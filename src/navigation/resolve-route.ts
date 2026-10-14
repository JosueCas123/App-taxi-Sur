import type { Href } from 'expo-router';

import type { ConductorDetalleDto } from '../features/auth/api';

// Entrada mínima de la política. M05 deberá producirla a partir de una
// respuesta real, vigente y del conductor y generación de sesión actuales.
export type ServicioConfirmado = {
  id: string;
  conductorAsignadoId: string;
  estado: 'en_servicio';
};

export type AccesoOperativo = 'permitido' | 'bloqueado_por_estado' | 'solo_finalizar';

export function rutaInicialPorEstado(estado: ConductorDetalleDto['estado']): Href {
  switch (estado) {
    case 'pendiente':
      return '/(cuenta)/revision';
    case 'rechazado':
      return '/(cuenta)/rechazada';
    case 'suspendido':
      return '/(cuenta)/suspendida';
    case 'aprobado':
      return '/(operacion)/inicio';
  }
}

// Pathname visible en la URL (expo-router omite los grupos) por estado de cuenta.
export function pathnameCuentaPorEstado(
  estado: Exclude<ConductorDetalleDto['estado'], 'aprobado'>
): string {
  switch (estado) {
    case 'pendiente':
      return '/revision';
    case 'rechazado':
      return '/rechazada';
    case 'suspendido':
      return '/suspendida';
  }
}

// Política centralizada de acceso operativo. Un servicio confirmado solo cuenta
// cuando pertenece al conductor actual; una identidad diferente no habilita la
// excepción de continuidad. Estado ausente o no verificado no habilita operación.
export function evaluarAccesoOperativo(
  estadoCuenta: ConductorDetalleDto['estado'] | null | undefined,
  conductorId: string | null,
  servicio: ServicioConfirmado | null
): AccesoOperativo {
  if (!estadoCuenta || !conductorId) {
    return 'bloqueado_por_estado';
  }

  const servicioConfirmado =
    servicio !== null &&
    servicio.estado === 'en_servicio' &&
    servicio.conductorAsignadoId === conductorId;

  if (estadoCuenta === 'aprobado') {
    return 'permitido';
  }

  // Cuentas restringidas: solo continuidad/finalización con servicio confirmado propio.
  return servicioConfirmado ? 'solo_finalizar' : 'bloqueado_por_estado';
}