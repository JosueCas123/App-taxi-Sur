import { apiRequest } from '../../lib/api-client';

export type EstadoSolicitud =
  | 'creada'
  | 'buscando'
  | 'conductor_seleccionado'
  | 'esperando_respuesta'
  | 'aceptada'
  | 'rechazada'
  | 'expirada'
  | 'en_servicio'
  | 'finalizada'
  | 'sin_conductor';

export type ConductorAsignadoDto = {
  id: string;
  nombreCompleto: string;
  vehiculo: {
    placa: string;
    marca: string;
    modelo: string;
    color: string;
    capacidadPasajeros: number;
  } | null;
};

export type SolicitudDetalleDto = {
  id: string;
  pasajeroId: string;
  conductorAsignadoId: string | null;
  estado: EstadoSolicitud;
  latitudRecogida: number;
  longitudRecogida: number;
  destino: string | null;
  puntoRecogidaTexto: string | null;
  expiraEn: string | null;
  aceptadaEn: string | null;
  finalizadaEn: string | null;
  creadoEn: string;
  pasajero: {
    id: string;
    nombre: string;
  };
  conductorAsignado: ConductorAsignadoDto | null;
  distanciaAproximadaKm: number | null;
};

// GET /api/conductores/:id/solicitud-activa → SolicitudDetalleDto | null
// Bearer; devuelve null cuando el conductor no tiene solicitud activa.
export function obtenerSolicitudActiva(
  conductorId: string,
  token: string,
  signal?: AbortSignal
): Promise<SolicitudDetalleDto | null> {
  return apiRequest<SolicitudDetalleDto | null>(
    `/api/conductores/${encodeURIComponent(conductorId)}/solicitud-activa`,
    { token, signal }
  );
}

// GET /api/solicitudes/:id → SolicitudDetalleDto (403 si no es del conductor).
export function obtenerSolicitud(
  solicitudId: string,
  token: string,
  signal?: AbortSignal
): Promise<SolicitudDetalleDto> {
  return apiRequest<SolicitudDetalleDto>(`/api/solicitudes/${encodeURIComponent(solicitudId)}`, {
    token,
    signal,
  });
}
