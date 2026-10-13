# TaxiSur — Revisión de endpoints para la app del conductor

Fecha: 10 de octubre de 2026.

## Resultado

**Sí: los cuatro endpoints que faltaban ya están implementados en el backend local.** Se revisaron rutas, controladores, servicios, validaciones, autenticación y pruebas existentes, además del ROADMAP_ENDPOINTS.md. El backend contiene 34 rutas HTTP bajo `/api`, más `/health`.

Esto confirma implementación en código. No certifica el despliegue, la aplicación de migraciones en Supabase ni la integración de las pantallas en React Native. La app `app-taxi/app-taxi/App.tsx` continúa mostrando la pantalla inicial de Expo.

## Rutas incorporadas

| Endpoint | Resultado de la revisión | Uso en la app |
|---|---|---|
| `PATCH /api/conductores/:id/jornada` | Implementado. Valida identidad, propiedad, estado y asignaciones dentro de transacción con bloqueo. | Iniciar jornada y solicitar su cierre. |
| `PATCH /api/conductores/:id/disponibilidad` | Implementado. Para activarse exige cuenta aprobada, jornada activa, ausencia de asignaciones incompatibles y GPS válido reciente. | Interruptor Disponible / No disponible. |
| `GET /api/conductores/:id/solicitud-activa` | Implementado. Comprueba propiedad; también permite administración y n8n. Devuelve el detalle de la solicitud o `null`. | Recuperar una oferta o servicio al abrir o reconectar la app. |
| `GET /api/conductores/:id/eventos` | Implementado. Stream SSE exclusivo del conductor propietario, con evento inicial y cambios recibidos desde Supabase por el backend. | Avisar cambios y disparar la recuperación del estado actual. |

Los tres primeros están en `backend/src/modules/conductores/conductores.router.ts`; SSE está en `backend/src/modules/eventos/eventos.router.ts`. Todos están montados en `backend/src/app.ts`.

## Correcciones anteriores verificadas

| Punto | Estado actual |
|---|---|
| Identificar al conductor después del login | El JWT incorpora `conductorId` cuando existe el conductor asociado. `sub` sigue siendo el ID del usuario. No hace falta agregar `/me` para resolver este punto. |
| Leer el detalle de la solicitud desde la app | `GET /api/solicitudes/:id` acepta autenticación del conductor y verifica que sea el asignado. |
| Aceptar una oferta después del vencimiento | Corregido en código: se consulta el reloj después de adquirir los bloqueos y la actualización exige `expiraEn > now`. No depende únicamente de que el job haya procesado el vencimiento. |
| Recuperar el servicio después de cerrar la app | Resuelto por `solicitud-activa`. |
| Texto de recogida y distancia | El detalle incluye `puntoRecogidaTexto` y `distanciaAproximadaKm`. La distancia puede ser `null` y es geográfica, no una ruta vial ni una estimación de tiempo. |
| Cerrar jornada durante un servicio | Se guarda `cierreJornadaSolicitado`; al finalizar el servicio se cierra la jornada y se libera al conductor como no disponible. |
| Suspensión durante un servicio | Las transiciones preservan la asignación activa; el conductor puede finalizarla sin volver a quedar disponible si está suspendido. |
| Notificaciones a la app | Existe el puente Supabase → backend → SSE autenticado. La app no debe recibir la clave `service_role`. |
| Registro sin token | Sigue devolviendo el alta sin JWT. Es compatible con pedir login después del registro; el token en el registro continúa siendo opcional. |
| Implementación móvil | Pendiente: existen prototipos HTML, pero el proyecto Expo inspeccionado todavía contiene la pantalla inicial. |

## Observaciones que permanecen

### 1. El stream SSE no finaliza al vencer la sesión

La autenticación verifica el JWT al abrir la petición. Después, `eventos.controller.ts` registra la conexión y solo la retira al cerrarse; `eventos.service.ts` continúa enviando cambios y heartbeats. No se encontró temporizador asociado a `exp` ni revalidación de la identidad durante la conexión.

**Consecuencia:** una conexión que ya estaba abierta puede seguir recibiendo estados del conductor después del vencimiento del token o de la eliminación del usuario. Las nuevas peticiones sí pasan otra vez por autenticación.

**Ajuste recomendado:** cerrar el stream al vencer la sesión y definir cómo revocar conexiones existentes cuando se invalide la identidad. La app debe renovar la sesión mediante el flujo disponible y reconectar con credenciales válidas.

Evidencia: `backend/src/middlewares/auth.ts`, función `resolveByJwt`; `backend/src/modules/eventos/eventos.controller.ts`, registro y limpieza de conexión; `backend/src/modules/eventos/eventos.service.ts`, registro, heartbeat y envío de cambios. Hallazgo de inspección estática, no de una prueba de expiración de larga duración.

### 2. «Conectado» no garantiza que Realtime esté operativo

El controlador emite el evento inicial independientemente de la suscripción de Supabase. La llamada `canal.subscribe()` no registra un callback para observar el estado o los errores asíncronos del canal. En desarrollo, si faltan las credenciales, el servicio informa que solo emitirá snapshot y heartbeats; en producción la validación de configuración exige ambas credenciales.

**Consecuencia:** la app puede mantener un stream abierto sin recibir las nuevas asignaciones si falla la suscripción o falta habilitar la tabla en Realtime.

**Antes de dar por validado el despliegue:** comprobar una asignación real y su recepción en SSE, verificar la publicación de `public.conductores` y observar el estado de la suscripción. El heartbeat demuestra que el canal HTTP sigue abierto, no que Supabase esté entregando cambios.

Evidencia: `backend/src/modules/eventos/eventos.service.ts`, función `iniciarEventosRealtime`, y evento inicial en `eventos.controller.ts`.

### 3. Ajustes del contrato documentado para implementar la app

- El ROADMAP menciona `rol: "conductor"` dentro del JWT. La firma actual añade `conductorId`, pero no `rol`; el middleware obtiene el rol desde la base de datos. No programar el cliente suponiendo ese claim.
- El evento SSE contiene `conductorId`, `estadoJornada`, `estadoDisponibilidad`, `tipo` y `fecha`; no contiene `solicitudId`. Al recibir una oferta, llamar primero a `GET /api/conductores/:id/solicitud-activa`. Su respuesta permite conocer el ID y el detalle de la solicitud.
- `solicitud-activa` responde directamente con un objeto de detalle o con `null`, no con `{ solicitud: ... }`.
- Jornada y disponibilidad responden directamente con el detalle actualizado del conductor. Usar ese resultado para actualizar la pantalla.
- Una oferta vencida puede seguir apareciendo como activa hasta que el job procese el vencimiento. La UI debe respetar `expiraEn`, desactivar la aceptación vencida y reconciliar el estado. El endpoint de respuesta ya protege contra la aceptación tardía.

## Contratos mínimos para conectar las pantallas

```http
PATCH /api/conductores/{conductorId}/jornada
Authorization: Bearer <token>
Content-Type: application/json

{"accion":"iniciar"}
```

Para finalizar, enviar `{"accion":"finalizar"}`. Si existe un servicio en curso, la pantalla debe mostrar el cierre solicitado a partir de `cierreJornadaSolicitado`; no mostrar la jornada como cerrada antes de recibir ese estado del servidor.

```http
PATCH /api/conductores/{conductorId}/disponibilidad
Authorization: Bearer <token>
Content-Type: application/json

{"disponible":true}
```

Para pasar a no disponible, enviar `{"disponible":false}`. Gestionar los conflictos HTTP 409 sin cambiar optimistamente a un estado que el servidor rechazó.

Secuencia de arranque: login → obtener `conductorId` del JWT → consultar perfil → abrir SSE → recuperar solicitud activa → mostrar la pantalla correspondiente. También reconciliar al recibir el evento inicial, tras reconectar y al volver al primer plano. Evitar que una respuesta antigua sobrescriba otra más reciente.

## Verificación ejecutada y límites

- Recuento del código: **34 rutas `/api`**, además de `/health`.
- TypeScript: **`tsc --noEmit --pretty false` finalizó con código 0** sobre una copia del backend actual.
- Se intentó ejecutar la suite unitaria actual en una copia aislada, sin `.env` ni acceso a una base real. **No se pudo completar satisfactoriamente**: hubo errores `EACCES` en conexiones HTTP locales y errores `ENOENT` al cargar módulos temporales de Vitest. Un segundo intento limitado tampoco inició correctamente por resolución de `vitest/config`. No se atribuyen estos errores a las reglas de negocio ni se presenta la suite como aprobada.
- Se encontraron las migraciones `20261007192812_add_cierre_jornada_solicitado` y `20261009120000_add_punto_recogida_texto`. Su presencia no demuestra que estén aplicadas en la base desplegada.
- No se ejecutaron migraciones, no se modificó el backend original y no se validó Supabase en vivo.

## Siguiente paso

Ya se puede comenzar la integración móvil usando estos contratos. Antes de considerar terminado el flujo completo, resolver la duración de la sesión SSE y comprobar en un entorno de pruebas: registro/login, jornada, ubicación, disponibilidad, asignación recibida por SSE, recuperación al reabrir, aceptación antes y después del vencimiento, finalización y cierre diferido de jornada.

El plan de implementación anterior debe interpretarse con estas actualizaciones: `conductorId` sustituye la propuesta de `/me`, y SSE del backend sustituye la conexión directa de la app a Supabase.
