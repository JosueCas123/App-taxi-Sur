import { expect, it } from '@jest/globals';

import { rutaInicialPorEstado } from '../../../navigation/resolve-route';
import type { ConductorDetalleDto } from '../api';

it.each([
  ['pendiente', '/(cuenta)/revision'],
  ['rechazado', '/(cuenta)/rechazada'],
  ['suspendido', '/(cuenta)/suspendida'],
  ['aprobado', '/(operacion)/inicio'],
] satisfies [ConductorDetalleDto['estado'], string][])('resuelve %s a %s', (estado, ruta) => {
  expect(rutaInicialPorEstado(estado)).toBe(ruta);
});
