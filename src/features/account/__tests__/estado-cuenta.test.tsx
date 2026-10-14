import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Linking, type ViewProps } from 'react-native';

import { runtimeConfig } from '../../../config/runtime';
import type { ConductorDetalleDto } from '../../auth/api';
import { EstadoCuentaScreen } from '../screens/estado-cuenta';

const mockInvalidarSesion = jest.fn();

jest.mock('../../auth/session-context', () => ({
  useSession: () => ({ invalidarSesion: mockInvalidarSesion }),
}));
jest.mock('../../../config/runtime', () => ({
  runtimeConfig: { apiUrl: 'https://api.example.test', contactoAyuda: null },
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: jest.fn(),
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

const perfil: ConductorDetalleDto = {
  id: 'conductor-a',
  usuarioId: 'usuario-conductor-a',
  telefono: '70000000',
  nombreCompleto: 'Ana Pérez',
  cedulaIdentidad: '1234567',
  estado: 'pendiente',
  estadoJornada: 'no_iniciada',
  estadoDisponibilidad: 'no_disponible',
  cierreJornadaSolicitado: false,
  creadoEn: '2026-01-01T00:00:00.000Z',
  vehiculo: {
    id: 'vehiculo-1',
    placa: 'abc123',
    marca: 'Toyota',
    modelo: 'Corolla',
    color: 'Blanco',
    capacidadPasajeros: 4,
  },
};

jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
  runtimeConfig.contactoAyuda = null;
});

type CasoEstado = [
  estado: 'pendiente' | 'rechazado' | 'suspendido',
  titulo: string,
];

it.each<CasoEstado>([
  ['pendiente', 'Cuenta en revisión'],
  ['rechazado', 'Cuenta rechazada'],
  ['suspendido', 'Cuenta suspendida'],
])('representa el estado %s con los datos del perfil real', async (estado, titulo) => {
  await render(<EstadoCuentaScreen estado={estado} perfil={perfil} />);
  expect(screen.getByText(titulo)).toBeTruthy();
  expect(screen.getByText('Ana Pérez')).toBeTruthy();
  expect(screen.getByText('70000000')).toBeTruthy();
  expect(screen.getByText('ABC123')).toBeTruthy();
  expect(screen.getByText('pendiente')).toBeTruthy();
});

it('no ofrece autoaprobación, edición de vehículo ni finalización de servicio', async () => {
  await render(<EstadoCuentaScreen estado="rechazado" perfil={perfil} />);
  const etiquetas = ['Autoaprobar', 'Editar vehículo', 'Finalizar', 'Aprobar'].map(
    (texto) => screen.queryByText(texto) ?? screen.queryByLabelText(texto)
  );
  expect(etiquetas).toEqual([null, null, null, null]);
});

it('sin contacto de ayuda configurado no muestra el botón de ayuda', async () => {
  await render(<EstadoCuentaScreen estado="pendiente" perfil={perfil} />);
  expect(screen.queryByLabelText('Obtener ayuda sobre el estado de cuenta')).toBeNull();
});

it('con contacto de ayuda configurado el botón llama al teléfono público', async () => {
  runtimeConfig.contactoAyuda = '+59170000000';
  await render(<EstadoCuentaScreen estado="pendiente" perfil={perfil} />);
  fireEvent.press(screen.getByLabelText('Obtener ayuda sobre el estado de cuenta'));
  expect(Linking.openURL).toHaveBeenCalledWith('tel:+59170000000');
});

it('el botón Salir invalida la sesión localmente', async () => {
  await render(<EstadoCuentaScreen estado="suspendido" perfil={perfil} />);
  fireEvent.press(screen.getByLabelText('Salir de la sesión'));
  expect(mockInvalidarSesion).toHaveBeenCalledTimes(1);
});

it('la actualización en curso deshabilita los botones y no se dispara dos veces', async () => {
  const onActualizar = jest.fn(async () => {});
  await render(<EstadoCuentaScreen estado="pendiente" perfil={perfil} cargando onActualizar={onActualizar} />);
  fireEvent.press(screen.getByLabelText('Actualizar información de cuenta'));
  expect(onActualizar).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Actualizar información de cuenta')).toBeDisabled();
});
