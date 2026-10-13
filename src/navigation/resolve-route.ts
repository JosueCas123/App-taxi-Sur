import type { Href } from 'expo-router';

import type { ConductorDetalleDto } from '../features/auth/api';

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