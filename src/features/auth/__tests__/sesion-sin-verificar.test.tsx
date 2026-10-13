import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

import { SesionSinVerificarScreen } from '../screens/sesion-sin-verificar';
import { SessionProvider } from '../session-context';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
  useFocusEffect: function useFocusEffect(efecto: () => void) {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(efecto, [efecto]);
  },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn() }));
jest.mock('expo-navigation-bar', () => ({ NavigationBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafeAreaProvider: ({ children }: { children?: ReactNode }) => children,
    SafeAreaView: ({ children, style, ...rest }: ViewProps) =>
      React.createElement(View, { style, ...rest }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 320, height: 640 }),
    initialWindowMetrics: null,
  };
});
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

function perfil(estado: 'pendiente' | 'aprobado' = 'pendiente') {
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

function montar() {
  return render(<SesionSinVerificarScreen />, {
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
});

it('explica la situacion y no da acceso a operacion con el perfil sin confirmar', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));
  await montar();
  expect(await screen.findByText('No pudimos confirmar tu sesión')).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalledWith('/(operacion)/inicio');
});

it('el reintento con red restablecida navega a la ruta resuelta conservando el token', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
  await montar();
  await screen.findByText('No pudimos confirmar tu sesión');
  fetchMock.mockResolvedValueOnce(respuesta(perfil('pendiente')));
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(cuenta)/revision'));
  expect(almacenado).toBe(jwt());
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

it('salir invalida la sesion, borra el token y redirige a login', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));
  await montar();
  await screen.findByText('No pudimos confirmar tu sesión');
  await fireEvent.press(screen.getByRole('button', { name: 'Salir' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  expect(almacenado).toBeNull();
});
