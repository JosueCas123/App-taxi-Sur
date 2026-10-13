# M03 — Inicio, jornada y disponibilidad

**Estado:** por implementar en React Native. **Dependencias:** M02; M04 para completar la disponibilidad real.

## Objetivo

Reflejar la jornada y disponibilidad confirmadas por el servidor, incluido el cierre diferido.

## Pantallas de referencia

- [inicio.html](../referencias-ui/inicio.html)

Los HTML son referencias visuales con simulaciones, no componentes nativos ni pruebas de integración.

## Contratos

GET /api/conductores/:id; PATCH /api/conductores/:id/jornada; PATCH /api/conductores/:id/disponibilidad.

Consultar cuerpos y respuestas en [01-CONTRATOS-API.md](../01-CONTRATOS-API.md).

## Tareas

1. Crear home con estado de cuenta, jornada, disponibilidad y GPS. Separar esos cuatro conceptos; no convertirlos en un único booleano.
2. Enviar {accion:"iniciar"} o {accion:"finalizar"} a jornada; actualizar desde el perfil devuelto. Iniciar jornada no equivale a ponerse disponible.
3. Activar disponibilidad únicamente con jornada activa, cuenta aprobada, permiso/GPS adecuado y ubicación reciente aceptada por el servidor. Enviar {disponible:true|false}.
4. Durante una mutación desactivar el control afectado. No mostrar el cambio como confirmado antes de recibir respuesta. En 409 recuperar perfil y solicitud activa.
5. Si se solicita cerrar jornada durante un servicio, mostrar cierreJornadaSolicitado y mantener el servicio. No detener prematuramente todo el flujo como si la jornada ya estuviera finalizada.
6. Con solicitud pendiente, el backend puede rechazar el cierre. Explicar el conflicto y resolver/reconciliar la oferta antes de volver a intentarlo. No inventar una cancelación de solicitud.
7. Preparar la interfaz de GPS de M04 con un doble de prueba durante el desarrollo; solo completar la aceptación del módulo al conectarla a ubicación real.

## Archivos propuestos

- `src/features/shift/api.ts`
- `src/features/shift/use-shift.ts`
- `src/features/shift/screens/HomeScreen.tsx`
- `src/features/shift/components/*`

Las rutas son una propuesta de organización; adaptar si el repositorio ya tiene convenciones.

## Criterios de aceptación

- [ ] Iniciar jornada devuelve activa/no_disponible y no envía disponible automáticamente.
- [ ] No se habilita disponible sin GPS confirmado reciente.
- [ ] Doble pulsación genera una sola mutación concurrente.
- [ ] Cerrar con servicio conserva en_servicio y muestra cierre pendiente.
- [ ] Al completar ese servicio el perfil muestra jornada finalizada y no_disponible.

## Decisiones y límites

El contrato ya está implementado; no crear los endpoints propuestos en el plan anterior. Los errores de jornada/disponibilidad usan INVALID_STATE_TRANSITION y HTTP 409, no los códigos de solicitudes.

## Prompt para comenzar

> Implementa únicamente M03 — Inicio, jornada y disponibilidad en la app TaxiSur existente. Lee este archivo, 01-CONTRATOS-API.md y 02-ARQUITECTURA.md; comprueba que sus dependencias estén listas. Usa las referencias HTML solo como diseño, conserva las reglas de negocio del backend y no inventes endpoints. Implementa las tareas, verifica los criterios aplicables y entrega un resumen de archivos modificados, pruebas ejecutadas y pendientes. No avances automáticamente al módulo siguiente ni publiques la app.
