# Matriz de aceptación

Estado inicial de todos los casos: **pendiente**. Ejecutar contra el backend real configurado, usando cuentas autorizadas; guardar dispositivo, versión, fecha y evidencia.

| ID | Módulo | Escenario | Resultado esperado |
|---|---|---|---|
| A01 | M01 | Login válido, inválido, token vencido y falta de conductorId | Ruta y mensaje correctos; nunca usar sub como conductorId |
| A02 | M02 | Registro y aprobación desde administración en el backend conectado | Alta persistida → login → consultar perfil real |
| A03 | M02/M07 | Suspender conductor con servicio | Bloquea nuevas operaciones; permite finalizar el existente |
| A04 | M03 | Iniciar jornada sin permiso GPS | Activa/no disponible; no forzar permiso para iniciar |
| A05 | M04 | Permiso denegado y GPS apagado | Mensajes distintos, ajustes y recuperación |
| A06 | M03/M04 | Habilitar disponible sin GPS fresco / con GPS válido | Primer caso bloqueado; segundo confirmado por API |
| A07 | M05 | Asignación real por n8n/admin a conductor elegible | SSE dispara activa y muestra los datos del backend |
| A08 | M05 | Dos conductores, eventos duplicados y reconexión | Sin fuga entre identidades, stream único y recuperación |
| A09 | M06 | Reabrir oferta a los 40 s y dejar vencer | Usa expiraEn; no reinicia 60 s; no acepta tarde |
| A10 | M06 | Rechazar y recibir 403 en detalle desasignado | Reconcilia activa; no interpreta como sesión expirada |
| A11 | M06 | Doble pulsación y timeout tras aceptar | Una mutación activa; consulta antes de repetir |
| A12 | M07 | Timeout después de finalizar en servidor | Consulta detalle; éxito solo si finalizada confirmado |
| A13 | M03/M07 | Pedir fin de jornada durante servicio y completarlo | Cierre diferido → finalizada/no_disponible |
| A14 | M04/M09 | Cinco minutos sin GPS y reconexión después de viaje | Posición obsoleta visible; no sube muestras antiguas |
| A15 | M08 | Salir offline y entrar como otro conductor | Elimina token/caché; no finge cierre de jornada |
| A16 | M05 | Vencer token manteniendo SSE abierto | App cierra; backend también debe aplicar ciclo de sesión |
| A17 | M05/M10 | Supabase sin publicación o canal caído | No certificar Realtime con solo conectado/heartbeat |
| A18 | M09 | Reloj adelantado/atrasado, app bloqueada y vuelta a foreground | Reconciliación y expiración del servidor prevalecen |
| A19 | M09 | Texto ampliado, lector de pantalla y teclado | Controles legibles, foco y navegación correctos |
| A20 | M10 | Inspeccionar entrega final y flujo de las 16 pantallas | Sin simuladores, PIN, IDs demo ni secretos en artefactos |

## Registro por ejecución

Copiar por caso: ID, versión/commit app, versión backend, dispositivo/SO, fecha, pasos, resultado observado, aprobado/fallido/no ejecutado, evidencia y defecto asociado.

Pruebas de integración del flujo contra el backend real del sistema con las cuentas y registros que estén autorizados: contador basado en expiraEn, conductor suspendido con servicio, limpieza de identidad, timeout de mutaciones. Pruebas en dispositivo para SSE, permisos, ciclo de vida y recuperación. No sustituir respuestas del backend por fixtures o mocks en la ejecución de la app.
