# M05 — SSE y recuperación del estado operativo

**Estado:** por implementar en React Native. **Dependencias:** M01 y M02; integra M03 y M04.

## Objetivo

Mantener una única sesión de eventos y recuperar el estado real sin depender de eventos perdidos.

## Pantallas de referencia

- [inicio.html](../referencias-ui/inicio.html)
- [solicitud-entrante.html](../referencias-ui/solicitud-entrante.html)
- [en-servicio.html](../referencias-ui/en-servicio.html)

Los HTML son referencias visuales con simulaciones, no componentes nativos ni pruebas de integración.

## Contratos

GET /api/conductores/:id/eventos; GET /api/conductores/:id/solicitud-activa; GET /api/conductores/:id; GET /api/solicitudes/:id.

Consultar cuerpos y respuestas en [01-CONTRATOS-API.md](../01-CONTRATOS-API.md).

## Tareas

1. Hacer una prueba técnica pequeña del transporte SSE en Android con Authorization Bearer y cierre/abort. Encapsularlo en un adaptador: no asumir que EventSource del navegador está disponible o admite headers en React Native.
2. Conectar al stream del conductor autenticado. Manejar eventos conectado/actualizado, comentarios heartbeat y retry. Asegurar una sola conexión por sesión y descartar mensajes de conexiones antiguas.
3. Cada mensaje relevante provoca reconciliación de perfil y solicitud activa. El evento no trae solicitudId: obtenerlo de solicitud-activa. No usar conductorId en rutas de solicitudes.
4. Abrir SSE y recuperar una instantánea al iniciar; repetir recuperación con conectado para cubrir la carrera inicial. Agrupar invalidaciones simultáneas y descartar respuestas antiguas mediante generación de sesión/petición.
5. Reconectar con espera progresiva acotada; al recuperar red o primer plano consultar el estado. No crear polling continuo para descubrir ofertas de 60 segundos.
6. Cerrar al logout, cambio de usuario y vencimiento local de sesión. Esto mejora el cliente, pero no reemplaza el cierre de sesión SSE pendiente en backend.
7. Mostrar pérdida de conexión operativa. No interpretar heartbeat o conectado como prueba de que Supabase entrega cambios; validar la cadena completa con una asignación real.

## Archivos propuestos

- `src/features/events/sse-transport.ts`
- `src/features/events/use-driver-events.ts`
- `src/features/requests/api.ts`
- `src/features/requests/reconcile.ts`
- `src/navigation/resolve-route.ts`

Las rutas son una propuesta de organización; adaptar si el repositorio ya tiene convenciones.

## Criterios de aceptación

- [ ] Evento pendiente → solicitud-activa → oferta correcta, sin conocer previamente el UUID.
- [ ] Reabrir recupera un servicio aceptado aun si se perdió el evento.
- [ ] Dos eventos duplicados no abren dos pantallas ni dos streams.
- [ ] Cambio de cuenta limpia datos y cancela peticiones de la sesión anterior.
- [ ] Prueba con dos conductores confirma que cada stream solo entrega sus propios estados.

## Decisiones y límites

La especificación antigua menciona conexión directa a Supabase; queda reemplazada por el backend actual. No instalar Supabase en la app para esta función ni exponer service_role. Ver 05-PENDIENTES-BACKEND.md antes de certificar tiempo real.

## Prompt para comenzar

> Implementa únicamente M05 — SSE y recuperación del estado operativo en la app TaxiSur existente. Lee este archivo, 01-CONTRATOS-API.md y 02-ARQUITECTURA.md; comprueba que sus dependencias estén listas. Usa las referencias HTML solo como diseño, conserva las reglas de negocio del backend y no inventes endpoints. Implementa las tareas, verifica los criterios aplicables y entrega un resumen de archivos modificados, pruebas ejecutadas y pendientes. No avances automáticamente al módulo siguiente ni publiques la app.
