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

export type SolicitudDto = {
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
};

// GET /api/conductores/:id/solicitud-activa → SolicitudDetalleDto | null
// Bearer; devuelve null cuando el conductor no tiene solicitud activa.
// El callback opcional recibe la cabecera HTTP Date cruda (no ISO) o null.
export function obtenerSolicitudActiva(
  conductorId: string,
  token: string,
  signal?: AbortSignal,
  onFechaServidor?: (fechaServidor: string | null) => void
): Promise<SolicitudDetalleDto | null> {
  return apiRequest<SolicitudDetalleDto | null>(
    `/api/conductores/${encodeURIComponent(conductorId)}/solicitud-activa`,
    {
      token,
      signal,
      ...(onFechaServidor && { capturarFechaServidor: onFechaServidor }),
    }
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

// POST /api/solicitudes/:id/responder {acepta} → SolicitudDto
// Bearer; una única petición sin reintento. 409 ESTADO_INVALIDO en conflicto
// o vencimiento.
export function responderSolicitud(
  solicitudId: string,
  token: string,
  acepta: boolean
): Promise<SolicitudDto> {
  return apiRequest<SolicitudDto>(
    `/api/solicitudes/${encodeURIComponent(solicitudId)}/responder`,
    {
      metodo: 'POST',
      token,
      cuerpo: { acepta },
    }
  );
}

// POST /api/solicitudes/:id/finalizar → SolicitudDto
// Bearer, sin cuerpo (el backend acepta {} o ausencia de cuerpo). Una única
// petición sin reintento: repetirla no es idempotente y puede devolver 409.
export function finalizarSolicitud(solicitudId: string, token: string): Promise<SolicitudDto> {
  return apiRequest<SolicitudDto>(`/api/solicitudes/${encodeURIComponent(solicitudId)}/finalizar`, {
    metodo: 'POST',
    token,
  });
}
