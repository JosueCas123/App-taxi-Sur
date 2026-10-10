# Contratos de la app — código auditado el 10/10/2026

Base configurable sin credenciales. Rutas completas bajo /api. Authorization: Bearer <token> en todas salvo login y registro. El cliente usa conductorId del JWT y los UUID reales de solicitudes. No se inventan endpoints por cada pantalla.

| Método y ruta | Cuerpo | Respuesta exitosa | Módulos |
|---|---|---|---|
| POST /api/auth/conductor/login | {telefono,pin} | 200 {token,tokenType,expiresIn} | M01 |
| POST /api/conductores | Registro indicado abajo | 201 ConductorDetalleDto sin JWT | M02 |
| GET /api/conductores/:id | Ninguno | 200 ConductorDetalleDto propio | M01–M09 |
| PATCH /api/conductores/:id/jornada | {accion:"iniciar"} o {accion:"finalizar"} | 200 ConductorDetalleDto | M03, M08 |
| PATCH /api/conductores/:id/disponibilidad | {disponible:boolean} | 200 ConductorDetalleDto | M03 |
| POST /api/conductores/:id/ubicacion | {latitud:number,longitud:number} | 201 UbicacionDto | M04 |
| GET /api/conductores/:id/solicitud-activa | Ninguno | 200 SolicitudDetalleDto o null | M05–M09 |
| GET /api/conductores/:id/eventos | Ninguno | 200 text/event-stream | M05 |
| GET /api/solicitudes/:id | Ninguno | 200 SolicitudDetalleDto si corresponde al conductor | M05–M07 |
| POST /api/solicitudes/:id/responder | {acepta:boolean} | 200 SolicitudDto | M06 |
| POST /api/solicitudes/:id/finalizar | {} o sin cuerpo | 200 SolicitudDto | M07 |
| GET /api/configuracion | Ninguno | 200 ConfiguracionDto; uso opcional | M08 |

## Registro

```json
{
  "telefono": "<teléfono>",
  "pin": "<4 a 6 dígitos>",
  "nombreCompleto": "<nombre>",
  "cedulaIdentidad": "<CI>",
  "vehiculo": {
    "placa": "<placa>",
    "marca": "<marca>",
    "modelo": "<modelo>",
    "color": "<color>",
    "capacidadPasajeros": 4
  }
}
```

Teléfono: 1–30 caracteres; nombre: 1–100; CI: 1–50. Placa, marca, modelo y color: 1–30 cada uno. Textos recortados. Capacidad: entero 1–100. PIN: expresión ^\d{4,6}$. Confirmar PIN es validación local: no enviarlo como campo adicional. Los esquemas de registro, ubicación y mutaciones son estrictos.

## Formas de datos relevantes

- ConductorDetalleDto: id, usuarioId, telefono, nombreCompleto, cedulaIdentidad, estado, estadoJornada, estadoDisponibilidad, cierreJornadaSolicitado, creadoEn, vehiculo (objeto o null).
- Estado de cuenta: pendiente, aprobado, rechazado, suspendido. Jornada: no_iniciada, activa, finalizada. Disponibilidad: disponible, no_disponible, solicitud_pendiente, en_servicio.
- Vehículo: id, placa, marca, modelo, color, capacidadPasajeros.
- SolicitudDto: id, pasajeroId, conductorAsignadoId nullable, estado, latitudRecogida, longitudRecogida, destino nullable, puntoRecogidaTexto nullable, expiraEn nullable, aceptadaEn nullable, finalizadaEn nullable, creadoEn.
- SolicitudDetalleDto amplía SolicitudDto con pasajero {id,nombre}, conductorAsignado nullable {id,nombreCompleto,vehiculo} y distanciaAproximadaKm nullable. El vehículo anidado aquí no incluye id. No hay teléfono de pasajero.
- UbicacionDto: id como string numérico, latitud, longitud, horaRegistro, esValida. La app envía coordenadas; no define horaRegistro.
- ConfiguracionDto: id, nombreEmpresa, radioMaximoBusquedaKm, telefonoCentroAtencion nullable, actualizadoEn. GET es autenticado, no sirve como fuente pública antes del login.

Los DTO exitosos son cuerpos directos, sin envoltorio data. No sustituir SolicitudDetalleDto por SolicitudDto: las mutaciones no devuelven pasajero ni distancia. Conservar el detalle ya conocido o volver a consultarlo cuando esté autorizado.

## SSE

Eventos nombrados conectado y actualizado. Datos: {tipo,conductorId,estadoJornada,estadoDisponibilidad,fecha}. No incluye solicitudId, estado de aprobación ni cierreJornadaSolicitado. Incluye comentarios heartbeat y sugerencia retry: 5000.

Flujo: evento → recuperar perfil y solicitud-activa → resolver pantalla. null significa ausencia de solicitud activa, no confirmación de que una mutación previa terminó bien. No hay replay garantizado ni Last-Event-ID implementado: reconciliar al reconectar.

## Errores y respuestas inciertas

Formato habitual: {error:{code,message}}. 400 entrada; 401 credenciales; 403 permiso/cuenta; 404 recurso ausente; 409 conflicto; 500 servidor. No comparar por message. Jornada/disponibilidad: INVALID_STATE_TRANSITION. Responder/finalizar: ESTADO_INVALIDO. Ubicación puede devolver CONDUCTOR_NO_APROBADO con 403.

Timeout no prueba que el servidor no haya ejecutado la operación. Desactivar reintento automático de mutaciones; consultar estado antes de repetir. No existe refresh, logout remoto, /me, endpoint de expiración ni actualización de perfil por conductor.

## Fuente

Esquemas, routers, controladores y servicios en backend/src/modules/{auth,conductores,ubicaciones,solicitudes,eventos,configuracion}; el perfil de autenticación está en backend/src/middlewares/auth.ts. Antes de implementar, comparar con el código si hubo cambios posteriores a esta fecha.
