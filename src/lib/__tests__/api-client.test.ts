import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';

import { apiRequest } from '../api-client';

jest.mock('../../config/runtime', () => ({
  runtimeConfig: { apiUrl: 'https://api.example.test', contactoAyuda: null },
}));

const fetchOriginal = globalThis.fetch;
let fetchMock: jest.MockedFunction<typeof fetch>;

function respuesta(datos: unknown, status = 200, fecha: string | null = null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (clave: string) => (clave === 'Date' ? fecha : null),
    },
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

it('capturarFechaServidor se invoca con el valor crudo de la cabecera Date', async () => {
  const fecha = 'Wed, 15 Oct 2026 12:00:00 GMT';
  fetchMock.mockResolvedValue(respuesta({ ok: true }, 200, fecha));

  const capturada = jest.fn<(fechaServidor: string | null) => void>();
  await apiRequest('ruta', { capturarFechaServidor: capturada });

  expect(capturada).toHaveBeenCalledWith(fecha);
});

it('capturarFechaServidor recibe null si la cabecera Date falta', async () => {
  fetchMock.mockResolvedValue(respuesta({ ok: true }, 200, null));

  const capturada = jest.fn<(fechaServidor: string | null) => void>();
  await apiRequest('ruta', { capturarFechaServidor: capturada });

  expect(capturada).toHaveBeenCalledWith(null);
});

it('capturarFechaServidor no se invoca en respuestas no exitosas', async () => {
  fetchMock.mockResolvedValue(respuesta({ error: 'x' }, 409, 'Wed, 15 Oct 2026 12:00:00 GMT'));

  const capturada = jest.fn<(fechaServidor: string | null) => void>();
  await expect(apiRequest('ruta', { capturarFechaServidor: capturada })).rejects.toMatchObject({
    code: 'CONFLICT',
  });

  expect(capturada).not.toHaveBeenCalled();
});
