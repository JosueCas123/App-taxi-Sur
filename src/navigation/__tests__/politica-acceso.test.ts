import { expect, it } from '@jest/globals';

import {
  evaluarAccesoOperativo,
  pathnameCuentaPorEstado,
  rutaInicialPorEstado,
  type ServicioConfirmado,
} from '../resolve-route';

function servicio(
  parcial: Partial<ServicioConfirmado> = {}
): ServicioConfirmado {
  return {
    id: 'solicitud-1',
    conductorAsignadoId: 'conductor-a',
    estado: 'en_servicio',
    ...parcial,
  };
}

it('aprobado sin servicio confirmado tiene acceso operativo permitido', () => {
  expect(evaluarAccesoOperativo('aprobado', 'conductor-a', null)).toBe('permitido');
});

it('aprobado con servicio confirmado propio mantiene acceso (prioridad en-servicio es de M05)', () => {
  expect(evaluarAccesoOperativo('aprobado', 'conductor-a', servicio())).toBe('permitido');
});

it.each(['pendiente', 'rechazado', 'suspendido'] as const)(
  '%s sin servicio confirmado queda bloqueado_por_estado',
  (estado) => {
    expect(evaluarAccesoOperativo(estado, 'conductor-a', null)).toBe('bloqueado_por_estado');
  }
);

it.each(['pendiente', 'rechazado', 'suspendido'] as const)(
  '%s con servicio confirmado propio conserva solo_finalizar',
  (estado) => {
    expect(evaluarAccesoOperativo(estado, 'conductor-a', servicio())).toBe('solo_finalizar');
  }
);

it('un servicio asignado a otra identidad no habilita la excepción de continuidad', () => {
  expect(
    evaluarAccesoOperativo('suspendido', 'conductor-a', servicio({ conductorAsignadoId: 'conductor-b' }))
  ).toBe('bloqueado_por_estado');
});

it('un servicio que no está en_servicio no cuenta como confirmado (defensivo)', () => {
  expect(
    evaluarAccesoOperativo(
      'suspendido',
      'conductor-a',
      servicio({ estado: 'otro' as ServicioConfirmado['estado'] })
    )
  ).toBe('bloqueado_por_estado');
});

it.each(['pendiente', 'rechazado', 'suspendido'] as const)(
  '%s con continuidad de finalización conserva solo_finalizar',
  (estado) => {
    expect(evaluarAccesoOperativo(estado, 'conductor-a', null, true)).toBe('solo_finalizar');
  }
);

it('la continuidad de finalización no habilita una identidad sin verificar', () => {
  expect(evaluarAccesoOperativo('suspendido', null, null, true)).toBe('bloqueado_por_estado');
  expect(evaluarAccesoOperativo(null, 'conductor-a', null, true)).toBe('bloqueado_por_estado');
});

it('estado de cuenta ausente o identidad sin verificar no habilita operación', () => {
  expect(evaluarAccesoOperativo(null, 'conductor-a', servicio())).toBe('bloqueado_por_estado');
  expect(evaluarAccesoOperativo(undefined, 'conductor-a', null)).toBe('bloqueado_por_estado');
  expect(evaluarAccesoOperativo('aprobado', null, servicio())).toBe('bloqueado_por_estado');
  expect(evaluarAccesoOperativo('pendiente', null, servicio())).toBe('bloqueado_por_estado');
});

it('la ruta inicial por estado conserva el mapa de cuentas y el inicio aprobado', () => {
  expect(rutaInicialPorEstado('pendiente')).toBe('/(cuenta)/revision');
  expect(rutaInicialPorEstado('rechazado')).toBe('/(cuenta)/rechazada');
  expect(rutaInicialPorEstado('suspendido')).toBe('/(cuenta)/suspendida');
  expect(rutaInicialPorEstado('aprobado')).toBe('/(operacion)/inicio');
});

it('el pathname de cuenta por estado omite el grupo, como expo-router en la URL', () => {
  expect(pathnameCuentaPorEstado('pendiente')).toBe('/revision');
  expect(pathnameCuentaPorEstado('rechazado')).toBe('/rechazada');
  expect(pathnameCuentaPorEstado('suspendido')).toBe('/suspendida');
});
