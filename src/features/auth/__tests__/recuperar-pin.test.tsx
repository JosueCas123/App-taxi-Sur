import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Linking, type ViewProps } from 'react-native';
import type { ReactNode } from 'react';

import RecuperarPinScreen from '../../../app/(auth)/recuperar-pin';
import { runtimeConfig } from '../../../config/runtime';
import { SessionProvider } from '../session-context';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: function useFocusEffect(efecto: () => void) {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(efecto, [efecto]);
  },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
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
jest.mock('../../../config/runtime', () => ({
  runtimeConfig: { apiUrl: 'https://api.example.test', contactoAyuda: null },
}));

const fetchOriginal = globalThis.fetch;
let client: QueryClient;

function montar() {
  return render(<RecuperarPinScreen />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  globalThis.fetch = jest.fn<typeof fetch>();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  runtimeConfig.contactoAyuda = null;
});

afterEach(() => {
  client.clear();
  globalThis.fetch = fetchOriginal;
  runtimeConfig.contactoAyuda = null;
});

it('sin contacto configurado no muestra boton de llamada ni inventa un numero', async () => {
  await montar();
  expect(await screen.findByText(/El administrador de TaxiSur puede restablecer tu PIN/)).toBeTruthy();
  expect(screen.queryByLabelText('Llamar a administración')).toBeNull();
  expect(screen.queryByText(/tel:/)).toBeNull();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it('con contacto configurado el boton de ayuda abre Linking tel: sin llamar a la API', async () => {
  runtimeConfig.contactoAyuda = '+59170000000';
  await montar();
  await fireEvent.press(await screen.findByLabelText('Llamar a administración'));
  expect(Linking.openURL).toHaveBeenCalledWith('tel:+59170000000');
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it('volver al login usa router.back sin llamadas de red', async () => {
  await montar();
  await fireEvent.press(await screen.findByLabelText('Volver al inicio de sesión'));
  expect(router.back).toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
