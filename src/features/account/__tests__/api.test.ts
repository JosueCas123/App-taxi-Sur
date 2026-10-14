import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';

import { esErrorApi } from '../../../lib/api-client';
import { registrarConductor } from '../api';
import type { RegistroConductorInput } from '../registration-schema';

jest.mock('../../../config/runtime', () => ({
  runtimeConfig: { apiUrl: 'https://api.example.test', contactoAyuda: null },
}));

const fetchOriginal = globalThis.fetch;
let fetchMock: jest.MockedFunction<typeof fetch>;

function entrada(): RegistroConductorInput {
  return {
    telefono: '70000000',
    pin: '0012',
    nombreCompleto: 'Ana Pérez',
    cedulaIdentidad: '1234567',
    vehiculo: {
      placa: 'ABC123',
      marca: 'Toyota',
      modelo: 'Corolla',
      color: 'Blanco',
      capacidadPasajeros: 4,
    },
  };
}

function respuesta(datos: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(datos),
  } as Response;
}

beforeEach(() => {
  jest.resetAllMocks();
  fetchMock = jest.fn<typeof fetch>();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

it('hace POST público a /api/conductores con el cuerpo exacto y sin Bearer', async () => {
  const perfil = { id: 'conductor-nuevo', estado: 'pendiente' };
  fetchMock.mockResolvedValue(respuesta(perfil, 201));

  const resultado = await registrarConductor(entrada());

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, opciones] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.example.test/api/conductores');
  expect(opciones?.method).toBe('POST');
  const headers = opciones?.headers as Record<string, string>;
  expect(headers['Content-Type']).toBe('application/json');
  expect(headers.Authorization).toBeUndefined();
  expect(JSON.parse(String(opciones?.body))).toEqual(entrada());
  expect(resultado).toEqual(perfil);
});

it('devuelve el cuerpo directo sin envoltorio data', async () => {
  const perfil = { id: 'conductor-nuevo', estado: 'pendiente' };
  fetchMock.mockResolvedValue(respuesta(perfil, 201));
  const resultado = await registrarConductor(entrada());
  expect(resultado.id).toBe('conductor-nuevo');
});

it('un HTTP 409 produce un CONFLICT tipado por estado, sin interpretar el message', async () => {
  fetchMock.mockResolvedValue(
    respuesta({ error: { code: 'CONFLICT', message: 'El telefono ya esta registrado' } }, 409)
  );
  await expect(registrarConductor(entrada())).rejects.toMatchObject({
    code: 'CONFLICT',
    status: 409,
  });
});

it('un fallo de red se propaga como RED sin reintentar automáticamente', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));
  let capturado: unknown;
  try {
    await registrarConductor(entrada());
  } catch (error) {
    capturado = error;
  }
  expect(esErrorApi(capturado) && capturado.code === 'RED').toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
