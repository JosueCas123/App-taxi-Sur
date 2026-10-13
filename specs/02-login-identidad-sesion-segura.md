# SPEC 02 — Login, identidad y sesión segura

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-12
> **Objetivo:** Autenticar con teléfono y PIN contra el backend real, persistir solo el JWT en SecureStore, restaurar la sesión al iniciar y resolver la identidad y la ruta inicial del conductor a partir del perfil.

## Por qué existe esta spec

M00 entregó la base (rutas, UI, cliente HTTP, `SessionProvider` esqueleto). M01 implementa el primer flujo real de datos: login con teléfono/PIN, identidad del conductor a partir del JWT y restauración de sesión. El backend es la autoridad; la app solo muestra y solicita. El claim `conductorId` del JWT fue verificado contra el código real (`backend/src/modules/auth/auth.service.ts`); `sub` identifica al usuario, no al conductor.

Origen de los requisitos: `docs/implementacion-app/modulos/M01-ACCESO-Y-SESION.md`, `docs/implementacion-app/01-CONTRATOS-API.md`, `docs/implementacion-app/02-ARQUITECTURA.md` y `docs/implementacion-app/referencias/REVISION-ENDPOINTS.md`. Los HTML (`login.html`, `recuperar-pin.html`) se usan solo como referencia visual.

## Alcance

**Incluido:**

- Pantalla de login: teléfono (texto, 1–30 caracteres), PIN (texto `^\d{4,6}$`, ocultación con conmutador mostrar/ocultar, se preserva ceros iniciales), validación local, bloqueo de doble envío y mensaje de error genérico idéntico para credenciales incorrectas sin revelar si el teléfono existe.
- `POST /api/auth/conductor/login` con `{telefono,pin}`; guardar solo el JWT en SecureStore (clave `taxitur.session.token`); la sesión vive en memoria en `SessionProvider`.
- Decodificar el payload del JWT en cliente: `conductorId` (identidad del conductor) y `exp` (solo ayuda de UX; la verificación la hace el servidor). Si falta `conductorId`, mostrar sesión incompatible y solicitar nuevo login; `sub` nunca se usa como ID del conductor.
- `GET /api/conductores/:id` con `Authorization: Bearer` para confirmar identidad tras el login y tras restaurar la sesión.
- Restauración real al arrancar: sin token → `no_autenticado`; token con `exp` vencido → pedir login sin llamada; token vigente → consultar perfil.
- Protección de rutas, no solo redirección desde `index.tsx`: `SessionProvider` dispara la restauración una sola vez al montarse y los guards esperan su resultado; los grupos `(cuenta)` y `(operacion)` montan un guard de sesión en sus `_layout.tsx` (o en el layout raíz con segmentos) que redirige a `/login` cuando la sesión es `no_autenticado` o `sesion_incompatible`, y a `/sesion-sin-verificar` cuando es `sesion_sin_verificar` (conserva token, reintento posible); `(auth)` redirige a la ruta resuelta si ya hay sesión autenticada y es el único responsable de navegar tras el login. Una apertura directa de una ruta privada (deep link, restauración de estado de navegación) no puede saltarse la puerta ni depende de visitar `index.tsx`.
- Nuevo estado `sesion_sin_verificar`: token presente pero el perfil no pudo confirmarse por `RED`/`TIMEOUT` (y también cuando el login obtuvo el JWT y la consulta posterior del perfil falló por red). La app conserva el token, muestra pantalla de verificación con reintento manual, no entra a operación y no muestra "PIN incorrecto". El reintento vuelve a consultar el perfil con el mismo token.
- Distinguir 401 de `TIMEOUT`/`RED`: el 401 invalida la sesión, borra el token, cancela consultas en vuelo, limpia cachés privadas del conductor, expone un registro para que M05 cierre SSE y muestra un aviso de sesión vencida; el timeout o fallo de red conserva la sesión (`sesion_sin_verificar`) y muestra estado incierto con reintento manual. Se habilita volver a entrar y recuperar el servicio activo.
- Resolver 403 y 404 de `GET /api/conductores/:id` además del 401 (verificado en `conductores.controller.ts:40-64`): 404 = UUID inválido o conductor inexistente; 403 = el token pertenece a otro usuario (`conductor.usuarioId !== auth.userId`). Ambos indican un token incompatible: se borra el token para no repetir el mismo fallo en cada arranque y se solicita nuevo login con mensaje específico ("Tu sesión ya no es válida"), sin mostrar "PIN incorrecto" ni dejar la app en estado aparentemente autenticado.
- Resolución mínima de ruta por `estado` de cuenta en `src/navigation/resolve-route.ts`: `pendiente → /(cuenta)/revision`, `rechazado → /(cuenta)/rechazada`, `suspendido → /(cuenta)/suspendida`, `aprobado → /(operacion)/inicio` (stub de M03). La pantalla inicial redirige a la ruta resuelta cuando la sesión ya está autenticada y la app abrió en `/`; tras el login, la navegación la ejecuta el guard de `(auth)` (un solo responsable, sin `router.replace` duplicados).
- Pantalla `(auth)/recuperar-pin.tsx` con el diseño de `recuperar-pin.html`: texto de ayuda y, solo si hay contacto configurado, botón que abre `Linking` (`tel:`). Sin contacto, no se inventa número.
- `src/config/runtime.ts` y `.env.example` con `EXPO_PUBLIC_CONTACTO_AYUDA` (público, sin credenciales).
- Verificación con `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor` y búsqueda de credenciales/PIN en el código entregable.
- Pruebas unitarias de los comportamientos críticos de sesión con `jest-expo` (solo la lógica de M01: token-storage con SecureStore simulado, decodificación de JWT, máquina de estados de `SessionContext`, resolución de ruta y limpieza de caché). No se posponen a M09/M10 porque `tsc`/`lint`/`doctor` no comprueban esos comportamientos.

**Fuera de alcance (módulos siguientes):**

- Registro y estados de cuenta completos (M02).
- Jornada, disponibilidad e inicio operativo (M03); el destino `aprobado → inicio` apunta a su stub existente.
- Permisos y envío de ubicación (M04).
- SSE y su cierre ante 401 (M05); M01 solo expone el hook de invalidación.
- Ofertas, servicio y finalización (M06/M07).
- Perfil y cierre de sesión (M08).
- Conectividad global y accesibilidad (M09); la suite completa de pruebas de integración y pruebas en dispositivo (M10). M01 sí incorpora pruebas unitarias de la lógica de sesión (ver Alcance y Plan).
- Refresh token y logout remoto: no existen en el contrato actual.
- Modificar el backend, mocks, fixtures o adaptadores con datos falsos; usar WebView con los HTML.

## Modelo de datos

Estructuras introducidas por M01 sobre los tipos ya existentes:

```ts
// src/features/auth/token-storage.ts
const CLAVE_TOKEN = 'taxitur.session.token'; // SecureStore; solo el JWT, nunca el PIN
guardarToken(token: string): Promise<void>;
leerToken(): Promise<string | null>;
borrarToken(): Promise<void>;
```

```ts
// src/features/auth/api.ts (contrato 01-CONTRATOS-API.md)
type LoginResponse = { token: string; tokenType: string; expiresIn: number };
loginConductor(datos: { telefono: string; pin: string }): Promise<LoginResponse>; // POST /api/auth/conductor/login
type ConductorDetalleDto = {
  id: string; usuarioId: string; telefono: string; nombreCompleto: string;
  cedulaIdentidad: string; estado: 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido';
  estadoJornada: 'no_iniciada' | 'activa' | 'finalizada';
  estadoDisponibilidad: 'disponible' | 'no_disponible' | 'solicitud_pendiente' | 'en_servicio';
  cierreJornadaSolicitado: boolean; creadoEn: string;
  vehiculo: { id: string; placa: string; marca: string; modelo: string; color: string; capacidadPasajeros: number } | null;
};
obtenerConductor(conductorId: string, token: string): Promise<ConductorDetalleDto>; // GET /api/conductores/:id
```

```ts
// src/features/auth/jwt.ts
type PayloadJwt = { sub?: string; conductorId?: string; exp?: number };
decodificarPayloadJwt(token: string): PayloadJwt | null; // base64 del payload; sin verificar firma
```

```ts
// src/features/auth/session-context.tsx (sustituye el stub de M00)
type SessionStatus =
  | 'restaurando'          // gate inicial o reintento de verificación en curso
  | 'autenticado'          // token + perfil confirmado por la API
  | 'sesion_sin_verificar' // token presente; perfil no confirmado por RED/TIMEOUT (token conservado)
  | 'sesion_incompatible'  // token sin conductorId, o perfil con 403/404; token borrado
  | 'no_autenticado';      // sin token o sesión invalidada
type SessionContextValue = {
  status: SessionStatus;
  token: string | null;            // memoria; no se persiste en contexto
  conductorId: string | null;      // claim del JWT; null si falta
  conductor: ConductorDetalleDto | null;
  mensajeSesion: string | null;    // texto para sesion_incompatible ("Tu sesión ya no es válida", etc.)
  iniciarSesion: (telefono: string, pin: string) => Promise<void>;
  restaurarSesion: () => Promise<void>;   // también usado como reintento desde sesion_sin_verificar
  invalidarSesion: () => Promise<void>;   // borra token, cancela/limpiar queries, registra cierre SSE (M05)
};
// SessionProvider inicia `restaurarSesion` una sola vez al montarse (useEffect con guarda de ejecución);
// los guards esperan ese resultado y no dependen de que se visite `index.tsx`.
// Transiciones de perfil con token presente:
//   RED/TIMEOUT → sesion_sin_verificar (conservar token; reintento = restaurarSesion)
//   401         → invalidar + no_autenticado (token borrado; aviso de sesión vencida)
//   403 o 404   → invalidar + sesion_incompatible (token borrado; no repetir el fallo en cada arranque)
//   sin conductorId → invalidar + sesion_incompatible (token borrado)
```

```ts
// src/navigation/guard-sesion.tsx (protección de rutas)
// Componente que, según useSession(), redirige fuera del grupo si no corresponde:
//   - Rutas de (cuenta)/(operacion):
//       'no_autenticado' | 'sesion_incompatible' → router.replace('/login')
//       'sesion_sin_verificar'                   → router.replace('/sesion-sin-verificar')
//       'restaurando'                            → no navega; espera el resultado de restaurarSesion()
//     Se monta en los _layout.tsx de cada grupo.
//   - Rutas de (auth) (login/recuperar-pin): status === 'autenticado' → router.replace(rutaInicialPorEstado(...))
//     Es el ÚNICO responsable de navegar tras el login; la pantalla de login no llama a router.replace.
// Cubre apertura directa de ruta (deep link o estado de navegación), no solo la redirección desde index.tsx.
```

```ts
// src/navigation/resolve-route.ts
rutaInicialPorEstado(estado: ConductorDetalleDto['estado']): Href;
// pendiente → '/(cuenta)/revision'; rechazado → '/(cuenta)/rechazada';
// suspendido → '/(cuenta)/suspendida'; aprobado → '/(operacion)/inicio'
```

```ts
// src/config/runtime.ts (amplía M00)
export type RuntimeConfig = { apiUrl: string | null; contactoAyuda: string | null };
```

Convenciones: el JWT es la única persistencia; `conductor` y el resto de datos del servidor viven en TanStack Query bajo `queryKeys.conductor(conductorId)`. El PIN nunca se almacena, registra ni reutiliza.

## Plan de implementación

1. **Dependencias.** `npx expo install expo-secure-store` y `npx expo install jest-expo jest @types/jest` (dev). Verificar versión compatible con SDK 57 vía `expo-doctor`; configurar `jest` en `package.json` con preset `jest-expo` y `setupFiles` si hace falta. Verificación: `npx expo-doctor` sin errores nuevos.
2. **Almacenamiento seguro.** Crear `src/features/auth/token-storage.ts` con `guardarToken`/`leerToken`/`borrarToken` sobre SecureStore. Verificación: `tsc --noEmit` sin errores.
3. **API de autenticación y perfil.** Crear `src/features/auth/api.ts` (`loginConductor`, `obtenerConductor`) y `src/features/auth/jwt.ts` (`decodificarPayloadJwt`) usando el `api-client` de M00. Verificación: `tsc --noEmit`.
4. **Sesión real.** Reescribir `src/features/auth/session-context.tsx` con la máquina de estados del modelo: `iniciarSesion` (login → claim `conductorId` → si falta, `sesion_incompatible` con token borrado; si existe, guardar token y GET perfil → `autenticado`; si el perfil falla por `RED`/`TIMEOUT`, conservar token en `sesion_sin_verificar` — no mostrar "PIN incorrecto" ni entrar a operación). `restaurarSesion` (leer token → `exp` vencido → `no_autenticado` sin llamada → GET perfil; `RED`/`TIMEOUT` → `sesion_sin_verificar` conservando token; `401` → invalidar + `no_autenticado`; `403`/`404` → invalidar borrando token + `sesion_incompatible`). `invalidarSesion` (borrar token, `queryClient.cancelQueries` + `removeQueries` de claves del conductor, exponer registro para cierre SSE de M05). `restaurarSesion` sirve también como reintento desde `sesion_sin_verificar`. El `SessionProvider` dispara `restaurarSesion()` una sola vez al montarse (no desde `index.tsx`), de modo que una apertura directa a una ruta privada también restaura. Verificación: `tsc` sin errores; no se guarda el PIN en ningún sitio.
5. **Resolución de ruta.** Crear `src/navigation/resolve-route.ts` con `rutaInicialPorEstado`. Verificación: `tsc` sin errores.
6. **Protección de rutas.** Crear `src/navigation/guard-sesion.tsx` y montarlo en `src/app/(cuenta)/_layout.tsx` y `src/app/(operacion)/_layout.tsx` (`no_autenticado`/`sesion_incompatible` → `/login`; `sesion_sin_verificar` → `/sesion-sin-verificar`; `restaurando` no navega) y en `src/app/(auth)/_layout.tsx` (redirige a la ruta resuelta si `status === 'autenticado'`). Verificación: `tsc` sin errores; una apertura directa a `/perfil` sin sesión redirige a login.
7. **Pantalla de login.** Reemplazar el stub `src/app/(auth)/login.tsx` por la pantalla real según `login.html` y tokens M00: `Screen`, `TextField` (teléfono con teclado numérico; PIN con `secureTextEntry` y conmutador), `Button` con `loading`, `ErrorBanner` con mensaje genérico, validación local (teléfono no vacío ≤30; PIN `^\d{4,6}$`), bloqueo de doble envío y enlace a `/recuperar-pin`. Tras `iniciarSesion` la pantalla no navega: el guard de `(auth)` reacciona al pasar a `autenticado` y hace el único `router.replace`. Verificación: `tsc` y `lint` sin errores.
8. **Pantalla recuperar PIN.** Crear `src/app/(auth)/recuperar-pin.tsx` según `recuperar-pin.html`: texto de ayuda (contacto a administración, sin SMS ni reset) y botón de contacto con `Linking.openURL('tel:...')` solo si `runtimeConfig.contactoAyuda`; si no hay contacto, el botón no se renderiza. Sin llamadas a `GET /api/configuracion`. Ampliar `src/config/runtime.ts` y `.env.example` con `EXPO_PUBLIC_CONTACTO_AYUDA`. Verificación: `tsc` y `lint` sin errores.
9. **Puerta de arranque y pantalla sin verificar.** Actualizar `src/app/index.tsx`: mantener el gate `restaurando` y, cuando `status === 'autenticado'`, redirigir con `router.replace` a `rutaInicialPorEstado(conductor.estado)` (solo para el arranque en `/`). Crear la ruta `src/app/sesion-sin-verificar.tsx` para que la URL `/sesion-sin-verificar` exista (la vista puede vivir en `src/features/auth/screens/sesion-sin-verificar.tsx` y la ruta reexportarla): explica que no se pudo confirmar la sesión, ofrece reintento (`restaurarSesion`) y opción de salir (`invalidarSesion`). Verificación: `tsc` sin errores; `/sesion-sin-verificar` resuelve como ruta.
10. **Pruebas unitarias de sesión.** Crear `src/features/auth/__tests__/` con `jest-expo` y mocks de `expo-secure-store` y `fetch`: (a) token vencido (`exp` pasado) → `no_autenticado` sin llamada; (b) JWT sin `conductorId` → `sesion_incompatible` y token borrado; (c) pérdida de red en perfil → `sesion_sin_verificar` conservando token; (d) 401 → token borrado y caché del conductor limpia; (e) 403 y 404 → `sesion_incompatible` con token borrado; (f) cambio de conductor (login con token de otro id) → caché anterior invalidada; (g) `rutaInicialPorEstado` para los cuatro estados. Verificación: `npx jest src/features/auth` en verde.
11. **Verificación final.** Ejecutar `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor` y `npx jest src/features/auth`. Buscar en `src/`, `app.json` y `.env.example` rastros de PIN en logs, credenciales, `service_role`, `JWT_SECRET` o tokens de n8n. Revisar los criterios aplicables de A01 (`06-PRUEBAS-DE-ACEPTACION.md`). No compilar ni publicar.

## Criterios de aceptación

- [x] Login correcto conduce al flujo de cuenta según `estado`, nunca directamente a disponible.
- [x] Error de credenciales muestra un mensaje genérico ("Teléfono o PIN incorrecto") sin revelar si el teléfono existe.
- [x] Reinicio de la app restaura una sesión válida; un token vencido solicita login sin llamada al servidor.
- [x] Un timeout o fallo de red durante la verificación del perfil deja la sesión en `sesion_sin_verificar` con token conservado, pantalla de reintento y sin acceso a operación; el reintento con red restablecida entra a la ruta resuelta.
- [x] La URL `/sesion-sin-verificar` existe como ruta (`src/app/sesion-sin-verificar.tsx`); el guard de `(cuenta)`/`(operacion)` redirige allí cuando el estado es `sesion_sin_verificar`.
- [x] La restauración la inicia `SessionProvider` una sola vez al montarse; abrir directamente una ruta privada (sin pasar por `index.tsx`) restaura y respeta el guard.
- [x] Tras el login solo el guard de `(auth)` navega; no hay dos `router.replace` simultáneos entre la pantalla de login y el guard.
- [x] Un 401 en el perfil vuelve a `no_autenticado` con aviso de sesión vencida y limpia cachés privadas; un 403 o 404 deja `sesion_incompatible`, borra el token y muestra "Tu sesión ya no es válida" sin repetir el fallo en cada arranque.
- [x] Si el login entrega el JWT pero el perfil posterior falla por red, se conserva el token para reintentar; no se muestra "PIN incorrecto" ni se entra a operación.
- [x] Abrir directamente una ruta de `(operacion)` o `(cuenta)` sin sesión (deep link) redirige a login; abrir `login` con sesión autenticada redirige a la ruta resuelta.
- [x] Un JWT sin claim `conductorId` produce sesión incompatible con token borrado y solicita nuevo login; `sub` no se usa como ID del conductor.
- [x] La ayuda de PIN no llama al endpoint administrativo de resetear PIN ni a `GET /api/configuracion`; sin contacto configurado no se inventa un número.
- [x] Solo el JWT se persiste (SecureStore); el PIN no aparece en logs, caché ni almacenamiento.
- [x] Las pruebas unitarias de sesión cubren: token vencido, claim ausente, pérdida de red, 401, 403/404, cambio de conductor y limpieza de caché al invalidar; `npx jest src/features/auth` termina en verde.
- [x] `npx tsc --noEmit`, `npx expo lint` y `npx expo-doctor` terminan sin errores de bloqueo.
- [x] El paquete no contiene credenciales del backend, `JWT_SECRET`, token de n8n ni clave `service_role`.

## Evidencia de cierre (2026-10-13)

Los checks anteriores corresponden a revisión estática y pruebas automatizadas con dependencias nativas, router y servidor simulados, no a una certificación E2E en dispositivo.

| Verificación | Resultado |
|---|---|
| `npx jest src/features/auth --runInBand` | 8 suites, 63 pruebas aprobadas; sin fallos ni avisos de `act`. |
| `npx tsc --noEmit` | Código de salida 0. |
| `npx expo lint` | Sin errores ni advertencias. |
| `npx expo-doctor` | 21/21 comprobaciones aprobadas. |
| `git diff --check` | Sin errores de whitespace; solo avisos de conversión LF/CRLF de Git. |
| Revisión de `src/`, `app.json`, `.env.example` | Sin indicios de secretos reales, logs de PIN o persistencia del PIN; datos sintéticos únicamente en tests. No se generó un paquete binario. |

Evidencia por área en `src/features/auth/__tests__/`:

- `session-context.test.tsx`: restauración, expiración, claim ausente, errores de perfil, reintento, invalidación, cambio de conductor, limpieza y respuestas tardías; también error de lectura de SecureStore.
- `guard-sesion.test.tsx` y `resolve-route.test.ts`: protección de grupos, destinos por estado y único responsable de navegación tras login; revisión adicional de los layouts y la ruta de sesión sin verificar.
- `login-pantalla.test.tsx`: validación, credenciales genéricas, fallo de red diferenciado, bloqueo de doble envío, ceros iniciales, visibilidad del PIN y ausencia de navegación propia.
- `recuperar-pin.test.tsx` y `sesion-sin-verificar.test.tsx`: contacto opcional, reintento y salida.
- `jwt.test.ts` y `token-storage.test.ts`: payload y persistencia exclusiva del JWT.

Correcciones de cierre: referencias estáticas `process.env.EXPO_PUBLIC_*` para que Expo incorpore la configuración al bundle; error de lectura del almacén seguro sin bloqueo infinito del arranque; errores de conexión del login separados de credenciales; prioridad del error actual en el banner y bloqueo síncrono de doble envío.

**Límites:** no se ejecutó login contra backend real, reinicio físico de la app, deep links del sistema operativo ni comparación visual en dispositivo. Esas verificaciones manuales siguen pendientes para la integración/dispositivo (M10). No se compiló, publicó ni creó un commit. La búsqueda del documento externo `06-PRUEBAS-DE-ACEPTACION.md` no pudo completarse; no se declara validación adicional de A01 fuera de los criterios de este spec.

## Decisiones tomadas y descartadas

- **Sí:** `EXPO_PUBLIC_CONTACTO_AYUDA` como variable de entorno pública, coherente con `EXPO_PUBLIC_API_URL` de M00 y con "datos públicos de configuración de compilación" de `02-ARQUITECTURA.md`.
- **Sí:** pantalla dedicada `recuperar-pin.tsx` (la referencia HTML existe y M08 reutilizará la ayuda).
- **Sí:** validación de teléfono fiel al contrato (1–30 caracteres); se descarta el patrón boliviano del HTML (8 dígitos, 6/7) por ser más restrictivo que el backend y arriesgar rechazar teléfonos válidos.
- **Sí:** resolución mínima por `estado` de cuenta en M01; el resolve-route completo (jornada, SSE, ofertas, `en_servicio`) queda en M03/M05.
- **Sí:** estado `sesion_incompatible` reservado a "token sin conductorId o perfil 403/404" (se borra el token para no repetir el fallo en cada arranque); un 401 no es incompatible, sino sesión vencida: borra el token, vuelve a `no_autenticado` y muestra un aviso de sesión vencida.
- **Sí:** estado `sesion_sin_verificar` separado de `autenticado` y `no_autenticado`: conserva el token cuando la verificación falla por red/timeout, evitando tanto la pérdida injustificada de una sesión válida como el acceso a operación con identidad sin confirmar.
- **Sí:** protección de rutas con guard en los `_layout.tsx` de los grupos `(auth)`, `(cuenta)` y `(operacion)`, no solo una redirección desde `index.tsx`; así una apertura directa de una ruta privada no se salta la puerta.
- **Sí:** `SessionProvider` inicia la restauración una sola vez al montarse y los guards esperan ese resultado; una apertura directa a una ruta privada no depende de pasar por `index.tsx`.
- **Sí:** un único responsable de la navegación tras el login: el guard de `(auth)` reacciona al estado `autenticado`; la pantalla de login solo llama a `iniciarSesion` y no hace `router.replace`, evitando dos redirecciones simultáneas.
- **Sí:** la pantalla `sesion_sin_verificar` se expone como ruta real `src/app/sesion-sin-verificar.tsx` para que la URL a la que apunta el guard exista.
- **Sí:** tratar 403 y 404 del perfil como token incompatible (borrar y pedir login) en lugar de error genérico con sesión aparentemente autenticada; verificado contra `conductores.controller.ts:40-64`.
- **Sí:** decodificar `exp` localmente solo como ayuda de UX; la autoridad sigue siendo el 401 del servidor (decodificar no reemplaza la verificación del servidor).
- **Sí:** `jest-expo` con pruebas unitarias de los comportamientos críticos de sesión en M01 (token vencido, claim ausente, red, 401, 403/404, cambio de conductor, limpieza de caché); `tsc`/`lint`/`doctor` no comprueban esas transiciones. La suite de integración y pruebas en dispositivo sigue siendo M09/M10.
- **No:** refresh token ni logout remoto: no existen endpoints en el contrato; al expirar se requiere autenticación otra vez.
- **No:** depender del claim `rol` mencionado en el ROADMAP: no está en la firma actual del JWT (verificado en `auth.service.ts`).
- **No:** usar `sub` como `conductorId` ni adivinar un ID cuando el claim falta.
- **No:** posponer toda verificación de sesión a M09/M10: los casos críticos se prueban aquí con jest; lo que requiere dispositivo o backend completo queda en esos módulos.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `exp` decodificado en cliente no equivale a verificación server-side | Solo UX: si `exp` venció, pedir login sin llamada; el 401 del servidor sigue invalidando la sesión cuando corresponda. |
| `EXPO_PUBLIC_API_URL` local (`localhost`) no resuelve desde emulador o dispositivo físico | Documentado en `.env.example`: emulador Android usa `10.0.2.2`, dispositivo físico la IP LAN. Login manual pendiente hasta tener backend accesible. |
| 401/403/404 en el perfil tras restore (token revocado, cuenta borrada, token de otro usuario) | 401 invalida; 403/404 borran el token como incompatible; en todos se solicita login y no se queda la app en estado aparentemente autenticado. |
| Fallo de red tras login deja token sin perfil verificado | Estado explícito `sesion_sin_verificar`: conserva token, sin acceso a operación, reintento manual; no muestra error de credenciales. |
| Ruta privada abierta por deep link saltándose la redirección de `index.tsx` | Guard de sesión en los `_layout.tsx` de los grupos; toda entrada a `(cuenta)`/`(operacion)` pasa por el mismo check. |
| SecureStore no funciona en web | La app es móvil (Expo Go/Android/iOS); no se declara soporte web. |
| Cierre de SSE ante 401 (pendiente backend, M05) | M01 expone `invalidarSesion` con registro de listeners; M05 se suscribe sin tocar M01. |
| `jest-expo` puede requerir ajustes con SDK 57 / React 19 | Instalar versión resuelta por `expo install`; si bloquea, se documenta el impedimento en la evidencia de verificación sin ampliar alcance. |

## Lo que **no** está en esta spec

- Registro y estados de cuenta (M02).
- Jornada, disponibilidad y GPS (M03/M04).
- SSE, ofertas, servicio y finalización (M05–M07).
- Perfil y cierre de sesión (M08).
- Conectividad global y accesibilidad (M09); pruebas de integración con backend y en dispositivo (M10). Las pruebas unitarias de la lógica de sesión de M01 sí van aquí.
- Refresh, logout remoto, `/me` ni actualización de perfil: no existen en el contrato.

Cada uno, si procede, va en su propia spec.
