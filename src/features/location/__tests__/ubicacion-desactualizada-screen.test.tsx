import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

import { LocationSharingProvider } from '../location-sharing-provider';
import { UbicacionDesactualizadaScreen } from '../screens/ubicacion-desactualizada';
import { useCompartirUbicacion, type EstadoComparticion } from '../use-location-sharing';

jest.mock('../use-location-sharing', () => ({
  useCompartirUbicacion: jest.fn(),
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

function compartir(): EstadoComparticion {
  return {
    estado: { lista: false, motivo: 'desactualizada', antiguedadMs: 301_000 },
    compartiendo: true,
    permiso: 'concedido',
    esValidaUltima: true,
    iniciando: false,
    error: null,
    iniciar: jest.fn(),
    detener: jest.fn(),
    reintentar: jest.fn(),
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('UbicacionDesactualizadaScreen', () => {
  it('reutiliza la vista desactualizada compartida y actualiza con reintentar', async () => {
    const c = compartir();
    useCompartirMock.mockReturnValue(c);

    await render(
      <LocationSharingProvider>
        <UbicacionDesactualizadaScreen />
      </LocationSharingProvider>
    );

    expect(screen.getByText('Ubicación sin actualizar')).toBeTruthy();
    expect(screen.getByText('Actualiza tu ubicación.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Actualizar ubicación'));
    expect(c.reintentar).toHaveBeenCalledTimes(1);
  });

  it('permite volver a mi jornada', async () => {
    useCompartirMock.mockReturnValue(compartir());

    await render(
      <LocationSharingProvider>
        <UbicacionDesactualizadaScreen />
      </LocationSharingProvider>
    );

    fireEvent.press(screen.getByLabelText('Ir a mi jornada'));
    expect(router.replace).toHaveBeenCalledWith('/(operacion)/inicio');
  });
});
