import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';

import { queryKeys } from '../../../lib/query-client';
import type { ConductorDetalleDto } from '../api';
import { registrarAlInvalidar, SessionProvider, useSession, type SessionStatus } from '../session-context';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../../../config/runtime', () => ({
  runtimeConfig: { apiUrl: 'https://api.example.test', contactoAyuda: null },
}));

const fetchOriginal = globalThis.fetch;
let fetchMock: jest.MockedFunction<typeof fetch>;
let almacenado: string | null;
let client: QueryClient;

function jwt(payload: object = { conductorId: 'conductor-a', exp: 4102444800 }) {
  return `cabecera.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.firma`;
}

function perfil(id = 'conductor-a'): ConductorDetalleDto {
  return {
    id, usuarioId: `usuario-${id}`, telefono: '00000000', nombreCompleto: 'Prueba',
    cedulaIdentidad: 'prueba', estado: 'aprobado', estadoJornada: 'no_iniciada',
    estadoDisponibilidad: 'no_disponible', cierreJornadaSolicitado: false,
    creadoEn: '2026-01-01T00:00:00.000Z', vehiculo: null,
  };
}

function respuesta(datos: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(datos) } as Response;
}

function diferida<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

async function montar() {
  return renderHook(() => useSession(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  almacenado = jwt();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  fetchMock = jest.fn<typeof fetch>();
  globalThis.fetch = fetchMock;
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async () => almacenado);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (_key, token) => { almacenado = token; });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async () => { almacenado = null; });
});

afterEach(() => {
  client.clear();
  globalThis.fetch = fetchOriginal;
  jest.useRealTimers();
});

it('sin token no consulta el servidor y restaura una sola vez al montar', async () => {
  almacenado = null;
  const { result, rerender } = await montar();
  await rerender(undefined);
  expect(result.current.status).toBe('no_autenticado');
  expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('un fallo de lectura segura termina sin autenticar y sin fetch', async () => {
  jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('SecureStore unavailable'));
  const { result } = await montar();
  expect(result.current.status).toBe('no_autenticado');
  expect(result.current.mensajeSesion).toBe('No se pudo leer la sesión segura. Intenta ingresar nuevamente');
  expect(result.current.token).toBeNull();
  expect(result.current.conductor).toBeNull();
  expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('exp vencido borra token sin fetch', async () => {
  almacenado = jwt({ conductorId: 'conductor-a', exp: Math.floor(Date.now() / 1000) - 1 });
  const { result } = await montar();
  expect(result.current.status).toBe('no_autenticado');
  expect(almacenado).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('sin conductorId no usa sub y borra el token incompatible', async () => {
  almacenado = jwt({ sub: 'usuario-a', exp: 4102444800 });
  const { result } = await montar();
  expect(result.current.status).toBe('sesion_incompatible');
  expect(result.current.conductorId).toBeNull();
  expect(almacenado).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('confirma con Bearer y el perfil vive y se actualiza en Query', async () => {
  fetchMock.mockResolvedValue(respuesta(perfil()));
  const { result } = await montar();
  expect(result.current.status).toBe('autenticado');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/conductores/conductor-a',
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${almacenado}` }) }));
  expect(client.getQueryData(queryKeys.conductor('conductor-a'))).toEqual(perfil());
  await act(async () => {
    client.setQueryData(queryKeys.conductor('conductor-a'), { ...perfil(), estado: 'suspendido' });
  });
  await waitFor(() => expect(result.current.conductor?.estado).toBe('suspendido'));
});

it.each(['RED', 'TIMEOUT'] as const)('%s conserva token y permite reintento con el mismo Bearer', async (fallo) => {
  const token = almacenado;
  if (fallo === 'TIMEOUT') {
    jest.useFakeTimers();
    fetchMock.mockImplementationOnce((_url, opciones) => new Promise((_resolve, reject) => {
      opciones?.signal?.addEventListener('abort', () => reject(new Error('abort')));
    }));
  } else {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
  }
  const { result } = await montar();
  if (fallo === 'TIMEOUT') {
    await act(async () => { await jest.advanceTimersByTimeAsync(15000); });
  }
  expect(result.current.status).toBe('sesion_sin_verificar');
  expect(result.current.conductor).toBeNull();
  expect(almacenado).toBe(token);
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce(respuesta(perfil()));
  await act(() => result.current.restaurarSesion());
  expect(result.current.status).toBe('autenticado');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1]?.headers).toEqual(expect.objectContaining({ Authorization: `Bearer ${token}` }));
});

it.each([401, 403, 404])('perfil %s borra token y caches privadas incluso en el primer arranque', async (status) => {
  client.setQueryData(queryKeys.conductor('conductor-a'), perfil());
  client.setQueryData(queryKeys.solicitudActiva('conductor-a'), { id: 'solicitud-a' });
  client.setQueryData(queryKeys.configuracion(), { publico: true });
  fetchMock.mockResolvedValue(respuesta({}, status));
  const { result } = await montar();
  expect(result.current.status).toBe(status === 401 ? 'no_autenticado' : 'sesion_incompatible');
  expect(result.current.mensajeSesion).toBe(status === 401
    ? 'Tu sesi\u00f3n expir\u00f3. Ingresa nuevamente' : 'Tu sesi\u00f3n ya no es v\u00e1lida');
  expect(result.current.token).toBeNull();
  expect(result.current.conductor).toBeNull();
  expect(almacenado).toBeNull();
  expect(client.getQueryData(queryKeys.conductor('conductor-a'))).toBeUndefined();
  expect(client.getQueryData(queryKeys.solicitudActiva('conductor-a'))).toBeUndefined();
  expect(client.getQueryData(queryKeys.configuracion())).toEqual({ publico: true });
});

it('login con otro conductor limpia cache anterior y conserva solo el nuevo JWT', async () => {
  fetchMock.mockResolvedValueOnce(respuesta(perfil()));
  const { result } = await montar();
  client.setQueryData(queryKeys.solicitudActiva('conductor-a'), { id: 'solicitud-a' });
  const token = jwt({ conductorId: 'conductor-b', exp: 4102444800 });
  fetchMock.mockResolvedValueOnce(respuesta({ token, tokenType: 'Bearer', expiresIn: 3600 }));
  fetchMock.mockResolvedValueOnce(respuesta(perfil('conductor-b')));
  await act(() => result.current.iniciarSesion('00000000', '0012'));
  expect(result.current.status).toBe('autenticado');
  expect(result.current.conductorId).toBe('conductor-b');
  expect(client.getQueryData(queryKeys.conductor('conductor-a'))).toBeUndefined();
  expect(client.getQueryData(queryKeys.solicitudActiva('conductor-a'))).toBeUndefined();
  expect(client.getQueryData(queryKeys.conductor('conductor-b'))).toEqual(perfil('conductor-b'));
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('taxitur.session.token', token);
  expect(almacenado).toBe(token);
});

it('login con credenciales rechazadas propaga el error sin persistir token', async () => {
  almacenado = null;
  const { result } = await montar();
  fetchMock.mockResolvedValueOnce(
    respuesta({ error: { code: 'UNAUTHORIZED', message: 'Credenciales invalidas' } }, 401)
  );
  await act(async () => {
    await expect(result.current.iniciarSesion('70000000', '0000')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
  expect(result.current.status).toBe('no_autenticado');
  expect(almacenado).toBeNull();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('login con JWT sin conductorId da sesion incompatible con token borrado', async () => {
  almacenado = null;
  const { result } = await montar();
  const token = jwt({ sub: 'usuario-a', exp: 4102444800 });
  fetchMock.mockResolvedValueOnce(respuesta({ token, tokenType: 'Bearer', expiresIn: 3600 }));
  await act(() => result.current.iniciarSesion('70000000', '0012'));
  expect(result.current.status).toBe('sesion_incompatible');
  expect(result.current.conductorId).toBeNull();
  expect(result.current.mensajeSesion).toBe('Tu sesi\u00f3n ya no es v\u00e1lida');
  expect(almacenado).toBeNull();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('RED despues del login conserva el JWT y reintenta sin repetir credenciales', async () => {
  almacenado = null;
  const { result } = await montar();
  fetchMock.mockResolvedValueOnce(respuesta({ token: jwt(), tokenType: 'Bearer', expiresIn: 3600 }));
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
  await act(() => result.current.iniciarSesion('00000000', '0012'));
  expect(result.current.status).toBe('sesion_sin_verificar');
  expect(almacenado).toBe(jwt());
  fetchMock.mockResolvedValueOnce(respuesta(perfil()));
  await act(() => result.current.restaurarSesion());
  expect(result.current.status).toBe('autenticado');
  expect(fetchMock.mock.calls.map(([, opciones]) => opciones?.method)).toEqual(['POST', 'GET', 'GET']);
});

it('notifica listeners activos y permite desuscribirse', async () => {
  fetchMock.mockResolvedValue(respuesta(perfil()));
  const { result } = await montar();
  const activo = jest.fn();
  const retirado = jest.fn();
  const quitarActivo = registrarAlInvalidar(activo);
  const quitarRetirado = registrarAlInvalidar(retirado);
  quitarRetirado();
  try {
    await act(() => result.current.invalidarSesion());
    expect(activo).toHaveBeenCalledTimes(1);
    expect(retirado).not.toHaveBeenCalled();
    expect(result.current.status).toBe('no_autenticado');
    expect(almacenado).toBeNull();
  } finally {
    quitarActivo();
  }
});

it('invalidar aborta el perfil y una respuesta tardia no autentica ni repuebla cache', async () => {
  const pendiente = diferida<Response>();
  fetchMock.mockReturnValueOnce(pendiente.promise);
  const { result } = await montar();
  expect(result.current.status).toBe('restaurando');
  const signal = fetchMock.mock.calls[0][1]?.signal;
  await act(() => result.current.invalidarSesion());
  expect(signal?.aborted).toBe(true);
  await act(async () => { pendiente.resolve(respuesta(perfil())); });
  expect(result.current.status).toBe('no_autenticado');
  expect(result.current.token).toBeNull();
  expect(almacenado).toBeNull();
  expect(client.getQueryData(queryKeys.conductor('conductor-a'))).toBeUndefined();
});

it('cancelQueries impide autenticar con el resultado tardio del perfil', async () => {
  const pendiente = diferida<Response>();
  fetchMock.mockReturnValueOnce(pendiente.promise);
  const { result } = await montar();
  await act(() => client.cancelQueries({ queryKey: queryKeys.conductor('conductor-a') }));
  await act(async () => { pendiente.resolve(respuesta(perfil())); });
  expect(result.current.status).toBe('sesion_sin_verificar');
  expect(result.current.conductor).toBeNull();
  expect(client.getQueryData(queryKeys.conductor('conductor-a'))).toBeUndefined();
  fetchMock.mockResolvedValueOnce(respuesta(perfil()));
  await act(() => result.current.restaurarSesion());
  expect(result.current.status).toBe('autenticado');
});

it('invalidar durante login ignora el JWT tardio sin persistirlo', async () => {
  almacenado = null;
  const { result } = await montar();
  const pendiente = diferida<Response>();
  fetchMock.mockReturnValueOnce(pendiente.promise);
  let login!: Promise<void>;
  await act(async () => { login = result.current.iniciarSesion('00000000', '0012'); });
  await act(() => result.current.invalidarSesion());
  await act(async () => {
    pendiente.resolve(respuesta({ token: jwt(), tokenType: 'Bearer', expiresIn: 3600 }));
    await login;
  });
  expect(result.current.status).toBe('no_autenticado');
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('invalidar durante lectura de SecureStore ignora el token tardio', async () => {
  const lectura = diferida<string | null>();
  jest.mocked(SecureStore.getItemAsync).mockReturnValueOnce(lectura.promise);
  const { result } = await montar();
  await act(() => result.current.invalidarSesion());
  await act(async () => { lectura.resolve(jwt()); });
  expect(result.current.status).toBe('no_autenticado');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('invalidar durante escritura del JWT espera y borra tambien esa escritura', async () => {
  almacenado = null;
  const { result } = await montar();
  const escritura = diferida<void>();
  jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(async (_key, token) => {
    await escritura.promise;
    almacenado = token;
  });
  fetchMock.mockResolvedValueOnce(respuesta({ token: jwt(), tokenType: 'Bearer', expiresIn: 3600 }));
  let login!: Promise<void>;
  let invalidacion!: Promise<void>;
  await act(async () => { login = result.current.iniciarSesion('00000000', '0012'); });
  expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  await act(async () => { invalidacion = result.current.invalidarSesion(); });
  expect(result.current.status).toBe('no_autenticado');
  await act(async () => {
    escritura.resolve();
    await Promise.all([login, invalidacion]);
  });
  expect(almacenado).toBeNull();
  expect(result.current.status).toBe('no_autenticado');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('el perfil tardio del conductor anterior no reemplaza el nuevo ni repuebla su cache', async () => {
  const anterior = diferida<Response>();
  fetchMock.mockReturnValueOnce(anterior.promise);
  const { result } = await montar();
  const signalAnterior = fetchMock.mock.calls[0][1]?.signal;
  const token = jwt({ conductorId: 'conductor-b', exp: 4102444800 });
  fetchMock.mockResolvedValueOnce(respuesta({ token, tokenType: 'Bearer', expiresIn: 3600 }));
  fetchMock.mockResolvedValueOnce(respuesta(perfil('conductor-b')));
  await act(() => result.current.iniciarSesion('00000000', '0012'));
  expect(signalAnterior?.aborted).toBe(true);
  await act(async () => { anterior.resolve(respuesta(perfil())); });
  expect(result.current.status).toBe('autenticado');
  expect(result.current.conductor?.id).toBe('conductor-b');
  expect(almacenado).toBe(token);
  expect(client.getQueryData(queryKeys.conductor('conductor-a'))).toBeUndefined();
});

it('un listener que falla no impide borrar token ni notificar a los demas', async () => {
  fetchMock.mockResolvedValueOnce(respuesta(perfil()));
  const { result } = await montar();
  const quitarFallido = registrarAlInvalidar(() => { throw new Error('recurso externo'); });
  const listener = jest.fn();
  const quitarListener = registrarAlInvalidar(listener);
  try {
    await act(() => result.current.invalidarSesion());
    expect(listener).toHaveBeenCalledTimes(1);
    expect(almacenado).toBeNull();
    expect(result.current.status).toBe('no_autenticado');
  } finally {
    quitarFallido();
    quitarListener();
  }
});

it('actualizarPerfil fuerza una lectura vigente y actualiza el perfil observado', async () => {
  fetchMock.mockResolvedValueOnce(respuesta(perfil()));
  const { result } = await montar();
  expect(result.current.status).toBe('autenticado');
  const token = almacenado;
  fetchMock.mockResolvedValueOnce(respuesta({ ...perfil(), estado: 'suspendido' }));
  await act(() => result.current.actualizarPerfil());
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toBe('https://api.example.test/api/conductores/conductor-a');
  expect(fetchMock.mock.calls[1][1]?.headers).toEqual(
    expect.objectContaining({ Authorization: `Bearer ${token}` })
  );
  await waitFor(() => expect(result.current.conductor?.estado).toBe('suspendido'));
  expect(client.getQueryData(queryKeys.conductor('conductor-a'))).toMatchObject({ estado: 'suspendido' });
});

it('agrupa varias actualizaciones simultaneas en una sola peticion', async () => {
  fetchMock.mockResolvedValueOnce(respuesta(perfil()));
  const { result } = await montar();
  const pendiente = diferida<Response>();
  fetchMock.mockReturnValueOnce(pendiente.promise);
  let primero!: Promise<void>;
  let segundo!: Promise<void>;
  await act(async () => {
    primero = result.current.actualizarPerfil();
    segundo = result.current.actualizarPerfil();
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await act(async () => {
    pendiente.resolve(respuesta({ ...perfil(), estado: 'rechazado' }));
    await Promise.all([primero, segundo]);
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(result.current.conductor?.estado).toBe('rechazado'));
});

it.each<[number, SessionStatus, string]>([
  [401, 'no_autenticado', 'Tu sesi\u00f3n expir\u00f3. Ingresa nuevamente'],
  [403, 'sesion_incompatible', 'Tu sesi\u00f3n ya no es v\u00e1lida'],
  [404, 'sesion_incompatible', 'Tu sesi\u00f3n ya no es v\u00e1lida'],
])('actualizarPerfil con %s aplica la semantica de M01', async (status, esperado, mensaje) => {
  fetchMock.mockResolvedValueOnce(respuesta(perfil()));
  const { result } = await montar();
  fetchMock.mockResolvedValueOnce(respuesta({}, status));
  await act(() => result.current.actualizarPerfil());
  expect(result.current.status).toBe(esperado);
  expect(result.current.mensajeSesion).toBe(mensaje);
  expect(result.current.token).toBeNull();
  expect(result.current.conductor).toBeNull();
  expect(almacenado).toBeNull();
});

it('un fallo de red en actualizarPerfil conserva la sesion y propaga el error', async () => {
  fetchMock.mockResolvedValueOnce(respuesta(perfil()));
  const { result } = await montar();
  const token = almacenado;
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
  await act(async () => {
    await expect(result.current.actualizarPerfil()).rejects.toMatchObject({ code: 'RED' });
  });
  expect(result.current.status).toBe('autenticado');
  expect(result.current.token).toBe(token);
  expect(almacenado).toBe(token);
  expect(result.current.conductor?.id).toBe('conductor-a');
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

it('una respuesta tardia de actualizarPerfil no reemplaza el perfil tras invalidar la sesion', async () => {
  fetchMock.mockResolvedValueOnce(respuesta(perfil()));
  const { result } = await montar();
  const pendiente = diferida<Response>();
  fetchMock.mockReturnValueOnce(pendiente.promise);
  let refresco!: Promise<void>;
  await act(async () => { refresco = result.current.actualizarPerfil(); });
  await act(() => result.current.invalidarSesion());
  await act(async () => {
    pendiente.resolve(respuesta({ ...perfil(), estado: 'suspendido' }));
    await refresco;
  });
  expect(result.current.status).toBe('no_autenticado');
  expect(result.current.conductor).toBeNull();
  expect(almacenado).toBeNull();
  expect(client.getQueryData(queryKeys.conductor('conductor-a'))).toBeUndefined();
});
