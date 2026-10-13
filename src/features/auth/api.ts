import { apiRequest } from '../../lib/api-client';

export type LoginResponse = {
  token: string;
  tokenType: string;
  expiresIn: number;
};

export type ConductorDetalleDto = {
  id: string;
  usuarioId: string;
  telefono: string;
  nombreCompleto: string;
  cedulaIdentidad: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido';
  estadoJornada: 'no_iniciada' | 'activa' | 'finalizada';
  estadoDisponibilidad: 'disponible' | 'no_disponible' | 'solicitud_pendiente' | 'en_servicio';
  cierreJornadaSolicitado: boolean;
  creadoEn: string;
  vehiculo: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    color: string;
    capacidadPasajeros: number;
  } | null;
};

export function loginConductor(datos: {
  telefono: string;
  pin: string;
}): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/conductor/login', {
    metodo: 'POST',
    cuerpo: datos,
  });
}

export function obtenerConductor(
  conductorId: string,
  token: string,
  signal?: AbortSignal
): Promise<ConductorDetalleDto> {
  return apiRequest<ConductorDetalleDto>(`/api/conductores/${encodeURIComponent(conductorId)}`, {
    token,
    signal,
  });
}
