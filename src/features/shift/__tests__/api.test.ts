import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';

import { esErrorApi } from '../../../lib/api-client';
import { cambiarDisponibilidad, finalizarJornada, iniciarJornada } from '../api';

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

function perfil(parcial: Record<string, unknown> = {}) {
  return { id: 'conductor-a', ...parcial };
}

beforeEach(() => {
  jest.resetAllMocks();
  fetchMock = jest.fn<typeof fetch>();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

it('iniciarJornada hace PATCH a /api/conductores/:id/jornada con {accion:"iniciar"} y Bearer', async () => {
  const detalle = perfil({ estadoJornada: 'activa', estadoDisponibilidad: 'no_disponible' });
  fetchMock.mockResolvedValue(respuesta(detalle));

  const resultado = await iniciarJornada('conductor-a', 'token-123');

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, opciones] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.example.test/api/conductores/conductor-a/jornada');
  expect(opciones?.method).toBe('PATCH');
  const headers = opciones?.headers as Record<string, string>;
  expect(headers.Authorization).toBe('Bearer token-123');
  expect(headers['Content-Type']).toBe('application/json');
  expect(JSON.parse(String(opciones?.body))).toEqual({ accion: 'iniciar' });
  expect(resultado).toEqual(detalle);
});

it('finalizarJornada hace PATCH a /api/conductores/:id/jornada con {accion:"finalizar"}', async () => {
  fetchMock.mockResolvedValue(respuesta(perfil({ estadoJornada: 'finalizada' })));

  await finalizarJornada('conductor-a', 'token-123');

  const [url, opciones] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.example.test/api/conductores/conductor-a/jornada');
  expect(opciones?.method).toBe('PATCH');
  expect(JSON.parse(String(opciones?.body))).toEqual({ accion: 'finalizar' });
});

it('cambiarDisponibilidad(true) hace PATCH con {disponible:true}', async () => {
  fetchMock.mockResolvedValue(respuesta(perfil({ estadoDisponibilidad: 'disponible' })));

  await cambiarDisponibilidad('conductor-a', 'token-123', true);

  const [url, opciones] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.example.test/api/conductores/conductor-a/disponibilidad');
  expect(opciones?.method).toBe('PATCH');
  expect(JSON.parse(String(opciones?.body))).toEqual({ disponible: true });
});

it('cambiarDisponibilidad(false) hace PATCH con {disponible:false}', async () => {
  fetchMock.mockResolvedValue(respuesta(perfil({ estadoDisponibilidad: 'no_disponible' })));

  await cambiarDisponibilidad('conductor-a', 'token-123', false);

  const [, opciones] = fetchMock.mock.calls[0];
  expect(JSON.parse(String(opciones?.body))).toEqual({ disponible: false });
});

it('codifica el id del conductor en la ruta', async () => {
  fetchMock.mockResolvedValue(respuesta(perfil()));

  await iniciarJornada('con/espacio', 'token-123');

  const [url] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.example.test/api/conductores/con%2Fespacio/jornada');
});

it('propaga el 409 INVALID_STATE_TRANSITION como CONFLICT conservando el backendCode', async () => {
  fetchMock.mockResolvedValue(
    respuesta(
      { error: { code: 'INVALID_STATE_TRANSITION', message: 'Jornada no está activa' } },
      409
    )
  );

  await expect(cambiarDisponibilidad('conductor-a', 'token-123', true)).rejects.toMatchObject({
    code: 'CONFLICT',
    status: 409,
    backendCode: 'INVALID_STATE_TRANSITION',
  });
});

it('un fallo de red se propaga como RED sin reintentar automáticamente', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));

  let capturado: unknown;
  try {
    await iniciarJornada('conductor-a', 'token-123');
  } catch (error) {
    capturado = error;
  }

  expect(esErrorApi(capturado) && capturado.code === 'RED').toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
