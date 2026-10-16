import type { ServicioConfirmado } from '../../navigation/resolve-route';
import type { ConductorDetalleDto } from '../auth/api';
import { obtenerConductor } from '../auth/api';

import { obtenerSolicitudActiva, type SolicitudDetalleDto } from './api';

export type InstantaneaOperativa = {
  conductor: ConductorDetalleDto;
  solicitudActiva: SolicitudDetalleDto | null;
};

// Deriva el `ServicioConfirmado` solo cuando la solicitud activa está
// `en_servicio` y asignada al conductor autenticado. Una asignación ajena no
// habilita la excepción de continuidad.
export function servicioConfirmadoDe(
  instantanea: InstantaneaOperativa
): ServicioConfirmado | null {
  const { conductor, solicitudActiva } = instantanea;
  if (
    solicitudActiva === null ||
    solicitudActiva.estado !== 'en_servicio' ||
    solicitudActiva.conductorAsignadoId !== conductor.id
  ) {
    return null;
  }
  return {
    id: solicitudActiva.id,
    conductorAsignadoId: solicitudActiva.conductorAsignadoId,
    estado: 'en_servicio',
  };
}

// Recupera en una sola pasada el perfil y la solicitud activa. Ambas lecturas se
// piden al mismo tiempo, una única vez por ciclo (el flujo de 409 reutiliza esta
// recuperación y no dispara un `actualizarPerfil` separado).
// El callback opcional se reenvía a la lectura de solicitud-activa para capturar
// la cabecera HTTP Date.
export async function recuperarInstantaneaOperativa(
  conductorId: string,
  token: string,
  signal?: AbortSignal,
  onFechaServidor?: (fechaServidor: string | null) => void
): Promise<InstantaneaOperativa> {
  const [conductor, solicitudActiva] = await Promise.all([
    obtenerConductor(conductorId, token, signal),
    obtenerSolicitudActiva(conductorId, token, signal, onFechaServidor),
  ]);
  return { conductor, solicitudActiva };
}
