# M09 — Conectividad, errores y accesibilidad

**Estado:** por implementar en React Native. **Dependencias:** M01–M08.

## Objetivo

Evitar estados falsos y hacer que la app sea legible y recuperable durante el uso en calle.

## Pantallas de referencia

- [sin-conexion.html](../referencias-ui/sin-conexion.html)

Los HTML son referencias visuales con simulaciones, no componentes nativos ni pruebas de integración.

## Contratos

Reutiliza perfil, solicitud-activa y detalle. No requiere endpoints propios.

Consultar cuerpos y respuestas en [01-CONTRATOS-API.md](../01-CONTRATOS-API.md).

## Tareas

1. Centralizar mensajes para 400, 401, 403, 404, 409, 500, timeout y falta de conectividad. Preservar error.code; no decidir por coincidencia de texto del mensaje.
2. Separar red del dispositivo, API inaccesible, SSE interrumpido y GPS sin señal. Tener internet no significa que la central esté disponible.
3. Al reconectar recuperar perfil y solicitud activa; no vaciar una cola de aceptar/rechazar/finalizar. Mantener estado incierto hasta completar la lectura.
4. Conservar datos esenciales del servicio en memoria de la sesión mientras se recupera la red; no persistir datos del pasajero por defecto. En un arranque sin red mostrar que no se puede verificar la operación.
5. Adaptar lector de pantalla, foco de formularios, contraste, estados con texto/iconos y texto ampliado. El contador no debe anunciar cada segundo.
6. Eliminar barras de prototipo, botones de simular suspensión/oferta, credenciales ficticias y IDs fijos. Revisar todas las pantallas en ancho pequeño y con teclado visible.

## Archivos propuestos

- `src/features/connectivity/*`
- `src/ui/FeedbackState.tsx`
- `src/lib/api-errors.ts`
- `src/accessibility/*`

Las rutas son una propuesta de organización; adaptar si el repositorio ya tiene convenciones.

## Criterios de aceptación

- [ ] Sin red no se presenta como sesión incorrecta ni como disponible.
- [ ] Ninguna mutación operativa se reenvía automáticamente tras reconexión.
- [ ] Los controles críticos pueden usarse con lector de pantalla y texto ampliado.
- [ ] La navegación Atrás no reabre una oferta vencida ni un login antiguo.
- [ ] Los datos desconocidos no se muestran como éxito, cero o disponible.

## Decisiones y límites

Usar transiciones de AppState y conectividad para recuperar lecturas, como describe la integración de TanStack Query con React Native. Los permisos y cambios de red se validan en dispositivo, no solo en navegador.

## Prompt para comenzar

> Implementa únicamente M09 — Conectividad, errores y accesibilidad en la app TaxiSur existente. Lee este archivo, 01-CONTRATOS-API.md y 02-ARQUITECTURA.md; comprueba que sus dependencias estén listas. Usa las referencias HTML solo como diseño, conserva las reglas de negocio del backend y no inventes endpoints. Implementa las tareas, verifica los criterios aplicables y entrega un resumen de archivos modificados, pruebas ejecutadas y pendientes. No avances automáticamente al módulo siguiente ni publiques la app.
