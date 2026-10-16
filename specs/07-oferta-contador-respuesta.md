# SPEC 07 — Oferta entrante, contador y respuesta

> **Estado:** Implementado
> **Depende de:** SPEC 02, SPEC 04, SPEC 05, SPEC 06
> **Fecha:** 2026-10-15
> **Objetivo:** Permitir una única decisión —aceptar o rechazar— sobre una oferta vigente, respetando el plazo del servidor.

## Por qué existe esta spec

M06 del plan (`docs/implementacion-app/modulos/M06-SOLICITUD-ENTRANTE.md`). SPEC 06 (M05) ya resuelve la navegación y deja `solicitud-entrante` y `solicitud-expirada` como stub; aquí se montan la pantalla real, el contador derivado de `expiraEn` y la respuesta única.

> **Correspondencia de nombres:** `M06` es el identificador del módulo en `docs/implementacion-app/modulos/M06-SOLICITUD-ENTRANTE.md`; este documento es su spec de implementación, `SPEC 07`. Igual que en SPEC 05/06, "M06" designa el alcance funcional y "SPEC 07" este archivo (contrato de implementación).

Fuentes de requisitos:

- `docs/implementacion-app/modulos/M06-SOLICITUD-ENTRANTE.md`.
- `docs/implementacion-app/01-CONTRATOS-API.md` y `02-ARQUITECTURA.md`.
- `docs/implementacion-app/05-PENDIENTES-BACKEND.md`.
- Referencias visuales `solicitud-entrante.html` y `solicitud-expirada.html` en `docs/implementacion-app/referencias-ui/` (solo diseño).

Los HTML son referencias visuales con simulaciones, no contratos ni pruebas de integración. Sus controles ("Simular llegada de solicitud", "Simular pérdida de conexión") y sus datos ficticios ("María Vargas", "Plaza de San Miguel") no se trasladan a la app entregable.

### Dependencias comprobadas

- M03/M04/M05 implementados y en `main`:
  - `useDriverEventsContext()` expone `solicitudActiva` (`SolicitudDetalleDto` reconciliada) y `reconciliar()`.
  - `src/navigation/resolve-route.ts` define `ServicioConfirmado`, `evaluarAccesoOperativo`, `resolverRutaOperativa` y `pathnameDeRuta`.
  - `src/navigation/guard-sesion.tsx` (`GuardRutaOperativa`) decide ruta con la reconciliación inicial completa.
  - `src/lib/api-client.ts` con Bearer, `AbortController`/timeout; **las mutaciones no se reintentan**.
  - `src/features/requests/api.ts` ya tiene `obtenerSolicitudActiva` y `obtenerSolicitud`.
- Contratos reales (`01-CONTRATOS-API.md`):
  - `POST /api/solicitudes/:id/responder {acepta:boolean}` → 200 `SolicitudDto` (sin `pasajero` ni `distanciaAproximadaKm`). No sustituye `SolicitudDetalleDto`.
  - 409 `ESTADO_INVALIDO` en conflicto o vencimiento. No existe endpoint de expiración.
  - `GET /api/conductores/:id/solicitud-activa` puede seguir devolviendo la oferta `esperando_respuesta` propia aunque el reloj local marque vencida; el job del backend la procesa después.
  - `SolicitudDto`: id, pasajeroId, conductorAsignadoId nullable, estado, latitudRecogida, longitudRecogida, destino nullable, puntoRecogidaTexto nullable, expiraEn nullable, aceptadaEn nullable, finalizadaEn nullable, creadoEn. No incluye teléfono del pasajero.
- `expo` SDK `~57.0.30`, React Native 0.86.3, React 19.2.3, `jest-expo` `~57.0.6`; gestor npm (`package-lock.json`, sin `bun.lock`). No se instala ninguna dependencia nueva.

## Alcance

**Incluido:**

- `IncomingRequestScreen`: muestra `pasajero.nombre`, `puntoRecogidaTexto` (respaldo: coordenadas cuando es null), `destino` nullable y `distanciaAproximadaKm` nullable. Nunca muestra el teléfono del pasajero (el DTO no lo trae) ni importa textos de demo.
- Contador derivado de `expiraEn`: reabrir a mitad de ventana muestra solo el tiempo restante; nunca inicia 60 segundos nuevos al montar o reabrir. El reloj local (ajustado por el desfase estimado) orienta la presentación del contador y la navegación local (oferta vs expiración), sin autoridad sobre la vigencia real: el backend decide si acepta la respuesta.
- Estimación opcional del desfase con la cabecera HTTP `Date` (capturada en la lectura de `solicitud-activa`; su valor es el texto HTTP crudo, no ISO), orientada a presentación y navegación local; el backend sigue siendo la autoridad sobre la vigencia real y la aceptación de la respuesta. Vive en memoria por sesión/conductor: se descarta al cambiar de sesión o perder la conexión y se reestima con una respuesta nueva al reconectar, pero no al reconciliar (M05 reconcilia con frecuencia y el contador necesita la fecha). No hay `serverNow` en el cuerpo.
- `expiraEn` null → sin contador y acciones activas (no se inventa plazo); el backend decide al responder.
- `POST /api/solicitudes/:id/responder` con `{acepta:true}` o `{acepta:false}`. Ambos botones se bloquean durante la petición (una sola en vuelo).
- Aceptar y rechazar → `reconciliar()` una vez y el guard resuelve `en-servicio` o `inicio`. En 409 (conflicto/vencimiento) y timeout: reconciliar sin reintentos automáticos; un 409 **no** se convierte en aceptación.
- Al llegar a cero: desactivar acciones y navegar a `solicitud-expirada`; reconciliar sin llamar a ningún endpoint de expiración. Si `solicitud-activa` aún devuelve la oferta vencida, no se reabre ni reinicia el contador.
- Extensión mínima de `resolverRutaOperativa` para que una oferta propia `esperando_respuesta` **ya vencida** resuelva a `solicitud-expirada` (si no, el guard revierte la navegación de expiración); salvo que esa oferta sea la que el conductor ya descartó, en cuyo caso se trata como ausente y resuelve a `inicio`.
- `ExpiredRequestScreen`: estado "El tiempo se terminó" + acción "Volver a mi jornada" → registrar la oferta como descartada en memoria (`ofertaDescartadaId`), reconciliar e ir a inicio. Mientras el backend siga devolviendo esa misma oferta vencida, el guard no regresa a `solicitud-expirada`; el descarte se limpia cuando la reconciliación deja de devolver esa oferta o al cambiar de sesión.
- Pruebas automatizadas de contador, respuesta, pantallas, resolver y guard.

**Fuera de alcance:**

- M07: `en-servicio` y `servicio-finalizado` siguen como stub; M06 solo decide la navegación hacia ellos.
- Chat, llamada al pasajero, navegación en mapa ni tarifa calculada.
- Endpoint de expiración, finalización de servicio, push, segundo plano, Supabase/`service_role` o `EventSource`.
- Mocks, interruptores de simulación o datos ficticios en el entregable.
- Cambios de backend o endpoints nuevos.
- Compilar, publicar o avanzar automáticamente de módulo.

## Modelo de datos

```ts
// src/features/requests/api.ts  (añadido)
export type SolicitudDto = {
  id: string;
  pasajeroId: string;
  conductorAsignadoId: string | null;
  estado: EstadoSolicitud;
  latitudRecogida: number;
  longitudRecogida: number;
  destino: string | null;
  puntoRecogidaTexto: string | null;
  expiraEn: string | null;
  aceptadaEn: string | null;
  finalizadaEn: string | null;
  creadoEn: string;
};

// POST /api/solicitudes/:id/responder {acepta} → 200 SolicitudDto; Bearer; sin reintento.
export function responderSolicitud(
  solicitudId: string,
  token: string,
  acepta: boolean
): Promise<SolicitudDto>;

// Reenvío opcional de la cabecera Date en las lecturas de oferta. El valor es
// el texto HTTP crudo (formato IMF-fixdate, no ISO); null si la cabecera falta.
export function obtenerSolicitudActiva(
  conductorId: string,
  token: string,
  signal?: AbortSignal,
  onFechaServidor?: (fechaServidor: string | null) => void
): Promise<SolicitudDetalleDto | null>;
```

```ts
// src/lib/api-client.ts  (opción aditiva; NO cambia el tipo de retorno de apiRequest)
export type ApiRequestOptions = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  cuerpo?: unknown;
  token?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  // Se invoca con `respuesta.headers.get('Date')` tras una respuesta OK; el
  // valor crudo puede no ser ISO (formato HTTP) y null si la cabecera falta.
  capturarFechaServidor?: (fechaServidor: string | null) => void;
};
```

```ts
// src/features/requests/use-offer-deadline.ts
export type Vencimiento = {
  tienePlazo: boolean;      // false cuando expiraEn es null
  restanteMs: number;       // 0 cuando no hay plazo o ya venció
  restanteSegundos: number; // ceil(restanteMs / 1000); presentación
  expirada: boolean;        // true solo con plazo y restanteMs <= 0
  urgente: boolean;         // restanteSegundos <= 10
};

// server - local, medido al recibir la cabecera Date; 0 si la fecha falta o no
// es un HTTP Date parseable (el contador cae al reloj local).
export function calcularDesfaseMs(fechaServidor: string | null, ahoraLocalMs: number): number;
export function restanteMsHasta(expiraEn: string, ahoraServidorMs: number): number;

export function useOfferDeadline(entrada: {
  expiraEn: string | null;
  fechaServidor?: string | null; // cabecera Date cruda de la última lectura
  ahoraMs?: () => number;        // inyectable para pruebas; por defecto Date.now
  intervaloMs?: number;          // por defecto 1000
}): Vencimiento;
```

```ts
// src/features/requests/use-respond.ts
export type AccionRespuesta = 'aceptar' | 'rechazar';

export type UseResponderResult = {
  respondiendo: AccionRespuesta | null;
  aceptar: () => void;
  rechazar: () => void;
  error: string | null;
  conflicto: boolean;            // true tras 409/ESTADO_INVALIDO
  limpiarMensajes: () => void;
};

export function useResponderSolicitud(entrada: {
  solicitudId: string | null;
  token: string | null;
  reconciliar: () => Promise<void>; // reconciliador real de M05
  ahoraMs?: () => number;
}): UseResponderResult;
// Bloqueo síncrono de doble pulsación: una única petición en vuelo.
// 409/timeout → reconciliar() una vez, sin reintento y sin asumir aceptación.
```

```ts
// src/features/events/use-driver-events.ts  (añadido al resultado)
// Cabecera Date de la última lectura de solicitud-activa (en memoria, por
// sesión/conductor); se limpia al cambiar de sesión o perder la conexión, y la
// siguiente lectura exitosa la reestima. No se limpia al reconciliar.
fechaServidorSolicitud: string | null;
// Oferta vencida que el conductor ya descartó con "Volver a mi jornada" (en
// memoria); se limpia cuando la reconciliación deja de devolver esa oferta o
// al cambiar de sesión.
ofertaDescartadaId: string | null;
descartarOfertaVencida: (solicitudId: string) => void;
```

```ts
// src/navigation/resolve-route.ts  (ampliación)
// expiraEn null → vigente. Con plazo, vigente solo si expiraEn > ahoraServidorMs.
// Es una mejor-esfuerzo local: orienta a qué pantalla navegar; no cambia lo
// que el backend aceptará.
export function ofertaVigente(solicitud: SolicitudDetalleDto, ahoraServidorMs: number): boolean;

// `ahoraServidorMs` = Date.now() + desfase estimado (por defecto, Date.now()).
// `ofertaDescartadaId`: si la oferta propia esperando respuesta está vencida y
// su id coincide, se trata como ausente (resuelve a inicio) en lugar de
// enviar a solicitud-expirada otra vez.
export function resolverRutaOperativa(
  estado: EstadoOperativoConfirmado,
  ahoraServidorMs?: number,
  ofertaDescartadaId?: string | null
): Href;
```

Convenciones: el desfase estimado y la fecha del servidor viven **solo en memoria** (por sesión/conductor); se descartan al cambiar de sesión o perder la conexión —no al reconciliar— y se reestiman con una respuesta nueva al reconectar. `restanteMs` se recalcula siempre desde `expiraEn`, por lo que reabrir no reinicia el plazo. El backend conserva la autoridad: el desfase orienta presentación y navegación local, pero no cambia si el servidor acepta o rechaza una respuesta tardía.

## Archivos previstos

**Crear:**

- `src/features/requests/use-offer-deadline.ts`.
- `src/features/requests/use-respond.ts`.
- `src/features/requests/screens/IncomingRequestScreen.tsx`.
- `src/features/requests/screens/ExpiredRequestScreen.tsx`.
- `src/features/requests/components/*` (contador y filas de campo reutilizables; nulls honestos).
- `src/features/requests/__tests__/` (deadline, respuesta y pantallas).

**Modificar:**

- `src/lib/api-client.ts`: opción aditiva `capturarFechaServidor`.
- `src/features/requests/api.ts`: `SolicitudDto`, `responderSolicitud` y reenvío de `onFechaServidor` en las lecturas.
- `src/features/requests/reconcile.ts`: reenvío opcional de `onFechaServidor` a `obtenerSolicitudActiva`.
- `src/features/events/use-driver-events.ts`: capturar la cabecera `Date` de `solicitud-activa` y exponer `fechaServidorSolicitud`; exponer `ofertaDescartadaId` y `descartarOfertaVencida`, con la limpieza descrita.
- `src/navigation/resolve-route.ts`: `ofertaVigente` y expiración en `resolverRutaOperativa`.
- `src/navigation/guard-sesion.tsx`: pasar `ahoraServidorMs` y `ofertaDescartadaId` a `resolverRutaOperativa`.
- `src/app/(operacion)/solicitud-entrante.tsx` y `solicitud-expirada.tsx`: reexportar las pantallas reales.
- Pruebas existentes de `src/navigation/__tests__`, `src/features/auth/__tests__` (guard) y `src/features/requests/__tests__`.

Las vistas compartidas permanecen fuera de `src/app/`. No se duplican DTOs, cliente HTTP ni almacenamiento de sesión.

## Plan de implementación

1. **Base y contratos.** Ejecutar la suite como línea base; contrastar `POST /responder` con el backend real si está disponible y con `01-CONTRATOS-API.md`. Consultar la documentación del SDK Expo 57 y Context7 antes de tocar temporizadores de React Native. Deja el proyecto ejecutable.
2. **Cabecera Date.** Añadir `capturarFechaServidor` a `api-client` (aditivo, sin cambiar el tipo de `apiRequest`); probar que se invoca con el valor crudo de `Date` y `null` si falta.
3. **API de respuesta.** Añadir `SolicitudDto`, `responderSolicitud` y reenvío de `onFechaServidor` en `requests/api.ts`; probar método, ruta, cuerpo exacto `{acepta}`, Bearer, `null` de solicitud activa y ausencia de reintento.
4. **Contador.** Crear `use-offer-deadline` (`calcularDesfaseMs`, `restanteMsHasta`, `useOfferDeadline`) con tick de 1 s, `urgente ≤ 10 s` y `expiraEn` null sin contador; probar reloj adelantado/atrasado, fecha HTTP ausente o inválida (desfase 0, usa reloj local) y reapertura a mitad de ventana (no reinicia).
5. **Respuesta.** Crear `use-respond` con bloqueo síncrono de doble pulsación; en 409/timeout reconciliar una sola vez, sin reintento y sin tratar 409 como aceptación; probar.
6. **Navegación de expiración.** Añadir `ofertaVigente`, `ahoraServidorMs` y `ofertaDescartadaId` a `resolverRutaOperativa`; `use-driver-events` captura y expone `fechaServidorSolicitud`, `ofertaDescartadaId` y `descartarOfertaVencida` (limpieza al dejar de devolver la oferta o cambiar de sesión); el guard pasa ambas referencias; probar que una oferta propia vencida resuelve a `solicitud-expirada`, que el guard no la revierte y que, tras descartarla con el backend aún devolviéndola, resuelve a `inicio` sin bucle.
7. **Pantallas.** `IncomingRequestScreen` (campos con null honestos, contador, Aceptar/Rechazar bloqueados, navegación a cero) y `ExpiredRequestScreen` ("Volver a mi jornada" → descartar oferta en memoria → reconciliar → inicio); reexportar las rutas; probar textos y acciones.
8. **Verificación final.** Ejecutar suite, `tsc`, `expo lint`, `expo-doctor` y `git diff --check`; revisar que no hay mocks ni datos ficticios en el entregable ni secretos introducidos; registrar evidencia y dejar sin marcar los criterios que exigen dispositivo o backend real. No compilar, publicar ni avanzar de módulo.

Cada incremento incluye sus pruebas aplicables y deja el proyecto ejecutable.

## Criterios de aceptación

### Verificables en esta entrega

- [x] Reabrir una oferta a mitad de ventana muestra solo el tiempo restante (no 60 s).
- [x] Tocar aceptar repetidamente produce una única petición activa.
- [x] Aceptación tardía/409 no entra en servicio ni se convierte en aceptación.
- [x] Tras rechazo no se consulta repetidamente el detalle por id (puede devolver 403); se usa `reconciliar()` una vez.
- [x] `destino` null muestra "Destino no indicado" y `distanciaAproximadaKm` null muestra "Distancia no disponible"; no se muestra el teléfono del pasajero ni textos de demo.
- [x] `expiraEn` null → sin contador y acciones activas.
- [x] Reloj adelantado/atrasado no altera la vigencia: el contador se presenta con el desfase estimado desde la cabecera `Date`, pero el backend decide; no se usa `serverNow` inexistente.
- [x] Una cabecera `Date` HTTP válida ajusta el desfase; una fecha ausente o inválida deja el desfase en 0 y el contador usa el reloj local.
- [x] Al llegar a cero se desactivan acciones y se navega a `solicitud-expirada`; no se llama a un endpoint de expiración inexistente.
- [x] Si `solicitud-activa` aún devuelve la oferta vencida, no se reabre ni se reinicia el contador.
- [x] Tras "Volver a mi jornada", mientras el backend siga devolviendo la misma oferta vencida, el conductor permanece en `inicio` y no regresa a `solicitud-expirada`; una oferta nueva posterior se muestra normalmente.
- [x] Aceptar → reconciliar → `en-servicio`; rechazar → reconciliar → `inicio`, resueltos por el guard.
- [x] No hay mocks, simuladores ni datos ficticios en el código entregable.
- [x] Las pruebas nuevas y la regresión de SPEC 02–06 terminan en verde.
- [x] TypeScript, lint y expo-doctor no reportan errores de bloqueo.

### Evidencia de verificación (2026-10-15)

- `npx jest --runInBand` → **39 suites, 444 pruebas en verde** (`--runInBand`, sin snapshots).
- `npx tsc --noEmit` → sin errores.
- `npx expo lint` → sin avisos de bloqueo.
- `npx expo-doctor` → **21/21 checks passed. No issues detected!**
- `git diff --check` → sin errores de espacios en blanco (solo avisos LF→CRLF de `core.autocrlf` en Windows).
- Revisión de entregable: sin `Simular`/`María Vargas`/`Plaza de San Miguel`/datos ficticios ni secretos hardcodeados; las coincidencias de "teléfono" pertenecen a los flujos de autenticación/registro y al aviso de privacidad del pasajero.
- Mapeo de criterios → pruebas: `use-offer-deadline.test.tsx`, `use-respond.test.tsx`, `IncomingRequestScreen.test.tsx`, `ExpiredRequestScreen.test.tsx`, `resolve-route.test.ts`, `guard-sesion.test.tsx`, `api-client.test.ts`, `requests/api.test.ts`, `use-driver-events.test.tsx`.

### Pendientes de integración, no acreditables en M06 aislado

- [ ] En dispositivo Android/iOS, con backend real: contador, reapertura, aceptación y 409 tardío.
- [ ] Cadena completa oferta → respuesta → `en-servicio` con una asignación real y el job de expiración del backend.

### Comandos de verificación

- `npx jest src/features/requests --runInBand`.
- `npx jest --runInBand`.
- `npx tsc --noEmit`.
- `npx expo lint`.
- `npx expo-doctor`.
- `git diff --check`.

## Decisiones tomadas y descartadas

- **Sí:** leer la oferta desde el contexto reconciliado (`useDriverEventsContext().solicitudActiva`); `GET /api/solicitudes/:id` solo como refresco puntual, nunca en bucle tras rechazar. Decisión confirmada por el usuario.
- **Sí:** estimar el desfase con la cabecera HTTP `Date` mediante un callback aditivo en `apiRequest` (no cambia el tipo de retorno). El valor se llama `fechaServidor` (no `fechaIso`): su formato HTTP no es ISO. Decisión confirmada por el usuario.
- **Sí:** aceptar/rechazar → `reconciliar()` una sola vez y dejar la navegación al guard. Decisión confirmada por el usuario.
- **Sí:** expiración como ruta dedicada `solicitud-expirada`; `resolverRutaOperativa` debe conocer la oferta vencida para no revertir la navegación. Decisión confirmada por el usuario.
- **Sí:** `expiraEn` null → sin contador y acciones activas; no se inventa plazo ni se bloquea por precaución. Decisión confirmada por el usuario.
- **Sí:** el desfase vive en memoria por sesión/conductor; se descarta al cambiar de sesión o perder la conexión y se reestima al reconectar, no al reconciliar. Sin reloj compartido. Decisión confirmada por el usuario.
- **Sí:** la fecha estimada orienta la presentación y la navegación local (oferta vs expiración); el backend decide si acepta la respuesta. Decisión confirmada por el usuario.
- **Sí:** "Volver a mi jornada" descarta la oferta vencida en memoria (`ofertaDescartadaId`) para que el guard no regrese a `solicitud-expirada` mientras el backend siga devolviendo esa oferta; el descarte se limpia al dejar de devolverla o cambiar de sesión. Decisión confirmada por el usuario.
- **Sí:** el contador se recalcula siempre desde `expiraEn`; nunca inicia 60 segundos nuevos al montar o reabrir.
- **Sí:** un 409/timeout reconcilia sin reintentos automáticos y nunca se interpreta como aceptación.
- **No:** endpoint de expiración, polling continuo de la oferta, reintento automático de la respuesta.
- **No:** chat, llamada al pasajero, mapa/navegación, tarifa, push o segundo plano.
- **No:** mostrar u obtener el teléfono del pasajero; importar datos o textos de la demo HTML.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El guard revierte la navegación a `solicitud-expirada` mientras `solicitud-activa` sigue devolviendo la oferta vencida | `resolverRutaOperativa` enruta la oferta propia vencida a `solicitud-expirada`; el resolver comparte el reloj estimado con la pantalla. |
| Bucle "Volver a mi jornada" → inicio → `solicitud-expirada` mientras el backend aún no procesó el vencimiento | `descartarOfertaVencida` registra el id en memoria; `resolverRutaOperativa` trata esa oferta vencida como ausente hasta que la reconciliación deje de devolverla o cambie la sesión. |
| Carrera de ±1 s entre el temporizador de la pantalla y la re-evaluación del guard | La pantalla reconcilia al navegar; el resolver usa el mismo reloj estimado; el estado se estabiliza al pasar el vencimiento. |
| Desfase del reloj del dispositivo | Presentación y navegación local ajustadas por la cabecera `Date`; la vigencia real y la aceptación de la respuesta siguen siendo autoridad del backend. |
| Respuesta perdida (timeout) tras aceptar | Reconciliar antes de repetir; no asumir `en-servicio` sin confirmación del backend. |
| Doble pulsación de Aceptar/Rechazar | Bloqueo síncrono de una única petición en vuelo; ambos botones desactivados durante la petición. |
| `expiraEn` null tratado como vencido | Sin plazo: sin contador y acciones activas; el backend decide al responder. |

## Lo que **no** está en esta spec

- M07: servicio activo, finalización y `servicio-finalizado`; `en-servicio` permanece stub.
- Chat, llamada, mapa/navegación y tarifa calculada.
- Push, segundo plano, pantalla bloqueada, Supabase/`service_role`.
- Endpoints nuevos, endpoint de expiración o cambios de backend.
- Mocks, simuladores o datos ficticios en el entregable.
- Compilar, publicar o avanzar automáticamente de módulo.
