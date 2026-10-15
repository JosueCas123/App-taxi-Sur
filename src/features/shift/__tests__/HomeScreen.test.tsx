import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

import type { ConductorDetalleDto } from '../../auth/api';
import { SessionProvider } from '../../auth/session-context';
import { ReconciliacionOfertaProvider } from '../reconciliacion-oferta';
import { HomeScreen } from '../screens/HomeScreen';
import {
  UbicacionOperativaProvider,
  type EstadoUbicacionOperativa,
} from '../ubicacion-operativa';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../../../config/runtime', () => ({
  runtimeConfig: { apiUrl: 'https://api.example.test', contactoAyuda: null },
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: jest.fn(),
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

const fetchOriginal = globalThis.fetch;
let fetchMock: jest.MockedFunction<typeof fetch>;
let almacenado: string | null;
let client: QueryClient;

const UBICACION_LISTA: EstadoUbicacionOperativa = { lista: true, motivo: null, antiguedadMs: 1000 };
const UBICACION_M04: EstadoUbicacionOperativa = {
  lista: false,
  motivo: 'm04_pendiente',
  antiguedadMs: null,
};

function jwt(payload: object = { conductorId: 'conductor-a', exp: 4102444800 }) {
  return `cabecera.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.firma`;
}

function perfil(parcial: Partial<ConductorDetalleDto> = {}): ConductorDetalleDto {
  return {
    id: 'conductor-a',
    usuarioId: 'usuario-conductor-a',
    telefono: '00000000',
    nombreCompleto: 'Prueba',
    cedulaIdentidad: 'prueba',
    estado: 'aprobado',
    estadoJornada: 'no_iniciada',
    estadoDisponibilidad: 'no_disponible',
    cierreJornadaSolicitado: false,
    creadoEn: '2026-01-01T00:00:00.000Z',
    vehiculo: null,
    ...parcial,
  };
}

function respuesta(datos: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(datos),
  } as Response;
}

function boton(nombre: string) {
  return screen.getByLabelText(nombre);
}

function estaDeshabilitado(nombre: string): boolean {
  return Boolean(boton(nombre).props.accessibilityState?.disabled);
}

async function montar(valor?: EstadoUbicacionOperativa) {
  const vista = render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <UbicacionOperativaProvider valor={valor}>
          <ReconciliacionOfertaProvider>
            <HomeScreen />
          </ReconciliacionOfertaProvider>
        </UbicacionOperativaProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
  await waitFor(() => expect(screen.getByText('Hola, Prueba......')).toBeTruthy(), { timeout: 5000 });
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
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (_key, token) => {
    almacenado = token;
  });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async () => {
    almacenado = null;
  });
});

afterEach(() => {
  client.clear();
  globalThis.fetch = fetchOriginal;
  jest.restoreAllMocks();
});

describe('HomeScreen · cuatro conceptos separados', () => {
  it('muestra estado de cuenta, jornada, disponibilidad y GPS como bloques distintos', async () => {
    await montar();
    expect(screen.getByText('Estado de cuenta')).toBeTruthy();
    expect(screen.getByText('Jornada')).toBeTruthy();
    expect(screen.getByText('Disponibilidad')).toBeTruthy();
    expect(screen.getByText('Ubicación (GPS)')).toBeTruthy();
  });

  it('con la ubicación por defecto (m04_pendiente) bloquea disponible con motivo visible', async () => {
    await montar(UBICACION_M04);
    expect(screen.getByText('La ubicación en tiempo real estará disponible próximamente.')).toBeTruthy();
    expect(estaDeshabilitado('Ponerse disponible')).toBe(true);
  });
});

describe('HomeScreen · jornada', () => {
  it('muestra "Iniciar jornada" y refleja la respuesta activa/no_disponible al pulsar', async () => {
    await montar();
    expect(screen.getByText('Sin iniciar')).toBeTruthy();
    expect(boton('Iniciar jornada')).toBeTruthy();

    fetchMock.mockResolvedValueOnce(
      respuesta(perfil({ estadoJornada: 'activa', estadoDisponibilidad: 'no_disponible' }))
    );
    fireEvent.press(boton('Iniciar jornada'));

    await waitFor(() => expect(screen.getByText('Activa')).toBeTruthy());
    expect(screen.getByText('No disponible')).toBeTruthy();
  });

  it('con cierreJornadaSolicitado muestra el cierre pendiente y deshabilita finalizar', async () => {
    fetchMock.mockResolvedValue(
      respuesta(
        perfil({
          estadoJornada: 'activa',
          estadoDisponibilidad: 'en_servicio',
          cierreJornadaSolicitado: true,
        })
      )
    );
    await montar(UBICACION_LISTA);

    expect(screen.getByText('En servicio')).toBeTruthy();
    expect(
      screen.getByText('Cierre de jornada pendiente: se completará al terminar el servicio en curso.')
    ).toBeTruthy();
    expect(estaDeshabilitado('Finalizar jornada')).toBe(true);
  });
});

describe('HomeScreen · disponibilidad', () => {
  it('con ubicación lista, cuenta aprobada y jornada activa habilita y activa la disponibilidad', async () => {
    await montar(UBICACION_LISTA);
    expect(estaDeshabilitado('Ponerse disponible')).toBe(true);

    fetchMock.mockResolvedValueOnce(respuesta(perfil({ estadoJornada: 'activa' })));
    fireEvent.press(boton('Iniciar jornada'));
    await waitFor(() => expect(screen.getByText('Activa')).toBeTruthy());
    await waitFor(() => expect(estaDeshabilitado('Ponerse disponible')).toBe(false));

    fetchMock.mockResolvedValueOnce(
      respuesta(perfil({ estadoJornada: 'activa', estadoDisponibilidad: 'disponible' }))
    );
    fireEvent.press(boton('Ponerse disponible'));

    await waitFor(() => expect(screen.getByText('Disponible')).toBeTruthy());
    const [, opciones] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(String(opciones.body))).toEqual({ disponible: true });
  });

  it('cuando está disponible permite desactivar y refleja no_disponible', async () => {
    fetchMock.mockResolvedValue(
      respuesta(perfil({ estadoJornada: 'activa', estadoDisponibilidad: 'disponible' }))
    );
    await montar(UBICACION_LISTA);

    expect(boton('Dejar de estar disponible')).toBeTruthy();
    expect(estaDeshabilitado('Dejar de estar disponible')).toBe(false);

    fetchMock.mockResolvedValueOnce(
      respuesta(perfil({ estadoJornada: 'activa', estadoDisponibilidad: 'no_disponible' }))
    );
    fireEvent.press(boton('Dejar de estar disponible'));

    await waitFor(() => expect(screen.getByText('No disponible')).toBeTruthy());
    const [, opciones] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(String(opciones.body))).toEqual({ disponible: false });
  });

  it('con en_servicio no permite alternar disponibilidad y explica el bloqueo', async () => {
    fetchMock.mockResolvedValue(
      respuesta(perfil({ estadoJornada: 'activa', estadoDisponibilidad: 'en_servicio' }))
    );
    await montar(UBICACION_LISTA);

    expect(
      screen.getByText(
        'No puedes cambiar tu disponibilidad durante un servicio o con una solicitud pendiente.'
      )
    ).toBeTruthy();
    expect(estaDeshabilitado('Ponerse disponible')).toBe(true);
  });
});
