import { expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

import BienvenidaScreen from '../../../app/index';

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn() }),
    router: { push: mockPush, replace: jest.fn(), back: jest.fn() },
    Link: ({ children }: { children: ReactNode }) => children,
    useLocalSearchParams: () => ({}),
    useFocusEffect: function useFocusEffect(efecto: React.EffectCallback) {
      React.useEffect(efecto, [efecto]);
    },
  };
});
jest.mock('../../../features/auth/session-context', () => ({
  useSession: () => ({ status: 'no_autenticado', conductor: null }),
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

it('la bienvenida entra al registro de conductores', async () => {
  const vista = await render(<BienvenidaScreen />);
  await fireEvent.press(vista.getByRole('button', { name: 'Quiero ser conductor' }));
  expect(mockPush).toHaveBeenCalledWith('/registro');
});

