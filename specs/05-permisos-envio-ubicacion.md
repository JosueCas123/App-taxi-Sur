# SPEC 05 — Permisos y envío de ubicación

> **Estado:** Aprobado
> **Depende de:** SPEC 02, SPEC 03, SPEC 04
> **Fecha:** 2026-10-14
> **Objetivo:** Compartir posiciones recientes con el backend durante la jornada en primer plano, explicando al conductor por qué su ubicación no está operativa.

## Por qué existe esta spec

M01 aportó sesión y perfil, M02 el registro y los estados de cuenta, M03 la jornada y la disponibilidad dejando el contrato `UbicacionOperativaProvider` en `m04_pendiente`. M04 conecta la ubicación real: permiso con propósito, captura en primer plano, envío al contrato estricto y cálculo de frescura que M03 ya consume.

> **Correspondencia de nombres:** `M04` es el identificador del módulo en `docs/implementacion-app/modulos/M04-UBICACION.md`; este documento es su spec de implementación, `SPEC 05`. En el texto, "M04" designa el módulo (alcance funcional) y "SPEC 05" este archivo (contrato de implementación).

Fuentes de requisitos:

- `docs/implementacion-app/modulos/M04-UBICACION.md`.
- `docs/implementacion-app/01-CONTRATOS-API.md`.
- `docs/implementacion-app/02-ARQUITECTURA.md`.
- Referencias visuales `ubicacion.html` y `ubicacion-desactualizada.html` en `docs/implementacion-app/referencias-ui/`.

Los HTML son referencias visuales con simulaciones, no contratos ni pruebas de integración. Sus controles ("Permiso simulado", "Simular llegada de solicitud", "Simular pérdida de conexión") no se trasladan a la app entregable.

### Dependencias comprobadas

- SPEC 02/03 existen con código; SPEC 04 (`specs/04-jornada-disponibilidad.md`) está en estado `Aprobado` y su implementación está presente en el árbol de trabajo (rama `spec-04-jornada-disponibilidad`, cambios sin commitear).
- `src/features/shift/ubicacion-operativa.tsx` define `EstadoUbicacionOperativa` y `MotivoUbicacionNoLista`, con valor por defecto `{lista:false, motivo:'m04_pendiente', antiguedadMs:null}`; `use-shift.ts` lo consume y `jornada-policy.ts` aplica el umbral estricto `UBICACION_VIGENCIA_MS = 5 min`.
- `src/app/(operacion)/ubicacion.tsx` y `ubicacion-desactualizada.tsx` son stubs con el texto "(M03)".
- El contrato ya expone `POST /api/conductores/:id/ubicacion` con cuerpo `{latitud,longitud}` y respuesta `201 UbicacionDto`; puede devolver `CONDUCTOR_NO_APROBADO` (403). No se crean endpoints.
- `expo-location` **no está instalado**; en SDK 57 está incluido en Expo Go para primer plano (el segundo plano exige development build).
- M05 (SSE/solicitud-activa), M06, M07 y M08 no están implementados. M04 no los adelanta.
- La validación de M01–M04 contra backend real y dispositivo sigue pendiente.

## Alcance

**Incluido:**

- Instalar `expo-location` con `npx expo install` (resuelve la versión compatible con el SDK 57).
- Solicitar permiso de primer plano **cuando el conductor inicia el flujo de ubicación**, con explicación concreta (para qué se comparte) antes del diálogo del sistema.
- Distinguir y explicar: permiso denegado, permiso denegado permanente (sin posibilidad de volver a preguntar), GPS apagado, precisión insuficiente, error de red y posición obsoleta.
- `src/features/location/location-service.ts`: permiso, servicios activos, captura y clasificación de diagnóstico; `abrirAjustes()` como vía de recuperación.
- `src/features/location/api.ts`: `enviarUbicacion` con cuerpo estricto `{latitud,longitud}` (sin timestamp ni campos adicionales) sobre el `api-client` existente, sin reintento automático.
- `src/features/location/use-location-sharing.ts`: ciclo de observación en primer plano con intervalo objetivo configurable de **30 s**; evita envíos simultáneos; conserva en memoria la hora de captura local y la respuesta `{horaRegistro,esValida}`.
- Un `201` con `esValida:false` **no** declara GPS listo; tras reiniciar o volver de segundo plano se adquiere una muestra nueva (sin persistencia).
- `antiguedadMs` medido con un **reloj monotónico local** desde que se recibió la respuesta aceptada, de modo que no dependa del reloj absoluto del dispositivo ni del desfase con el servidor. `horaRegistro` se conserva como dato de la respuesta; si no es interpretable, la muestra **no** habilita disponibilidad (no se usa la hora de captura local para habilitarla).
- Temporizador de frescura: al **cumplir 5 minutos** desde la última muestra aceptada, el estado pasa a `desactualizada` **sin** esperar a que `watchPositionAsync` entregue otra muestra.
- Pausa al salir de primer plano (AppState) y reanudación al volver: se verifica permiso y servicios y se adquiere una **muestra nueva** antes de volver a considerar el GPS listo.
- Precedencia explícita de motivos cuando **no** hay muestra fresca: `permiso_denegado` > `gps_apagado` > `precision_insuficiente` > `desactualizada` > `error_red` > `sin_muestra`. Un error de red no revoca una muestra aceptada aún fresca (coherente con la política de M03).
- Proveedor real que alimenta el `EstadoUbicacionOperativa` de M03, sustituyendo el valor por defecto `m04_pendiente`.
- Pantallas: `ubicacion.tsx` (permiso + estados + compartir/detener) y una vista de "desactualizada" compartida, reutilizada por `ubicacion-desactualizada.tsx`.
- Ampliar `MotivoUbicacionNoLista` con `precision_insuficiente` y `error_red` y actualizar el mapa de textos de `UbicacionCard`.
- Detener observadores e intervalos al finalizar jornada o cerrar sesión; no reenviar posiciones antiguas tras reconexión.
- Pruebas automatizadas de servicio, API, hook, provider y pantallas.

**Fuera de alcance:**

- Segundo plano, pantalla bloqueada, tareas con `TaskManager`, `startLocationUpdatesAsync` o `requestBackgroundPermissionsAsync` (exigen development build). Se documentan como ampliación futura.
- Reenvío de muestras antiguas almacenadas offline; no hay cola ni persistencia de coordenadas.
- Mapas, geocodificación, SSE, ofertas, servicio activo y perfil.
- Cambios de backend, endpoints nuevos, refresh token o logout remoto.
- Mocks, interruptores de simulación o datos ficticios dentro del entregable (solo en pruebas automatizadas).
- Compilar, publicar o avanzar automáticamente de módulo.

## Modelo de datos

```ts
// src/features/location/api.ts
export type UbicacionDto = {
  id: string;           // string numérico del backend
  latitud: number;
  longitud: number;
  horaRegistro: string; // la define el servidor; la app no la envía
  esValida: boolean;
};

export function enviarUbicacion(
  conductorId: string,
  token: string,
  muestra: { latitud: number; longitud: number }
): Promise<UbicacionDto>;
// POST /api/conductores/:id/ubicacion  {latitud,longitud} estricto; Bearer; sin reintento.
// UbicacionDto es cuerpo directo, sin envoltorio data.
```

```ts
// src/features/location/location-service.ts
export const LOCATION_INTERVAL_MS = 30_000; // intervalo objetivo, decisión inicial
export const PRECISION_MAXIMA_M = 50;       // umbral de precisión suficiente (radio en metros)

export type MuestraCapturada = {
  latitud: number;
  longitud: number;
  capturadaEn: number;       // LocationObject.timestamp
  precisionM: number | null; // coords.accuracy (radio en metros; menor es mejor)
};

export type PermisoUbicacion =
  | 'concedido'
  | 'denegado'
  | 'denegado_permanente' // canAskAgain === false
  | 'no_solicitado';

export type DiagnosticoUbicacion = 'ok' | 'gps_apagado' | 'precision_insuficiente';

export function permisoConcedidoAsync(): Promise<PermisoUbicacion>; // getForegroundPermissionsAsync
export function solicitarPermisoAsync(): Promise<PermisoUbicacion>; // requestForegroundPermissionsAsync
export function tieneServiciosActivos(): Promise<boolean>;          // hasServicesEnabledAsync
export function capturarMuestraAsync(): Promise<MuestraCapturada | null>; // getCurrentPositionAsync
export function clasificarMuestra(muestra: MuestraCapturada): DiagnosticoUbicacion;
export function abrirAjustes(): void;                               // Linking.openSettings()
```

```ts
// src/features/shift/ubicacion-operativa.tsx  (ampliación mínima del contrato de M03)
export type MotivoUbicacionNoLista =
  | 'm04_pendiente'
  | 'permiso_denegado'
  | 'gps_apagado'
  | 'precision_insuficiente'
  | 'error_red'
  | 'sin_muestra'
  | 'desactualizada';
// `UbicacionCard` añade textos para precision_insuficiente y error_red.
```

```ts
// src/features/location/use-location-sharing.ts
export type EstadoComparticion = {
  estado: EstadoUbicacionOperativa; // { lista, motivo, antiguedadMs } de M03
  compartiendo: boolean;
  permiso: PermisoUbicacion;
  esValidaUltima: boolean;          // esValida de la última respuesta recibida
  iniciando: boolean;
  error: string | null;             // error de red al enviar (recuperable)
  iniciar: () => void;              // solicita permiso y arranca el ciclo
  detener: () => void;              // limpia observador/intervalo
  reintentar: () => void;
};
```

```ts
// src/features/location/location-sharing-provider.tsx
export function LocationSharingProvider(props: { children: ReactNode }): JSX.Element;
export function useLocationSharing(): EstadoComparticion;
// `UbicacionOperativaPuente` lee useLocationSharing().estado y lo inyecta en
// <UbicacionOperativaProvider valor={estado}> para que `use-shift` lo consuma.
// La app entregable usa este puente real; los tests siguen inyectando un doble
// directamente en `UbicacionOperativaProvider valor`.
```

```ts
// Frescura independiente del reloj del dispositivo (todo en memoria):
// - `anclaMonotonica` se fija con un reloj monotónico local en el instante en que
//   llega una respuesta con esValida:true (no se usa el valor absoluto de horaRegistro).
// - antiguedadMs = ahoraMonotonico() - anclaMonotonica  (NO Date.now() - horaRegistro),
//   por lo que un reloj del dispositivo desfasado no altera la edad calculada.
// - `horaRegistro` se conserva como dato del servidor; si no es interpretable,
//   la muestra NO habilita disponibilidad y NO se recurre a la hora de captura local.
// - Un temporizador dispara al cumplir UBICACION_VIGENCIA_MS (5 min) y marca
//   `desactualizada` aunque watchPositionAsync no entregue otra muestra.
// - Al volver de segundo plano se descarta el ancla y se exige una muestra nueva.
```

Convenciones: la última muestra aceptada (`anclaMonotonica`, `horaRegistro` y `esValida`) vive **solo en memoria** y se descarta al reiniciar, al detener y al volver de segundo plano; no se persiste ninguna coordenada. `lista` solo es verdadero con una muestra aceptada por el servidor (`esValida:true`), con `horaRegistro` interpretable y antigüedad estricta **< 5 min** (ya aplicado por `esUbicacionOperativaLista` de M03); al **cumplir 5 minutos** pasa a `desactualizada`. Cuando **no** hay muestra fresca, el motivo se deriva por prioridad: `permiso_denegado` > `gps_apagado` > `precision_insuficiente` > `desactualizada` > `error_red` > `sin_muestra`. Un error de red **no** revoca una muestra aceptada que siga con antigüedad < 5 min: mientras lo esté, `lista` permanece verdadero y `error_red` no se muestra como motivo. El estado remoto sigue en TanStack Query; el `api-client` no reintenta mutaciones.

## Archivos previstos

**Crear:**

- `src/features/location/api.ts`.
- `src/features/location/location-service.ts`.
- `src/features/location/use-location-sharing.ts`.
- `src/features/location/location-sharing-provider.tsx`.
- `src/features/location/screens/ubicacion.tsx`.
- `src/features/location/screens/ubicacion-desactualizada.tsx`.
- `src/features/location/components/*` (vista de estado "desactualizada" compartida).
- `src/features/location/__tests__/` (servicio, API, hook, provider/puente y pantallas).

**Modificar:**

- `package.json` y `package-lock.json` por la dependencia `expo-location` (`expo install`).
- `src/app/(operacion)/_layout.tsx`: montar `LocationSharingProvider` + puente y los providers de M03.
- `src/app/(operacion)/ubicacion.tsx` y `ubicacion-desactualizada.tsx`: reexportar las pantallas reales.
- `src/features/shift/ubicacion-operativa.tsx`: ampliar `MotivoUbicacionNoLista` y ajustar el comentario de `valor` (pasa a ser el punto de integración real; los tests siguen inyectando dobles).
- `src/features/shift/components/UbicacionCard.tsx`: textos para los motivos nuevos.
- `app.json`: si el permiso iOS necesita descripción propia, configurar el plugin `expo-location` (`locationWhenInUsePermission`) sin activar background.

Las vistas compartidas permanecen fuera de `src/app/`. No se duplican DTOs, cliente HTTP ni almacenamiento de sesión.

## Plan de implementación

1. **Confirmar base y contratos.** Ejecutar la suite existente como línea base. Contrastar el contrato con el backend si su código está disponible; si no, documentar la imposibilidad sin inventar reglas. Consultar la documentación del SDK Expo 57 instalado y Context7 antes de tocar APIs de Expo/React Native. Instalar `expo-location` con `npx expo install` y validar con `expo-doctor`. Deja el proyecto ejecutable.
2. **Ampliar el contrato de motivos.** Añadir `precision_insuficiente` y `error_red` a `MotivoUbicacionNoLista`, actualizar el mapa de textos de `UbicacionCard` y ajustar sus pruebas; verificar la regresión de M03 en verde.
3. **Servicio de ubicación.** Crear `location-service.ts` (`permisoConcedidoAsync`, `solicitarPermisoAsync`, `tieneServiciosActivos`, `capturarMuestraAsync`, `clasificarMuestra`, `abrirAjustes`) y probarlo con un doble de `expo-location`.
4. **API de envío.** Crear `location/api.ts` sobre el `api-client` existente, sin Bearer duplicado ni reintentos. Probar método, ruta, cuerpo exacto `{latitud,longitud}` (sin timestamp), `Authorization` y ausencia de reintento.
5. **Hook de compartición.** Crear `use-location-sharing.ts`: arranque por acción explícita, `watchPositionAsync` en primer plano con intervalo objetivo 30 s, un solo envío en vuelo (sin solapes), manejo de `esValida:false`, ancla monotónica de frescura, **temporizador que marca `desactualizada` al cumplir 5 min aunque no llegue otra muestra**, precedencia de motivos y pausa/reanudación por `AppState` (al volver se verifica permiso y servicios y se exige una muestra nueva). Parada al detener, finalizar jornada o cerrar sesión. Probar con temporizadores falsos, dobles y descarte de respuestas tardías.
6. **Provider y puente.** Crear `LocationSharingProvider` + `UbicacionOperativaPuente` y montarlos en `(operacion)/_layout.tsx` para inyectar el estado real en `UbicacionOperativaProvider`. Probar por componente que `useShift` recibe el estado real y que el doble sigue disponible en tests.
7. **Pantallas.** `ubicacion.tsx` con explicación previa, permiso, estados (denegado/ajustes/reintentar, GPS apagado, precisión insuficiente, error de red, obsoleta) y botón de compartir/detener; vista desactualizada compartida reutilizada por `ubicacion-desactualizada.tsx`. Probar textos y acciones.
8. **Verificación final.** Ejecutar la suite, `tsc`, `expo lint`, `expo-doctor` y `git diff --check`; revisar que no hay mocks ni coordenadas ficticias en el código entregable ni secretos introducidos; registrar evidencia y dejar sin marcar los criterios que exigen dispositivo o backend real. No compilar, publicar ni avanzar de módulo.

Cada incremento incluye sus pruebas aplicables y deja el proyecto ejecutable.

## Criterios de aceptación

### Verificables en esta entrega

- [x] `expo-location` queda instalado en la versión del SDK 57 y `expo-doctor` no reporta problemas.
- [x] Con permiso concedido, antes de solicitar disponibilidad se envía una ubicación y la respuesta `esValida:true` con `horaRegistro` interpretable y antigüedad estricta < 5 min deja la ubicación operativa lista.
- [x] El cuerpo enviado es exactamente `{latitud,longitud}`; no incluye timestamp ni campos adicionales.
- [x] El permiso se solicita tras una explicación concreta, no antes.
- [x] Un permiso denegado permanente conserva una vía para abrir ajustes y reintentar.
- [x] Se distinguen permiso denegado, GPS apagado, precisión insuficiente, error de red y posición obsoleta con motivos distintos, aplicando la precedencia documentada.
- [x] Un `201` con `esValida:false` no declara GPS listo (`lista` sigue `false`).
- [x] Una respuesta con `horaRegistro` no interpretable no habilita disponibilidad; no se recurre a la hora de captura local.
- [x] Tras reiniciar o volver de segundo plano sin muestra, se adquiere una muestra nueva; no se reutiliza la anterior.
- [x] Al **cumplir 5 minutos** sin envío confirmado el estado pasa a `desactualizada`, incluso si `watchPositionAsync` no entrega otra muestra (temporizador de frescura); no se inventa un cambio del servidor.
- [x] Un error de red con una muestra aceptada aún fresca (< 5 min) no revoca la disponibilidad ni muestra `error_red` como motivo; solo actúa como motivo cuando no hay muestra fresca.
- [x] Una antigüedad calculada es inmune al desfase del reloj del dispositivo (medida con reloj monotónico), y `Date.now() - horaRegistro` no se usa para habilitar disponibilidad.
- [x] Al pasar la app a segundo plano el observador y el intervalo se pausan; al volver se verifican permiso y servicios y no se declara GPS listo sin una muestra nueva.
- [x] No hay envíos simultáneos; el intervalo de 30 s no solapa peticiones.
- [x] La mutación de envío no se reintenta automáticamente y un timeout no se trata como éxito.
- [x] Un viaje offline no genera una cola de coordenadas antiguas al reconectar.
- [x] Al finalizar jornada o cerrar sesión no quedan observadores ni intervalos activos.
- [x] La app entregable no contiene mocks, simuladores ni coordenadas ficticias.
- [x] Las pruebas nuevas y la regresión de M03 terminan en verde.
- [x] TypeScript, lint y expo-doctor no reportan errores de bloqueo.

### Pendientes de integración, no acreditables en M04 aislado

- [ ] Contra un backend real autorizado, `POST /ubicacion` devuelve `201 UbicacionDto` con `esValida` y `horaRegistro` reales; registrar entorno y fecha sin token como evidencia de integración.
- [ ] En dispositivo se comprueban permiso real, GPS apagado/encendido, precisión, navegación y área segura.
- [ ] Segundo plano y pantalla bloqueada (development build) quedan como ampliación verificable futura; no se promete seguimiento ni recepción de ofertas con la app cerrada.

### Comandos de verificación

- `npx jest src/features/location --runInBand`
- `npx jest --runInBand`
- `npx tsc --noEmit`
- `npx expo lint`
- `npx expo-doctor`
- `git diff --check`

## Decisiones tomadas y descartadas

- **Sí:** `antiguedadMs` medido con un **reloj monotónico local** anclado al momento de recibir la respuesta aceptada, no `Date.now() - horaRegistro`. Decisión derivada de la revisión; elimina la dependencia del reloj absoluto del dispositivo y su desfase con el servidor.
- **Sí:** si `horaRegistro` no es interpretable, la muestra **no** habilita disponibilidad y **no** se recurre a la hora de captura local. Decisión derivada de la revisión; el backend es autoridad y no se habilita GPS con una aceptación no verificable.
- **Sí:** temporizador de frescura que marca `desactualizada` al **cumplir 5 minutos** sin nuevas muestras, aunque `watchPositionAsync` no entregue otra lectura. Decisión derivada de la revisión; evita que el estado quede en `lista:true` por falta de actualizaciones.
- **Sí:** umbral unificado: lista con antigüedad estricta **< 5 min**; **a los 5 minutos** queda desactualizada. Decisión derivada de la revisión; coincide con `esUbicacionOperativaLista` de M03.
- **Sí:** un error de red no revoca una muestra aceptada aún fresca; `error_red` solo es motivo cuando no hay muestra fresca. Decisión derivada de la revisión; coincide con la política de M03 (`lista` + `antiguedadMs`).
- **Sí:** pausa del ciclo al pasar a segundo plano (AppState) y reanudación con verificación de permiso/servicios y muestra nueva antes de declarar GPS listo. Decisión derivada de la revisión y de la tarea 6 del módulo.
- **Sí:** arranque del envío por acción explícita en la pantalla de ubicación, continuando mientras la jornada esté activa y la sesión válida. Decisión confirmada por el usuario.
- **Sí:** ampliar `MotivoUbicacionNoLista` con `precision_insuficiente` y `error_red`. Decisión confirmada por el usuario; satisface la tarea 1 del módulo sin ambigüedad.
- **Sí:** vista desactualizada compartida, inline en `ubicacion.tsx` y reutilizada por `ubicacion-desactualizada.tsx`. Decisión confirmada por el usuario; evita duplicar UI.
- **Sí:** `LOCATION_INTERVAL_MS = 30000` como constante exportada. Decisión confirmada por el usuario; no amplía `runtime.ts`.
- **Sí:** `PRECISION_MAXIMA_M = 50` como umbral inicial configurable. No existe regla de backend; es un criterio de app documentado y ajustable.
- **Sí:** `use-location-sharing` conserva `horaRegistro/esValida` en memoria; sin persistencia. Evita colas de coordenadas antiguas.
- **Sí:** primer plano con `watchPositionAsync`; background/`TaskManager` fuera de alcance. Coherente con `02-ARQUITECTURA.md` y el SDK 57.
- **Sí:** inyectar el estado real en `UbicacionOperativaProvider` mediante un puente; `valor` pasa a ser el punto de integración real y los tests siguen inyectando dobles.
- **Sí:** distinguir errores de red del envío (recuperable, con reintento manual) de la falta de muestra; no se reintenta automáticamente.
- **No:** persistir coordenadas, reenviar muestras offline, simular GPS en el entregable ni crear endpoints.
- **No:** activar permisos de background; un intervalo exacto en segundo plano no está garantizado por el sistema operativo.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Desfase o ajuste del reloj del dispositivo | `antiguedadMs` desde un reloj monotónico anclado al recibir la respuesta; el valor absoluto de `horaRegistro` no interviene y `Date.now() - horaRegistro` no se usa. |
| `watchPositionAsync` no respeta el intervalo exacto | Intervalo objetivo con guarda de un único envío en vuelo; no se promete cadencia exacta. |
| Dejan de llegar actualizaciones y el estado se queda en `lista:true` | Temporizador de frescura que marca `desactualizada` al cumplir 5 min sin nueva muestra. |
| Permiso "Allow Once" en iOS revocado al cerrar la app | Detectar permiso no concedido al reanudar y ofrecer reintentar/ajustes; no asumir concesión previa. |
| Confundir primer plano con segundo plano | Pausar el ciclo con `AppState` al pasar a segundo plano y exigir muestra nueva al volver; `TaskManager`/dev build queda como ampliación. |
| Colección de suscripciones al desmontar | Parada explícita al finalizar jornada, cerrar sesión y desmontar; pruebas de limpieza. |
| La app parece terminada sin backend real | Separar criterios locales e integrados; dejar sin marcar los que exigen dispositivo/API. |
| `horaRegistro` no interpretable | Validar el parseo; si falla, la muestra no habilita disponibilidad y no se usa la captura local. |

## Lo que **no** está en esta spec

- Segundo plano, pantalla bloqueada y `TaskManager`.
- SSE, ofertas, servicio activo, perfil y mapas.
- Cola offline de ubicaciones.
- Mocks, interruptores de simulación o datos ficticios en el entregable.
- Cambios de backend o endpoints nuevos.
- Compilar, publicar o avanzar automáticamente de módulo.

## Evidencia de verificación

- **Fecha:** 2026-10-14.
- **Entorno:** rama `spec-05-permisos-envio-ubicacion`; `app-taxi` 1.0.0; Expo SDK `~57.0.29`, React Native 0.86.3, React 19.2.3, `expo-location` `~57.0.21`; gestor de paquetes npm (`package-lock.json`, sin `bun.lock`).
- **Comandos ejecutados (npm / npx):**
  - `npx jest src/features/location --runInBand` → 6 suites, 51/51 pruebas en verde.
  - `npx jest --runInBand` → 28 suites, 296/296 pruebas en verde (incluye la regresión de SPEC 02/03/04).
  - `npx tsc --noEmit` → exit 0, sin errores.
  - `npx expo lint` → exit 0, sin errores (0 problemas).
  - `npx expo-doctor` → 21/21 comprobaciones, sin problemas.
  - `git diff --check` → exit 0 (solo avisos de fin de línea LF/CRLF, sin errores de whitespace).
- **Revisión del entregable:** búsqueda estática en `src/` (excluyendo `__tests__`/`*.test.ts*`) sin coincidencias reales de `mock`/`simul`/`fake`/`dummy`/`fixture`/`Math.random` (los aciertos de `simul` son la palabra "simultáneos/as" en comentarios, y `localhost` aparece solo en un comentario de diagnóstico de `api-client.ts`). No hay coordenadas literales: `latitud`/`longitud` solo aparecen como nombres de campo y se alimentan desde `expo-location`. Sin persistencia de coordenadas ni cola offline. No se incorporan secretos, tokens ni credenciales; `EXPO_PUBLIC_API_URL` es una variable pública. El proveedor entregable monta `LocationSharingProvider` + `UbicacionOperativaPuente` en `(operacion)/_layout.tsx`; no hay interruptores de simulación.
- **Fuentes consultadas:** documentación oficial del SDK Expo 57 (`https://docs.expo.dev/versions/v57.0.0/`) y Context7 para `expo-location`; contratos del proyecto `docs/implementacion-app/01-CONTRATOS-API.md` y `docs/implementacion-app/modulos/M04-UBICACION.md`. Los pasos 7/8 no introdujeron APIs nuevas de Expo/React Native.
- **Plataformas:** toda la evidencia automática corresponde a pruebas Jest (entorno Node con `jest-expo`) y revisión estática de TypeScript. No se ejecutó en Android ni iOS y no se dispone de capturas de dispositivo; los criterios que exigen dispositivo o API real se mantienen sin marcar.

| Criterio | Resultado | Plataforma | Evidencia | Pendiente o bloqueo |
| --- | --- | --- | --- | --- |
| `expo-location` instalado en la versión del SDK 57 y `expo-doctor` sin problemas | Verificado | Node | `package.json` `expo-location ~57.0.21`; `npx expo-doctor` 21/21; plugin `expo-location` en `app.json` con `locationWhenInUsePermission` | — |
| Con permiso concedido se envía una ubicación y `esValida:true` + `horaRegistro` interpretable + antigüedad < 5 min deja lista | Verificado | Jest | `use-location-sharing.test.tsx` "arranca el ciclo, envía la muestra y queda lista con esValida:true"; `location-sharing-provider.test.tsx` "refleja una ubicación lista del hook con su antigüedad" | — |
| Cuerpo exactamente `{latitud,longitud}`; sin timestamp ni campos adicionales | Verificado | Jest | `api.test.ts` "hace POST a /api/conductores/:id/ubicacion con {latitud,longitud} y Bearer, sin timestamp" y "envía el cuerpo estricto descartando cualquier campo adicional de la muestra" | — |
| El permiso se solicita tras una explicación concreta, no antes | Verificado | Jest | `ubicacion-screen.test.tsx` "muestra el propósito y no solicita el permiso hasta pulsar la acción" | — |
| Permiso denegado permanente conserva abrir ajustes y reintentar | Verificado | Jest | `ubicacion-screen.test.tsx` "permiso denegado permanente conserva abrir ajustes y reintentar"; `location-service.test.ts` "devuelve denegado_permanente…" y "abre los ajustes del sistema" | — |
| Se distinguen permiso denegado, GPS apagado, precisión insuficiente, error de red y obsoleta, con precedencia | Verificado | Jest | `use-location-sharing.test.tsx` motivos: "permiso denegado se distingue y no envía", "GPS apagado…", "precisión insuficiente no envía ni declara listo", "error de red sin muestra fresca…", "un permiso denegado tiene prioridad sobre GPS apagado"; `ubicacion-screen.test.tsx` bloque "motivos" | — |
| Un `201` con `esValida:false` no declara GPS listo | Verificado | Jest | `use-location-sharing.test.tsx` "un 201 con esValida:false no declara GPS listo" | — |
| `horaRegistro` no interpretable no habilita; no se usa la hora de captura local | Verificado | Jest | `use-location-sharing.test.tsx` "una horaRegistro no interpretable no habilita disponibilidad" | — |
| Tras reiniciar o volver de segundo plano sin muestra, se adquiere una muestra nueva | Verificado | Jest | `use-location-sharing.test.tsx` "al pasar a segundo plano descarta el ancla; al volver exige una muestra nueva"; el ancla vive solo en memoria (`use-location-sharing.ts`), no se persiste | — |
| Al cumplir 5 minutos el estado pasa a `desactualizada` vía temporizador, sin nueva muestra | Verificado | Jest | `use-location-sharing.test.tsx` "al cumplir 5 minutos sin nueva muestra pasa a desactualizada" | — |
| Error de red con muestra fresca (< 5 min) no revoca la disponibilidad ni muestra `error_red` | Verificado | Jest | `use-location-sharing.test.tsx` "un error de red con muestra fresca no revoca la disponibilidad ni muestra error_red" | — |
| Antigüedad inmune al desfase del reloj (monotónica); `Date.now() - horaRegistro` no habilita | Verificado | Jest | `use-location-sharing.test.tsx` "la antigüedad es inmune al valor absoluto de horaRegistro (reloj monotónico)"; `ahoraMonotonico()` en `use-location-sharing.ts` | — |
| Segundo plano pausa observador e intervalo; al volver verifica permiso/servicios y exige muestra nueva | Verificado | Jest | `use-location-sharing.test.tsx` "al pasar a segundo plano descarta el ancla; al volver exige una muestra nueva" (`AppState` + `permisoConcedidoAsync`/`iniciarCiclo`) | — |
| No hay envíos simultáneos; el intervalo de 30 s no solapa peticiones | Verificado | Jest | `use-location-sharing.test.tsx` "no solapa envíos: una sola petición en vuelo"; `location-service.test.ts` "define el intervalo objetivo y el umbral de precisión" (`LOCATION_INTERVAL_MS = 30_000`) | — |
| La mutación no se reintenta automáticamente y un timeout no se trata como éxito | Verificado | Jest / Revisión estática | `api.test.ts` "un fallo de red se propaga como RED sin reintentar automáticamente" (una sola llamada a `fetch`); `api-client.ts` aborta por timeout y lanza `TIMEOUT` (nunca resuelve como éxito) | — |
| Un viaje offline no genera una cola de coordenadas antiguas al reconectar | Verificado | Revisión estática | Sin persistencia ni cola: el estado (ancla, `horaRegistro`) vive solo en memoria en `use-location-sharing.ts`; `enviarUbicacion` no reintenta ni almacena | — |
| Al finalizar jornada o cerrar sesión no quedan observadores ni intervalos activos | Verificado | Jest | `use-location-sharing.test.tsx` "finalizar la jornada detiene el ciclo", "cerrar sesión detiene el ciclo", "detener limpia la suscripción y el estado", "desmontar limpia la suscripción" | — |
| La app entregable no contiene mocks, simuladores ni coordenadas ficticias | Verificado | Revisión estática | Búsqueda en `src/` sin `mock`/`simul`/`fake`/`dummy`/`fixture`/`Math.random` en código no de prueba; sin coordenadas literales; sin interruptores de simulación | — |
| Las pruebas nuevas y la regresión de M03 terminan en verde | Verificado | Jest | `npx jest --runInBand` → 28 suites, 296/296 pruebas | — |
| TypeScript, lint y expo-doctor no reportan errores de bloqueo | Verificado | Node | `npx tsc --noEmit` exit 0; `npx expo lint` exit 0; `npx expo-doctor` 21/21; `git diff --check` exit 0 | — |
| Contra backend real, `POST /ubicacion` devuelve `201 UbicacionDto` con `esValida`/`horaRegistro` reales | Bloqueado | — | No ejecutado: los dobles de Jest no certifican integración real | Requiere autorización del entorno y datos de prueba |
| En dispositivo se comprueban permiso real, GPS apagado/encendido, precisión, navegación y área segura | Bloqueado | Android / iOS | Sin dispositivo ni capturas; no se dispone de evidencia visual | Ejecutar la app en dispositivo (o emulador) y registrar capturas |
| Segundo plano y pantalla bloqueada (development build) como ampliación futura | Bloqueado | — | Fuera de alcance; no se promete seguimiento ni ofertas con la app cerrada | Requiere development build y `TaskManager` |
