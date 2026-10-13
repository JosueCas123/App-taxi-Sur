# Orden de implementación y entregas

Cada módulo se completa con sus criterios y evidencia, no solo creando archivos. No se asignan duraciones ficticias: el esfuerzo depende de la integración y las pruebas en dispositivo.

| Etapa | Módulos | Resultado verificable |
|---|---|---|
| 1 | M00 → M01 → M02 | App arranca, login seguro, registro y aprobación |
| 2 | M03 base → M04 → completar M03 | Jornada y GPS real; disponibilidad validada |
| 3 | M05 → M06 → M07 | Oferta real por SSE, aceptación y finalización |
| 4 | M08 → M09 | Perfil, salida y recuperación accesibles |
| 5 | M10 | Flujo completo probado en dispositivo |

M03 y M04 comparten el estado de jornada: crear primero el servicio de jornada, luego GPS y al final cerrar la aceptación del interruptor de disponibilidad. No marcar M03 terminado con un GPS simulado.

Los pendientes de backend no impiden empezar M00–M04. Para certificar M05 y M10 se necesita validar el transporte SSE completo y resolver su ciclo de sesión.

## Archivos por módulo

- [M00 — Base Expo, navegación y sistema visual](modulos/M00-BASE-EXPO.md)
- [M01 — Login, identidad y sesión segura](modulos/M01-ACCESO-Y-SESION.md)
- [M02 — Registro y estados de cuenta](modulos/M02-REGISTRO-Y-CUENTA.md)
- [M03 — Inicio, jornada y disponibilidad](modulos/M03-JORNADA-Y-DISPONIBILIDAD.md)
- [M04 — Permisos y envío de ubicación](modulos/M04-UBICACION.md)
- [M05 — SSE y recuperación del estado operativo](modulos/M05-EVENTOS-Y-RECUPERACION.md)
- [M06 — Oferta, contador y respuesta](modulos/M06-SOLICITUD-ENTRANTE.md)
- [M07 — Servicio activo y finalización](modulos/M07-SERVICIO-Y-FINALIZACION.md)
- [M08 — Perfil, ayuda y cierre de sesión](modulos/M08-PERFIL-Y-SALIDA.md)
- [M09 — Conectividad, errores y accesibilidad](modulos/M09-CONEXION-Y-ACCESIBILIDAD.md)
- [M10 — Integración, pruebas y compilación de prueba](modulos/M10-VALIDACION-Y-ENTREGA.md)
