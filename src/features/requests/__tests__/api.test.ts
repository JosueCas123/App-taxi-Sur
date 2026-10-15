import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';

import { esErrorApi } from '../../../lib/api-client';
import { obtenerSolicitud, obtenerSolicitudActiva, type SolicitudDetalleDto } from '../api';

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

function detalle(parcial: Partial<SolicitudDetalleDto> = {}): SolicitudDetalleDto {
  return {
    id: 'solicitud-1',
    pasajeroId: 'pasajero-1',
    conductorAsignadoId: 'conductor-a',
    estado: 'esperando_respuesta',
    latitudRecogida: -17.7833,
    longitudRecogida: -63.1821,
    destino: 'Centro',
    puntoRecogidaTexto: 'Plaza 24 de Septiembre',
    expiraEn: '2026-10-15T12:00:00.000Z',
    aceptadaEn: null,
    finalizadaEn: null,
    creadoEn: '2026-10-15T11:59:00.000Z',
    pasajero: { id: 'pasajero-1', nombre: 'Ana' },
    conductorAsignado: {
      id: 'conductor-a',
      nombreCompleto: 'Luis',
      vehiculo: null,
    },
    distanciaAproximadaKm: 1.2,
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

it('obtenerSolicitudActiva hace GET a la ruta de solicitud activa con Bearer', async () => {
  const dto = detalle();
  fetchMock.mockResolvedValue(respuesta(dto));

  const resultado = await obtenerSolicitudActiva('conductor-a', 'token-123');

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, opciones] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.example.test/api/conductores/conductor-a/solicitud-activa');
  expect(opciones?.method ?? 'GET').toBe('GET');
  const headers = opciones?.headers as Record<string, string>;
  expect(headers.Authorization).toBe('Bearer token-123');
  expect(headers.Accept).toBe('application/json');
  expect(opciones?.body).toBeUndefined();
  expect(resultado).toEqual(dto);
});

it('obtenerSolicitudActiva devuelve null cuando el conductor no tiene solicitud activa', async () => {
  fetchMock.mockResolvedValue(respuesta(null));

  const resultado = await obtenerSolicitudActiva('conductor-a', 'token-123');

  expect(resultado).toBeNull();
});

it('codifica el id del conductor en la ruta de solicitud activa', async () => {
  fetchMock.mockResolvedValue(respuesta(null));

  await obtenerSolicitudActiva('con/espacio', 'token-123');

  const [url] = fetchMock.mock.calls[0];
  expect(url).toBe(
    'https://api.example.test/api/conductores/con%2Fespacio/solicitud-activa'
  );
});

it('obtenerSolicitud hace GET a /api/solicitudes/:id con Bearer', async () => {
  const dto = detalle({ estado: 'en_servicio' });
  fetchMock.mockResolvedValue(respuesta(dto));

  const resultado = await obtenerSolicitud('solicitud-1', 'token-123');

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, opciones] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.example.test/api/solicitudes/solicitud-1');
  expect(opciones?.method ?? 'GET').toBe('GET');
  const headers = opciones?.headers as Record<string, string>;
  expect(headers.Authorization).toBe('Bearer token-123');
  expect(resultado).toEqual(dto);
});

it('propaga el 403 de obtenerSolicitud como FORBIDDEN', async () => {
  fetchMock.mockResolvedValue(
    respuesta({ error: { code: 'FORBIDDEN', message: 'Permiso denegado' } }, 403)
  );

  let capturado: unknown;
  try {
    await obtenerSolicitud('solicitud-1', 'token-123');
  } catch (error) {
    capturado = error;
  }

  expect(esErrorApi(capturado)).toBe(true);
  expect(capturado).toMatchObject({ code: 'FORBIDDEN', status: 403 });
});

it('propaga el 404 de obtenerSolicitud como NOT_FOUND', async () => {
  fetchMock.mockResolvedValue(
    respuesta({ error: { code: 'NOT_FOUND', message: 'Solicitud no encontrada' } }, 404)
  );

  await expect(obtenerSolicitud('solicitud-1', 'token-123')).rejects.toMatchObject({
    code: 'NOT_FOUND',
    status: 404,
  });
});

it('un fallo de red se propaga como RED sin reintentar', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));

  await expect(obtenerSolicitudActiva('conductor-a', 'token-123')).rejects.toMatchObject({
    code: 'RED',
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
