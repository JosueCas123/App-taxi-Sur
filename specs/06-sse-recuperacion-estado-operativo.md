# SPEC 06 — SSE y recuperación del estado operativo

> **Estado:** Aprobado
> **Depende de:** SPEC 02, SPEC 03, SPEC 04, SPEC 05
> **Fecha:** 2026-10-15
> **Objetivo:** Mantener una única conexión de eventos autenticada y reconciliar el estado operativo real (perfil y solicitud activa) para resolver la pantalla correcta sin depender de eventos perdidos.

## Por qué existe esta spec

SPEC 04 (M03) dejó el perfil, la jornada y la disponibilidad, con la costura `ReconciliacionOfertaProvider` no-op y el guard operativo con `servicioConfirmado = null`. SPEC 05 (M04) conectó la ubicación real. Falta el canal que descubre la oferta sin conocer el UUID de antemano y que recupera el estado tras reinicio, reconexión o evento perdido.

> **Correspondencia de nombres:** `M05` es el módulo en `docs/implementacion-app/modulos/M05-EVENTOS-Y-RECUPERACION.md`; este documento es `SPEC 06`. `M06`/`M07` designan módulos del plan, no specs numeradas.

Fuentes de requisitos:

- `docs/implementacion-app/modulos/M05-EVENTOS-Y-RECUPERACION.md`.
- `docs/implementacion-app/01-CONTRATOS-API.md` y `02-ARQUITECTURA.md`.
- `docs/implementacion-app/05-PENDIENTES-BACKEND.md`.
- Referencias visuales `inicio.html`, `solicitud-entrante.html`, `en-servicio.html` en `docs/implementacion-app/referencias-ui/` (solo diseño; su `connection-banner` inspira el indicador de conexión).

Los HTML son referencias visuales con simulaciones, no contratos ni pruebas de integración. Sus controles ("Simular llegada de solicitud", "Simular pérdida de conexión") no se trasladan a la app entregable.

### Dependencias comprobadas

- SPEC 02 (`session-context`): `registrarAlInvalidar(listener)`, generación de sesión (`operacionRef`), `limpiarCachesConductor` (cancela `conductor` y `solicitudActiva`) y `actualizarPerfil`.
- SPEC 03/04: `api-client` con Bearer/abort/timeout (lecturas con reintento limitado, mutaciones sin reintento), `queryKeys.conductor/solicitudActiva/solicitud`, `ReconciliacionOfertaProvider`, `UbicacionOperativaProvider` y `GuardRutaOperativa`.
- SPEC 05: `LocationSharingProvider` + puente y patrón de provider/`AppState` reutilizable.
- Backend real verificado en `backend/src/modules/*` y en la auditoría `taxisur-endpoints-audit-2026-10-10` (`src/modules/eventos/eventos.schema.ts` y `eventos.service.ts`):
  - `GET /api/conductores/:id/eventos` (SSE; exige Bearer JWT de conductor; `retry: 5000`; evento nombrado `conectado` inicial y `actualizado`; heartbeat `: heartbeat` cada 25 s; sin `Last-Event-ID` ni replay). El esquema Zod confirma los campos `tipo`, `conductorId` (uuid), `estadoJornada`, `estadoDisponibilidad` y `fecha`; el evento **no** incluye `solicitudId`.
  - `GET /api/conductores/:id/solicitud-activa` → `SolicitudDetalleDto | null` (activas = `esperando_respuesta` o `en_servicio`; prioriza `en_servicio`).
  - `GET /api/solicitudes/:id` → `SolicitudDetalleDto` (403 si no es del conductor).
  - `GET /api/conductores/:id` → `ConductorDetalleDto`.
- `expo` SDK `~57.0.29` incluye `expo/fetch` con streaming (`response.body.getReader()`), y en Android/iOS es el `fetch` global; soporta `Authorization` y `AbortController`. No se instala `EventSource` ni Supabase.
- Gestor de paquetes npm (`package-lock.json`); suites Jest con `jest-expo`.

## Alcance

**Incluido:**

- Adaptador `sse-transport.ts` sobre `expo/fetch` (inyectable para pruebas): cabeceras `Authorization: Bearer` y `Accept: text/event-stream`, lectura por chunks, parseo de marcos SSE (`event:`, `data:`, comentarios `:`), cierre con `AbortController`, y `retry:` como pista acotada.
- Validación **antes de leer el cuerpo**: estado HTTP y `Content-Type`; clasificación de `401/403`, otros `4xx`, `5xx`, fin limpio del servidor, `Content-Type` inválido y errores de red, con reconexión acotada o delegación al manejo de sesión.
- Decodificación streaming con `TextDecoder({ stream: true })` para no corromper multibyte partidos entre chunks; el parser de texto acepta finales de línea LF y CRLF.
- Parseo puro y probado: marcos partidos entre chunks, `data:` multilínea, comentarios heartbeat ignorados y descarte de eventos cuyo `conductorId` no sea el autenticado.
- `use-driver-events.ts`: una sola conexión por sesión y por conductor; agrupa invalidaciones simultáneas y descarta respuestas de generaciones previas.
- **Compuerta de reconciliación inicial:** el guard no resuelve ruta ni evalúa acceso hasta que la primera reconciliación complete; `servicioConfirmado: null` no se interpreta como "sin servicio" mientras siga pendiente.
- Arranque: abrir SSE y recuperar instantánea (perfil + solicitud-activa); repetir reconciliación al recibir `conectado` para cubrir la carrera inicial.
- Los eventos se tratan como **invalidaciones**, no como copia completa de la entidad (coherente con `02-ARQUITECTURA.md`).
- Reconexión con espera progresiva **acotada**; al volver a primer plano (`AppState`) reconciliar. Sin polling continuo para descubrir ofertas de 60 s.
- Cierre del stream al logout, cambio de conductor y vencimiento local de sesión (vía `registrarAlInvalidar` y cambio de `conductorId`).
- `requests/api.ts` (`obtenerSolicitudActiva`, `obtenerSolicitud`) sobre `api-client`, sin Bearer duplicado ni reintento de mutaciones.
- `requests/reconcile.ts`: coordinador que en **una sola pasada** recupera perfil y solicitud-activa con generación de sesión/petición, agrupa y decide la ruta; el flujo de 409 de M03 lo invoca una única vez, sin recuperación de perfil separada.
- Extensión de `resolve-route.ts`: `resolverRutaOperativa(estado)` y derivación de `ServicioConfirmado` (solicitud `en_servicio` propia), validando `conductorAsignadoId` contra el conductor autenticado antes de navegar a una oferta o servicio.
- `driver-events-provider.tsx` + `EstadoConexionBanner.tsx`: contexto del stream y aviso global de **pérdida de conexión operativa** montado en `(operacion)/_layout.tsx`.
- Alimentar `GuardRutaOperativa` con el `ServicioConfirmado` reconciliado (sustituye el placeholder `null`) para no bloquear a una cuenta suspendida con servicio en curso.
- Montar el reconciliador real en `ReconciliacionOfertaProvider` para que el 409 de M03 reconcilie la oferta.
- Pruebas automatizadas del transporte, decodificación, validación HTTP, reconciliación, provider, banner y resolución de ruta.

**Fuera de alcance:**

- Pantallas de oferta (`solicitud-entrante`/`solicitud-expirada`) y de servicio (`en-servicio`/`servicio-finalizado`): son M06/M07. M05 solo **decide la navegación**; esos `src/app/(operacion)/*.tsx` siguen como stub.
- Contador de 60 s, respuesta `aceptar/rechazar` y finalización de servicio.
- Push, segundo plano, pantalla bloqueada, `TaskManager` (SSE no es push).
- Instalar Supabase, `EventSource` de navegador o exponer `service_role`.
- Backend, endpoints nuevos, refresh token o logout remoto.
- Mocks, interruptores de simulación o datos ficticios en el entregable.
- Compilar, publicar o avanzar de módulo.

## Modelo de datos

```ts
// src/features/events/sse-transport.ts
export type EventoConductor = {
  tipo: 'conectado' | 'actualizado';
  conductorId: string;
  estadoJornada: 'no_iniciada' | 'activa' | 'finalizada';
  estadoDisponibilidad: 'disponible' | 'no_disponible' | 'solicitud_pendiente' | 'en_servicio';
  fecha: string;
};

// Parseo puro de texto YA decodificado: acumula buffer y devuelve marcos
// completos + resto. Acepta finales de línea LF (\n) y CRLF (\r\n).
// Nunca recibe bytes crudos: el cuerpo se decodifica antes con TextDecoder
// en modo streaming (ver abrirConexionSse).
export function extraerMarcosSse(
  resto: string,
  chunk: string
): { eventos: EventoConductor[]; comentarios: string[]; retryMs: number | null; resto: string };

export type MotivoFin =
  | 'cerrado'          // lo pidió el llamador vía signal/cerrar()
  | 'fin_servidor'     // el servidor terminó el cuerpo sin error HTTP
  | 'error_red'        // fallo de red/lectura
  | 'error_http'       // 4xx/5xx distinto de 401/403
  | 'no_autorizado'    // 401/403
  | 'contenido_invalido'; // Content-Type no es text/event-stream

export type OpcionesConexion = {
  url: string;                       // `${apiUrl}/api/conductores/${id}/eventos`
  token: string;
  conductorId: string;               // filtra eventos de otros conductores
  signal: AbortSignal;               // propiedad del llamador (el hook)
  fetchImpl?: typeof fetch;          // por defecto expo/fetch
  onEvento: (evento: EventoConductor) => void;
  onApertura?: () => void;
  onFin?: (motivo: MotivoFin, detalle?: { status?: number }) => void;
};
export type ConexionSse = { cerrar: () => void };
export function abrirConexionSse(opciones: OpcionesConexion): ConexionSse;
```

**Decodificación de bytes (punto 5).** `response.body.getReader()` entrega `Uint8Array`. El adaptador mantiene un `TextDecoder` con `{ stream: true }` y decodifica cada fragmento antes de llamar a `extraerMarcosSse`, de modo que un carácter multibyte partido entre dos chunks no se corrompe. Al terminar el cuerpo se hace una última `decoder.decode()` (sin `stream`) para vaciar el buffer. `extraerMarcosSse` separa marcos por doble salto aceptando `\n\n` y `\r\n\r\n`, y tolera líneas `event:`, `data:` (múltiples líneas se unen con `\n`), comentarios `:` (heartbeats) y `retry:`.

**Quién controla `AbortController` (punto 3).** El **hook** (llamador) crea y posee un `AbortController` por conexión y pasa su `signal` a `abrirConexionSse`. `abrirConexionSse` **no** crea otro controlador: usa el `signal` recibido para `fetch` y devuelve `cerrar()`, que simplemente hace `controller.abort()` sobre el mismo `signal` (el adaptador expone un `cerrar` que aborta el signal que se le pasó). Los dos mecanismos son el mismo: `cerrar()` y el `abort()` del llamador producen el mismo efecto. Se dispara ante: logout/cambio de `conductorId`/expiración local de sesión (vía el hook), y al cerrar la pantalla o desmontar el provider. La lectura con `reader.read()` rechaza con `AbortError`, se clasifica como `'cerrado'` y **no** cuenta como error de red para el backoff. El hook, al cerrar por cambio de sesión o conductor, conserva el comportamiento de reconexión: la nueva sesión/conductor arranca una conexión nueva (no reutiliza el signal abortado).

```ts
// src/features/requests/api.ts
export function obtenerSolicitudActiva(
  conductorId: string, token: string, signal?: AbortSignal
): Promise<SolicitudDetalleDto | null>;   // GET /api/conductores/:id/solicitud-activa

export function obtenerSolicitud(
  solicitudId: string, token: string, signal?: AbortSignal
): Promise<SolicitudDetalleDto>;          // GET /api/solicitudes/:id

export type SolicitudDetalleDto = { /* id, pasajeroId, conductorAsignadoId, estado,
  latitudRecogida, longitudRecogida, destino, puntoRecogidaTexto, expiraEn, aceptadaEn,
  finalizadaEn, creadoEn, pasajero:{id,nombre}, conductorAsignado, distanciaAproximadaKm */ };
```

```ts
// src/features/events/use-driver-events.ts
export type EstadoConexion = 'iniciando' | 'conectado' | 'reconectando' | 'perdida';
// Compuerta de arranque: hasta que la PRIMERA reconciliación no termine, no se
// resuelve ninguna ruta (evita bloquear a una cuenta suspendida con servicio).
export type EstadoReconciliacion = 'pendiente' | 'completa' | 'fallida';
export type UseDriverEventsResult = {
  conexion: EstadoConexion;
  reconciliando: boolean;
  reconciliacionInicial: EstadoReconciliacion;
  solicitudActiva: SolicitudDetalleDto | null;
  servicioConfirmado: ServicioConfirmado | null;
  reconciliar: () => Promise<void>;       // reutilizada por la costura de M03 (409)
};
```

**Compuerta inicial del guard (punto 1).** `servicioConfirmado: null` **solo** es concluyente cuando `reconciliacionInicial === 'completa'`. Mientras esté `'pendiente'`, `GuardRutaOperativa` no evalúa acceso ni navega: mantiene el `Stack` con pantalla de carga/splash operativa (sin redirección). Si la primera reconciliación falla por red (`'fallida'`), el guard **no** decide con datos incompletos: permanece en espera y reintenta (SSE/reconexión/`AppState`); solo una `'completa'` habilita `evaluarAccesoOperativo`/`resolverRutaOperativa`. Así una cuenta suspendida con servicio `en_servicio` propio nunca se bloquea por una lectura aún no resuelta.

```ts
// src/features/requests/reconcile.ts
export type InstantaneaOperativa = {
  conductor: ConductorDetalleDto;
  solicitudActiva: SolicitudDetalleDto | null;
};
export function servicioConfirmadoDe(
  instantanea: InstantaneaOperativa
): ServicioConfirmado | null;             // en_servicio y conductorAsignadoId === conductor.id
```

**Reconciliación completa y flujo 409 (punto 2).** `reconciliar()` recupera **en una sola pasada** el perfil (`obtenerConductor`) y la solicitud activa (`obtenerSolicitudActiva`), y de ahí deriva `solicitudActiva`, `servicioConfirmado` y la ruta. SPEC 04 pedía refrescar el perfil y llamar a la costura de M05; aquí esa costura **es** `reconciliar`, que ya hace la recuperación completa, por lo que el manejo del 409 de M03 invoca `reconciliar()` **una sola vez** y **no** dispara además un `actualizarPerfil` separado (evita doble consulta de perfil). La costura `ReconciliacionOfertaProvider` se conecta a `reconciliar`; ninguna otra ruta de M05 repite esas consultas dentro del mismo ciclo.

```ts
// src/navigation/resolve-route.ts  (ampliación)
export type EstadoOperativoConfirmado = {
  conductor: ConductorDetalleDto;
  solicitudActiva: SolicitudDetalleDto | null;
};
export function resolverRutaOperativa(estado: EstadoOperativoConfirmado): Href;
```

Reglas de `resolverRutaOperativa` (derivadas de `02-ARQUITECTURA.md`; no inventa estados). Se invocan **solo** con `reconciliacionInicial === 'completa'` (punto 1):

- cuenta `pendiente`/`rechazado`/`suspendido` sin servicio `en_servicio` propio → ruta de cuenta.
- servicio `en_servicio` **propio** (aunque la cuenta esté suspendida) → `/(operacion)/en-servicio` (exige `conductorAsignadoId === conductor.id`).
- `aprobado` + `esperando_respuesta` **asignada al conductor autenticado** (`conductorAsignadoId === conductor.id`) → `/(operacion)/solicitud-entrante`; si la asignación no coincide, se ignora y se trata como sin solicitud (punto 6).
- resto → `/(operacion)/inicio`.

Toda decisión de oferta/servicio valida la asignación contra el conductor autenticado antes de navegar, igual que exige `servicioConfirmadoDe`; nunca navega a una oferta por el mero estado `esperando_respuesta`.

**Manejo de HTTP, errores y reconexión (punto 4).** `abrirConexionSse` valida **antes de leer el cuerpo**:
- `response.ok === false`: no se lee el cuerpo. Se clasifica el motivo y se llama `onFin` sin `onApertura`:
  - `401`/`403` → `'no_autorizado'`: **no se reintenta** en el transporte; el hook invalida la sesión (mismo camino que `api-client` para `UNAUTHORIZED`, vía `registrarAlInvalidar`) y el guard de sesión actúa. No se reconecta con credenciales inválidas.
  - otros `4xx` → `'error_http'`: sin reintento inmediato; el hook lo trata como pérdida de conexión operativa y aplica el backoff, esperando que el siguiente intento (tras la siguiente señal) recupere.
  - `5xx` → `'error_http'`: tratado como fallo transitorio y sujeto a backoff acotado.
- `Content-Type` que no contenga `text/event-stream` → `'contenido_invalido'`, se cierra y se trata como pérdida de conexión operativa (con backoff); no se intenta parsear.
- Cuerpo `null` → `'fin_servidor'`.
- Fin limpio del cuerpo (`done: true` en el reader) sin abort → `'fin_servidor'`: el hook lo considera caída y reconecta con backoff.
- Error de red/lectura (`fetch` rechaza o `reader.read()` rechaza sin ser `AbortError`) → `'error_red'`: reconecta con backoff.

**Reconexión y backoff.** Espera progresiva acotada: base `1000 ms`, duplicando por intento hasta un **máximo de `30000 ms`** (`min(1000 * 2^n, 30000)`). El `retry: 5000` del servidor se usa como **pista acotada**: nunca se espera menos que `1 s` ni más que `30 s`, y no puede reducir el backoff por debajo del valor calculado. El backoff se **reinicia a `1000 ms`** en cuanto una conexión se **abre correctamente** (`onApertura`, HTTP 200 + `text/event-stream`), no al recibir solo `conectado`. En `'no_autorizado'` no hay backoff (se delega al manejo de sesión). No hay polling: la reconexión se dispara solo por caída del stream o por retorno a primer plano.

## Archivos previstos

**Crear:**

- `src/features/events/sse-transport.ts`.
- `src/features/events/use-driver-events.ts`.
- `src/features/events/driver-events-provider.tsx`.
- `src/features/events/components/EstadoConexionBanner.tsx`.
- `src/features/requests/api.ts`.
- `src/features/requests/reconcile.ts`.
- `src/features/events/__tests__/` y `src/features/requests/__tests__/`.

**Modificar:**

- `src/app/(operacion)/_layout.tsx`: montar `DriverEventsProvider` sobre `GuardRutaOperativa`, el `EstadoConexionBanner` y `ReconciliacionOfertaProvider` con el reconciliador real.
- `src/navigation/guard-sesion.tsx`: `GuardRutaOperativa` consume `useDriverEvents().servicioConfirmado` en lugar de `null`.
- `src/navigation/resolve-route.ts`: añadir `EstadoOperativoConfirmado` y `resolverRutaOperativa`.

Las vistas compartidas quedan fuera de `src/app/`. No se duplican DTOs, cliente HTTP ni almacenamiento de sesión.

## Plan de implementación

1. **Base y contratos.** Ejecutar la suite como línea base; contrastar el contrato SSE con el backend real (ya verificado). Consultar la documentación del SDK Expo 57 y Context7 antes de tocar APIs de `expo/fetch`/`AbortController`. Dejar el proyecto ejecutable.
2. **Transporte + parser.** Crear `sse-transport.ts` con `abrirConexionSse` y `extraerMarcosSse`; probar Bearer, `Accept`, validación de estado HTTP y `Content-Type` antes de leer el cuerpo, clasificación de `401/403`/`4xx`/`5xx`/fin limpio/contenido inválido/error de red, parseo entre chunks (LF y CRLF), `data:` multilínea, comentarios heartbeat ignorados, `retry:` como pista acotada, decodificación streaming de multibyte partido entre chunks, cierre por `signal`/`cerrar()` (mismo `AbortController`), filtrado de `conductorId` ajeno y `fetchImpl` inyectado.
3. **API de solicitudes.** Crear `requests/api.ts` sobre `api-client`; probar ruta, método, Bearer, `null` para ausencia de solicitud activa y 403 tipado en `obtenerSolicitud`.
4. **Reconciliación y ruta.** Crear `requests/reconcile.ts` y añadir `resolverRutaOperativa` en `resolve-route.ts`; probar todas las reglas de ruta, la validación de `conductorAsignadoId` contra el conductor autenticado, la recuperación completa en una sola pasada y `servicioConfirmadoDe`.
5. **Hook de eventos.** Crear `use-driver-events.ts`: una conexión por sesión, arranque (SSE + instantánea), compuerta `reconciliacionInicial`, reconciliación al `conectado`, agrupación de invalidaciones, descarte por generación, reconexión con espera progresiva acotada (máx. 30 s, reinicio al abrir), `AppState` para primer plano y cierre al logout/cambio de conductor/expiración local. Probar con `fetchImpl` y temporizadores falsos, incluida la clasificación de motivos de fin y que el cambio de sesión/conductor cierra y abre conexión nueva.
6. **Provider, banner y costuras.** Crear `DriverEventsProvider` + `EstadoConexionBanner`; montarlos en `(operacion)/_layout.tsx`; inyectar el reconciliador real en `ReconciliacionOfertaProvider` y el `servicioConfirmado` en `GuardRutaOperativa`. Probar que el guard no navega antes de la reconciliación inicial, la pérdida de conexión, el no bloqueo de una cuenta suspendida con servicio, la ausencia de doble consulta en el 409 y la costura en 409.
7. **Verificación final.** Ejecutar suite, `tsc`, `expo lint`, `expo-doctor` y `git diff --check`; revisar ausencia de mocks/secretos; registrar evidencia y dejar sin marcar los criterios que exigen dispositivo o backend real. No compilar, publicar ni avanzar de módulo.

Cada incremento incluye sus pruebas aplicables y deja el proyecto ejecutable.

## Criterios de aceptación

### Verificables en esta entrega

- [x] Un evento `actualizado` dispara reconciliación vía `solicitud-activa` y enruta a la oferta correcta sin conocer el UUID de antemano.
- [x] Al reabrir/iniciar, la instantánea recupera un servicio `en_servicio` aunque no haya llegado ningún evento (ruta a `en-servicio`).
- [x] Dos eventos duplicados consecutivos no abren dos conexiones ni duplican la decisión de navegación (una sola conexión, reconciliación agrupada).
- [x] El cambio de cuenta limpia cachés y cancela el stream y las peticiones de la sesión anterior; una respuesta tardía de otra generación no sobrescribe el estado.
- [x] Un evento con `conductorId` distinto al autenticado se descarta (cada stream solo entrega sus propios estados).
- [x] La conexión usa `Authorization: Bearer`, `Accept: text/event-stream` y cierre con `AbortController`; los comentarios heartbeat no producen reconciliación.
- [x] `abrirConexionSse` valida estado HTTP y `Content-Type` **antes** de leer el cuerpo; un `text/event-stream` distinto no se parsea y se trata como pérdida de conexión.
- [x] Ante `401`/`403` no se reintenta en el transporte: el hook invalida la sesión; otros `4xx`/`5xx`/fin limpio/error de red reconectan con backoff acotado (máx. 30 s) que se reinicia al abrir la conexión.
- [x] La decodificación usa `TextDecoder` en modo streaming: un carácter multibyte partido entre chunks no se corrompe; el parser acepta LF y CRLF.
- [x] El `AbortController` lo posee el hook y `cerrar()` aborta el mismo `signal`; cerrar, cambiar de sesión o cambiar de conductor termina la lectura (`'cerrado'`) y, en cambio de sesión/conductor, arranca una conexión nueva.
- [x] `conectado` no se interpreta como prueba de cambios: solo dispara la reconciliación de arranque.
- [x] La reconexión usa espera progresiva acotada; no existe polling continuo de ofertas.
- [x] `GuardRutaOperativa` no navega ni evalúa acceso mientras `reconciliacionInicial === 'pendiente'` (o tras una `'fallida'`): `servicioConfirmado: null` no se lee como "sin servicio" y una cuenta suspendida con servicio propio no se bloquea.
- [x] Al volver a primer plano (`AppState`) se consulta el estado; al fallar el stream se muestra la pérdida de conexión operativa.
- [x] Al logout, cambio de usuario o expiración local de sesión el stream se cierra y no quedan conexiones activas.
- [x] `GuardRutaOperativa` usa el `ServicioConfirmado` reconciliado y no bloquea una cuenta suspendida con servicio `en_servicio` propio.
- [x] El flujo de 409 de M03 invoca `reconciliar()` una sola vez y no dispara una recuperación de perfil separada (sin doble consulta).
- [x] La navegación a oferta o servicio valida `conductorAsignadoId === conductor.id`; una solicitud `esperando_respuesta` no asignada al conductor no navega a `solicitud-entrante`.
- [x] No hay mocks, simuladores ni datos ficticios en el código entregable; no se incorporan Supabase ni `service_role`.
- [x] Las pruebas nuevas y la regresión de SPEC 02–05 terminan en verde.
- [x] TypeScript, lint y expo-doctor no reportan errores de bloqueo.

### Pendientes de integración, no acreditables en M05 aislado

- [ ] En dispositivo Android, con `expo/fetch` real, comprobar cabeceras Bearer, streaming SSE, heartbeat, cierre y reconexión.
- [ ] Con dos conductores reales, confirmar que cada stream entrega solo sus propios estados.
- [ ] Certificar la cadena completa Supabase → backend → SSE con una asignación real (el backend puede limitarse a `conectado` + heartbeats si faltan credenciales de Realtime).
- [ ] Cierre de sesión SSE pendiente en backend (JWT vencido/invalidado); el cierre local mejora el cliente pero no lo reemplaza.

### Comandos de verificación

- `npx jest src/features/events src/features/requests --runInBand`.
- `npx jest --runInBand`.
- `npx tsc --noEmit`.
- `npx expo lint`.
- `npx expo-doctor`.
- `git diff --check`.

## Decisiones tomadas y descartadas

- **Sí:** transporte con `expo/fetch` streaming (global en Android/iOS, soporta Bearer y `AbortController`); sin `EventSource` de navegador ni `react-native-sse`. Decisión confirmada por el usuario.
- **Sí:** el adaptador recibe `fetchImpl` inyectable para probar el parseo y el ciclo sin red real.
- **Sí:** los eventos se tratan como invalidaciones; nunca como copia completa de la entidad. Coherente con `02-ARQUITECTURA.md`.
- **Sí:** M05 solo resuelve la navegación; `solicitud-entrante`/`en-servicio` permanecen stub hasta M06/M07. Decisión confirmada por el usuario.
- **Sí:** aviso de pérdida de conexión como banner global en `(operacion)`. Decisión confirmada por el usuario.
- **Sí:** alimentar `GuardRutaOperativa` con el `ServicioConfirmado` reconciliado en M05. Decisión confirmada por el usuario.
- **Sí:** reconciliar en el arranque y de nuevo al recibir `conectado` para cubrir la carrera inicial.
- **Sí:** cierre del stream vía `registrarAlInvalidar` y cambio de `conductorId`; no se inventa logout remoto.
- **Sí:** reconexión con espera progresiva acotada; sin polling continuo de ofertas de 60 s.
- **Sí:** recuperación de primer plano con `AppState`; sin `NetInfo` (no instalado) y sin promesas de segundo plano.
- **Sí:** verificación con Jest/tsc/lint/expo-doctor; los criterios de dispositivo/backend/dos conductores quedan bloqueados. Decisión confirmada por el usuario.
- **Sí:** compuerta de reconciliación inicial en el guard; no se navega con `servicioConfirmado: null` mientras la lectura siga pendiente (punto 1).
- **Sí:** el flujo de 409 de M03 invoca `reconciliar()` una sola vez; la costura hace la recuperación completa de perfil + solicitud activa (punto 2).
- **Sí:** el hook es dueño del `AbortController`; `signal` y `cerrar()` operan sobre el mismo controlador (punto 3).
- **Sí:** validación de HTTP/`Content-Type` antes de leer el cuerpo; `401/403` delegan al manejo de sesión y el resto reconecta con backoff acotado a 30 s, reiniciado al abrir (punto 4).
- **Sí:** decodificación con `TextDecoder` en modo streaming y parser con LF/CRLF (punto 5).
- **Sí:** toda navegación a oferta/servicio valida `conductorAsignadoId` contra el conductor autenticado (punto 6).
- **No:** instalar Supabase, `EventSource`, exponer `service_role` ni crear endpoints.
- **No:** construir pantallas de oferta/servicio, contador o finalización (M06/M07).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `expo/fetch` no entrega streaming en algún dispositivo/versión | Aislado en `sse-transport.ts` con `fetchImpl` inyectable; el criterio de dispositivo queda bloqueado hasta validar en Android real. |
| Backend no publica Realtime (faltan credenciales Supabase) y solo envía `conectado` + heartbeat | No interpretar `conectado`/heartbeat como prueba; reconciliar por instantánea y al reconectar; el criterio de cadena completa queda pendiente. |
| Cierre de sesión SSE no implementado en backend | Cierre local en logout/cambio/expiración; documentar que no reemplaza el cierre en servidor (`05-PENDIENTES-BACKEND.md`). |
| Respuesta tardía de una sesión previa sobrescribe el estado | Generación de sesión/petición y descarte de respuestas obsoletas, reutilizando el patrón de SPEC 02/04. |
| Reconciliaciones solapadas por eventos rápidos | Agrupar mientras hay una reconciliación en curso y ejecutar otra si llegó un cambio durante la lectura. |
| Duplicar conexiones o pantallas por eventos repetidos | Guardar una única conexión por sesión y una única decisión de navegación por reconciliación. |
| Bloquear a un conductor suspendido con servicio activo | `servicioConfirmadoDe` alimenta `evaluarAccesoOperativo` (`solo_finalizar`) sin depender de un booleano único. |
| La app parece terminada sin SSE real validado | Separar criterios locales e integrados; los de dispositivo/dos conductores/backend quedan sin marcar. |
| Un `fin_servidor` (cuerpo terminado sin error) se interpreta como conexión sana | Se clasifica como caída y reconecta con backoff; el reinicio de backoff depende de `onApertura` (200 + `text/event-stream`), no de recibir `conectado`. |
| Backoff mal acotado por confiar en `retry:` del servidor | `retry:` es solo una pista: el cálculo se acota a `[1000 ms, 30000 ms]` y nunca reduce el backoff calculado. |

## Lo que **no** está en esta spec

- Pantallas de oferta, contador, respuesta, servicio y finalización (M06/M07).
- Push, segundo plano, pantalla bloqueada y `TaskManager`.
- Supabase, `EventSource` de navegador o `react-native-sse`.
- Mocks, simuladores o datos ficticios en el entregable.
- Cambios de backend, endpoints nuevos o logout remoto.
- Compilar, publicar o avanzar automáticamente de módulo.

## Evidencia de verificación

- **Fecha:** 2026-10-15.
- **Entorno:** rama `spec-06-sse-recuperacion-estado-operativo`; `app-taxi` 1.0.0; Expo SDK `~57.0.30`, `expo-router` `~57.0.28`, React Native 0.86.3, React 19.2.3, `jest-expo` `~57.0.6`; gestor de paquetes npm (`package-lock.json`, sin `bun.lock`). El paso 7 subió los parches de `expo` (`~57.0.29` → `~57.0.30`) y `expo-router` (`~57.0.27` → `~57.0.28`) para dejar `expo-doctor` en 21/21; sin cambios de API ni de alcance.
- **Comandos ejecutados (npm / npx):**
  - `npx jest src/features/events src/features/requests --runInBand` → 6 suites, 55/55 pruebas en verde.
  - `npx jest --runInBand` → 34 suites, 373/373 pruebas en verde (incluye la regresión de SPEC 02–05).
  - `npx tsc --noEmit` → exit 0, sin errores.
  - `npx expo lint` → exit 0, sin errores.
  - `npx expo-doctor` → 21/21 comprobaciones, sin problemas.
  - `git diff --check` → exit 0 (solo avisos de fin de línea LF/CRLF, sin errores de whitespace).
- **Revisión del entregable:** búsqueda estática en `src/` (excluyendo `__tests__`/`*.test.ts*`) sin coincidencias reales de `mock`/`simul`/`fake`/`dummy`/`fixture`/`Math.random` (los únicos aciertos son la palabra "simultáneos/as" en comentarios). Sin URLs `http(s)://` hardcodeadas: la API se resuelve con `EXPO_PUBLIC_API_URL` (variable pública). Patrones de secreto (`service_role`, `supabase`, JWT `eyJ…`, `sk-…`, clave privada, `password`) sin coincidencias; no se incorporan Supabase ni `service_role`. Archivos creados exactamente en `src/features/events/` (transporte, hook, provider, banner + `__tests__/`) y `src/features/requests/` (`api.ts`, `reconcile.ts` + `__tests__/`), sin mocks ni interruptores de simulación en el código entregable.
- **Fuentes consultadas:** `docs/implementacion-app/modulos/M05-EVENTOS-Y-RECUPERACION.md`, `01-CONTRATOS-API.md`, `02-ARQUITECTURA.md` y `05-PENDIENTES-BACKEND.md`; documentación oficial del SDK Expo 57 (`expo/fetch` streaming y `AbortController`) y Context7 en los pasos previos; auditoría del backend `taxisur-endpoints-audit-2026-10-10` (esquema y servicio SSE). El paso 7 no introdujo APIs nuevas.
- **Plataformas:** toda la evidencia automática corresponde a pruebas Jest (entorno Node con `jest-expo`) y revisión estática de TypeScript. No se ejecutó en Android ni iOS y no se dispone de capturas de dispositivo; los criterios que exigen dispositivo o backend real se mantienen sin marcar.

| Criterio | Resultado | Plataforma | Evidencia | Pendiente o bloqueo |
| --- | --- | --- | --- | --- |
| Evento `actualizado` reconcilia vía `solicitud-activa` y enruta a la oferta sin conocer el UUID | Verificado | Jest | `use-driver-events.test.tsx` "agrupa eventos simultáneos en una sola relanzada y mantiene una única conexión" (eventos `actualizado` → `GET …/solicitud-activa`); `reconcile.test.ts` "recuperarInstantaneaOperativa recupera perfil y solicitud activa en una sola pasada"; `guard-sesion.test.tsx` "una oferta propia esperando_respuesta navega a solicitud-entrante" | — |
| Instantánea de arranque recupera `en_servicio` sin eventos y va a `en-servicio` | Verificado | Jest | `use-driver-events.test.tsx` "abre el stream con Bearer/Accept y recupera la instantánea aunque no llegue ningún evento", "deriva servicioConfirmado cuando la solicitud activa es en_servicio propia"; `guard-sesion.test.tsx` "una cuenta suspendida con servicio en_servicio propio no se bloquea y va a en-servicio" | — |
| Eventos duplicados: una sola conexión y una sola relanzada | Verificado | Jest | `use-driver-events.test.tsx` "agrupa eventos simultáneos en una sola relanzada y mantiene una única conexión" (una llamada SSE, recuento de `solicitud-activa` = 2 tras el agrupado) | — |
| Cambio de cuenta limpia/cancela; generación previa no sobrescribe | Verificado | Jest | `use-driver-events.test.tsx` "al cambiar de conductor cierra el stream y abre uno nuevo", "una respuesta tardía de la generación anterior no sobrescribe el estado", "el logout invalida la sesión y cierra el stream sin reconectar"; `use-shift.test.tsx` "una respuesta tardía de otra sesión no reemplaza el perfil actual" | — |
| Evento con `conductorId` ajeno se descarta | Verificado | Jest | `sse-transport.test.ts` "entrega eventos propios y descarta los de otro conductor"; `use-driver-events.test.tsx` "descarta un evento con conductorId distinto al autenticado" | — |
| Bearer + `Accept: text/event-stream` + cierre con `AbortController`; heartbeat no reconcilia | Verificado | Jest | `sse-transport.test.ts` "envía Authorization Bearer y Accept text/event-stream", "el abort del signal del llamador termina la lectura como cerrado", "cerrar() detiene la lectura y la marca como cerrado"; `use-driver-events.test.tsx` "los comentarios heartbeat no producen reconciliación" | — |
| Valida HTTP y `Content-Type` antes de leer el cuerpo | Verificado | Jest | `sse-transport.test.ts` "401 y 403 se clasifican como no_autorizado sin leer el cuerpo", "otros 4xx y 5xx se clasifican como error_http sin leer el cuerpo", "un Content-Type distinto no se parsea y cuenta como contenido_invalido", "un cuerpo nulo termina como fin_servidor" | — |
| `401`/`403` sin reintento; backoff acotado a 30 s reiniciado al abrir | Verificado | Jest | `use-driver-events.test.tsx` "un 401 invalida la sesión sin backoff y sin reconectar", "un fallo de red acumula espera progresiva acotada a 30 s", "fin de stream, error de red, error_http y contenido inválido reconectan con backoff", "duplica desde 1 s y se acota a 30 s", "acota la pista del servidor a [1000, 30000] y nunca reduce el cálculo"; `sse-transport.test.ts` clasificación de motivos | — |
| `TextDecoder` streaming multibyte; parser LF y CRLF | Verificado | Jest | `sse-transport.test.ts` "decodifica un multibyte partido entre chunks sin corromperlo", "parsea un marco LF con evento y datos", "acepta finales de línea CRLF", "reconstruye marcos partidos entre chunks", "no inventa un salto cuando un CRLF se parte entre chunks" | — |
| El hook posee el `AbortController`; cambio de sesión/conductor cierra y abre nueva conexión | Verificado | Jest | `sse-transport.test.ts` "el abort del signal del llamador termina la lectura como cerrado", "cerrar() detiene la lectura y la marca como cerrado"; `use-driver-events.test.tsx` "al cambiar de conductor cierra el stream y abre uno nuevo", "el logout invalida la sesión y cierra el stream sin reconectar", "el cierre intencional no programa reconexión" | — |
| `conectado` solo dispara la reconciliación de arranque | Verificado | Jest | `use-driver-events.test.tsx` "el evento conectado vuelve a reconciliar para cubrir la carrera inicial" | — |
| Reconexión con espera progresiva acotada; sin polling de ofertas | Verificado | Jest / Revisión estática | `use-driver-events.test.tsx` bloque "backoffMs" (acotado `[1000, 30000]`, la pista del servidor no reduce el cálculo) y "un fallo de red acumula espera progresiva acotada a 30 s"; `use-driver-events.ts` no define temporizador periódico de solicitudes | — |
| Guard no navega/evalúa con `reconciliacionInicial` `'pendiente'` o `'fallida'` | Verificado | Jest | `guard-sesion.test.tsx` "mientras la reconciliación inicial sigue pendiente no evalúa acceso ni navega", "tras una reconciliación fallida permanece en espera sin navegar" | — |
| `AppState` reconcilia al primer plano y la caída del stream se muestra en el banner | Verificado | Jest | `use-driver-events.test.tsx` "al volver a primer plano reconcilia el estado" y clasificación de caídas con reconexión; `estado-conexion-banner.test.tsx` "con la conexión perdida avisa que se reintenta", "en reconexión avisa al conductor" | — |
| Logout/cambio/expiración local cierra el stream sin conexiones activas | Verificado | Jest | `use-driver-events.test.tsx` "el logout invalida la sesión y cierra el stream sin reconectar", "al cambiar de conductor cierra el stream y abre uno nuevo" (vía `registrarAlInvalidar`) | — |
| Guard usa el `ServicioConfirmado` reconciliado; suspendido con servicio propio no bloquea | Verificado | Jest | `guard-sesion.test.tsx` "una cuenta suspendida con servicio en_servicio propio no se bloquea y va a en-servicio"; `driver-events-provider.test.tsx` "expone el estado del stream reconciliado a los hijos"; `operacion-layout.test.tsx` "monta el reconciliador real de M05 (reconciliar) en el ámbito operativo" | — |
| El 409 invoca `reconciliar()` una sola vez, sin doble consulta de perfil | Verificado | Jest | `use-shift.test.tsx` "ante 409 invoca la costura una sola vez, sin recuperación de perfil separada" (3 llamadas `fetch` en total), "si la costura tras 409 falla, queda no confirmado, avisa y permite reintentar" | — |
| Navegación a oferta/servicio valida `conductorAsignadoId === conductor.id` | Verificado | Jest | `resolve-route.test.ts` "una oferta esperando_respuesta no asignada al conductor se ignora", "un servicio en_servicio asignado a otro conductor no habilita la continuidad", "un servicio en_servicio propio sin asignación válida no navega a en-servicio"; `guard-sesion.test.tsx` "una oferta no asignada al conductor no navega a solicitud-entrante" | — |
| Sin mocks, simuladores ni datos ficticios; sin Supabase ni `service_role` | Verificado | Revisión estática | Búsqueda en `src/` sin código de prueba: sin `mock`/`simul`/`fake`/`dummy`/`fixture`/`Math.random` reales, sin URLs hardcodeadas, sin patrones de secreto; `EXPO_PUBLIC_API_URL` es pública | — |
| Pruebas nuevas y regresión de SPEC 02–05 en verde | Verificado | Jest | `npx jest src/features/events src/features/requests --runInBand` → 6/6 suites (55/55); `npx jest --runInBand` → 34/34 suites (373/373) | — |
| TypeScript, lint y expo-doctor sin errores de bloqueo | Verificado | Node | `npx tsc --noEmit` exit 0; `npx expo lint` exit 0; `npx expo-doctor` 21/21; `git diff --check` exit 0 | — |
| En dispositivo Android, con `expo/fetch` real, cabeceras Bearer, streaming, heartbeat, cierre y reconexión | Bloqueado | Android / iOS | Sin dispositivo ni capturas; los dobles de Jest no certifican streaming real | Ejecutar la app en dispositivo/emulador y registrar evidencia |
| Con dos conductores reales, cada stream solo entrega sus estados | Bloqueado | — | No ejecutado: requiere backend real y dos cuentas | Requiere entorno de integración con credenciales |
| Cadena completa Supabase → backend → SSE con asignación real | Bloqueado | — | No ejecutada: los dobles de Jest no certifican la cadena real | Requiere credenciales de Supabase/Realtime y asignación de prueba |
| Cierre de sesión SSE en backend (JWT vencido/invalidado) | Bloqueado | — | `05-PENDIENTES-BACKEND.md`: pendiente de implementación en servidor; el cierre local no lo reemplaza | Implementación en backend |
