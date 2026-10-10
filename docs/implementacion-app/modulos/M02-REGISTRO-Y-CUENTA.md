# M02 — Registro y estados de cuenta

**Estado:** por implementar en React Native. **Dependencias:** M01.

## Objetivo

Registrar persona y vehículo y mantener las restricciones según el estado real de aprobación.

## Pantallas de referencia

- [registro.html](../referencias-ui/registro.html)
- [cuenta-en-revision.html](../referencias-ui/cuenta-en-revision.html)
- [cuenta-rechazada.html](../referencias-ui/cuenta-rechazada.html)
- [cuenta-suspendida.html](../referencias-ui/cuenta-suspendida.html)

Los HTML son referencias visuales con simulaciones, no componentes nativos ni pruebas de integración.

## Contratos

POST /api/conductores; GET /api/conductores/:id.

Consultar cuerpos y respuestas en [01-CONTRATOS-API.md](../01-CONTRATOS-API.md).

## Tareas

1. Implementar formulario por secciones: datos personales, PIN/confirmación y vehículo. Usar los nombres y límites exactos de 01-CONTRATOS-API.md.
2. Validar confirmación solo en la app; no enviarla al backend. Mostrar errores por campo y conservar campos no sensibles si el registro falla.
3. El registro devuelve perfil sin JWT. Después del alta, volver al login con teléfono prellenado y borrar el PIN. No presentar una sesión autenticada por haber recibido el perfil.
4. Tras login consultar el perfil real y mostrar pendiente, rechazado, suspendido o aprobado. Permitir actualizar manualmente y al volver a primer plano.
5. Centralizar guards y recuperación: si hay un servicio en curso confirmado por la API, preservar acceso a su finalización aunque la cuenta pase a suspendida; bloquear nuevas operaciones.
6. Actualizar perfil al recibir SSE y en eventos de ciclo de vida: el mensaje SSE no incluye estado de aprobación. Evitar intervalos agresivos y consultas cuando la pantalla está desmontada.

## Archivos propuestos

- `src/features/account/api.ts`
- `src/features/account/registration-schema.ts`
- `src/features/account/screens/*`
- `src/navigation/resolve-route.ts`

Las rutas son una propuesta de organización; adaptar si el repositorio ya tiene convenciones.

## Criterios de aceptación

- [ ] Registro válido crea la cuenta y conduce al login sin asumir un token inexistente.
- [ ] PIN de 4–6 dígitos, longitudes y capacidad coinciden con el servidor.
- [ ] Pendiente/rechazado no acceden a iniciar jornada ni a disponibilidad.
- [ ] Una suspensión durante servicio muestra el aviso y mantiene Finalizar servicio; no habilita otro servicio.
- [ ] No aparecen botones para autoaprobarse o editar el vehículo.

## Decisiones y límites

El selector de capacidad del prototipo y el esquema no son iguales: el backend admite enteros 1–100. Usar entrada numérica dentro del contrato; cualquier rango operativo más estrecho requiere una decisión de negocio. No inventar motivo de rechazo o suspensión si el perfil no lo devuelve.

## Prompt para comenzar

> Implementa únicamente M02 — Registro y estados de cuenta en la app TaxiSur existente. Lee este archivo, 01-CONTRATOS-API.md y 02-ARQUITECTURA.md; comprueba que sus dependencias estén listas. Usa las referencias HTML solo como diseño, conserva las reglas de negocio del backend y no inventes endpoints. Implementa las tareas, verifica los criterios aplicables y entrega un resumen de archivos modificados, pruebas ejecutadas y pendientes. No avances automáticamente al módulo siguiente ni publiques la app.
