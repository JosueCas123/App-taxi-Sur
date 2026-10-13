import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, type ReactNode } from 'react';
import { Text } from 'react-native';

import { GuardRutaAuth, GuardRutaPrivada } from '../../../navigation/guard-sesion';
import type { ConductorDetalleDto } from '../api';
import { SessionProvider, useSession } from '../session-context';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
}));
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

function envolver(children: ReactNode) {
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}

function montarPrivada() {
  return render(
    <GuardRutaPrivada>
      <Text testID="ruta-privada">privada</Text>
    </GuardRutaPrivada>,
    { wrapper: ({ children }) => envolver(children) }
  );
}

function montarAuth() {
  return render(
    <GuardRutaAuth>
      <Text testID="ruta-auth">login-form</Text>
    </GuardRutaAuth>,
    { wrapper: ({ children }) => envolver(children) }
  );
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

describe('GuardRutaPrivada ((cuenta) y (operacion))', () => {
  it('sin token espera la restauración y luego redirige a /login', async () => {
    almacenado = null;
    await montarPrivada();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('token vencido redirige a /login sin consultar el servidor', async () => {
    almacenado = jwt({ conductorId: 'conductor-a', exp: Math.floor(Date.now() / 1000) - 1 });
    await montarPrivada();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sesion_sin_verificar redirige a /sesion-sin-verificar y conserva el token', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await montarPrivada();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sesion-sin-verificar'));
    expect(almacenado).toBe(jwt());
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('perfil 403 redirige a /login y nunca muestra la ruta privada', async () => {
    fetchMock.mockResolvedValue(respuesta({}, 403));
    await montarPrivada();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByTestId('ruta-privada')).toBeNull();
  });

  it('con sesión autenticada muestra la ruta privada sin navegar fuera del grupo', async () => {
    fetchMock.mockResolvedValue(respuesta(perfil()));
    await montarPrivada();
    expect(await screen.findByTestId('ruta-privada')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('GuardRutaAuth ((auth))', () => {
  it('con sesión autenticada redirige a la ruta resuelta según estado de cuenta', async () => {
    const casos: [ConductorDetalleDto['estado'], string][] = [
      ['pendiente', '/(cuenta)/revision'],
      ['rechazado', '/(cuenta)/rechazada'],
      ['suspendido', '/(cuenta)/suspendida'],
      ['aprobado', '/(operacion)/inicio'],
    ];
    for (const [estado, ruta] of casos) {
      router.replace = jest.fn();
      almacenado = jwt();
      fetchMock.mockResolvedValue(respuesta(perfil(estado)));
      const vista = await montarAuth();
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith(ruta));
      expect(router.replace).toHaveBeenCalledTimes(1);
      await vista.unmount();
    }
  });

  it('en restaurando no navega y muestra la pantalla de espera', async () => {
    let confirmar!: (respuesta: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolver) => { confirmar = resolver; })
    );
    await montarAuth();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => { confirmar(respuesta(perfil())); });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(operacion)/inicio'));
  });

  it('en no_autenticado muestra el formulario de login sin navegar', async () => {
    almacenado = null;
    await montarAuth();
    expect(await screen.findByTestId('ruta-auth')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('tras iniciarSesion solo el guard navega', () => {
  function LoginAutomatico() {
    const { iniciarSesion, status } = useSession();
    const iniciado = useRef(false);
    useEffect(() => {
      if (status !== 'no_autenticado' || iniciado.current) return;
      iniciado.current = true;
      void iniciarSesion('00000000', '0012');
    }, [iniciarSesion, status]);
    return <Text testID="login-form">login</Text>;
  }

  function SondaEstado() {
    const { status } = useSession();
    return <Text testID="sonda-estado">{status}</Text>;
  }

  it('con un login valido navega a la ruta de cuenta (nunca directo a disponible)', async () => {
    almacenado = null;
    fetchMock.mockResolvedValueOnce(respuesta({ token: jwt(), tokenType: 'Bearer', expiresIn: 3600 }));
    fetchMock.mockResolvedValueOnce(respuesta(perfil('pendiente')));
    await render(
      <>
        <SondaEstado />
        <LoginAutomatico />
        <GuardRutaAuth>
          <Text>login</Text>
        </GuardRutaAuth>
      </>,
      { wrapper: ({ children }) => envolver(children) }
    );
    await waitFor(
      () => expect(screen.getByTestId('sonda-estado').props.children).toBe('autenticado'),
      { timeout: 3000 }
    );
    await waitFor(
      () => expect(router.replace).toHaveBeenCalledWith('/(cuenta)/revision'),
      { timeout: 3000 }
    );
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.map(([, opciones]) => opciones?.method)).toEqual(['POST', 'GET']);
    expect(router.replace).not.toHaveBeenCalledWith('/(operacion)/inicio');
  });
});
