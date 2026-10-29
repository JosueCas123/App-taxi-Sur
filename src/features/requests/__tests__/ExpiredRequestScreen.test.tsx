import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

import type { UseDriverEventsResult } from '../../events/use-driver-events';
import type { SolicitudDetalleDto } from '../api';
import { ExpiredRequestScreen } from '../screens/ExpiredRequestScreen';

let mockEventos: UseDriverEventsResult;

jest.mock('../../events/driver-events-provider', () => ({
  useDriverEventsContext: () => mockEventos,
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
    expiraEn: '2020-01-01T00:00:00.000Z',
    aceptadaEn: null,
    finalizadaEn: null,
    creadoEn: '2026-10-15T12:00:00.000Z',
    pasajero: { id: 'pasajero-1', nombre: 'Ana Pérez' },
    conductorAsignado: null,
    distanciaAproximadaKm: null,
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
    servicioFinalizadoId: null,
    servicioEnVerificacionId: null,
    marcarServicioFinalizado: jest.fn(),
    limpiarServicioFinalizado: jest.fn(),
    marcarServicioEnVerificacion: jest.fn(),
    limpiarServicioEnVerificacion: jest.fn(),
    ...parcial,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockEventos = eventos();
});

describe('ExpiredRequestScreen', () => {
  it('muestra el estado de expiración', async () => {
    await render(<ExpiredRequestScreen />);

    expect(screen.getByText('El tiempo se terminó')).toBeTruthy();
    expect(screen.getByText('La solicitud ha expirado.')).toBeTruthy();
  });

  it('Volver a mi jornada descarta la oferta, reconcilia y va a inicio', async () => {
    await render(<ExpiredRequestScreen />);

    await fireEvent.press(screen.getByLabelText('Volver a mi jornada'));

    expect(mockEventos.descartarOfertaVencida).toHaveBeenCalledWith('solicitud-1');
    expect(mockEventos.reconciliar).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/(operacion)/inicio');
  });

  it('sin oferta activa no descarta pero reconciliación y vuelve a inicio', async () => {
    mockEventos = eventos({ solicitudActiva: null });
    await render(<ExpiredRequestScreen />);

    await fireEvent.press(screen.getByLabelText('Volver a mi jornada'));

    expect(mockEventos.descartarOfertaVencida).not.toHaveBeenCalled();
    expect(mockEventos.reconciliar).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/(operacion)/inicio');
  });
});
