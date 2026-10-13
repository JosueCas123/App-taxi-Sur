# M06 — Oferta, contador y respuesta

**Estado:** por implementar en React Native. **Dependencias:** M03, M04 y M05.

## Objetivo

Permitir una única decisión sobre una oferta vigente, respetando el plazo del servidor.

## Pantallas de referencia

- [solicitud-entrante.html](../referencias-ui/solicitud-entrante.html)
- [solicitud-expirada.html](../referencias-ui/solicitud-expirada.html)

Los HTML son referencias visuales con simulaciones, no componentes nativos ni pruebas de integración.

## Contratos

GET /api/conductores/:id/solicitud-activa; GET /api/solicitudes/:id; POST /api/solicitudes/:id/responder.

Consultar cuerpos y respuestas en [01-CONTRATOS-API.md](../01-CONTRATOS-API.md).

## Tareas

1. Mostrar pasajero.nombre, puntoRecogidaTexto, coordenadas como respaldo, destino nullable y distanciaAproximadaKm nullable. No mostrar teléfono del pasajero ni importar textos de demo.
2. Calcular tiempo restante desde expiraEn; nunca iniciar 60 segundos nuevos al montar o reabrir la pantalla. Usar reloj local solo para presentación, sin atribuirle autoridad sobre la vigencia.
3. Si la fecha HTTP Date está disponible y validada puede usarse para una estimación del desfase; no existe serverNow en el cuerpo. Probar reloj adelantado/atrasado y conservar al backend como autoridad.
4. Enviar {acepta:true} o {acepta:false}. Bloquear ambos botones durante la petición; el éxito devuelve SolicitudDto, no el DTO ampliado con pasajero.
5. Aceptar navega al servicio confirmado; rechazar provoca reconciliación y retorno operativo. El backend devuelve buscando al rechazar y elimina la asignación; no esperar estado persistente rechazada.
6. Al llegar a cero desactivar acciones, mostrar expirada y reconciliar. No llamar a un endpoint de expiración inexistente. Si solicitud-activa aún devuelve la oferta vencida, no reabrirla ni reiniciar el contador.
7. En timeout de respuesta consultar estado antes de repetir. Un 409 significa conflicto o vencimiento: no convertirlo en aceptación ni lanzar reintentos automáticos.

## Archivos propuestos

- `src/features/requests/screens/IncomingRequestScreen.tsx`
- `src/features/requests/screens/ExpiredRequestScreen.tsx`
- `src/features/requests/use-offer-deadline.ts`
- `src/features/requests/use-respond.ts`

Las rutas son una propuesta de organización; adaptar si el repositorio ya tiene convenciones.

## Criterios de aceptación

- [ ] Reabrir una oferta a mitad de ventana muestra solo el tiempo restante.
- [ ] Tocar aceptar repetidamente produce una petición activa.
- [ ] Aceptación tardía/409 no entra en servicio.
- [ ] Tras rechazo no se consulta repetidamente el detalle ya desasignado, que puede devolver 403.
- [ ] Valores null muestran alternativas honestas: destino no indicado o distancia no disponible.

## Decisiones y límites

No agregar chat, llamada al pasajero, navegación en mapa ni tarifa calculada. La UI de expiración es un estado de presentación; la oferta puede seguir temporalmente esperando_respuesta hasta que el job la procese.

## Prompt para comenzar

> Implementa únicamente M06 — Oferta, contador y respuesta en la app TaxiSur existente. Lee este archivo, 01-CONTRATOS-API.md y 02-ARQUITECTURA.md; comprueba que sus dependencias estén listas. Usa las referencias HTML solo como diseño, conserva las reglas de negocio del backend y no inventes endpoints. Implementa las tareas, verifica los criterios aplicables y entrega un resumen de archivos modificados, pruebas ejecutadas y pendientes. No avances automáticamente al módulo siguiente ni publiques la app.
