import type { ConductorDetalleDto } from '../auth/api';

import type { EstadoUbicacionOperativa } from './ubicacion-operativa';

// Umbral estricto: por debajo de 5 minutos la ubicación cuenta como lista; al
// cumplir 5 minutos se considera desactualizada (coherente con M04).
export const UBICACION_VIGENCIA_MS = 5 * 60 * 1000;

export type MotivoDisponibilidadBloqueada =
  | 'cuenta_no_aprobada'
  | 'jornada_no_activa'
  | 'ubicacion_no_lista'
  | 'estado_no_disponible'; // en_servicio o solicitud_pendiente

export type EntradaDisponibilidad = {
  estadoCuenta: ConductorDetalleDto['estado'];
  estadoJornada: ConductorDetalleDto['estadoJornada'];
  estadoDisponibilidad: ConductorDetalleDto['estadoDisponibilidad'];
  ubicacion: EstadoUbicacionOperativa;
};

// `ubicacion.lista` implica muestra aceptada por el servidor; si además trae una
// antigüedad, se exige estrictamente menor al umbral.
export function esUbicacionOperativaLista(ubicacion: EstadoUbicacionOperativa): boolean {
  if (!ubicacion.lista) {
    return false;
  }
  if (ubicacion.antiguedadMs === null) {
    return true;
  }
  return ubicacion.antiguedadMs < UBICACION_VIGENCIA_MS;
}

export function puedeActivarDisponibilidad(entrada: EntradaDisponibilidad): {
  permitido: boolean;
  motivo: MotivoDisponibilidadBloqueada | null;
} {
  if (entrada.estadoCuenta !== 'aprobado') {
    return { permitido: false, motivo: 'cuenta_no_aprobada' };
  }
  if (entrada.estadoJornada !== 'activa') {
    return { permitido: false, motivo: 'jornada_no_activa' };
  }
  if (!esUbicacionOperativaLista(entrada.ubicacion)) {
    return { permitido: false, motivo: 'ubicacion_no_lista' };
  }
  if (
    entrada.estadoDisponibilidad === 'en_servicio' ||
    entrada.estadoDisponibilidad === 'solicitud_pendiente'
  ) {
    return { permitido: false, motivo: 'estado_no_disponible' };
  }
  return { permitido: true, motivo: null };
}

// Control de jornada: qué acción se muestra y si está habilitada.
// 'no_iniciada' | 'finalizada' -> 'iniciar' habilitado.
// 'activa' sin cierre solicitado -> 'finalizar' habilitado.
// 'activa' con cierre solicitado -> 'finalizar' deshabilitado.
export function accionJornada(conductor: ConductorDetalleDto): {
  accion: 'iniciar' | 'finalizar';
  habilitado: boolean;
  motivo: 'cierre_solicitado' | null;
} {
  if (conductor.estadoJornada === 'activa') {
    if (conductor.cierreJornadaSolicitado) {
      return { accion: 'finalizar', habilitado: false, motivo: 'cierre_solicitado' };
    }
    return { accion: 'finalizar', habilitado: true, motivo: null };
  }
  return { accion: 'iniciar', habilitado: true, motivo: null };
}

// Control de disponibilidad: qué acción se muestra y si está habilitada.
// 'disponible' -> 'desactivar' (apagar siempre es seguro).
// 'en_servicio' | 'solicitud_pendiente' -> 'bloqueado'.
// 'no_disponible' -> 'activar' habilitado solo si la política lo permite.
export function accionDisponibilidad(entrada: EntradaDisponibilidad): {
  tipo: 'activar' | 'desactivar' | 'bloqueado';
  habilitado: boolean;
  motivo: MotivoDisponibilidadBloqueada | null;
} {
  if (entrada.estadoDisponibilidad === 'disponible') {
    return { tipo: 'desactivar', habilitado: true, motivo: null };
  }
  if (
    entrada.estadoDisponibilidad === 'en_servicio' ||
    entrada.estadoDisponibilidad === 'solicitud_pendiente'
  ) {
    return { tipo: 'bloqueado', habilitado: false, motivo: 'estado_no_disponible' };
  }
  const { permitido, motivo } = puedeActivarDisponibilidad(entrada);
  return { tipo: 'activar', habilitado: permitido, motivo };
}
