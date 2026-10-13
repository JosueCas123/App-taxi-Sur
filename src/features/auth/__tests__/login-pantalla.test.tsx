import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { findEventHandler } from '@testing-library/react-native/dist/events/propagation';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

import LoginScreen from '../../../app/(auth)/login';
import type { ConductorDetalleDto } from '../api';
import { SessionProvider } from '../session-context';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: function useFocusEffect(efecto: () => void) {
      React.useEffect(efecto, [efecto]);
    },
  };
});
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

function montar() {
  return render(<LoginScreen />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    ),
  });
}

async function rellenar(telefono: string, pin: string) {
  await fireEvent.changeText(screen.getByLabelText('Número de teléfono'), telefono);
  await fireEvent.changeText(screen.getByLabelText('PIN'), pin);
}

function cuerpoEnviado(indice = 0): { telefono: string; pin: string } {
  const opciones = fetchMock.mock.calls[indice][1];
  return JSON.parse(String(opciones?.body)) as { telefono: string; pin: string };
}

beforeEach(() => {
  jest.resetAllMocks();
  almacenado = null;
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

it('telefono vacio muestra error local y no envia el formulario', async () => {
  await montar();
  await fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  expect(await screen.findByText('Escribe tu número de teléfono')).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('pin con menos de 4 digitos muestra error local y no envia el formulario', async () => {
  await montar();
  await rellenar('70000000', '12');
  await fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  expect(await screen.findByText('Tu PIN debe tener entre 4 y 6 dígitos')).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('credenciales incorrectas muestran el mensaje generico sin revelar si el telefono existe', async () => {
  fetchMock.mockResolvedValue(
    respuesta({ error: { code: 'UNAUTHORIZED', message: 'Credenciales invalidas' } }, 401)
  );
  await montar();
  await rellenar('70000000', '0012');
  await fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  expect(await screen.findByText('Teléfono o PIN incorrecto')).toBeTruthy();
  expect(screen.queryByText('Credenciales invalidas')).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
});

it('bloquea el doble envio: un solo POST mientras la peticion esta en curso', async () => {
  let confirmar!: (respuesta: Response) => void;
  fetchMock.mockImplementationOnce(
    () => new Promise<Response>((resolver) => { confirmar = resolver; })
  );
  await montar();
  await rellenar('70000000', '0012');
  const boton = screen.getByRole('button', { name: 'Ingresar' });
  const { handler } = findEventHandler(boton, 'press', { bubbles: true });
  expect(handler).toEqual(expect.any(Function));
  let solicitud: unknown;
  // No retornar la promesa pendiente: act debe liberar el render del estado ocupado.
  await act(() => { solicitud = handler!(); });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => {
    confirmar(respuesta({ error: { code: 'UNAUTHORIZED', message: 'Credenciales invalidas' } }, 401));
    await solicitud;
  });
  expect(await screen.findByText('Teléfono o PIN incorrecto')).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
  expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
});

it('un fallo de red en el POST muestra error de conexion, no de credenciales', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
  await montar();
  await rellenar('70000000', '0012');
  await fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  expect(await screen.findByText('No se pudo iniciar sesión. Intenta nuevamente')).toBeTruthy();
  expect(screen.queryByText('Teléfono o PIN incorrecto')).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(almacenado).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
});

it('preserva ceros iniciales del PIN y lo envia como texto', async () => {
  fetchMock.mockResolvedValueOnce(
    respuesta({ token: jwt(), tokenType: 'Bearer', expiresIn: 3600 })
  );
  fetchMock.mockResolvedValueOnce(respuesta(perfil('pendiente')));
  await montar();
  await rellenar('70000000', '0012');
  await fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(cuerpoEnviado(0)).toEqual({ telefono: '70000000', pin: '0012' });
});

it('tras un login valido la pantalla no navega: esa responsabilidad es del guard de (auth)', async () => {
  fetchMock.mockResolvedValueOnce(
    respuesta({ token: jwt(), tokenType: 'Bearer', expiresIn: 3600 })
  );
  fetchMock.mockResolvedValueOnce(respuesta(perfil('aprobado')));
  await montar();
  await rellenar('70000000', '0012');
  await fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.queryByText('Teléfono o PIN incorrecto')).toBeNull();
});

it('el conmutador mostrar/ocultar cambia la visibilidad del PIN', async () => {
  await montar();
  const campo = screen.getByLabelText('PIN');
  expect(campo.props.secureTextEntry).toBe(true);
  await fireEvent.press(screen.getByLabelText('Mostrar pin de acceso'));
  expect(screen.getByLabelText('PIN').props.secureTextEntry).toBe(false);
  await fireEvent.press(screen.getByLabelText('Ocultar pin de acceso'));
  expect(screen.getByLabelText('PIN').props.secureTextEntry).toBe(true);
});
