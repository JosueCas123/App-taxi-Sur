# SPEC 04 — Inicio, jornada y disponibilidad

> **Estado:** Aprobado
> **Depende de:** SPEC 02, SPEC 03
> **Fecha:** 2026-10-14
> **Objetivo:** Reflejar la jornada y la disponibilidad confirmadas por el servidor y enviar solo acciones de iniciar/finalizar/activar, separando cuenta, jornada, disponibilidad y GPS.

## Por qué existe esta spec

M01 aportó sesión y perfil; M02 el registro, estados de cuenta y guards. Falta el primer flujo operativo: iniciar/finalizar jornada y activar/desactivar disponibilidad contra el backend real, con un inicio que separe cuatro conceptos que el prototipo mezcla visualmente.

> **Correspondencia de nombres:** `M03` es el identificador del módulo en `docs/implementacion-app/modulos/M03-JORNADA-Y-DISPONIBILIDAD.md`; este documento es su spec de implementación, `SPEC 04`. En el texto, "M03" designa el módulo (alcance funcional) y "SPEC 04" este archivo (contrato de implementación). `M04`, `M05`, `M06`, `M07` y `M08` designan módulos del plan, no specs numeradas existentes.

Fuentes de requisitos:

- `docs/implementacion-app/modulos/M03-JORNADA-Y-DISPONIBILIDAD.md`.
- `docs/implementacion-app/01-CONTRATOS-API.md`.
- `docs/implementacion-app/02-ARQUITECTURA.md`.
- Referencia visual `inicio.html` en `docs/implementacion-app/referencias-ui/`.

Los HTML no son contratos ni pruebas de integración. Sus controles, simulaciones y el texto "herramientas de revisión / simular" no se trasladan a la app entregable.

### Dependencias comprobadas

- SPEC 02 existe con estado `Implementado`: sesión segura, `obtenerConductor`, `queryKeys.conductor(conductorId)`, `actualizarPerfil`, invalidación con limpieza de caché y generación de sesión.
- SPEC 03 existe con estado `Aprobado`: registro, estados de cuenta reales, guards centralizados (`GuardRutaPrivada`, `GuardRutaOperativa`, `GuardRutaCuenta`) y `evaluarAccesoOperativo`.
- `src/app/(operacion)/inicio.tsx` es un stub con el texto "Jornada y disponibilidad (M03)".
- El contrato ya expone `PATCH /api/conductores/:id/jornada` y `PATCH /api/conductores/:id/disponibilidad`; devuelven `ConductorDetalleDto`. No se crean endpoints.
- M04 (ubicación), M05 (SSE/solicitud-activa) y M07 (finalización) no están implementados. M03 prepara las interfaces y no los adelanta.
- La validación de M01–M03 contra backend real y dispositivo sigue pendiente.

## Alcance

**Incluido:**

- Pantalla de inicio (`inicio`) que muestra cuatro conceptos separados y legibles por sí mismos: estado de cuenta, jornada, disponibilidad y GPS. Ninguno se colapsa en un único booleano.
- `PATCH /api/conductores/:id/jornada` con `{accion:"iniciar"}` y `{accion:"finalizar"}`.
- `PATCH /api/conductores/:id/disponibilidad` con `{disponible:true|false}`.
- Actualizar el perfil desde el `ConductorDetalleDto` devuelto por cada mutación, usando la misma clave de caché ya existente (`queryKeys.conductor`). Sin duplicar el perfil en un store nuevo.
- Iniciar jornada no activa disponibilidad: el control de disponibilidad permanece en `no_disponible` hasta una acción explícita.
- Habilitar "disponible" solo cuando: cuenta `aprobado`, jornada `activa`, ubicación operativa lista (según contrato de ubicación) y disponibilidad actual no es `en_servicio` ni `solicitud_pendiente`. Decisión de UI pura y verificable en la política.
- Definir cuándo se muestra o habilita cada control y qué respuesta del servidor confirma cada cambio, mediante la política pura: iniciar jornada, finalizar jornada, activar disponibilidad y desactivar disponibilidad.
- Ciclo de mutación: desactivar el control afectado mientras la petición está en curso (bloqueo síncrono de doble pulsación); no mostrar cambio confirmado antes de la respuesta; sin actualización optimista ni reintento automático.
- Ante HTTP 409 (`INVALID_STATE_TRANSITION`): recuperar el perfil real y explicar el conflicto. La acción afectada permanece bloqueada en M03 y solo se vuelve a habilitar si el perfil recién recuperado la vuelve válida según la política. Se expone una costura de integración para que M05/M06 reconcilien una oferta activa, pero la costura no-op de M03 no se presenta como reconciliación efectiva. No se consulta `solicitud-activa` ni se inventan cancelaciones.
- Si el refresco de perfil tras el 409 falla, conservar el estado anterior como no confirmado, mostrar que no se pudo sincronizar y ofrecer reintentar la carga; no habilitar controles con datos posiblemente obsoletos.
- Cierre diferido: si la jornada está `activa` con `en_servicio` y se envía `finalizar`, el backend conserva `en_servicio` y marca `cierreJornadaSolicitado`; la pantalla lo muestra, mantiene el servicio y no presenta la jornada como finalizada.
- Interfaz de ubicación operativa consumida por el inicio (contrato para M04). En la app entregable permanece "no lista" (disponible bloqueado y explicado); los tests inyectan un doble. No se envía ningún mock dentro de la app.
- Reutilizar guardas y política de acceso existentes de M02; no reimplementar estados de cuenta.
- Pruebas automatizadas de política, API, hooks y pantalla.

**Fuera de alcance:**

- Permiso, captura y envío de ubicación reales (M04). M03 solo consume su interfaz.
- SSE, reconexión y consulta/reconciliación de `solicitud-activa` (M05).
- Oferta entrante y respuesta (M06).
- Servicio activo y finalización real del servicio (M07). El criterio de "servicio completado" se verifica con un perfil simulado del servidor, no finalizando un servicio.
- Pantalla de perfil y cierre de sesión (M08).
- Cualquier mock, interruptor de simulación o dato ficticio dentro de la app entregable (solo en pruebas automatizadas).
- Cambios de backend, endpoints nuevos, refresh token o logout remoto.
- Cuentas reales de prueba, pruebas contra producción, compilación, publicación o avance automático de módulo.

## Modelo de datos

Se reutiliza `ConductorDetalleDto` y `queryKeys.conductor(conductorId)` de SPEC 02/03. No se crea una segunda fuente de verdad para el perfil.

```ts
// src/features/shift/api.ts
export function iniciarJornada(conductorId: string, token: string): Promise<ConductorDetalleDto>;
export function finalizarJornada(conductorId: string, token: string): Promise<ConductorDetalleDto>;
export function cambiarDisponibilidad(
  conductorId: string,
  token: string,
  disponible: boolean
): Promise<ConductorDetalleDto>;
// PATCH /api/conductores/:id/jornada  {accion:'iniciar'|'finalizar'}
// PATCH /api/conductores/:id/disponibilidad  {disponible:boolean}
// Bearer; el api-client no reintenta mutaciones.
```

```ts
// src/features/shift/ubicacion-operativa.tsx  (contrato para M04)
export type MotivoUbicacionNoLista =
  | 'm04_pendiente'
  | 'permiso_denegado'
  | 'gps_apagado'
  | 'sin_muestra'
  | 'desactualizada';

export type EstadoUbicacionOperativa = {
  lista: boolean;
  motivo: MotivoUbicacionNoLista | null;
  antiguedadMs: number | null; // antigüedad de la última muestra aceptada por el servidor
};

// Proveedor por defecto de la app entregable: { lista:false, motivo:'m04_pendiente', antiguedadMs:null }.
// M04 sustituirá el proveedor por ubicación real; los tests inyectan un doble.
export const UbicacionOperativaProvider: React.FC<{
  children: React.ReactNode;
  // `valor` existe solo para inyectar un doble en pruebas; la app entregable usa el valor por defecto.
  valor?: EstadoUbicacionOperativa;
}>;
export function useUbicacionOperativa(): EstadoUbicacionOperativa;
```

`antiguedadMs` se compara contra un umbral estricto de **5 minutos**: la ubicación cuenta como lista solo con **menos de 5 minutos**; al cumplir 5 minutos se considera desactualizada (coincide con M04). `ubicacion.lista` ya implica muestra aceptada por el servidor y por debajo del umbral.

```ts
// src/features/shift/jornada-policy.ts  (política pura)
export type MotivoDisponibilidadBloqueada =
  | 'cuenta_no_aprobada'
  | 'jornada_no_activa'
  | 'ubicacion_no_lista'
  | 'estado_no_disponible'; // en_servicio o solicitud_pendiente

export function puedeActivarDisponibilidad(entrada: {
  estadoCuenta: ConductorDetalleDto['estado'];
  estadoJornada: ConductorDetalleDto['estadoJornada'];
  estadoDisponibilidad: ConductorDetalleDto['estadoDisponibilidad'];
  ubicacion: EstadoUbicacionOperativa;
}): { permitido: boolean; motivo: MotivoDisponibilidadBloqueada | null };

// Control de jornada: qué acción se muestra y si está habilitada.
// 'no_iniciada' | 'finalizada' -> accion 'iniciar' (habilitado).
// 'activa' con cierreJornadaSolicitado=false -> accion 'finalizar' (habilitado).
// 'activa' con cierreJornadaSolicitado=true  -> accion 'finalizar' (deshabilitado; cierre ya solicitado).
export function accionJornada(conductor: ConductorDetalleDto): {
  accion: 'iniciar' | 'finalizar';
  habilitado: boolean;
  motivo: 'cierre_solicitado' | null;
};

// Control de disponibilidad: qué acción se muestra y si está habilitada.
// 'disponible' -> tipo 'desactivar' (habilitado; apagar siempre es seguro).
// 'en_servicio' | 'solicitud_pendiente' -> tipo 'bloqueado' (motivo 'estado_no_disponible').
// 'no_disponible' -> tipo 'activar' habilitado solo si puedeActivarDisponibilidad lo permite.
export function accionDisponibilidad(
  entrada: {
    estadoCuenta: ConductorDetalleDto['estado'];
    estadoJornada: ConductorDetalleDto['estadoJornada'];
    estadoDisponibilidad: ConductorDetalleDto['estadoDisponibilidad'];
    ubicacion: EstadoUbicacionOperativa;
  }
): {
  tipo: 'activar' | 'desactivar' | 'bloqueado';
  habilitado: boolean;
  motivo: MotivoDisponibilidadBloqueada | null;
};
```

```ts
// src/features/shift/use-shift.ts
export function useShift(): {
  conductor: ConductorDetalleDto | null;
  iniciarJornada: () => void;
  finalizarJornada: () => void;
  activarDisponibilidad: () => void;
  desactivarDisponibilidad: () => void;
  mutando: 'jornada' | 'disponibilidad' | null;
  error: string | null;
  conflicto: string | null;   // mensaje de 409 explicado
  ubicacion: EstadoUbicacionOperativa;
  disponibilidad: { permitido: boolean; motivo: MotivoDisponibilidadBloqueada | null };
};
// Cada mutación actualiza queryKeys.conductor(conductorId) con la respuesta del servidor y
// solo entonces se muestra el cambio como confirmado.
// En 409: refresca el perfil (actualizarPerfil) e invoca la costura de reconciliación (M05).
// La costura no-op de M03 NO desbloquea: la acción sigue bloqueada hasta que el perfil
// recuperado vuelva a satisfacer la política.
// Si el refresco de perfil falla: el estado queda 'no confirmado', se expone el aviso de
// no sincronización con reintento y no se habilitan controles con datos posiblemente obsoletos.
// En JSON de control: mutando: 'jornada' | 'disponibilidad' | null (el valor concreto bloquea
// únicamente el control afectado); error para errores recuperables; conflicto para el 409.
// Una respuesta de otra generación de sesión se descarta.
```

```ts
// src/features/shift/reconciliacion-oferta.tsx  (costura para M05)
export type ReconciliadorOferta = () => Promise<void>;
// Proveedor por defecto: no-op. Se documenta como punto de integración, NO como reconciliación efectiva.
// M05/M06 lo sustituirán para reconciliar la oferta activa; M03 no consulta solicitud-activa.
// Tras invocarlo, la acción del 409 solo se rehabilita si el perfil recuperado satisface la política.
export function ReconciliacionOfertaProvider(props: {
  children: React.ReactNode;
  // `reconciliador` existe solo para inyectar un doble en pruebas; la app entregable usa el no-op.
  reconciliador?: ReconciliadorOferta;
}): React.JSX.Element;
export function useReconciliacionOferta(): ReconciliadorOferta;
```

Convenciones: el estado remoto vive en TanStack Query; el `apiRequest` no reintenta mutaciones; el perfil devuelto por una mutación reemplaza la caché `conductor`. Ningún concepto (cuenta/jornada/disponibilidad/GPS) se deriva del otro por conveniencia.

## Archivos previstos

**Crear:**

- `src/features/shift/api.ts`.
- `src/features/shift/jornada-policy.ts`.
- `src/features/shift/ubicacion-operativa.tsx`.
- `src/features/shift/reconciliacion-oferta.tsx`.
- `src/features/shift/use-shift.ts`.
- `src/features/shift/screens/HomeScreen.tsx`.
- `src/features/shift/components/EstadoCuentaResumen.tsx`.
- `src/features/shift/components/JornadaCard.tsx`.
- `src/features/shift/components/DisponibilidadCard.tsx`.
- `src/features/shift/components/UbicacionCard.tsx`.
- `src/features/shift/__tests__/` para política, API, hook, ubicación y pantalla.

**Modificar:**

- `src/app/(operacion)/inicio.tsx` para reexportar `HomeScreen`.
- `src/app/(operacion)/_layout.tsx` para montar `UbicacionOperativaProvider` y `ReconciliacionOfertaProvider` en el ámbito operativo.

Las vistas compartidas permanecen fuera de `src/app/`. No se duplican DTOs, cliente HTTP ni almacenamiento de sesión.

## Plan de implementación

1. **Confirmar base y contratos.** Ejecutar la suite existente como línea base. Contrastar el contrato con el backend si su código está disponible; si no, documentar la imposibilidad sin inventar reglas. Consultar documentación del SDK Expo 57 instalado y Context7 antes de tocar APIs de Expo/React Native. Mantener dependencias salvo necesidad demostrada.
2. **Política pura.** Crear `jornada-policy.ts` con `puedeActivarDisponibilidad`, `accionJornada` y `accionDisponibilidad`, y pruebas de todos los motivos de bloqueo (cuenta, jornada, ubicación, estado no disponible) y de la vía permitida, incluidos los límites `<5 min` vs `=5 min` y el caso `cierreJornadaSolicitado`. No depende de React.
3. **API de jornada y disponibilidad.** Añadir `shift/api.ts` sobre el `api-client` existente, sin Bearer duplicado ni reintentos. Probar método, ruta, cuerpo exacto, `Authorization` y que no hay reintento automático.
4. **Interfaz de ubicación.** Crear `ubicacion-operativa.tsx` con el proveedor por defecto `no lista (m04_pendiente)` y el hook. Probar el valor por defecto y que el umbral de 5 minutos se evalúa en la política.
5. **Hook de mutaciones.** Crear `use-shift.ts`: iniciar/finalizar/activar/desactivar, actualización de `queryKeys.conductor` desde la respuesta, bloqueo de doble pulsación con estado `mutando`, descarte de respuestas de otra sesión. En 409: refrescar el perfil, invocar la costura de reconciliación y mantener la acción bloqueada salvo que el perfil recuperado la vuelva válida. Si el refresco de perfil falla, conservar el estado anterior como no confirmado, exponer el aviso de no sincronización y ofrecer reintento sin habilitar controles con datos posiblemente obsoletos. Probar concurrencia, 409, fallo de refresco y descarte tardío.
6. **Pantalla de inicio.** Crear `HomeScreen` con los cuatro conceptos y sus componentes; montar en `src/app/(operacion)/inicio.tsx`. Deshabilitar el control de disponibilidad con motivo visible cuando la política lo bloquee y durante mutaciones. Mostrar `cierreJornadaSolicitado` conservando `en_servicio`. Probar interacción y textos.
7. **Costuras para M04/M05.** Montar `UbicacionOperativaProvider` (default no lista) y `ReconciliacionOfertaProvider` (default no-op) en `(operacion)/_layout.tsx`. Verificar por pruebas que con un doble de ubicación lista la disponibilidad se habilita, que el reconciliador se invoca en 409 y que un reconciliador no-op no desbloquea por sí solo.
8. **Verificación final.** Ejecutar la suite, `tsc`, `lint`, `expo-doctor` y `git diff --check`. Revisar que no hay mocks ni datos ficticios en el código entregable y que no se introducen secretos. Registrar evidencia y dejar sin marcar los criterios que exigen backend real o dispositivo. No compilar, publicar ni avanzar de módulo.

Cada incremento incluye sus pruebas aplicables y deja el proyecto ejecutable.

## Criterios de aceptación

### Verificables en esta entrega

- [x] Iniciar jornada envía `{accion:"iniciar"}` y la respuesta `activa`/`no_disponible` se refleja sin enviar `disponible` automáticamente.
- [x] El inicio muestra separados estado de cuenta, jornada, disponibilidad y GPS, cada uno legible por sí mismo.
- [x] No se habilita "disponible" sin ubicación operativa lista (muestra aceptada por el servidor con antigüedad **menor a 5 minutos**; a los 5 minutos se considera desactualizada).
- [x] Con la interfaz de ubicación por defecto (`m04_pendiente`), "disponible" queda bloqueado con motivo visible.
- [x] Con un doble de ubicación lista, cuenta `aprobado` y jornada `activa`, "disponible" se habilita; envía `{disponible:true}` y la respuesta `disponible` confirma el cambio.
- [x] Desactivar disponibilidad se muestra y habilita cuando `estadoDisponibilidad === 'disponible'`; envía `{disponible:false}` y la respuesta `no_disponible` confirma el cambio.
- [x] El control de jornada muestra "Iniciar jornada" con `no_iniciada`/`finalizada` y "Finalizar jornada" con `activa`; con `cierreJornadaSolicitado === true` el control de finalizar queda deshabilitado y se muestra el cierre pendiente.
- [x] `en_servicio` y `solicitud_pendiente` no permiten alternar disponibilidad; se muestran como estado bloqueado con motivo.
- [x] Una doble pulsación genera una sola mutación concurrente; el control afectado se desactiva mientras está en curso.
- [x] El cambio no se muestra como confirmado antes de recibir la respuesta; no hay actualización optimista.
- [x] Ante 409, se muestra el conflicto, se recupera el perfil real y se invoca la costura de reconciliación sin consultar `solicitud-activa` ni inventar cancelaciones.
- [x] Tras un 409 la acción permanece bloqueada si el perfil recuperado no la vuelve válida; un reconciliador no-op no desbloquea por sí solo.
- [x] Si el refresco de perfil tras el 409 falla, el estado queda como no confirmado, se muestra que no se pudo sincronizar y se ofrece reintentar sin habilitar controles con datos posiblemente obsoletos.
- [x] Cerrar jornada con `en_servicio` conserva `en_servicio`, mantiene el servicio y muestra `cierreJornadaSolicitado` sin presentar la jornada como finalizada.
- [x] Dado un perfil del servidor con jornada `finalizada`/`no_disponible`, el inicio lo refleja (probado con doble de servidor).
- [x] Cada mutación escribe el perfil devuelto en `queryKeys.conductor` sin duplicar el DTO en otro store.
- [x] Una respuesta tardía de otra generación de sesión no reemplaza el perfil actual.
- [x] No aparece ningún interruptor de simulación, mock GPS ni dato ficticio en el código entregable.
- [x] Las pruebas nuevas y la regresión de SPEC 02/03 terminan en verde.
- [x] TypeScript, lint y expo-doctor no reportan errores de bloqueo.

### Pendientes de integración, no acreditables en M03 aislado

- [ ] M04 conecta la ubicación real: el inicio habilitará "disponible" solo con permiso, muestra reciente aceptada (`esValida`) y con antigüedad menor a 5 minutos, y explicará permiso denegado/GPS apagado/desactualizada.
- [ ] M05 reconcilia la oferta activa antes de reintentar tras 409; M03 sustituye el reconciliador no-op por el real.
- [ ] M07 completa el servicio tras el cierre diferido y el perfil real muestra jornada `finalizada`/`no_disponible`.
- [ ] Contra un backend real autorizado, iniciar jornada, finalizar con servicio y alternar disponibilidad respetan `INVALID_STATE_TRANSITION`/409 y devuelven el perfil esperado. Registrar entorno, fecha y resultado sin token.
- [ ] En dispositivo se comprueban navegación, área segura, texto ampliado y objetivos táctiles ≥48 dp.

### Comandos de verificación

- `npx jest src/features/shift --runInBand`.
- `npx jest --runInBand`.
- `npx tsc --noEmit`.
- `npx expo lint`.
- `npx expo-doctor`.
- `git diff --check`.

## Decisiones tomadas y descartadas

- **Sí:** interfaz de ubicación con doble solo en tests; la app entregable muestra GPS "no listo (M04 pendiente)". Decisión confirmada por el usuario; evita introducir mock GPS en el entregable.
- **Sí:** ante 409, refrescar el perfil real y exponer una costura para M05, sin consultar `solicitud-activa`. Decisión confirmada por el usuario; no adelanta M05/M06.
- **Sí:** tras un 409 la acción permanece bloqueada salvo que el perfil recuperado la vuelva válida; la costura no-op de M03 no se presenta como reconciliación efectiva. Decisión derivada de la revisión del 2026-10-14.
- **Sí:** si el refresco de perfil tras el 409 falla, el estado queda no confirmado con reintento y no se habilitan controles con datos obsoletos. Decisión derivada de la revisión del 2026-10-14.
- **Sí:** umbral estricto de ubicación: menos de 5 minutos cuenta como lista; a los 5 minutos se considera desactualizada. Decisión confirmada por el usuario; coherente con M04.
- **Sí:** definir en la política el momento y la habilitación de los controles de iniciar jornada, finalizar jornada, activar y desactivar disponibilidad, y la confirmación por la respuesta del servidor. Decisión derivada de la revisión del 2026-10-14.
- **Sí:** verificación con pruebas automatizadas y criterios de backend/dispositivo marcados como pendientes. Decisión confirmada por el usuario; coherente con SPEC 03.
- **Sí:** cuatro conceptos separados en el inicio. Decisión confirmada por el usuario; tarea 1 del módulo.
- **Sí:** reutilizar `queryKeys.conductor` y actualizar la caché con la respuesta de cada mutación. Es la fuente de verdad ya existente; evita un store duplicado.
- **Sí:** sin actualización optimista y sin reintento automático de mutaciones; el servidor es la autoridad y un timeout no prueba que la operación no se ejecutó.
- **Sí:** el criterio de "servicio completado" se verifica con un perfil simulado; la finalización real es M07.
- **No:** crear endpoints, cancelar solicitudes o simular SSE/GPS. No están en el contrato ni en el alcance.
- **No:** convertir cuenta, jornada, disponibilidad y GPS en un único booleano de "listo".

## Riesgos

| Riesgo | Mitigación |
|---|---|
| M03 parece terminado aunque la disponibilidad real dependa de M04 | Separar aceptación local de la integrada; mostrar GPS "no listo" y no marcar los criterios con M04/M05/M07. |
| 409 sin reconciliación de oferta deja al conductor en conflicto recurrente | Refrescar perfil, explicar el conflicto y mantener la acción bloqueada hasta que el perfil recuperado la vuelva válida; costura para M05 sin presentarla como reconciliación efectiva. |
| Refresco de perfil fallido tras 409 deja datos obsoletos | Estado no confirmado, aviso de no sincronización y reintento; no habilitar controles con datos posiblemente obsoletos. |
| Borde de frescura de GPS interpretado como ≤5 min | Umbral estricto documentado: menos de 5 minutos es lista; a los 5 minutos es desactualizada. |
| Respuesta tardía de otra sesión sobrescribe el perfil | Reutilizar generación de sesión, cancelación y descarte de respuestas tardías de SPEC 02/03. |
| Doble pulsación dispara dos mutaciones | Bloqueo síncrono del control afectado mientras `mutando` no es `null`. |
| El prototipo sugiere simular solicitud/GPS | Los HTML son solo diseño; no se trasladan simulaciones ni datos ficticios al entregable. |

## Lo que **no** está en esta spec

- Implementar M04, M05, M06, M07, M08 completos.
- Ubicación real, SSE, ofertas o finalización de servicio.
- Mocks, interruptores de simulación o datos ficticios dentro de la app.
- Cambios de backend o endpoints nuevos.
- Compilar, publicar o avanzar automáticamente al módulo siguiente.

## Evidencia de verificación

- **Fecha:** 2026-10-14.
- **Entorno:** rama `spec-04-jornada-disponibilidad`; `app-taxi` 1.0.0; Expo SDK `~57.0.29`, React Native 0.86.3, React 19.2.3; gestor de paquetes npm (`package-lock.json`, sin `bun.lock`).
- **Comandos ejecutados (npm / npx):**
  - `npx jest src/features/shift --runInBand` → 6 suites, 62/62 pruebas en verde.
  - `npx jest --runInBand` → 21 suites, 237/237 pruebas en verde (incluye regresión de SPEC 01/02/03).
  - `npx tsc --noEmit` → exit 0, sin errores.
  - `npx expo lint` → exit 0, sin errores.
  - `npx expo-doctor` → 21/21 comprobaciones, sin problemas.
  - `git diff --check` → exit 0 (solo avisos de fin de línea LF/CRLF, sin errores de whitespace).
- **Revisión del entregable:** búsqueda estática en `src/` sin coincidencias de `mock`, `simul`, `fake`, `dummy`, `fixture`, `Math.random`, `setTimeout(`, `localhost`/`127.0.0.1` en código no de prueba; el `UbicacionOperativaProvider` entregable usa `{ lista:false, motivo:'m04_pendiente', antiguedadMs:null }` y el `ReconciliacionOfertaProvider` entregable usa el reconciliador no-op; sin interruptores de simulación ni datos ficticios. No se incorporan secretos, tokens ni credenciales en el código.
- **Fuentes consultadas:** documentación oficial del SDK Expo 57 (`https://docs.expo.dev/versions/v57.0.0/`) para confirmar SDK 57 ↔ React Native 0.86 ↔ React 19.2.3 frente a `package.json`; contratos del proyecto `docs/implementacion-app/01-CONTRATOS-API.md` y `docs/implementacion-app/modulos/M03-JORNADA-Y-DISPONIBILIDAD.md`. El paso 7/8 no introdujo APIs nuevas de Expo/React Native.
- **Plataformas:** toda la evidencia automática corresponde a pruebas Jest (entorno Node con jest-expo) y revisión estática de TypeScript. No se ejecutó en Android ni iOS y no se dispone de capturas de dispositivo; los criterios que exigen dispositivo o API real se mantienen sin marcar.

| Criterio | Resultado | Plataforma | Evidencia | Pendiente o bloqueo |
| --- | --- | --- | --- | --- |
| Iniciar jornada envía `{accion:"iniciar"}` y la respuesta `activa`/`no_disponible` se refleja sin enviar `disponible` automáticamente | Verificado | Jest | `api.test.ts` "iniciarJornada hace PATCH … con {accion:\"iniciar\"} y Bearer"; `use-shift.test.tsx` "iniciar jornada escribe el perfil devuelto en queryKeys.conductor y refleja activa/no_disponible" | — |
| El inicio muestra separados estado de cuenta, jornada, disponibilidad y GPS, cada uno legible por sí mismo | Verificado | Jest | `HomeScreen.test.tsx` "muestra estado de cuenta, jornada, disponibilidad y GPS como bloques distintos" | — |
| No se habilita "disponible" sin ubicación operativa lista (menor a 5 minutos; a los 5 minutos desactualizada) | Verificado | Jest | `jornada-policy.test.ts` (`esUbicacionOperativaLista`: `UBICACION_VIGENCIA_MS - 1` lista, `UBICACION_VIGENCIA_MS` y `+ 1` no); `ubicacion-operativa.test.tsx` replica los límites | — |
| Con la interfaz de ubicación por defecto (`m04_pendiente`), "disponible" queda bloqueado con motivo visible | Verificado | Jest | `HomeScreen.test.tsx` "con la ubicación por defecto (m04_pendiente) bloquea disponible con motivo visible"; `use-shift.test.tsx` "con la ubicación por defecto (m04_pendiente) bloquea la disponibilidad" | — |
| Con doble de ubicación lista, cuenta `aprobado` y jornada `activa`, "disponible" se habilita; envía `{disponible:true}` y la respuesta confirma | Verificado | Jest | `HomeScreen.test.tsx` "con ubicación lista, cuenta aprobada y jornada activa habilita y activa la disponibilidad"; `use-shift.test.tsx` "activar disponibilidad envía disponible:true y confirma con la respuesta" | — |
| Desactivar disponibilidad se muestra y habilita con `disponible`; envía `{disponible:false}` y la respuesta `no_disponible` confirma | Verificado | Jest | `HomeScreen.test.tsx` "cuando está disponible permite desactivar y refleja no_disponible"; `api.test.ts` "cambiarDisponibilidad(false) hace PATCH con {disponible:false}" | — |
| El control de jornada muestra "Iniciar"/"Finalizar" según estado; con `cierreJornadaSolicitado === true` deshabilita finalizar y muestra el cierre pendiente | Verificado | Jest | `HomeScreen.test.tsx` "con cierreJornadaSolicitado muestra el cierre pendiente y deshabilita finalizar"; `jornada-policy.test.ts` "accionJornada" (iniciar con no_iniciada/finalizada, finalizar con activa, deshabilitado con cierre solicitado) | — |
| `en_servicio` y `solicitud_pendiente` no permiten alternar disponibilidad; se muestran como bloqueado con motivo | Verificado | Jest | `HomeScreen.test.tsx` "con en_servicio no permite alternar disponibilidad y explica el bloqueo"; `jornada-policy.test.ts` `puedeActivarDisponibilidad`/`accionDisponibilidad` con ambos estados | — |
| Una doble pulsación genera una sola mutación concurrente; el control afectado se desactiva mientras está en curso | Verificado | Jest | `use-shift.test.tsx` "una doble pulsación genera una sola mutación concurrente" (una sola petición de mutación) | — |
| El cambio no se muestra como confirmado antes de recibir la respuesta; no hay actualización optimista | Verificado | Jest | `use-shift.test.tsx` "no muestra el cambio como confirmado antes de la respuesta del servidor" | — |
| Ante 409 se muestra el conflicto, se recupera el perfil real y se invoca la costura sin consultar `solicitud-activa` ni inventar cancelaciones | Verificado | Jest | `use-shift.test.tsx` "ante 409 muestra el conflicto, refresca el perfil e invoca la costura sin desbloquear si sigue inválida"; la costura se monta en `src/app/(operacion)/_layout.tsx` (`operacion-layout.test.tsx`) | — |
| Tras un 409 la acción permanece bloqueada si el perfil no la vuelve válida; un reconciliador no-op no desbloquea por sí solo | Verificado | Jest | `use-shift.test.tsx` "ante 409 … sin desbloquear si sigue inválida" y "tras un 409 con reconciliador no-op, el perfil recuperado válido vuelve a habilitar la acción" | — |
| Si el refresco de perfil tras el 409 falla, el estado queda como no confirmado, se avisa y se ofrece reintentar sin habilitar controles con datos obsoletos | Verificado | Jest | `use-shift.test.tsx` "si el refresco tras 409 falla, queda no confirmado, avisa y permite reintentar" | — |
| Cerrar jornada con `en_servicio` conserva `en_servicio`, mantiene el servicio y muestra `cierreJornadaSolicitado` sin presentar la jornada como finalizada | Verificado | Jest | `HomeScreen.test.tsx` "con cierreJornadaSolicitado muestra el cierre pendiente…" (`en_servicio` + cierre pendiente, sin mostrar la jornada como finalizada); `jornada-policy.test.ts` | — |
| Dado un perfil del servidor con jornada `finalizada`/`no_disponible`, el inicio lo refleja | Verificado | Jest | `jornada-policy.test.ts` "muestra iniciar habilitado con jornada finalizada"; `api.test.ts` "finalizarJornada … responde perfil finalizada" | — |
| Cada mutación escribe el perfil devuelto en `queryKeys.conductor` sin duplicar el DTO en otro store | Verificado | Jest | `use-shift.test.tsx` "iniciar jornada escribe el perfil devuelto en queryKeys.conductor…"; la única fuente es TanStack Query (`queryClient.setQueryData`) | — |
| Una respuesta tardía de otra generación de sesión no reemplaza el perfil actual | Verificado | Jest | `use-shift.test.tsx` "una respuesta tardía de otra sesión no reemplaza el perfil actual" | — |
| No aparece ningún interruptor de simulación, mock GPS ni dato ficticio en el código entregable | Verificado | Revisión estática | Búsqueda en `src/` sin coincidencias de `mock`/`simul`/`fake`/`dummy`/`fixture`; proveedores entregables con valores por defecto reales (`m04_pendiente`, reconciliador no-op) | — |
| Las pruebas nuevas y la regresión de SPEC 02/03 terminan en verde | Verificado | Jest | `npx jest --runInBand` → 21 suites, 237/237 pruebas | — |
| TypeScript, lint y expo-doctor no reportan errores de bloqueo | Verificado | Node | `npx tsc --noEmit` exit 0; `npx expo lint` exit 0; `npx expo-doctor` 21/21; `git diff --check` exit 0 | — |
| M04 conecta la ubicación real: el inicio habilitará "disponible" solo con permiso, muestra reciente aceptada y con antigüedad menor a 5 minutos, y explicará permiso denegado/GPS apagado/desactualizada | Bloqueado | — | No ejecutado: fuera del alcance de M03; el contrato se consume con un doble en pruebas | Requiere implementación e integración de M04 |
| M05 reconcilia la oferta activa antes de reintentar tras 409; M03 sustituye el reconciliador no-op por el real | Bloqueado | — | No ejecutado: `ReconciliacionOfertaProvider` entregable permanece no-op | Requiere M05/M06 |
| M07 completa el servicio tras el cierre diferido y el perfil real muestra jornada `finalizada`/`no_disponible` | Bloqueado | — | No ejecutado: no hay finalización real de servicio en M03 | Requiere M07 |
| Contra un backend real autorizado, iniciar/finalizar jornada con servicio y alternar disponibilidad respetan `INVALID_STATE_TRANSITION`/409 y devuelven el perfil esperado | Bloqueado | — | No ejecutado: los dobles de Jest no certifican integración real | Requiere autorización posterior del entorno y datos de prueba |
| En dispositivo se comprueban navegación, área segura, texto ampliado y objetivos táctiles ≥48 dp | Bloqueado | Android / iOS | Sin dispositivo ni capturas; no se dispone de evidencia visual | Ejecutar la app en dispositivo (o emulador) y registrar capturas del inicio y sus controles |
