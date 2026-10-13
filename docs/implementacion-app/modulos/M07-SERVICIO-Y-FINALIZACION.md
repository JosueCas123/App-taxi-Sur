# M07 — Servicio activo y finalización

**Estado:** por implementar en React Native. **Dependencias:** M03 y M05–M06.

## Objetivo

Completar el servicio asignado y conservar coherencia incluso si falla la respuesta de red.

## Pantallas de referencia

- [en-servicio.html](../referencias-ui/en-servicio.html)
- [servicio-finalizado.html](../referencias-ui/servicio-finalizado.html)

Los HTML son referencias visuales con simulaciones, no componentes nativos ni pruebas de integración.

## Contratos

GET /api/conductores/:id/solicitud-activa; GET /api/solicitudes/:id; POST /api/solicitudes/:id/finalizar; GET /api/conductores/:id.

Consultar cuerpos y respuestas en [01-CONTRATOS-API.md](../01-CONTRATOS-API.md).

## Tareas

1. Mostrar servicio en curso con UUID real abreviado solo para presentación, pasajero y recogida. Conservar el UUID completo para la API.
2. Confirmar la intención de finalizar y enviar {} o ausencia de cuerpo a finalizar. No enviar campos de pago, ubicación o calificación inexistentes.
3. Mostrar éxito solo tras respuesta finalizada o consulta posterior que confirme finalizada. Luego actualizar el perfil para reflejar cierreJornadaSolicitado consumido y disponibilidad.
4. Si se pierde la respuesta, consultar el detalle por el UUID conocido y la solicitud activa. null en solicitud-activa no demuestra por sí solo que el servicio terminó correctamente.
5. Si el detalle devuelve 403/404 y no se puede confirmar el resultado, mostrar estado no verificable y recuperación/ayuda. No inventar una finalización offline.
6. Permitir finalizar un servicio existente tras suspensión, con aviso y sin habilitar nueva jornada/disponibilidad. Al regresar a la app recuperar el servicio antes de aplicar una pantalla de bloqueo general.

## Archivos propuestos

- `src/features/service/screens/*`
- `src/features/service/use-finish-service.ts`
- `src/features/service/resolve-finish-result.ts`

Las rutas son una propuesta de organización; adaptar si el repositorio ya tiene convenciones.

## Criterios de aceptación

- [ ] Finalizar muestra éxito con estado confirmado por backend.
- [ ] Timeout después de un commit se reconcilia sin volver a finalizar ciegamente.
- [ ] Cierre diferido termina en jornada finalizada/no_disponible.
- [ ] Una suspensión no deja atrapado al conductor fuera de su servicio existente.
- [ ] Reinicio durante servicio recupera el mismo UUID.

## Decisiones y límites

Finalizar repetidamente no garantiza éxito idempotente: puede devolver 409. El módulo debe reconciliar en lugar de interpretar ese código como una finalización confirmada.

## Prompt para comenzar

> Implementa únicamente M07 — Servicio activo y finalización en la app TaxiSur existente. Lee este archivo, 01-CONTRATOS-API.md y 02-ARQUITECTURA.md; comprueba que sus dependencias estén listas. Usa las referencias HTML solo como diseño, conserva las reglas de negocio del backend y no inventes endpoints. Implementa las tareas, verifica los criterios aplicables y entrega un resumen de archivos modificados, pruebas ejecutadas y pendientes. No avances automáticamente al módulo siguiente ni publiques la app.
