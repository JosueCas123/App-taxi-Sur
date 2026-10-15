import { apiRequest } from '../../lib/api-client';
import type { ConductorDetalleDto } from '../auth/api';

// PATCH /api/conductores/:id/jornada {accion:'iniciar'|'finalizar'}
// Bearer; el api-client no reintenta mutaciones.
export function iniciarJornada(
  conductorId: string,
  token: string
): Promise<ConductorDetalleDto> {
  return apiRequest<ConductorDetalleDto>(
    `/api/conductores/${encodeURIComponent(conductorId)}/jornada`,
    {
      metodo: 'PATCH',
      token,
      cuerpo: { accion: 'iniciar' },
    }
  );
}

export function finalizarJornada(
  conductorId: string,
  token: string
): Promise<ConductorDetalleDto> {
  return apiRequest<ConductorDetalleDto>(
    `/api/conductores/${encodeURIComponent(conductorId)}/jornada`,
    {
      metodo: 'PATCH',
      token,
      cuerpo: { accion: 'finalizar' },
    }
  );
}

// PATCH /api/conductores/:id/disponibilidad {disponible:boolean}
export function cambiarDisponibilidad(
  conductorId: string,
  token: string,
  disponible: boolean
): Promise<ConductorDetalleDto> {
  return apiRequest<ConductorDetalleDto>(
    `/api/conductores/${encodeURIComponent(conductorId)}/disponibilidad`,
    {
      metodo: 'PATCH',
      token,
      cuerpo: { disponible },
    }
  );
}
