import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';

import { esErrorApi } from '../../../lib/api-client';
import { enviarUbicacion, type UbicacionDto } from '../api';

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

function dto(parcial: Partial<UbicacionDto> = {}): UbicacionDto {
  return {
    id: '7',
    latitud: -17.78,
    longitud: -63.18,
    horaRegistro: '2026-10-14T12:00:00.000Z',
    esValida: true,
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

it('hace POST a /api/conductores/:id/ubicacion con {latitud,longitud} y Bearer, sin timestamp', async () => {
  const respuestaDto = dto();
  fetchMock.mockResolvedValue(respuesta(respuestaDto, 201));

  const resultado = await enviarUbicacion('conductor-a', 'token-123', {
    latitud: -17.78,
    longitud: -63.18,
  });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, opciones] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.example.test/api/conductores/conductor-a/ubicacion');
  expect(opciones?.method).toBe('POST');
  const headers = opciones?.headers as Record<string, string>;
  expect(headers.Authorization).toBe('Bearer token-123');
  expect(headers['Content-Type']).toBe('application/json');
  expect(JSON.parse(String(opciones?.body))).toEqual({ latitud: -17.78, longitud: -63.18 });
  expect(resultado).toEqual(respuestaDto);
});

it('envía el cuerpo estricto descartando cualquier campo adicional de la muestra', async () => {
  fetchMock.mockResolvedValue(respuesta(dto(), 201));

  await enviarUbicacion('conductor-a', 'token-123', {
    latitud: 1,
    longitud: 2,
    capturadaEn: 123,
    precisionM: 30,
  } as { latitud: number; longitud: number });

  const [, opciones] = fetchMock.mock.calls[0];
  expect(JSON.parse(String(opciones?.body))).toEqual({ latitud: 1, longitud: 2 });
});

it('codifica el id del conductor en la ruta', async () => {
  fetchMock.mockResolvedValue(respuesta(dto(), 201));

  await enviarUbicacion('con/espacio', 'token-123', { latitud: 0, longitud: 0 });

  const [url] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.example.test/api/conductores/con%2Fespacio/ubicacion');
});

it('propaga el 403 CONDUCTOR_NO_APROBADO como FORBIDDEN conservando el backendCode', async () => {
  fetchMock.mockResolvedValue(
    respuesta(
      { error: { code: 'CONDUCTOR_NO_APROBADO', message: 'Conductor no aprobado' } },
      403
    )
  );

  await expect(
    enviarUbicacion('conductor-a', 'token-123', { latitud: 0, longitud: 0 })
  ).rejects.toMatchObject({
    code: 'FORBIDDEN',
    status: 403,
    backendCode: 'CONDUCTOR_NO_APROBADO',
  });
});

it('un fallo de red se propaga como RED sin reintentar automáticamente', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));

  let capturado: unknown;
  try {
    await enviarUbicacion('conductor-a', 'token-123', { latitud: 0, longitud: 0 });
  } catch (error) {
    capturado = error;
  }

  expect(esErrorApi(capturado) && capturado.code === 'RED').toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
