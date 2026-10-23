import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

import type { UseDriverEventsResult } from '../../events/use-driver-events';
import type { SolicitudDetalleDto } from '../api';
import { IncomingRequestScreen } from '../screens/IncomingRequestScreen';
import type { Vencimiento } from '../use-offer-deadline';
import type { UseResponderResult } from '../use-respond';

let mockEventos: UseDriverEventsResult;
let mockVencimiento: Vencimiento;
let mockRespuesta: UseResponderResult;
let mockToken: string | null;

jest.mock('../../auth/session-context', () => ({
  useSession: () => ({ token: mockToken }),
}));
jest.mock('../../events/driver-events-provider', () => ({
  useDriverEventsContext: () => mockEventos,
}));
jest.mock('../use-offer-deadline', () => ({
  useOfferDeadline: () => mockVencimiento,
}));
jest.mock('../use-respond', () => ({
  useResponderSolicitud: () => mockRespuesta,
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useFocusEffect: jest.fn(),
}));
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

function solicitud(parcial: Partial<SolicitudDetalleDto> = {}): SolicitudDetalleDto {
  return {
    id: 'solicitud-1',
    pasajeroId: 'pasajero-1',
    conductorAsignadoId: 'conductor-a',
    estado: 'esperando_respuesta',
    latitudRecogida: -17.7833,
    longitudRecogida: -63.1821,
    destino: 'Centro',
    puntoRecogidaTexto: 'Plaza',
    expiraEn: '2026-10-15T12:01:00.000Z',
    aceptadaEn: null,
    finalizadaEn: null,
    creadoEn: '2026-10-15T12:00:00.000Z',
    pasajero: { id: 'pasajero-1', nombre: 'Ana Pérez' },
    conductorAsignado: null,
    distanciaAproximadaKm: 1.2,
    ...parcial,
  };
}

function eventos(parcial: Partial<UseDriverEventsResult> = {}): UseDriverEventsResult {
  return {
    conexion: 'conectado',
    reconciliando: false,
    reconciliacionInicial: 'completa',
    solicitudActiva: solicitud(),
    servicioConfirmado: null,
    reconciliar: jest.fn(async () => {}),
    fechaServidorSolicitud: null,
    ofertaDescartadaId: null,
    descartarOfertaVencida: jest.fn(),
    ...parcial,
  };
}

function vencimiento(parcial: Partial<Vencimiento> = {}): Vencimiento {
  return {
    tienePlazo: true,
    restanteMs: 42000,
    restanteSegundos: 42,
    expirada: false,
    urgente: false,
    ...parcial,
  };
}

function respuesta(parcial: Partial<UseResponderResult> = {}): UseResponderResult {
  return {
    respondiendo: null,
    aceptar: jest.fn(),
    rechazar: jest.fn(),
    error: null,
    conflicto: false,
    limpiarMensajes: jest.fn(),
    ...parcial,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockToken = 'token-1';
  mockEventos = eventos();
  mockVencimiento = vencimiento();
  mockRespuesta = respuesta();
});

describe('IncomingRequestScreen · datos de la oferta', () => {
  it('muestra pasajero, recogida, destino y distancia aproximada', async () => {
    await render(<IncomingRequestScreen />);

    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('Plaza')).toBeTruthy();
    expect(screen.getByText('Centro')).toBeTruthy();
    expect(screen.getByText('1,2 km')).toBeTruthy();
  });

  it('usa las coordenadas como respaldo cuando no hay puntoRecogidaTexto', async () => {
    mockEventos = eventos({ solicitudActiva: solicitud({ puntoRecogidaTexto: null }) });
    await render(<IncomingRequestScreen />);

    expect(screen.getByText('-17.7833, -63.1821')).toBeTruthy();
  });

  it('muestra alternativas honestas cuando destino y distancia son null', async () => {
    mockEventos = eventos({
      solicitudActiva: solicitud({ destino: null, distanciaAproximadaKm: null }),
    });
    await render(<IncomingRequestScreen />);

    expect(screen.getByText('Destino no indicado')).toBeTruthy();
    expect(screen.getByText('Distancia no disponible')).toBeTruthy();
  });

  it('no muestra el teléfono del pasajero', async () => {
    await render(<IncomingRequestScreen />);

    expect(screen.queryByText(/teléfono del pasajero:/i)).toBeNull();
  });
});

describe('IncomingRequestScreen · contador', () => {
  it('muestra el tiempo restante calculado desde expiraEn', async () => {
    mockVencimiento = vencimiento({ restanteSegundos: 42, urgente: true });
    await render(<IncomingRequestScreen />);

    expect(screen.getByText('Tiempo restante para responder')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('segundos')).toBeTruthy();
  });

  it('sin plazo no muestra contador y deja las acciones activas', async () => {
    mockVencimiento = vencimiento({
      tienePlazo: false,
      restanteMs: 0,
      restanteSegundos: 0,
      expirada: false,
    });
    await render(<IncomingRequestScreen />);

    expect(screen.queryByText('Tiempo restante para responder')).toBeNull();
    expect(screen.getByLabelText('Aceptar')).toBeEnabled();
    expect(screen.getByLabelText('Rechazar')).toBeEnabled();
  });
});

describe('IncomingRequestScreen · respuesta', () => {
  it('Aceptar y Rechazar disparan sus acciones', async () => {
    await render(<IncomingRequestScreen />);

    await fireEvent.press(screen.getByLabelText('Aceptar'));
    expect(mockRespuesta.aceptar).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByLabelText('Rechazar'));
    expect(mockRespuesta.rechazar).toHaveBeenCalledTimes(1);
  });

  it('bloquea ambos botones mientras hay una petición en vuelo', async () => {
    mockRespuesta = respuesta({ respondiendo: 'aceptar' });
    await render(<IncomingRequestScreen />);

    expect(screen.getByLabelText('Aceptar')).toBeDisabled();
    expect(screen.getByLabelText('Rechazar')).toBeDisabled();
  });

  it('muestra el aviso de conflicto sin tratarlo como aceptación', async () => {
    mockRespuesta = respuesta({ conflicto: true });
    await render(<IncomingRequestScreen />);

    expect(
      screen.getByText('La solicitud ya no está disponible. Actualizando tu jornada…')
    ).toBeTruthy();
  });

  it('muestra el error de respuesta', async () => {
    mockRespuesta = respuesta({ error: 'No pudimos responder la solicitud' });
    await render(<IncomingRequestScreen />);

    expect(screen.getByText('No pudimos responder la solicitud')).toBeTruthy();
  });
});

describe('IncomingRequestScreen · expiración', () => {
  it('al llegar a cero reconcilia una vez y navega a solicitud-expirada', async () => {
    mockVencimiento = vencimiento({ expirada: true, restanteMs: 0, restanteSegundos: 0 });
    await render(<IncomingRequestScreen />);

    expect(mockEventos.reconciliar).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/(operacion)/solicitud-expirada');
  });

  it('con la oferta expirada desactiva las acciones', async () => {
    mockVencimiento = vencimiento({ expirada: true, restanteMs: 0, restanteSegundos: 0 });
    await render(<IncomingRequestScreen />);

    expect(screen.getByLabelText('Aceptar')).toBeDisabled();
    expect(screen.getByLabelText('Rechazar')).toBeDisabled();
  });
});
