# TaxiSur — Módulos de implementación de la app del conductor

Versión 2 · 10 de octubre de 2026 · React Native + Expo

Este paquete contiene **11 módulos ejecutables como especificaciones de trabajo**, uno por archivo Markdown, con una versión HTML para leer en el navegador. No contiene la aplicación ya implementada. La app debe consumir la API real del sistema; no incluye fuentes de datos ficticias. Las pruebas también ejecutan peticiones reales contra ese backend.

## Cómo empezar

1. Abrir ABRIR_AQUI.html después de descomprimir completamente el ZIP.
2. Leer contratos y arquitectura compartida.
3. Comenzar M00; después seguir 03-ORDEN-DE-IMPLEMENTACION.md.
4. Usar el prompt al final de cada módulo y entregar sus criterios comprobados antes de continuar.
5. Consultar las pantallas copiadas en referencias-ui; su lógica local es simulada.

## Qué cambia respecto al paquete anterior

- Jornada, disponibilidad, solicitud activa y SSE ya existen en el backend.
- El JWT entrega conductorId; no hace falta implementar /me para descubrirlo.
- La app escucha SSE del backend; no se conecta directamente a Supabase.
- El detalle ya incluye texto de recogida y distancia nullable.
- El cierre diferido se representa con cierreJornadaSolicitado.
- La protección contra aceptación tardía está en el backend.

El código auditado tiene prioridad para los contratos actuales. La especificación antigua conserva referencias obsoletas a endpoints ausentes, conexión directa a Supabase y un ejemplo OTP; este plan usa teléfono/PIN y el contrato SSE actual.

## Alcance

Solo app del conductor del proyecto TaxiSur, conectada al mismo backend del panel administrativo. Registro, cuenta, jornada, ubicación en primer plano, ofertas, servicio, perfil y recuperación. No incluye delivery El Kuchu, pagos, chat, mapas de navegación, edición de vehículo, push ni seguimiento garantizado en segundo plano.

Los módulos están todos pendientes de implementación. El proyecto Expo inspeccionado conserva la pantalla inicial. Los HTML incluidos siguen siendo prototipos visuales; las discrepancias se resuelven con los contratos de este paquete.
