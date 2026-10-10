# M04 — Permisos y envío de ubicación

**Estado:** por implementar en React Native. **Dependencias:** M01 y M02; consume el estado de jornada de M03.

## Objetivo

Compartir posiciones recientes durante la jornada y explicar al conductor si su ubicación está operativa.

## Pantallas de referencia

- [ubicacion.html](../referencias-ui/ubicacion.html)
- [ubicacion-desactualizada.html](../referencias-ui/ubicacion-desactualizada.html)

Los HTML son referencias visuales con simulaciones, no componentes nativos ni pruebas de integración.

## Contratos

POST /api/conductores/:id/ubicacion. No utilizar el GET de ubicación: es administrativo.

Consultar cuerpos y respuestas en [01-CONTRATOS-API.md](../01-CONTRATOS-API.md).

## Tareas

1. Solicitar permiso cuando el conductor inicia el flujo de ubicación, con explicación concreta. Distinguir permiso denegado, GPS apagado, precisión insuficiente, error de red y posición obsoleta.
2. Implementar primero ubicación en primer plano con expo-location. Obtener una muestra reciente y enviar solo {latitud,longitud}; no mandar timestamp ni campos adicionales al esquema estricto.
3. Usar un intervalo objetivo configurable de 30 segundos como decisión inicial, evitando envíos simultáneos. No reenviar posiciones antiguas almacenadas offline: el backend registra la hora de recepción y podría tratarlas como frescas.
4. Conservar en memoria hora de captura local y respuesta {horaRegistro,esValida}. Un 201 con esValida:false no permite declarar GPS listo. Después de reiniciar adquirir una muestra nueva.
5. Al finalizar jornada o cerrar sesión detener observadores e intervalos. En cierre diferido con servicio, mantener el ciclo mientras corresponda al estado confirmado y los permisos.
6. En segundo plano no prometer seguimiento ni recepción de ofertas: esta fase es foreground. Al regresar, actualizar permisos, posición, perfil y solicitud activa. Si se necesita operar con pantalla bloqueada, tratarlo como una ampliación verificable en development build.

## Archivos propuestos

- `src/features/location/location-service.ts`
- `src/features/location/api.ts`
- `src/features/location/use-location-sharing.ts`
- `src/features/location/screens/*`

Las rutas son una propuesta de organización; adaptar si el repositorio ya tiene convenciones.

## Criterios de aceptación

- [ ] Permiso rechazado conserva una vía para abrir ajustes y reintentar.
- [ ] Tras conceder permiso se envía una ubicación válida antes de activar disponibilidad.
- [ ] Más de cinco minutos sin envío confirmado muestra ubicación desactualizada; no inventa un cambio del servidor.
- [ ] Un viaje offline no genera una cola de coordenadas antiguas al reconectar.
- [ ] No quedan suscripciones activas después del logout o jornada finalizada.

## Decisiones y límites

El sistema operativo no garantiza un intervalo exacto en segundo plano. El alcance inicial coincide con la sección foreground de la especificación; no equivale a rastreo permanente. Véase Expo Location SDK 57 en las fuentes.

## Prompt para comenzar

> Implementa únicamente M04 — Permisos y envío de ubicación en la app TaxiSur existente. Lee este archivo, 01-CONTRATOS-API.md y 02-ARQUITECTURA.md; comprueba que sus dependencias estén listas. Usa las referencias HTML solo como diseño, conserva las reglas de negocio del backend y no inventes endpoints. Implementa las tareas, verifica los criterios aplicables y entrega un resumen de archivos modificados, pruebas ejecutadas y pendientes. No avances automáticamente al módulo siguiente ni publiques la app.
