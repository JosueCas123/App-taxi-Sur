import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';

import { recuperarInstantaneaOperativa, servicioConfirmadoDe } from '../reconcile';
import type { InstantaneaOperativa } from '../reconcile';
import type { ConductorDetalleDto } from '../../auth/api';
import type { SolicitudDetalleDto } from '../api';

jest.mock('../../../config/runtime', () => ({
  runtimeConfig: { apiUrl: 'https://api.example.test', contactoAyuda: null },
}));

const fetchOriginal = globalThis.fetch;
let fetchMock: jest.MockedFunction<typeof fetch>;

function respuesta(datos: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(datos),
  } as Response;
}

function conductor(parcial: Partial<ConductorDetalleDto> = {}): ConductorDetalleDto {
  return {
    id: 'conductor-a',
    usuarioId: 'usuario-1',
    telefono: '70000000',
    nombreCompleto: 'Luis',
    cedulaIdentidad: '1234567',
    estado: 'aprobado',
    estadoJornada: 'activa',
    estadoDisponibilidad: 'en_servicio',
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
    conductorAsignadoId: 'conductor-a',
    estado: 'en_servicio',
    latitudRecogida: -17.78,
    longitudRecogida: -63.18,
    destino: null,
    puntoRecogidaTexto: null,
    expiraEn: null,
    aceptadaEn: '2026-10-15T12:00:00.000Z',
    finalizadaEn: null,
    creadoEn: '2026-10-15T11:59:00.000Z',
    pasajero: { id: 'pasajero-1', nombre: 'Ana' },
    conductorAsignado: null,
    distanciaAproximadaKm: null,
    ...parcial,
  };
}

function instantanea(parcial: Partial<InstantaneaOperativa> = {}): InstantaneaOperativa {
  return {
    conductor: conductor(),
    solicitudActiva: solicitud(),
    ...parcial,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  fetchMock = jest.fn<typeof fetch>();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

it('servicioConfirmadoDe deriva el servicio cuando está en_servicio y asignado al conductor', () => {
  const resultado = servicioConfirmadoDe(instantanea());
  expect(resultado).toEqual({
    id: 'solicitud-1',
    conductorAsignadoId: 'conductor-a',
    estado: 'en_servicio',
  });
});

it('servicioConfirmadoDe devuelve null si la solicitud no está en_servicio', () => {
  expect(
    servicioConfirmadoDe(instantanea({ solicitudActiva: solicitud({ estado: 'esperando_respuesta' }) }))
  ).toBeNull();
});

it('servicioConfirmadoDe devuelve null si la solicitud está asignada a otro conductor', () => {
  expect(
    servicioConfirmadoDe(
      instantanea({ solicitudActiva: solicitud({ conductorAsignadoId: 'otro-conductor' }) })
    )
  ).toBeNull();
});

it('servicioConfirmadoDe devuelve null sin solicitud activa', () => {
  expect(servicioConfirmadoDe(instantanea({ solicitudActiva: null }))).toBeNull();
});

it('recuperarInstantaneaOperativa recupera perfil y solicitud activa en una sola pasada', async () => {
  const perfil = conductor();
  const activa = solicitud();
  fetchMock.mockImplementation((async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    if (url.endsWith('/solicitud-activa')) return respuesta(activa);
    return respuesta(perfil);
  }) as typeof fetch);

  const resultado = await recuperarInstantaneaOperativa('conductor-a', 'token-123');

  expect(resultado).toEqual({ conductor: perfil, solicitudActiva: activa });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const urls = fetchMock.mock.calls.map(([url]) => url);
  expect(urls).toContain('https://api.example.test/api/conductores/conductor-a');
  expect(urls).toContain('https://api.example.test/api/conductores/conductor-a/solicitud-activa');
  for (const [, opciones] of fetchMock.mock.calls) {
    const headers = opciones?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-123');
  }
});

it('recuperarInstantaneaOperativa expone la ausencia de solicitud activa como null', async () => {
  fetchMock.mockImplementation((async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    if (url.endsWith('/solicitud-activa')) return respuesta(null);
    return respuesta(conductor({ estadoDisponibilidad: 'disponible' }));
  }) as typeof fetch);

  const resultado = await recuperarInstantaneaOperativa('conductor-a', 'token-123');

  expect(resultado.solicitudActiva).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
