import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import { AppState, Button, Text, type AppStateStatus } from 'react-native';

import type { ConductorDetalleDto } from '../../auth/api';
import { SessionProvider, useSession } from '../../auth/session-context';
import { RefrescoPerfilProvider, useRefrescoPerfil } from '../use-refresco-perfil';

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
let oyentesAppState: ((estado: AppStateStatus) => void)[];
let suscripcionesAppState: { remove: jest.Mock }[];

function jwt(payload: object = { conductorId: 'conductor-a', exp: 4102444800 }) {
  return `cabecera.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.firma`;
}

function perfil(estado: ConductorDetalleDto['estado'] = 'aprobado'): ConductorDetalleDto {
  return {
    id: 'conductor-a', usuarioId: 'usuario-conductor-a', telefono: '00000000',
    nombreCompleto: 'Prueba', cedulaIdentidad: 'prueba', estado,
    estadoJornada: 'no_iniciada', estadoDisponibilidad: 'no_disponible',
    cierreJornadaSolicitado: false, creadoEn: '2026-01-01T00:00:00.000Z', vehiculo: null,
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

function estado(testID: string) {
  return screen.getByTestId(testID).props.children;
}

async function emitirAppState(nuevo: AppStateStatus) {
  await act(async () => {
    for (const oyente of [...oyentesAppState]) oyente(nuevo);
  });
}

function presionar(testID: string) {
  return fireEvent.press(screen.getByTestId(testID));
}

function Sonda() {
  const { status, conductor } = useSession();
  const { refrescando, error, refrescar, limpiarError } = useRefrescoPerfil();
  return (
    <>
      <Text testID="estado">{status}</Text>
      <Text testID="conductor">{conductor?.estado ?? 'sin-perfil'}</Text>
      <Text testID="refrescando">{String(refrescando)}</Text>
      <Text testID="error">{error ?? 'sin-error'}</Text>
      <Button testID="boton-refrescar" title="Refrescar" onPress={() => void refrescar()} />
      <Button testID="boton-limpiar" title="Limpiar" onPress={limpiarError} />
    </>
  );
}

async function montar() {
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <RefrescoPerfilProvider>
          <Sonda />
        </RefrescoPerfilProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

async function montarAutenticado() {
  const vista = await montar();
  await waitFor(() => expect(estado('estado')).toBe('autenticado'));
  return vista;
}

beforeEach(() => {
  jest.resetAllMocks();
  almacenado = jwt();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  fetchMock = jest.fn<typeof fetch>();
  fetchMock.mockResolvedValue(respuesta(perfil()));
  globalThis.fetch = fetchMock;
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async () => almacenado);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (_key, token) => { almacenado = token; });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async () => { almacenado = null; });
  oyentesAppState = [];
  suscripcionesAppState = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_tipo, oyente) => {
    oyentesAppState.push(oyente);
    const suscripcion = { remove: jest.fn() };
    suscripcionesAppState.push(suscripcion);
    return suscripcion as never;
  });
});

afterEach(() => {
  client.clear();
  globalThis.fetch = fetchOriginal;
  jest.restoreAllMocks();
});

describe('refresco de perfil', () => {
  it('al regresar a primer plano solicita un perfil vigente y actualiza la observación', async () => {
    await montarAutenticado();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(respuesta(perfil('suspendido')));
    await emitirAppState('background');
    await emitirAppState('active');
    await waitFor(() => expect(estado('conductor')).toBe('suspendido'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('no repite la consulta mientras la app permanece en primer plano', async () => {
    await montarAutenticado();
    await emitirAppState('background');
    await emitirAppState('active');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await emitirAppState('active');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('no consulta el perfil cuando la sesión no está autenticada', async () => {
    almacenado = null;
    await montar();
    await waitFor(() => expect(estado('estado')).toBe('no_autenticado'));
    await emitirAppState('background');
    await emitirAppState('active');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('registra un único listener aunque se actualice el perfil', async () => {
    await montarAutenticado();
    await presionar('boton-refrescar');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(oyentesAppState).toHaveLength(1);
    expect(suscripcionesAppState).toHaveLength(1);
  });

  it('expone un error recuperable en la actualización manual y lo limpia', async () => {
    await montarAutenticado();
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await presionar('boton-refrescar');
    await waitFor(() => expect(estado('error')).toBe('No hay conexión con el servidor'));
    expect(estado('refrescando')).toBe('false');
    await presionar('boton-limpiar');
    expect(estado('error')).toBe('sin-error');
    fetchMock.mockResolvedValueOnce(respuesta(perfil('suspendido')));
    await presionar('boton-refrescar');
    await waitFor(() => expect(estado('conductor')).toBe('suspendido'));
    expect(estado('error')).toBe('sin-error');
  });

  it('agrupa actualizaciones simultáneas propias en una sola petición', async () => {
    await montarAutenticado();
    const pendiente = diferida<Response>();
    fetchMock.mockReturnValueOnce(pendiente.promise);
    await fireEvent.press(screen.getByTestId('boton-refrescar'));
    await fireEvent.press(screen.getByTestId('boton-refrescar'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      pendiente.resolve(respuesta(perfil('rechazado')));
    });
    await waitFor(() => expect(estado('conductor')).toBe('rechazado'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('elimina la suscripción al desmontar sin lanzar peticiones después', async () => {
    const vista = await montarAutenticado();
    await vista.unmount();
    expect(suscripcionesAppState[0].remove).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
