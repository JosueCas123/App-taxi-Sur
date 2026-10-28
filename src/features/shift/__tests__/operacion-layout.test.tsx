import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import OperacionLayout from '../../../app/(operacion)/_layout';

jest.mock('../../../navigation/guard-sesion', () => ({
  GuardRutaPrivada: ({ children }: { children: ReactNode }) => children,
  GuardRutaOperativa: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('../../../features/auth/session-context', () => ({
  useSession: () => ({
    status: 'no_autenticado',
    token: null,
    conductorId: null,
    conductor: null,
    mensajeSesion: null,
  }),
  registrarAlInvalidar: () => () => {},
}));

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const { useUbicacionOperativa } =
    jest.requireActual<typeof import('../ubicacion-operativa')>('../ubicacion-operativa');
  const { useReconciliacionOferta } =
    jest.requireActual<typeof import('../reconciliacion-oferta')>('../reconciliacion-oferta');

  function Sonda() {
    const ubicacion = useUbicacionOperativa();
    const reconciliar = useReconciliacionOferta();
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(Text, { testID: 'lista' }, String(ubicacion.lista)),
      React.createElement(Text, { testID: 'motivo' }, ubicacion.motivo ?? 'sin-motivo'),
      React.createElement(Text, { testID: 'reconciliador' }, typeof reconciliar)
    );
  }

  return { Stack: () => React.createElement(Sonda) };
});

function renderLayout() {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={cliente}>
      <OperacionLayout />
    </QueryClientProvider>
  );
}

describe('OperacionLayout · costuras M04/M05', () => {
  it('inyecta el estado real de M04 (sin_muestra) en el ámbito operativo', async () => {
    const vista = await renderLayout();
    expect(vista.getByTestId('lista').props.children).toBe('false');
    expect(vista.getByTestId('motivo').props.children).toBe('sin_muestra');
  });

  it('monta el reconciliador real de M05 (reconciliar) en el ámbito operativo', async () => {
    const vista = await renderLayout();
    expect(vista.getByTestId('reconciliador').props.children).toBe('function');
  });
});
