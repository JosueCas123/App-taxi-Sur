# SPEC 08 — Servicio activo y finalización

> **Estado:** Aprobado
> **Depende de:** SPEC 02, SPEC 04, SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-10-23
> **Objetivo:** Finalizar el servicio en curso solo con confirmación del backend, reconciliando respuestas inciertas sin inventar un éxito offline.

## Por qué existe esta spec

M07 del plan (`docs/implementacion-app/modulos/M07-SERVICIO-Y-FINALIZACION.md`). SPEC 07 (M06) ya decide la navegación hacia `en-servicio` y `servicio-finalizado`, pero ambas rutas siguen siendo stubs. Aquí se montan las pantallas reales, la confirmación de finalización y la recuperación cuando la respuesta de red no permite saber si el backend completó la operación.

> **Correspondencia de nombres:** `M07` es el identificador del módulo en `docs/implementacion-app/modulos/M07-SERVICIO-Y-FINALIZACION.md`; este documento es su spec de implementación, `SPEC 08`. Igual que en SPEC 05/06/07, "M07" designa el alcance funcional y "SPEC 08" este archivo (contrato de implementación).

Fuentes de requisitos:

- `docs/implementacion-app/modulos/M07-SERVICIO-Y-FINALIZACION.md`.
- `docs/implementacion-app/01-CONTRATOS-API.md` y `02-ARQUITECTURA.md`.
- `docs/implementacion-app/05-PENDIENTES-BACKEND.md`.
- Referencias visuales `en-servicio.html` y `servicio-finalizado.html` en `docs/implementacion-app/referencias-ui/` (solo diseño).

Los HTML son referencias visuales con simulaciones, no contratos ni pruebas de integración. Sus controles de demostración, datos ficticios ("María Vargas", "Plaza de San Miguel", "TS-0248") y la acción "Terminar jornada después" no se trasladan a la app entregable.

### Dependencias comprobadas

- `docs/implementacion-app/` existe en este workspace: se contrastaron `modulos/M07-SERVICIO-Y-FINALIZACION.md`, `01-CONTRATOS-API.md`, `02-ARQUITECTURA.md`, `05-PENDIENTES-BACKEND.md` y las referencias UI citadas.
- Código de M03/M04/M05/M06 presente; SPEC 07 está marcada como **Implementado** y deja `en-servicio` y `servicio-finalizado` como stub.
- `useDriverEventsContext()` expone `solicitudActiva`, `servicioConfirmado`, `reconciliar()`, `ofertaDescartadaId` y `descartarOfertaVencida()`.
- `src/navigation/resolve-route.ts` ya resuelve un servicio propio `en_servicio` a `/(operacion)/en-servicio`; no conoce un resultado confirmado ni una verificación pendiente.
- `evaluarAccesoOperativo()` solo permite continuidad a cuentas restringidas cuando existe un `ServicioConfirmado` propio `en_servicio`.
- `src/navigation/guard-sesion.tsx` espera `reconciliacionInicial === 'completa'` antes de decidir; no evalúa con datos incompletos.
- `recuperarInstantaneaOperativa()` pide perfil y `solicitud-activa` en paralelo, pero `reconciliar()` no publica el perfil leído en la caché de TanStack Query. `useSession().conductor` puede quedar obsoleto tras finalizar.
- `src/features/requests/api.ts` ya tiene `obtenerSolicitudActiva()` y `obtenerSolicitud()`; no tiene `finalizarSolicitud()`. El hook recibe `obtenerSolicitud` como `obtenerDetalle`.
- `src/features/requests/reconcile.ts` ya deriva `servicioConfirmado` solo para `en_servicio` propio.
- `src/lib/api-client.ts` aplica Bearer, timeout de 15 s y **no reintenta mutaciones**. Los errores se clasifican por `code`/`status`/`backendCode`, nunca por el texto de `message`.
- `src/features/auth/session-context.tsx` expone `token`, `conductor`, `conductorId` e `invalidarSesion()`.
- `ConfirmDialog`, `Button`, `Screen`, `Card`, `StateBadge`, `ErrorBanner` y `LoadingState` existen en `src/ui/`.
- `runtimeConfig.contactoAyuda` es la fuente configurada para un teléfono de ayuda; `recuperar-pin.tsx` ya usa `Linking.openURL('tel:...')`.
- `expo` SDK `~57.0.30`, React Native 0.86.3, React 19.2.3; gestor npm. No se instala ninguna dependencia nueva.
- Contratos reales (`01-CONTRATOS-API.md` y código del backend):
  - `GET /api/conductores/:id/solicitud-activa` → `SolicitudDetalleDto | null`. Solo devuelve una solicitud `esperando_respuesta` o `en_servicio`; una solicitud `finalizada` nunca aparece allí.
  - `GET /api/solicitudes/:id` → `SolicitudDetalleDto` si corresponde al conductor; 403/404 si no puede consultarse.
  - `POST /api/solicitudes/:id/finalizar` acepta `{}` o ausencia de cuerpo; 200 `SolicitudDto` (sin `pasajero`), 403 si no es el conductor asignado, 404 si no existe y 409 `ESTADO_INVALIDO` si no está `en_servicio`.
  - Repetir una finalización no es idempotente por contrato: puede devolver 409 y **no** demuestra éxito.
  - Al finalizar, el backend deja la solicitud `finalizada`, libera disponibilidad y, si `cierreJornadaSolicitado` estaba activo, deja `estadoJornada = finalizada`, `estadoDisponibilidad = no_disponible` y limpia el flag.
  - La finalización no exige que la cuenta siga aprobada; el conductor asignado puede finalizar un servicio existente tras una suspensión.
  - `SolicitudDetalleDto` incluye `pasajero {id,nombre}`, recogida, coordenadas, destino nullable y `conductorAsignado` nullable. **No hay teléfono del pasajero**.
  - `null` en `solicitud-activa` significa ausencia de solicitud activa, no prueba de que una finalización previa terminó correctamente.

## Alcance

**Incluido:**

- `EnServicioScreen` real: estado "En servicio", UUID real abreviado solo en UI, nombre del pasajero, punto de recogida (respaldo: coordenadas) y destino nullable. Nunca muestra el teléfono del pasajero ni datos de demostración.
- Confirmación explícita antes de finalizar. `POST /api/solicitudes/:id/finalizar` sin cuerpo; no se envían pago, ubicación, calificación ni campos inventados.
- Bloqueo síncrono de doble pulsación: una única finalización en vuelo.
- Éxito solo si la respuesta es `estado = finalizada` con `id` igual al UUID intentado y `conductorAsignadoId` igual al conductor autenticado, o si el detalle consultado por UUID cumple esas mismas condiciones y confirma `finalizada`. Una respuesta o detalle de otra solicitud o de otro conductor nunca confirma éxito.
- Tras el éxito: marcar el servicio como finalizado, mostrar `ServicioFinalizadoScreen` y refrescar perfil + solicitud activa con `reconciliar()`. La pantalla de éxito no espera a que termine el refresco para mostrarse. "Volver a mi jornada" reconcilia antes de limpiar `servicioFinalizadoId`; si la lectura falla, la pantalla conserva el resultado confirmado y no navega con un perfil viejo.
- Resultado incierto (timeout, red, 409, 5xx o respuesta inesperada): consultar primero el detalle con `GET /api/solicitudes/:id` y después refrescar perfil + `solicitud-activa` con `reconciliar()`. El hook recibe `obtenerDetalle(solicitudId, token)` para esa consulta; `reconciliar()` no obtiene el detalle por UUID.
- Si el detalle propio dice `en_servicio`: limpiar la verificación pendiente y permitir reintentar finalizar manualmente. No se reintenta el POST automáticamente.
- Si el detalle propio dice `finalizada`: confirmar el éxito aunque la respuesta original se haya perdido.
- Si el detalle devuelve 403/404, falla la red, no permite verificar o corresponde a otro UUID/conductor: mostrar estado no verificable, conservar el UUID conocido y ofrecer solo "Volver a verificar" y el canal de ayuda configurado. No se declara éxito offline ni se repite el POST a ciegas.
- Validación de identidad de la respuesta: `resolverResultadoFinalizacion()` exige `id === solicitudId` y `conductorAsignadoId === conductorId` tanto en la respuesta del POST como en el detalle. Un estado `finalizada` de otra solicitud no es éxito.
- Aviso de cierre diferido: si `cierreJornadaSolicitado` es true, informar que la jornada se cerrará al finalizar el servicio, sin acción adicional.
- Aviso de suspensión: permitir finalizar y verificar el servicio existente, sin habilitar nueva jornada ni disponibilidad.
- Extensión de `useDriverEvents` con `servicioFinalizadoId` y `servicioEnVerificacionId`, incluyendo limpieza por sesión y reconciliación.
- Extensión de `resolverRutaOperativa` y `evaluarAccesoOperativo` para rutas de éxito/verificación, manteniendo la compatibilidad de las llamadas existentes.
- Extensión de `reconciliar()` para publicar el conductor leído en `queryKeys.conductor(id)`, sin una consulta adicional y sin llamar a `actualizarPerfil()`.
- Pruebas automatizadas de contrato API, resolución pura, hook, flags, navegación, guard y pantallas.

**Fuera de alcance:**

- M08: perfil, logout, ayuda autenticada vía `telefonoCentroAtencion`, cambio de PIN y cierre de jornada desde otras pantallas.
- Acción "Terminar jornada después" y cualquier `PATCH /conductores/:id/jornada` desde `en-servicio`.
- Chat, llamada al pasajero, mapa, navegación turn-by-turn, calificación, pago, recibo o historial.
- Push, segundo plano, cola offline, persistencia de éxito/verificación entre reinicios o reintento automático de la finalización.
- Endpoints nuevos, cambios de backend, Supabase/`service_role` o `EventSource` alternativo.
- Mocks, interruptores de simulación, datos ficticios o importar la demo HTML en un WebView.
- Compilar, publicar o avanzar automáticamente de módulo.

## Modelo de datos

```ts
// src/features/requests/api.ts  (añadido)
// POST /api/solicitudes/:id/finalizar, Bearer, sin cuerpo.
// El backend acepta {} o ausencia de cuerpo; no se envía Content-Type.
export function finalizarSolicitud(
  solicitudId: string,
  token: string
): Promise<SolicitudDto>;
```

```ts
// src/features/service/finalizacion.ts
export type ResultadoFinalizacion =
  | { tipo: 'confirmada' }
  | { tipo: 'sigue_en_servicio' }
  | { tipo: 'no_verificable' };

// Solo presentación: primeros 8 caracteres + "…" + últimos 4.
// Un valor corto se devuelve sin recortar. El UUID completo se conserva para la API.
export function abreviarUuid(uuid: string): string;

// Precedencia (solo cuentan respuestas del servicio propio):
// 1. respuesta con id === solicitudId, conductorAsignadoId === conductorId y
//    estado === 'finalizada' → confirmada.
// 2. detalle con id === solicitudId, conductorAsignadoId === conductorId y
//    estado === 'finalizada' → confirmada.
// 3. detalle propio con estado === 'en_servicio' → sigue_en_servicio.
// 4. detalle null, ajeno, de otro id o cualquier otro estado → no_verificable.
// Una respuesta o detalle con UUID o conductor distinto se descarta por completo:
// nunca confirma la finalización de otra solicitud.
export function resolverResultadoFinalizacion(entrada: {
  solicitudId: string;
  conductorId: string;
  respuesta: SolicitudDto | null;
  detalle: SolicitudDetalleDto | null;
}): ResultadoFinalizacion;
```

```ts
// src/features/service/use-finalizar-servicio.ts
export type FaseFinalizacion =
  | 'en_servicio'
  | 'finalizando'
  | 'verificando'
  | 'sigue_en_servicio'
  | 'no_verificable'
  | 'confirmada';

export type UseFinalizarServicioResult = {
  fase: FaseFinalizacion;
  finalizando: boolean; // fase === 'finalizando'
  verificando: boolean; // fase === 'verificando'
  finalizar: () => void; // permitido en en_servicio y sigue_en_servicio
  reintentarVerificacion: () => void; // permitido en no_verificable
};

export function useFinalizarServicio(entrada: {
  solicitudId: string | null;
  token: string | null;
  conductorId: string | null;
  // Inyectado desde requests/api.ts (obtenerSolicitud). Se usa para consultar
  // el detalle por UUID cuando el resultado de la finalización es incierto.
  obtenerDetalle: (solicitudId: string, token: string) => Promise<SolicitudDetalleDto>;
  reconciliar: () => Promise<void>;
  marcarServicioFinalizado: (solicitudId: string) => void;
  marcarServicioEnVerificacion: (solicitudId: string) => void;
  limpiarServicioEnVerificacion: () => void;
  invalidarSesion: () => Promise<void>;
}): UseFinalizarServicioResult;
```

Orden de verificación de `useFinalizarServicio` ante un resultado incierto:

1. `obtenerDetalle(solicitudId, token)` (consulta puntual por UUID).
2. `resolverResultadoFinalizacion({ solicitudId, conductorId, respuesta, detalle })`.
3. `await reconciliar()` para refrescar perfil y solicitud activa.

`reconciliar()` no sustituye la consulta por UUID. El fallo de `reconciliar()` no revierte un resultado ya decidido por el detalle propio; solo impide refrescar perfil y `solicitud-activa`. Un detalle con otro UUID u otro conductor es `no_verificable`.

El hook no navega. `ServicioFinalizadoScreen` toma `reconciliar` y `limpiarServicioFinalizado` de `useDriverEvents()` para implementar "Volver a mi jornada" en el orden reconciliar → limpiar flag → navegar.

```ts
// src/features/events/use-driver-events.ts  (añadido al resultado)
// Servicio cuya finalización fue confirmada por el backend. En memoria, por
// sesión/conductor. Se conserva mientras solicitudActiva sea null o el mismo id;
// se limpia si aparece una solicitud activa distinta, al cambiar de sesión, al
// invalidar la sesión o al pulsar "Volver a mi jornada" con reconciliación exitosa.
servicioFinalizadoId: string | null;
// Servicio cuya finalización está pendiente de verificación. Se conserva
// mientras solicitudActiva sea null o el mismo id; se limpia cuando el detalle
// confirma finalización o en_servicio, cuando aparece otra solicitud activa, o
// al cambiar/invalidar la sesión.
servicioEnVerificacionId: string | null;
marcarServicioFinalizado: (solicitudId: string) => void;
limpiarServicioFinalizado: () => void;
marcarServicioEnVerificacion: (solicitudId: string) => void;
limpiarServicioEnVerificacion: () => void;
```

Convenciones de los flags:

- `marcarServicioFinalizado(id)` también limpia `servicioEnVerificacionId` si coincide con ese id.
- `marcarServicioEnVerificacion(id)` no hace nada si ese id ya está confirmado como finalizado.
- Un `reconciliar()` exitoso publica `instantanea.conductor` en `queryKeys.conductor(conductorIdActual)` después de validar la generación de sesión. Así `useSession().conductor` refleja el cierre diferido y la disponibilidad sin una segunda consulta.
- `reconciliar()` conserva ambos flags si `solicitudActiva` es `null` o el mismo id. Solo los limpia cuando la solicitud activa tiene otro id. Un fallo de reconciliación no limpia flags.
- Si se pierde la conexión o la app vuelve a primer plano, se reconcilia; no se borran los flags por el solo hecho de que `solicitud-activa` sea `null`.
- "Volver a mi jornada" primero `await reconciliar()` y solo si esa lectura termina bien ejecuta `limpiarServicioFinalizado()` y navega a `/(operacion)/inicio`. Si `reconciliar()` falla, la pantalla permanece con el éxito confirmado, conserva el flag y muestra el error; no navega con un perfil viejo.
- Los flags viven solo en memoria; no se persisten entre reinicios.

```ts
// src/navigation/resolve-route.ts  (ampliación compatible)
export type OpcionesFinalizacion = {
  servicioFinalizadoId?: string | null;
  servicioEnVerificacionId?: string | null;
};

// `continuidadFinalizacion` = hay verificación pendiente o éxito confirmado.
// Una cuenta restringida solo recibe `solo_finalizar` si además tiene un
// servicio propio `en_servicio` o continuidad de finalización.
export function evaluarAccesoOperativo(
  estadoCuenta: ConductorDetalleDto['estado'] | null | undefined,
  conductorId: string | null,
  servicio: ServicioConfirmado | null,
  continuidadFinalizacion?: boolean
): AccesoOperativo;

export function resolverRutaOperativa(
  estado: EstadoOperativoConfirmado,
  ahoraServidorMs?: number,
  ofertaDescartadaId?: string | null,
  finalizacion?: OpcionesFinalizacion
): Href;
```

Orden de resolución, con los flags recibidos:

1. `servicioEnVerificacionId !== null` → `/(operacion)/en-servicio`.
2. Solicitud propia `en_servicio` cuyo id sea distinto de `servicioFinalizadoId` → `/(operacion)/en-servicio`.
3. Oferta propia `esperando_respuesta` de una cuenta aprobada → lógica vigente de SPEC 07 (`solicitud-entrante` o `solicitud-expirada`; `ofertaDescartadaId` se conserva).
4. `servicioFinalizadoId !== null` → `/(operacion)/servicio-finalizado`.
5. Cuenta restringida → ruta de cuenta.
6. `/(operacion)/inicio`.

La misma solicitud `en_servicio` que ya fue confirmada como finalizada se trata como ausente para evitar un rebote a la pantalla de servicio. Un servicio nuevo u oferta distinta gana sobre el éxito anterior; la reconciliación limpia el flag viejo.

## Archivos previstos

**Crear:**

- `src/features/service/finalizacion.ts`.
- `src/features/service/use-finalizar-servicio.ts`.
- `src/features/service/screens/EnServicioScreen.tsx`.
- `src/features/service/screens/ServicioFinalizadoScreen.tsx`.
- `src/features/service/__tests__/finalizacion.test.ts`.
- `src/features/service/__tests__/use-finalizar-servicio.test.tsx`.
- `src/features/service/__tests__/EnServicioScreen.test.tsx`.
- `src/features/service/__tests__/ServicioFinalizadoScreen.test.tsx`.

**Modificar:**

- `src/features/requests/api.ts`: `finalizarSolicitud()`.
- `src/features/events/use-driver-events.ts`: flags, acciones, limpieza por generación y publicación del perfil en caché.
- `src/navigation/resolve-route.ts`: `OpcionesFinalizacion`, ruta de éxito/verificación y extensión de acceso.
- `src/navigation/guard-sesion.tsx`: pasar flags a resolver y acceso.
- `src/app/(operacion)/en-servicio.tsx` y `servicio-finalizado.tsx`: reexportar las pantallas reales.
- `src/features/requests/__tests__/api.test.ts`: contrato de finalización.
- `src/features/events/__tests__/use-driver-events.test.tsx`: flags, caché y limpieza; envolver `renderHook` en `QueryClientProvider`.
- `src/features/auth/__tests__/resolve-route.test.ts`: prioridades de finalización.
- `src/navigation/__tests__/politica-acceso.test.ts`: continuidad de acceso.
- `src/features/auth/__tests__/guard-sesion.test.tsx`: suspensión, éxito y verificación pendiente.
- Fixtures de `UseDriverEventsResult` en `src/features/events/__tests__/estado-conexion-banner.test.tsx`, `src/features/requests/__tests__/IncomingRequestScreen.test.tsx` y `src/features/requests/__tests__/ExpiredRequestScreen.test.tsx`.
- Cualquier fixture adicional de `UseDriverEventsResult` que TypeScript detecte al ampliar el tipo.

Las vistas compartidas permanecen fuera de `src/app/`. No se duplican DTOs, cliente HTTP, sesión ni almacenamiento. No se modifica el backend.

## Plan de implementación

1. **Base y contratos.** Ejecutar la suite como línea base; contrastar `POST /finalizar` con el backend real si está disponible y con `01-CONTRATOS-API.md`. Consultar la documentación del SDK Expo 57 y Context7 antes de tocar APIs de React Native. Deja el proyecto ejecutable.
2. **API de finalización.** Añadir `finalizarSolicitud()` en `requests/api.ts` con `POST`, Bearer y sin cuerpo; probar método, ruta, ausencia de `cuerpo`/`Content-Type`, timeout y ausencia de reintento. Deja el proyecto ejecutable.
3. **Resolución pura y UUID.** Crear `finalizacion.ts` con `abreviarUuid()` y `resolverResultadoFinalizacion()`; exigir coincidencia de `id` y `conductorAsignadoId` en respuesta y detalle; probar éxito propio por respuesta, éxito propio por detalle, respuesta/detalle de otro UUID o conductor, `en_servicio` propio, 403/404/red simulados como `null`, estado inesperado, UUID corto y conservación del UUID completo para la API.
4. **Flags y caché del perfil.** Ampliar `use-driver-events` con los dos ids y sus acciones; publicar el conductor leído en `queryKeys.conductor(id)`; limpiar por sesión, generación y solicitud activa distinta. Probar que un `null` o el mismo id conserva el flag, que otro id lo limpia y que la caché del perfil se actualiza. Ajustar los tests del hook para `QueryClientProvider`.
5. **Navegación y guard.** Añadir `OpcionesFinalizacion`, la prioridad de rutas y `continuidadFinalizacion` en el acceso; conectar el guard. Probar éxito, verificación pendiente, mismo UUID, servicio/oferta nuevos, cuenta suspendida con éxito y cuenta suspendida sin servicio.
6. **Hook de finalización.** Crear `use-finalizar-servicio` con bloqueo síncrono, confirmación externa, `obtenerDetalle(solicitudId, token)` inyectado, orden detalle → `reconciliar()` y las fases definidas. Exigir UUID y conductor propios antes de aceptar éxito. En 409/timeout/5xx/red no asumir éxito; en detalle propio `en_servicio` limpiar la verificación y permitir reintento; en 403/404/red o identidad ajena conservar el estado no verificable; en 401 delegar a `invalidarSesion()`. Probar doble pulsación, éxito propio, respuesta/detalle ajenos, timeout tras commit, 409, no verificable y cambio de sesión.
7. **Pantallas y rutas.** Implementar `EnServicioScreen` (datos, UUID abreviado, confirmación, avisos de suspensión/cierre, estados de finalización/verificación/no verificable y ayuda) y `ServicioFinalizadoScreen` (éxito confirmado, cierre de jornada reflejado y "Volver a mi jornada" que reconcilia antes de limpiar el flag; si falla, conserva el éxito y muestra el error); reexportar ambas rutas. Probar textos, nulls honestos, bloqueo de acciones, orden de "Volver", navegación y ausencia de datos ficticios.
8. **Verificación final.** Ejecutar suite, `tsc`, `expo lint`, `expo-doctor` y `git diff --check`; revisar que no hay mocks, datos de demostración, teléfono de pasajero, secretos ni endpoints inventados. Registrar evidencia y dejar sin marcar los criterios que exigen dispositivo o backend real. No compilar, publicar ni avanzar de módulo.

Cada incremento incluye sus pruebas aplicables y deja el proyecto ejecutable.

## Criterios de aceptación

### Verificables en esta entrega

- [x] `EnServicioScreen` muestra el UUID real abreviado como `8 caracteres…últimos 4`; la API recibe el UUID completo.
- [x] La pantalla muestra pasajero, recogida y destino del detalle activo; usa coordenadas y "Destino no indicado" cuando faltan datos, y nunca muestra teléfono del pasajero.
- [x] Finalizar exige confirmación explícita y envía `POST /api/solicitudes/:id/finalizar` sin cuerpo.
- [x] Una doble pulsación de finalizar produce una única petición en vuelo.
- [x] Un 200 propio con `id` y `conductorAsignadoId` del conductor autenticado y `estado = finalizada` muestra la pantalla de éxito con el UUID abreviado.
- [x] Un detalle posterior propio (mismo UUID y mismo conductor) `finalizada` también muestra éxito si la respuesta original se perdió.
- [x] Una respuesta o un detalle con otro UUID u otro conductor nunca se interpreta como éxito ni confirma otra solicitud.
- [x] Un 409, timeout, error de red o respuesta inesperada nunca se interpretan por sí solos como éxito.
- [x] Ante un resultado incierto, la verificación consulta primero el detalle por UUID y después `reconciliar()` para refrescar perfil y solicitud activa.
- [x] Si el detalle propio dice `en_servicio`, se limpia la verificación pendiente y se habilita un reintento manual de finalización.
- [x] Si el detalle devuelve 403/404, falla la red, no permite confirmar o no corresponde al UUID/conductor, se muestra el estado no verificable, se conserva el UUID y solo se ofrece "Volver a verificar" y ayuda si hay contacto configurado.
- [x] En estado no verificable no se repite el POST automáticamente ni se muestra un éxito offline.
- [x] Repetir una finalización que devuelve 409 no se muestra como éxito; se verifica el detalle.
- [x] "Volver a mi jornada" espera la reconciliación; si falla, la pantalla conserva el éxito confirmado, el flag y muestra el error sin navegar.
- [x] Tras un éxito confirmado, `reconciliar()` actualiza el perfil en la caché y refleja `cierreJornadaSolicitado` consumido.
- [x] Si el cierre era diferido, el perfil refleja `estadoJornada = finalizada`, `estadoDisponibilidad = no_disponible` y `cierreJornadaSolicitado = false`.
- [x] La pantalla de éxito no depende de que el refresco de perfil termine para mostrarse.
- [x] Una cuenta suspendida con servicio existente puede abrir `en-servicio`, finalizar y ver el resultado; no se habilita nueva jornada ni disponibilidad.
- [x] Una cuenta suspendida sin servicio no puede entrar a rutas operativas.
- [x] Al reiniciar la app durante un servicio, `solicitud-activa` recupera el mismo UUID y la pantalla de servicio se muestra antes de aplicar un bloqueo general.
- [x] El guard no permite volver a inicio o pestañas mientras haya servicio activo, éxito confirmado o verificación pendiente sin resolver.
- [x] Una oferta o servicio nuevo y distinto limpia el éxito/verificación anterior y toma la ruta que corresponde.
- [x] `reconciliar()` conserva el éxito si `solicitud-activa` devuelve `null` o el mismo UUID, y lo limpia si devuelve otro id.
- [x] No hay mocks, simuladores, datos ficticios, "Terminar jornada después", teléfono de pasajero, secretos ni endpoints inventados en el entregable.
- [x] Las pruebas nuevas y la regresión de SPEC 02–07 terminan en verde.
- [x] TypeScript, lint y expo-doctor no reportan errores de bloqueo.

### Evidencia de verificación (2026-10-27)

- `npx jest src/features/service --runInBand` → **4 suites, 52 pruebas en verde**.
- `npx jest --runInBand` → **45 suites, 534 pruebas en verde** (sin snapshots).
- `npx tsc --noEmit` → sin errores.
- `npx expo lint` → sin errores ni avisos.
- `npx expo-doctor` → **21/21 checks passed. No issues detected!**
- `git diff --check` → sin errores de espacios en blanco (solo avisos LF→CRLF de `core.autocrlf` en Windows).
- Revisión del entregable: sin `Simular`/`María Vargas`/`Plaza de San Miguel`/datos ficticios ni secretos; la única mención de "teléfono del pasajero" es el aviso de privacidad.
- Mapeo de criterios → pruebas: `EnServicioScreen.test.tsx`, `ServicioFinalizadoScreen.test.tsx`, `use-finalizar-servicio.test.tsx`, `finalizacion.test.ts`, `use-driver-events.test.tsx`, `resolve-route.test.ts`, `guard-sesion.test.tsx`, `politica-acceso.test.ts`, `requests/api.test.ts`, `operacion-layout.test.tsx`.

### Pendientes de integración, no acreditables solo con pruebas unitarias

- [ ] En dispositivo Android/iOS con backend real: finalización, timeout después de un commit y verificación por UUID.
- [ ] En dispositivo con backend real: 409 por finalización repetida y recuperación sin segundo POST ciego.
- [ ] En dispositivo con backend real: suspensión durante un servicio y finalización posterior.
- [ ] En dispositivo con backend real: cierre diferido reflejado como jornada finalizada/no disponible.
- [ ] En dispositivo con backend real: reinicio de la app durante un servicio y recuperación del mismo UUID.

### Comandos de verificación

- `npx jest src/features/service --runInBand`.
- `npx jest --runInBand`.
- `npx tsc --noEmit`.
- `npx expo lint`.
- `npx expo-doctor`.
- `git diff --check`.

## Decisiones tomadas y descartadas

- **Sí:** el éxito se sostiene con `servicioFinalizadoId` en `useDriverEvents`, integrado a `resolverRutaOperativa` y al guard, porque `solicitud-activa` deja de devolver el servicio finalizado. Decisión confirmada por el usuario.
- **Sí:** el UUID se abrevia solo para presentación con primeros 8 + `…` + últimos 4; la API siempre usa el UUID completo. Decisión confirmada por el usuario.
- **Sí:** un resultado incierto se resuelve consultando el detalle por UUID y la solicitud activa; si el detalle dice `en_servicio`, se permite reintentar finalizar; si da 403/404 o falla la red, solo se verifica y se ofrece ayuda. Decisión confirmada por el usuario.
- **Sí:** el hook recibe `obtenerDetalle(solicitudId, token)` y consulta el detalle antes de `reconciliar()`, porque `reconciliar()` solo refresca perfil y `solicitud-activa` y no recupera un UUID finalizado. Decisión confirmada por el usuario.
- **Sí:** para declarar éxito, tanto la respuesta como el detalle deben tener el mismo `id` intentado y `conductorAsignadoId` del conductor autenticado; una respuesta ajena no confirma nada. Decisión confirmada por el usuario.
- **Sí:** "Volver a mi jornada" reconcilia primero y solo limpia `servicioFinalizadoId` si la lectura termina bien; si falla, mantiene el resultado confirmado y no navega con un perfil viejo. Decisión confirmada por el usuario.
- **Sí:** refrescar el perfil con `reconciliar()` en una sola pasada, no con `actualizarPerfil()` separado. Se extiende `reconciliar()` para publicar el conductor en `queryKeys.conductor(id)`, de modo que la caché observada por `useSession()` quede actualizada. Decisión confirmada por el usuario.
- **Sí:** `servicioEnVerificacionId` mantiene al conductor en `en-servicio` cuando una lectura devuelve `null`, para que el guard no lo expulse antes de mostrar el estado no verificable.
- **Sí:** el éxito se conserva mientras `solicitud-activa` devuelva `null` o el mismo id; solo una solicitud distinta lo limpia. Esto evita que una lectura tardía del mismo servicio rebote la pantalla de éxito.
- **Sí:** una oferta o servicio nuevo tiene prioridad sobre un éxito anterior; la reconciliación limpia el flag viejo.
- **Sí:** no se incluye "Terminar jornada después" en `en-servicio`; solo un aviso informativo si `cierreJornadaSolicitado`. Decisión confirmada por el usuario.
- **Sí:** una cuenta suspendida puede finalizar el servicio existente, con banner y sin habilitar nueva jornada/disponibilidad. Decisión confirmada por el usuario.
- **Sí:** la finalización se envía sin cuerpo; el backend acepta `{}` o ausencia de cuerpo. No se envían campos de pago, ubicación ni calificación. Decisión confirmada por el usuario.
- **Sí:** el guard debe permitir renderizar `en-servicio` y `servicio-finalizado` a cuentas restringidas cuando hay continuidad de finalización; la pantalla de cuenta sigue aplicando cuando no hay servicio.
- **Sí:** un 401 no se interpreta como éxito; se delega a `invalidarSesion()` y no se sigue verificando con un token vencido.
- **No:** éxito offline, optimista o derivado de `solicitud-activa = null`.
- **No:** repetir el POST automáticamente tras timeout, 409, 5xx o error de red.
- **No:** persistir el éxito o la verificación entre reinicios; M07 los mantiene en memoria.
- **No:** polling continuo del detalle. La verificación es una consulta puntual y un reintento manual.
- **No:** endpoint nuevo, cambio de backend, dependencia nueva, Supabase/`service_role` o WebView con la demo.
- **No:** mostrar u obtener el teléfono del pasajero; el DTO no lo trae.
- **No:** interpretar `message` del backend; se usan `code`, `status` y `backendCode`.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Una lectura tardía de `solicitud-activa` sigue devolviendo el mismo servicio `en_servicio` después de un éxito confirmado | El flag de éxito ignora `null` y el mismo UUID mientras está visible. Al volver, se reconcilia y el estado del servidor manda; un 409 se verifica y nunca se declara éxito sin confirmación. |
| El refresco de perfil falla después de un éxito confirmado | La pantalla de éxito no se bloquea. El perfil se refresca en el siguiente primer plano o al pulsar "Volver"; no se inventa un estado de jornada. |
| El estado no verificable queda sin `solicitud-activa` y el guard intenta expulsar al conductor | `servicioEnVerificacionId` mantiene la ruta `en-servicio` mientras el detalle no confirme; el estado se conserva aunque la solicitud activa sea `null`. |
| El detalle devuelve 403/404 de forma permanente | Se muestra el estado no verificable y el canal de ayuda configurado; no se repite el POST ni se simula éxito. |
| La respuesta o el detalle pertenecen a otro UUID u otro conductor | `resolverResultadoFinalizacion()` descarta cualquier coincidencia incompleta; solo un servicio propio puede confirmar éxito. |
| "Volver a mi jornada" navega con un perfil viejo porque la reconciliación falló | La pantalla espera la lectura, conserva el flag y el éxito, y muestra el error sin navegar. |
| Doble pulsación o reintento mientras hay una petición en vuelo | Bloqueo síncrono de una única petición; las acciones se deshabilitan durante `finalizando`/`verificando`. |
| Llega una oferta o un servicio nuevo mientras se muestra el éxito o se verifica el anterior | `reconciliar()` limpia el flag anterior cuando la solicitud activa tiene otro id; el resolver prioriza la oferta/servicio nuevo. |
| Carrera entre lecturas de perfil de distinta generación de sesión | `reconciliar()` valida la generación antes de publicar el perfil y los flags; una respuesta vieja no sobrescribe la sesión actual. |

## Lo que **no** está en esta spec

- M08: perfil, logout, ayuda autenticada, cambio de PIN y cierre de jornada desde otras pantallas.
- "Terminar jornada después", chat, llamada, mapa, navegación, tarifa, calificación, pago, recibo o historial.
- Push, segundo plano, cola offline, persistencia de éxito/verificación entre reinicios o reintento automático de la finalización.
- Endpoints nuevos, cambios de backend, Supabase/`service_role` o un WebView con la demo.
- Mocks, simuladores o datos ficticios en el entregable.
- Compilar, publicar o avanzar automáticamente de módulo.

Cada uno de esos puntos, si llega, va en su propia spec.
