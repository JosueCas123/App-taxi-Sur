import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, type ViewProps } from 'react-native';

import { runtimeConfig } from '../../../config/runtime';
import type { ConductorDetalleDto } from '../../auth/api';
import type { UseDriverEventsResult } from '../../events/use-driver-events';
import type { SolicitudDetalleDto } from '../../requests/api';
import { EnServicioScreen } from '../screens/EnServicioScreen';
import {
  useFinalizarServicio,
  type UseFinalizarServicioResult,
} from '../use-finalizar-servicio';

jest.setTimeout(15000);

const SOLICITUD_ID = '11111111-2222-3333-4444-555555555555';
const CONDUCTOR_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

type SesionMock = {
  token: string | null;
  conductorId: string | null;
  conductor: ConductorDetalleDto | null;
  invalidarSesion: () => Promise<void>;
};

let mockSesion: SesionMock;
let mockEventos: UseDriverEventsResult;

jest.mock('../../auth/session-context', () => ({
  useSession: () => mockSesion,
}));
jest.mock('../../events/driver-events-provider', () => ({
  useDriverEventsContext: () => mockEventos,
}));
jest.mock('../use-finalizar-servicio', () => ({
  useFinalizarServicio: jest.fn(),
}));
jest.mock('../../../config/runtime', () => ({
  runtimeConfig: { apiUrl: 'https://api.example.test', contactoAyuda: null },
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

const useFinalizarMock = useFinalizarServicio as jest.MockedFunction<
  typeof useFinalizarServicio
>;

jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

function conductor(parcial: Partial<ConductorDetalleDto> = {}): ConductorDetalleDto {
  return {
    id: CONDUCTOR_ID,
    usuarioId: 'usuario-1',
    telefono: '70000000',
    nombreCompleto: 'Luis Pérez',
    cedulaIdentidad: '1234567',
    estado: 'aprobado',
    estadoJornada: 'activa',
    estadoDisponibilidad: 'en_servicio',
    cierreJornadaSolicitado: false,
    creadoEn: '2026-10-01T10:00:00.000Z',
    vehiculo: null,
    ...parcial,
  };
}

function solicitud(parcial: Partial<SolicitudDetalleDto> = {}): SolicitudDetalleDto {
  return {
    id: SOLICITUD_ID,
    pasajeroId: 'pasajero-1',
    conductorAsignadoId: CONDUCTOR_ID,
    estado: 'en_servicio',
    latitudRecogida: -17.7833,
    longitudRecogida: -63.1821,
    destino: 'Centro',
    puntoRecogidaTexto: 'Plaza',
    expiraEn: null,
    aceptadaEn: '2026-10-15T12:00:00.000Z',
    finalizadaEn: null,
    creadoEn: '2026-10-15T11:59:00.000Z',
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
    servicioFinalizadoId: null,
    servicioEnVerificacionId: null,
    marcarServicioFinalizado: jest.fn(),
    limpiarServicioFinalizado: jest.fn(),
    marcarServicioEnVerificacion: jest.fn(),
    limpiarServicioEnVerificacion: jest.fn(),
    ...parcial,
  };
}

function finalizacion(
  parcial: Partial<UseFinalizarServicioResult> = {}
): UseFinalizarServicioResult {
  return {
    fase: 'en_servicio',
    finalizando: false,
    verificando: false,
    finalizar: jest.fn(),
    reintentarVerificacion: jest.fn(),
    ...parcial,
  };
}

function montar(resultado: UseFinalizarServicioResult = finalizacion()) {
  useFinalizarMock.mockReturnValue(resultado);
  return render(<EnServicioScreen />);
}

beforeEach(() => {
  jest.resetAllMocks();
  runtimeConfig.contactoAyuda = null;
  mockSesion = {
    token: 'token-1',
    conductorId: CONDUCTOR_ID,
    conductor: conductor(),
    invalidarSesion: jest.fn(async () => {}),
  };
  mockEventos = eventos();
});

describe('EnServicioScreen · datos del servicio', () => {
  it('muestra el UUID abreviado, el pasajero, la recogida y el destino', async () => {
    await montar();

    expect(screen.getByText('En servicio')).toBeTruthy();
    expect(screen.getByText('Tu servicio actual.')).toBeTruthy();
    expect(screen.getByText('Servicio 11111111.5555')).toBeTruthy();
    expect(screen.queryByText(SOLICITUD_ID)).toBeNull();
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('Plaza')).toBeTruthy();
    expect(screen.getByText('Centro')).toBeTruthy();
  });

  it('usa las coordenadas y "Destino no indicado" cuando faltan datos', async () => {
    mockEventos = eventos({
      solicitudActiva: solicitud({ puntoRecogidaTexto: null, destino: null }),
    });
    await montar();

    expect(screen.getByText('-17.7833, -63.1821')).toBeTruthy();
    expect(screen.getByText('Destino no indicado')).toBeTruthy();
  });

  it('no muestra el teléfono del pasajero ni datos de demostración', async () => {
    await montar();

    expect(screen.queryByText(/teléfono del pasajero:/i)).toBeNull();
    expect(screen.queryByText('María Vargas')).toBeNull();
    expect(screen.queryByText('Plaza de San Miguel')).toBeNull();
  });

  it('entrega el UUID completo al hook de finalización', async () => {
    await montar();

    expect(useFinalizarMock).toHaveBeenCalledWith(
      expect.objectContaining({ solicitudId: SOLICITUD_ID, conductorId: CONDUCTOR_ID })
    );
  });
});

describe('EnServicioScreen · finalización', () => {
  it('exige confirmación explícita antes de enviar la finalización', async () => {
    const resultado = finalizacion();
    await montar(resultado);

    await fireEvent.press(screen.getByLabelText('Finalizar servicio'));

    expect(resultado.finalizar).not.toHaveBeenCalled();
    expect(await screen.findByText('¿Finalizar el servicio?')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Sí, finalizar'));

    expect(resultado.finalizar).toHaveBeenCalledTimes(1);
  });

  it('deshabilita el botón mientras la finalización está en vuelo', async () => {
    await montar(finalizacion({ fase: 'finalizando', finalizando: true }));

    expect(screen.getByLabelText('Finalizar servicio')).toBeDisabled();
  });

  it('muestra la verificación en curso y oculta las acciones de finalización', async () => {
    await montar(finalizacion({ fase: 'verificando', verificando: true }));

    expect(screen.getByText('Verificando la finalización…')).toBeTruthy();
    expect(screen.queryByLabelText('Finalizar servicio')).toBeNull();
  });

  it('si el servicio sigue activo, avisa y permite reintentar la finalización', async () => {
    await montar(finalizacion({ fase: 'sigue_en_servicio' }));

    expect(screen.getByText('El servicio sigue activo')).toBeTruthy();
    expect(screen.getByLabelText('Finalizar servicio')).toBeEnabled();
  });

  it('al confirmarse el backend navega a la pantalla de éxito', async () => {
    await montar(finalizacion({ fase: 'confirmada' }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/(operacion)/servicio-finalizado')
    );
  });

  it('no ofrece "Terminar jornada después"', async () => {
    await montar();

    expect(screen.queryByText(/Terminar jornada después/i)).toBeNull();
  });
});

describe('EnServicioScreen · resultado no verificable', () => {
  it('conserva el UUID, ofrece volver a verificar y oculta finalizar', async () => {
    const resultado = finalizacion({ fase: 'no_verificable' });
    await montar(resultado);

    expect(screen.getByText('No pudimos verificar la finalización')).toBeTruthy();
    expect(screen.getByText('Servicio 11111111.5555')).toBeTruthy();
    expect(screen.queryByLabelText('Finalizar servicio')).toBeNull();

    fireEvent.press(screen.getByLabelText('Volver a verificar'));

    expect(resultado.reintentarVerificacion).toHaveBeenCalledTimes(1);
  });

  it('sin contacto configurado no muestra la ayuda telefónica', async () => {
    await montar(finalizacion({ fase: 'no_verificable' }));

    expect(screen.queryByLabelText('Llamar al centro de ayuda')).toBeNull();
  });

  it('con contacto configurado la ayuda llama al teléfono público', async () => {
    runtimeConfig.contactoAyuda = '+59170000000';
    await montar(finalizacion({ fase: 'no_verificable' }));

    fireEvent.press(screen.getByLabelText('Llamar al centro de ayuda'));

    expect(Linking.openURL).toHaveBeenCalledWith('tel:+59170000000');
  });

  it('sin solicitud activa conserva el UUID pendiente de verificación', async () => {
    mockEventos = eventos({ solicitudActiva: null, servicioEnVerificacionId: SOLICITUD_ID });
    await montar(finalizacion({ fase: 'no_verificable' }));

    expect(screen.getByText('Servicio 11111111.5555')).toBeTruthy();
    expect(screen.getByLabelText('Volver a verificar')).toBeTruthy();
  });
});

describe('EnServicioScreen · avisos de cuenta', () => {
  it('una cuenta suspendida puede finalizar el servicio con aviso', async () => {
    mockSesion.conductor = conductor({ estado: 'suspendido' });
    await montar();

    expect(screen.getByText('Cuenta suspendida')).toBeTruthy();
    expect(screen.getByLabelText('Finalizar servicio')).toBeEnabled();
  });

  it('avisa el cierre de jornada solicitado sin ofrecer acciones adicionales', async () => {
    mockSesion.conductor = conductor({ cierreJornadaSolicitado: true });
    await montar();

    expect(screen.getByText('Cierre de jornada solicitado')).toBeTruthy();
    expect(screen.queryByText(/Finalizar jornada/i)).toBeNull();
  });
});
