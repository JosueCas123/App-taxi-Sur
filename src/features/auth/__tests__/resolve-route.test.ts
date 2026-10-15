import { expect, it } from '@jest/globals';
import type { Href } from 'expo-router';

import {
  pathnameDeRuta,
  resolverRutaOperativa,
  rutaInicialPorEstado,
  type EstadoOperativoConfirmado,
} from '../../../navigation/resolve-route';
import type { ConductorDetalleDto } from '../api';
import type { SolicitudDetalleDto } from '../../requests/api';

it.each([
  ['/(operacion)/inicio', '/inicio'],
  ['/(operacion)/solicitud-entrante', '/solicitud-entrante'],
  ['/(operacion)/en-servicio', '/en-servicio'],
  ['/(cuenta)/revision', '/revision'],
] satisfies [string, string][])('pathnameDeRuta(%s) → %s', (href, pathname) => {
  expect(pathnameDeRuta(href as Href)).toBe(pathname);
});

it.each([
  ['pendiente', '/(cuenta)/revision'],
  ['rechazado', '/(cuenta)/rechazada'],
  ['suspendido', '/(cuenta)/suspendida'],
  ['aprobado', '/(operacion)/inicio'],
] satisfies [ConductorDetalleDto['estado'], string][])('resuelve %s a %s', (estado, ruta) => {
  expect(rutaInicialPorEstado(estado)).toBe(ruta);
});

const CONDUCTOR_ID = 'conductor-a';

function conductor(parcial: Partial<ConductorDetalleDto> = {}): ConductorDetalleDto {
  return {
    id: CONDUCTOR_ID,
    usuarioId: 'usuario-1',
    telefono: '70000000',
    nombreCompleto: 'Luis Pérez',
    cedulaIdentidad: '1234567',
    estado: 'aprobado',
    estadoJornada: 'activa',
    estadoDisponibilidad: 'disponible',
    cierreJornadaSolicitado: false,
    creadoEn: '2026-10-01T10:00:00.000Z',
    vehiculo: null,
    ...parcial,
  };
}

function solicitud(parcial: Partial<SolicitudDetalleDto> = {}): SolicitudDetalleDto {
  return {
    id: 'solicitud-1',
    pasajeroId: 'pasajero-1',
    conductorAsignadoId: CONDUCTOR_ID,
    estado: 'esperando_respuesta',
    latitudRecogida: -17.7833,
    longitudRecogida: -63.1821,
    destino: 'Centro',
    puntoRecogidaTexto: 'Plaza',
    expiraEn: '2026-10-15T12:01:00.000Z',
    aceptadaEn: null,
    finalizadaEn: null,
    creadoEn: '2026-10-15T12:00:00.000Z',
    pasajero: { id: 'pasajero-1', nombre: 'Ana' },
    conductorAsignado: null,
    distanciaAproximadaKm: 1,
    ...parcial,
  };
}

function estado(
  parcial: Omit<Partial<EstadoOperativoConfirmado>, 'conductor'> & {
    conductor?: Partial<ConductorDetalleDto>;
    solicitudActiva?: SolicitudDetalleDto | null;
  } = {}
): EstadoOperativoConfirmado {
  const { conductor: conductorParcial, solicitudActiva, ...resto } = parcial;
  return {
    conductor: conductor(conductorParcial),
    solicitudActiva: solicitudActiva ?? null,
    ...resto,
  };
}

it('aprobado sin solicitud activa navega a inicio', () => {
  expect(resolverRutaOperativa(estado())).toBe('/(operacion)/inicio');
});

it('un servicio en_servicio propio navega a en-servicio', () => {
  expect(
    resolverRutaOperativa(estado({ solicitudActiva: solicitud({ estado: 'en_servicio' }) }))
  ).toBe('/(operacion)/en-servicio');
});

it('una cuenta suspendida con servicio en_servicio propio no se bloquea', () => {
  expect(
    resolverRutaOperativa(
      estado({
        conductor: { estado: 'suspendido' },
        solicitudActiva: solicitud({ estado: 'en_servicio' }),
      })
    )
  ).toBe('/(operacion)/en-servicio');
});

it('una oferta esperando_respuesta asignada al conductor navega a solicitud-entrante', () => {
  expect(
    resolverRutaOperativa(
      estado({ solicitudActiva: solicitud({ estado: 'esperando_respuesta' }) })
    )
  ).toBe('/(operacion)/solicitud-entrante');
});

it('una oferta esperando_respuesta no asignada al conductor se ignora', () => {
  expect(
    resolverRutaOperativa(
      estado({
        solicitudActiva: solicitud({
          estado: 'esperando_respuesta',
          conductorAsignadoId: 'otro-conductor',
        }),
      })
    )
  ).toBe('/(operacion)/inicio');
});

it('un servicio en_servicio asignado a otro conductor no habilita la continuidad', () => {
  expect(
    resolverRutaOperativa(
      estado({
        conductor: { estado: 'suspendido' },
        solicitudActiva: solicitud({
          estado: 'en_servicio',
          conductorAsignadoId: 'otro-conductor',
        }),
      })
    )
  ).toBe('/(cuenta)/suspendida');
});

it('un servicio en_servicio propio sin asignación válida no navega a en-servicio', () => {
  expect(
    resolverRutaOperativa(
      estado({
        solicitudActiva: solicitud({
          estado: 'en_servicio',
          conductorAsignadoId: null,
        }),
      })
    )
  ).toBe('/(operacion)/inicio');
});

it('una cuenta suspendida con oferta propia no entra a la operación', () => {
  expect(
    resolverRutaOperativa(
      estado({
        conductor: { estado: 'suspendido' },
        solicitudActiva: solicitud({ estado: 'esperando_respuesta' }),
      })
    )
  ).toBe('/(cuenta)/suspendida');
});

it.each([
  ['pendiente', '/(cuenta)/revision'],
  ['rechazado', '/(cuenta)/rechazada'],
  ['suspendido', '/(cuenta)/suspendida'],
] satisfies [ConductorDetalleDto['estado'], string][])(
  'cuenta %s sin servicio propio va a su ruta de cuenta',
  (estadoCuenta, ruta) => {
    expect(resolverRutaOperativa(estado({ conductor: { estado: estadoCuenta } }))).toBe(ruta);
  }
);

it('una solicitud finalizada no navega a ninguna pantalla de operación especial', () => {
  expect(
    resolverRutaOperativa(estado({ solicitudActiva: solicitud({ estado: 'finalizada' }) }))
  ).toBe('/(operacion)/inicio');
});
