import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, type ReactNode } from 'react';
import { Text } from 'react-native';

import { GuardRutaAuth, GuardRutaCuenta, GuardRutaOperativa, GuardRutaPrivada } from '../../../navigation/guard-sesion';
import { rutaInicialPorEstado } from '../../../navigation/resolve-route';
import type { ConductorDetalleDto } from '../api';
import type { UseDriverEventsResult } from '../../events/use-driver-events';
import type { SolicitudDetalleDto } from '../../requests/api';
import { SessionProvider, useSession } from '../session-context';

let mockPathname = '/';
let mockEstadoEvents: UseDriverEventsResult;

function eventosPrueba(parcial: Partial<UseDriverEventsResult> = {}): UseDriverEventsResult {
  return {
    conexion: 'conectado',
    reconciliando: false,
    reconciliacionInicial: 'completa',
    solicitudActiva: null,
    servicioConfirmado: null,
    reconciliar: async () => {},
    fechaServidorSolicitud: null,
    ofertaDescartadaId: null,
    descartarOfertaVencida: () => {},
    servicioFinalizadoId: null,
    servicioEnVerificacionId: null,
    marcarServicioFinalizado: () => {},
    limpiarServicioFinalizado: () => {},
    marcarServicioEnVerificacion: () => {},
    limpiarServicioEnVerificacion: () => {},
    ...parcial,
  };
}

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
  usePathname: () => mockPathname,
}));
jest.mock('../../../features/events/driver-events-provider', () => ({
  useDriverEventsContext: () => mockEstadoEvents,
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

function solicitud(parcial: Partial<SolicitudDetalleDto> = {}): SolicitudDetalleDto {
  return {
    id: 'solicitud-1', pasajeroId: 'pasajero-1', conductorAsignadoId: 'conductor-a',
    estado: 'esperando_respuesta', latitudRecogida: -17.78, longitudRecogida: -63.18,
    destino: 'Centro', puntoRecogidaTexto: 'Plaza', expiraEn: null, aceptadaEn: null,
    finalizadaEn: null, creadoEn: '2026-10-15T12:00:00.000Z',
    pasajero: { id: 'pasajero-1', nombre: 'Ana' }, conductorAsignado: null,
    distanciaAproximadaKm: 1, ...parcial,
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
  mockPathname = '/';
  mockEstadoEvents = eventosPrueba();
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

describe('GuardRutaOperativa ((operacion))', () => {
  function SondaSesion() {
    const { status } = useSession();
    return <Text testID="sesion">{status}</Text>;
  }

  function montarOperativa() {
    return render(
      <>
        <SondaSesion />
        <GuardRutaOperativa>
          <Text testID="ruta-operativa">operacion</Text>
        </GuardRutaOperativa>
      </>,
      { wrapper: ({ children }) => envolver(children) }
    );
  }

  function estadoSesion() {
    return screen.getByTestId('sesion').props.children;
  }

  it('aprobado renderiza el contenido operativo sin navegar', async () => {
    mockPathname = '/inicio';
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each(['pendiente', 'rechazado', 'suspendido'] as const)(
    'acceso directo con %s no renderiza contenido operativo y redirige a su pantalla de cuenta',
    async (estado) => {
      fetchMock.mockResolvedValue(respuesta(perfil(estado)));
      await montarOperativa();
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith(rutaInicialPorEstado(estado)));
      expect(screen.queryByTestId('ruta-operativa')).toBeNull();
    }
  );

  it('mientras la reconciliación inicial sigue pendiente no evalúa acceso ni navega', async () => {
    mockEstadoEvents = eventosPrueba({ reconciliacionInicial: 'pendiente' });
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    await waitFor(() => expect(estadoSesion()).toBe('autenticado'));
    expect(screen.queryByTestId('ruta-operativa')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('tras una reconciliación fallida permanece en espera sin navegar', async () => {
    mockEstadoEvents = eventosPrueba({ reconciliacionInicial: 'fallida' });
    fetchMock.mockResolvedValue(respuesta(perfil('suspendido')));
    await montarOperativa();
    await waitFor(() => expect(estadoSesion()).toBe('autenticado'));
    expect(screen.queryByTestId('ruta-operativa')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('una cuenta suspendida con servicio en_servicio propio no se bloquea y va a en-servicio', async () => {
    mockPathname = '/inicio';
    mockEstadoEvents = eventosPrueba({
      solicitudActiva: solicitud({ estado: 'en_servicio' }),
      servicioConfirmado: {
        id: 'solicitud-1',
        conductorAsignadoId: 'conductor-a',
        estado: 'en_servicio',
      },
    });
    fetchMock.mockResolvedValue(respuesta(perfil('suspendido')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(operacion)/en-servicio'));
  });

  it('una oferta propia esperando_respuesta navega a solicitud-entrante', async () => {
    mockPathname = '/inicio';
    mockEstadoEvents = eventosPrueba({
      solicitudActiva: solicitud({ estado: 'esperando_respuesta' }),
    });
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/(operacion)/solicitud-entrante')
    );
  });

  it('una oferta no asignada al conductor no navega a solicitud-entrante', async () => {
    mockPathname = '/inicio';
    mockEstadoEvents = eventosPrueba({
      solicitudActiva: solicitud({
        estado: 'esperando_respuesta',
        conductorAsignadoId: 'otro-conductor',
      }),
    });
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('una oferta propia vencida navega a solicitud-expirada', async () => {
    mockPathname = '/inicio';
    mockEstadoEvents = eventosPrueba({
      solicitudActiva: solicitud({
        estado: 'esperando_respuesta',
        expiraEn: '2020-01-01T00:00:00.000Z',
      }),
    });
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/(operacion)/solicitud-expirada')
    );
  });

  it('estando ya en solicitud-expirada con la oferta vencida no revierte (no re-navega)', async () => {
    mockPathname = '/solicitud-expirada';
    mockEstadoEvents = eventosPrueba({
      solicitudActiva: solicitud({
        estado: 'esperando_respuesta',
        expiraEn: '2020-01-01T00:00:00.000Z',
      }),
    });
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('tras descartar la oferta vencida el guard permanece en inicio y no vuelve a expirada', async () => {
    mockPathname = '/solicitud-expirada';
    mockEstadoEvents = eventosPrueba({
      solicitudActiva: solicitud({
        estado: 'esperando_respuesta',
        expiraEn: '2020-01-01T00:00:00.000Z',
      }),
      ofertaDescartadaId: 'solicitud-1',
    });
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(operacion)/inicio'));
  });

  it('con la oferta descartada ya en inicio no vuelve a navegar', async () => {
    mockPathname = '/inicio';
    mockEstadoEvents = eventosPrueba({
      solicitudActiva: solicitud({
        estado: 'esperando_respuesta',
        expiraEn: '2020-01-01T00:00:00.000Z',
      }),
      ofertaDescartadaId: 'solicitud-1',
    });
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('en la ruta resuelta no vuelve a navegar', async () => {
    mockPathname = '/inicio';
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each(['/ubicacion', '/perfil'])(
    'con el neutro resuelto puede permanecer en la pestaña %s sin revertir',
    async (pathname) => {
      mockPathname = pathname;
      fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
      await montarOperativa();
      expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
      expect(router.replace).not.toHaveBeenCalled();
    }
  );

  it('una oferta propia vigente expulsa de la pestaña de ubicación hacia solicitud-entrante', async () => {
    mockPathname = '/ubicacion';
    mockEstadoEvents = eventosPrueba({
      solicitudActiva: solicitud({ estado: 'esperando_respuesta' }),
    });
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/(operacion)/solicitud-entrante')
    );
  });

  it('un éxito confirmado navega a servicio-finalizado', async () => {
    mockPathname = '/inicio';
    mockEstadoEvents = eventosPrueba({ servicioFinalizadoId: 'solicitud-1' });
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/(operacion)/servicio-finalizado')
    );
  });

  it('una verificación pendiente sin solicitud activa mantiene en-servicio a una cuenta suspendida', async () => {
    mockPathname = '/inicio';
    mockEstadoEvents = eventosPrueba({ servicioEnVerificacionId: 'solicitud-1' });
    fetchMock.mockResolvedValue(respuesta(perfil('suspendido')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(operacion)/en-servicio'));
  });

  it('una cuenta suspendida con el servicio ya finalizado conserva el éxito', async () => {
    mockPathname = '/inicio';
    mockEstadoEvents = eventosPrueba({
      solicitudActiva: solicitud({ estado: 'en_servicio' }),
      servicioConfirmado: {
        id: 'solicitud-1',
        conductorAsignadoId: 'conductor-a',
        estado: 'en_servicio',
      },
      servicioFinalizadoId: 'solicitud-1',
    });
    fetchMock.mockResolvedValue(respuesta(perfil('suspendido')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/(operacion)/servicio-finalizado')
    );
  });

  it('un servicio nuevo con otro UUID gana sobre el éxito anterior', async () => {
    mockPathname = '/inicio';
    mockEstadoEvents = eventosPrueba({
      solicitudActiva: solicitud({ id: 'solicitud-2', estado: 'en_servicio' }),
      servicioConfirmado: {
        id: 'solicitud-2',
        conductorAsignadoId: 'conductor-a',
        estado: 'en_servicio',
      },
      servicioFinalizadoId: 'solicitud-1',
    });
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(operacion)/en-servicio'));
  });

  it('una oferta nueva gana sobre el éxito anterior', async () => {
    mockPathname = '/inicio';
    mockEstadoEvents = eventosPrueba({
      solicitudActiva: solicitud({ id: 'solicitud-2' }),
      servicioFinalizadoId: 'solicitud-1',
    });
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/(operacion)/solicitud-entrante')
    );
  });

  it('estando ya en servicio-finalizado con el mismo éxito no vuelve a navegar', async () => {
    mockPathname = '/servicio-finalizado';
    mockEstadoEvents = eventosPrueba({ servicioFinalizadoId: 'solicitud-1' });
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarOperativa();
    expect(await screen.findByTestId('ruta-operativa')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('sin sesión no renderiza contenido operativo y el guard de sesión redirige', async () => {
    almacenado = null;
    await render(
      <GuardRutaPrivada>
        <GuardRutaOperativa>
          <Text testID="ruta-operativa">operacion</Text>
        </GuardRutaOperativa>
      </GuardRutaPrivada>,
      { wrapper: ({ children }) => envolver(children) }
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByTestId('ruta-operativa')).toBeNull();
  });
});

describe('GuardRutaCuenta ((cuenta))', () => {
  function montarCuenta() {
    return render(
      <GuardRutaCuenta>
        <Text testID="ruta-cuenta">cuenta</Text>
      </GuardRutaCuenta>,
      { wrapper: ({ children }) => envolver(children) }
    );
  }

  type CasoCuenta = [
    estado: 'pendiente' | 'rechazado' | 'suspendido',
    pathname: '/revision' | '/rechazada' | '/suspendida',
  ];

  it.each<CasoCuenta>([
    ['pendiente', '/revision'],
    ['rechazado', '/rechazada'],
    ['suspendido', '/suspendida'],
  ])('con el perfil %s en su pantalla correspondiente renderiza sin navegar', async (estado, pathname) => {
    mockPathname = pathname;
    fetchMock.mockResolvedValue(respuesta(perfil(estado)));
    await montarCuenta();
    expect(await screen.findByTestId('ruta-cuenta')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('un acceso directo a otra pantalla de cuenta redirige a la que corresponde al perfil real', async () => {
    mockPathname = '/rechazada';
    fetchMock.mockResolvedValue(respuesta(perfil('pendiente')));
    await montarCuenta();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(cuenta)/revision'));
    expect(screen.queryByTestId('ruta-cuenta')).toBeNull();
  });

  it('una cuenta aprobado redirige al inicio y no renderiza la pantalla de cuenta', async () => {
    mockPathname = '/revision';
    fetchMock.mockResolvedValue(respuesta(perfil('aprobado')));
    await montarCuenta();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(operacion)/inicio'));
    expect(screen.queryByTestId('ruta-cuenta')).toBeNull();
  });

  it('un cambio de estado del perfil observado redirige a la nueva pantalla de cuenta', async () => {
    mockPathname = '/revision';
    fetchMock.mockResolvedValueOnce(respuesta(perfil('pendiente')));
    await montarCuenta();
    expect(await screen.findByTestId('ruta-cuenta')).toBeTruthy();

    // El refresco de perfil actualiza la misma caché que observa la sesión.
    client.setQueryData(['conductor', 'conductor-a'], {
      ...perfil('pendiente'),
      estado: 'suspendido',
    });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(cuenta)/suspendida'));
    expect(screen.queryByTestId('ruta-cuenta')).toBeNull();
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
