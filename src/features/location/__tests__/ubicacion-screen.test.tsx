import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

import { abrirAjustes } from '../location-service';
import { LocationSharingProvider } from '../location-sharing-provider';
import { UbicacionScreen } from '../screens/ubicacion';
import { useCompartirUbicacion, type EstadoComparticion } from '../use-location-sharing';

jest.mock('../use-location-sharing', () => ({
  useCompartirUbicacion: jest.fn(),
}));
jest.mock('../location-service', () => ({
  abrirAjustes: jest.fn(),
}));
jest.mock('../../auth/session-context', () => ({
  useSession: () => ({ conductor: { nombreCompleto: 'Prueba Conductor' } }),
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

const useCompartirMock = useCompartirUbicacion as jest.MockedFunction<typeof useCompartirUbicacion>;
const abrirAjustesMock = abrirAjustes as jest.MockedFunction<typeof abrirAjustes>;

function compartir(overrides: Partial<EstadoComparticion> = {}): EstadoComparticion {
  return {
    estado: { lista: false, motivo: 'sin_muestra', antiguedadMs: null },
    compartiendo: false,
    permiso: 'no_solicitado',
    esValidaUltima: false,
    iniciando: false,
    error: null,
    iniciar: jest.fn(),
    detener: jest.fn(),
    reintentar: jest.fn(),
    ...overrides,
  };
}

function montar(c: EstadoComparticion) {
  useCompartirMock.mockReturnValue(c);
  return render(
    <LocationSharingProvider>
      <UbicacionScreen />
    </LocationSharingProvider>
  );
}

async function presionar(label: string) {
  await fireEvent.press(screen.getByLabelText(label));
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('UbicacionScreen · explicación antes del permiso', () => {
  it('muestra el propósito y no solicita el permiso hasta pulsar la acción', async () => {
    const c = compartir();
    await montar(c);

    expect(screen.getByText('Comparte tu ubicación.')).toBeTruthy();
    expect(
      screen.getByText('La central la necesita para conectarte con solicitudes cercanas.')
    ).toBeTruthy();
    expect(
      screen.getByText('Puedes iniciar jornada sin este permiso, pero no ponerte disponible.')
    ).toBeTruthy();

    expect(c.iniciar).not.toHaveBeenCalled();
    await presionar('Permitir ubicación');
    expect(c.iniciar).toHaveBeenCalledTimes(1);
  });
});

describe('UbicacionScreen · ubicación lista', () => {
  it('declara la ubicación lista y permite detener el envío', async () => {
    const c = compartir({
      estado: { lista: true, motivo: null, antiguedadMs: 1000 },
      compartiendo: true,
      permiso: 'concedido',
    });
    await montar(c);

    expect(screen.getByText('Ubicación lista')).toBeTruthy();
    expect(screen.getByText('Compartiendo durante tu jornada.')).toBeTruthy();

    await presionar('Detener');
    expect(c.detener).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Reintentar')).toBeNull();
  });
});

describe('UbicacionScreen · motivos', () => {
  it('permiso denegado permanente conserva abrir ajustes y reintentar', async () => {
    const c = compartir({
      estado: { lista: false, motivo: 'permiso_denegado', antiguedadMs: null },
      permiso: 'denegado_permanente',
      compartiendo: true,
    });
    await montar(c);

    expect(screen.getByText('Permiso denegado')).toBeTruthy();
    expect(
      screen.getByText(
        'El permiso está bloqueado. Ábrelo en los ajustes del sistema para volver a intentarlo.'
      )
    ).toBeTruthy();

    await presionar('Abrir ajustes');
    expect(abrirAjustesMock).toHaveBeenCalledTimes(1);

    await presionar('Reintentar');
    expect(c.reintentar).toHaveBeenCalledTimes(1);
  });

  it('GPS apagado se distingue con su propio mensaje', async () => {
    const c = compartir({
      estado: { lista: false, motivo: 'gps_apagado', antiguedadMs: null },
      permiso: 'concedido',
      compartiendo: true,
    });
    await montar(c);

    expect(screen.getByText('GPS apagado')).toBeTruthy();
    expect(screen.getByText('Activa la ubicación del teléfono para continuar.')).toBeTruthy();
  });

  it('precisión insuficiente se distingue con su propio mensaje', async () => {
    const c = compartir({
      estado: { lista: false, motivo: 'precision_insuficiente', antiguedadMs: null },
      permiso: 'concedido',
      compartiendo: true,
    });
    await montar(c);

    expect(screen.getByText('Precisión insuficiente')).toBeTruthy();
    expect(
      screen.getByText('Muévete a un lugar abierto e inténtalo de nuevo.')
    ).toBeTruthy();
  });

  it('error de red muestra el banner con reintento manual', async () => {
    const c = compartir({
      estado: { lista: false, motivo: 'error_red', antiguedadMs: null },
      compartiendo: true,
      permiso: 'concedido',
      error: 'No pudimos enviar tu ubicación. Revisa tu conexión e inténtalo de nuevo.',
    });
    await montar(c);

    expect(
      screen.getByText('No pudimos enviar tu ubicación. Revisa tu conexión e inténtalo de nuevo.')
    ).toBeTruthy();

    await presionar('Reintentar');
    expect(c.reintentar).toHaveBeenCalledTimes(1);
  });
});

describe('UbicacionScreen · desactualizada', () => {
  it('reutiliza la vista compartida y ofrece actualizar', async () => {
    const c = compartir({
      estado: { lista: false, motivo: 'desactualizada', antiguedadMs: 301_000 },
      compartiendo: true,
      permiso: 'concedido',
    });
    await montar(c);

    expect(screen.getByText('Actualiza tu ubicación.')).toBeTruthy();
    expect(
      screen.getByText(
        'Han pasado más de 5 minutos desde tu última actualización. No recibirás nuevas solicitudes hasta recuperarla.'
      )
    ).toBeTruthy();

    await presionar('Actualizar ubicación');
    expect(c.reintentar).toHaveBeenCalledTimes(1);
  });

  it('volver a mi jornada navega al inicio', async () => {
    await montar(compartir());
    await presionar('Volver a mi jornada');
    expect(router.replace).toHaveBeenCalledWith('/(operacion)/inicio');
  });
});
