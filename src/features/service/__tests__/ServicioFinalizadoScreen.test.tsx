import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

import type { ConductorDetalleDto } from '../../auth/api';
import type { UseDriverEventsResult } from '../../events/use-driver-events';
import { ServicioFinalizadoScreen } from '../screens/ServicioFinalizadoScreen';

jest.setTimeout(15000);

const SOLICITUD_ID = '11111111-2222-3333-4444-555555555555';
const CONDUCTOR_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

type SesionMock = {
  conductor: ConductorDetalleDto | null;
};

let mockSesion: SesionMock;
let mockEventos: UseDriverEventsResult;

jest.mock('../../auth/session-context', () => ({
  useSession: () => mockSesion,
}));
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

function conductor(parcial: Partial<ConductorDetalleDto> = {}): ConductorDetalleDto {
  return {
    id: CONDUCTOR_ID,
    usuarioId: 'usuario-1',
    telefono: '70000000',
    nombreCompleto: 'Luis Pérez',
    cedulaIdentidad: '1234567',
    estado: 'aprobado',
    estadoJornada: 'activa',
    estadoDisponibilidad: 'disponible',
    cierreJornadaSolicitado: false,
    creadoEn: '2026-10-01T10:00:00.000Z',
    vehiculo: null,
    ...parcial,
  };
}

function eventos(parcial: Partial<UseDriverEventsResult> = {}): UseDriverEventsResult {
  return {
    conexion: 'conectado',
    reconciliando: false,
    reconciliacionInicial: 'completa',
    solicitudActiva: null,
    servicioConfirmado: null,
    reconciliar: jest.fn(async () => {}),
    fechaServidorSolicitud: null,
    ofertaDescartadaId: null,
    descartarOfertaVencida: jest.fn(),
    servicioFinalizadoId: SOLICITUD_ID,
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
  mockSesion = { conductor: conductor() };
  mockEventos = eventos();
});

describe('ServicioFinalizadoScreen · confirmación', () => {
  it('muestra el éxito confirmado con el UUID abreviado', async () => {
    await render(<ServicioFinalizadoScreen />);

    expect(screen.getByText('Servicio finalizado')).toBeTruthy();
    expect(screen.getByText(/Buen recorrido/)).toBeTruthy();
    expect(screen.getByText('La finalización del servicio quedó confirmada.')).toBeTruthy();
    expect(screen.getByText('11111111.5555')).toBeTruthy();
    expect(screen.queryByText(SOLICITUD_ID)).toBeNull();
  });

  it('refleja el cierre diferido de la jornada', async () => {
    mockSesion.conductor = conductor({
      estadoJornada: 'finalizada',
      estadoDisponibilidad: 'no_disponible',
      cierreJornadaSolicitado: false,
    });
    await render(<ServicioFinalizadoScreen />);

    expect(
      screen.getByText('Tu jornada quedó finalizada. No estás disponible para nuevos servicios.')
    ).toBeTruthy();
  });

  it('refleja la disponibilidad cuando la jornada sigue activa', async () => {
    await render(<ServicioFinalizadoScreen />);

    expect(screen.getByText('Estás disponible para un nuevo servicio.')).toBeTruthy();
  });

  it('no ofrece "Terminar jornada después"', async () => {
    await render(<ServicioFinalizadoScreen />);

    expect(screen.queryByText(/Terminar jornada después/i)).toBeNull();
  });
});

describe('ServicioFinalizadoScreen · volver a la jornada', () => {
  it('reconcilia antes de limpiar el éxito y navegar al inicio', async () => {
    const reconciliar = jest.fn(async () => {});
    const limpiarServicioFinalizado = jest.fn();
    mockEventos = eventos({ reconciliar, limpiarServicioFinalizado });
    await render(<ServicioFinalizadoScreen />);

    await userEvent.press(screen.getByLabelText('Volver a mi jornada'));

    await waitFor(() => expect(limpiarServicioFinalizado).toHaveBeenCalledTimes(1));
    expect(reconciliar).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/(operacion)/inicio');
    expect(reconciliar.mock.invocationCallOrder[0]).toBeLessThan(
      limpiarServicioFinalizado.mock.invocationCallOrder[0]
    );
  });

  it('si la reconciliación falla conserva el éxito, el flag y no navega', async () => {
    const reconciliar = jest.fn(async () => {
      throw new Error('sin red');
    });
    const limpiarServicioFinalizado = jest.fn();
    mockEventos = eventos({ reconciliar, limpiarServicioFinalizado });
    await render(<ServicioFinalizadoScreen />);

    await userEvent.press(screen.getByLabelText('Volver a mi jornada'));

    await waitFor(() =>
      expect(
        screen.getByText('No pudimos actualizar tu jornada. Reintenta para continuar.')
      ).toBeTruthy()
    );
    expect(limpiarServicioFinalizado).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText('La finalización del servicio quedó confirmada.')).toBeTruthy();
    expect(screen.getByLabelText('Volver a mi jornada')).toBeEnabled();
  });

  it('no ejecuta dos reconciliaciones si se pulsa mientras está en vuelo', async () => {
    let resolver: () => void = () => {};
    const reconciliar = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolver = resolve;
        })
    );
    mockEventos = eventos({ reconciliar });
    await render(<ServicioFinalizadoScreen />);

    await userEvent.press(screen.getByLabelText('Volver a mi jornada'));
    await userEvent.press(screen.getByLabelText('Volver a mi jornada'));

    expect(reconciliar).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolver();
    });
  });
});
