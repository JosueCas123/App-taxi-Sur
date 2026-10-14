import { apiRequest } from '../../lib/api-client';
import type { ConductorDetalleDto } from '../auth/api';
import type { RegistroConductorInput } from './registration-schema';

export type { ConductorDetalleDto };
export { obtenerConductor } from '../auth/api';

export function registrarConductor(datos: RegistroConductorInput): Promise<ConductorDetalleDto> {
  // Público: sin Bearer y sin reintentos automáticos (apiRequest no reintenta).
  return apiRequest<ConductorDetalleDto>('/api/conductores', {
    metodo: 'POST',
    cuerpo: datos,
  });
}
