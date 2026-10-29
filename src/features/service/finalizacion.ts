import type { SolicitudDetalleDto, SolicitudDto } from '../requests/api';

export type ResultadoFinalizacion =
  | { tipo: 'confirmada' }
  | { tipo: 'sigue_en_servicio' }
  | { tipo: 'no_verificable' };

// Solo presentación: primeros 8 caracteres + "." + últimos 4.
// Un valor corto se devuelve sin recortar. El UUID completo se conserva para la API.
export function abreviarUuid(uuid: string): string {
  if (uuid.length <= 12) {
    return uuid;
  }
  return `${uuid.slice(0, 8)}.${uuid.slice(-4)}`;
}

type ServicioPropio = {
  id: string;
  conductorAsignadoId: string | null;
  estado: string;
};

function esServicioPropio(
  servicio: ServicioPropio | null,
  solicitudId: string,
  conductorId: string
): boolean {
  return (
    servicio !== null &&
    servicio.id === solicitudId &&
    servicio.conductorAsignadoId === conductorId
  );
}

// Precedencia (solo cuentan respuestas del servicio propio):
// 1. respuesta con id y conductorAsignadoId propios y estado 'finalizada' → confirmada.
// 2. detalle con id y conductorAsignadoId propios y estado 'finalizada' → confirmada.
// 3. detalle propio con estado 'en_servicio' → sigue_en_servicio.
// 4. cualquier otra combinación → no_verificable.
export function resolverResultadoFinalizacion(entrada: {
  solicitudId: string;
  conductorId: string;
  respuesta: SolicitudDto | null;
  detalle: SolicitudDetalleDto | null;
}): ResultadoFinalizacion {
  const { solicitudId, conductorId, respuesta, detalle } = entrada;

  if (
    esServicioPropio(respuesta, solicitudId, conductorId) &&
    respuesta?.estado === 'finalizada'
  ) {
    return { tipo: 'confirmada' };
  }

  if (esServicioPropio(detalle, solicitudId, conductorId) && detalle?.estado === 'finalizada') {
    return { tipo: 'confirmada' };
  }

  if (esServicioPropio(detalle, solicitudId, conductorId) && detalle?.estado === 'en_servicio') {
    return { tipo: 'sigue_en_servicio' };
  }

  return { tipo: 'no_verificable' };
}
