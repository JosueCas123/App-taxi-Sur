import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import { BottomNav } from '../BottomNav';

let mockPathname = '/inicio';
const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  router: { navigate: (href: unknown) => mockNavigate(href) },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/inicio';
});

describe('BottomNav', () => {
  it('marca como seleccionada la pestaña activa según el pathname', async () => {
    mockPathname = '/ubicacion';
    const { getByLabelText } = await render(<BottomNav />);
    expect(getByLabelText('Ubicación').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('Mi jornada').props.accessibilityState.selected).toBe(false);
  });

  it('al pulsar otra pestaña navega con router.navigate', async () => {
    mockPathname = '/inicio';
    const { getByLabelText } = await render(<BottomNav />);
    await fireEvent.press(getByLabelText('Mi cuenta'));
    expect(mockNavigate).toHaveBeenCalledWith('/(operacion)/perfil');
  });

  it('no navega al pulsar la pestaña ya activa', async () => {
    mockPathname = '/inicio';
    const { getByLabelText } = await render(<BottomNav />);
    await fireEvent.press(getByLabelText('Mi jornada'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
