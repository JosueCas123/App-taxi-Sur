import { beforeEach, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { findEventHandler } from '@testing-library/react-native/dist/events/propagation';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

import {
  crearApiError,
  MENSAJE_ERROR_RED,
  MENSAJE_ERROR_SERVER,
  MENSAJE_ERROR_SIN_CONFIGURACION,
} from '../../../lib/api-errors';
import { registrarConductor } from '../api';
import { RegistroScreen } from '../screens/registro';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: function useFocusEffect(efecto: React.EffectCallback) {
      React.useEffect(efecto, [efecto]);
    },
  };
});
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
jest.mock('../api', () => ({
  registrarConductor: jest.fn(),
  obtenerConductor: jest.fn(),
}));

const AVISO_TIMEOUT =
  'No pudimos confirmar si tu cuenta se creó. Puedes intentar ingresar con el teléfono y PIN que elegiste';
const AVISO_CONFLICTO =
  'No se pudo completar el registro por un conflicto con los datos enviados. Si ya tienes una cuenta, puedes intentar ingresar';

const mockRegistrar = jest.mocked(registrarConductor);

const DATOS_VALIDOS = {
  telefono: '70000000',
  nombreCompleto: 'Ana Pérez',
  cedulaIdentidad: '1234567',
  pin: '0012',
  confirmacionPin: '0012',
  placa: 'ABC123',
  marca: 'Toyota',
  modelo: 'Corolla',
  color: 'Blanco',
  capacidadPasajeros: '4',
} as const;

const CUERPO_ESPERADO = {
  telefono: '70000000',
  pin: '0012',
  nombreCompleto: 'Ana Pérez',
  cedulaIdentidad: '1234567',
  vehiculo: {
    placa: 'ABC123',
    marca: 'Toyota',
    modelo: 'Corolla',
    color: 'Blanco',
    capacidadPasajeros: 4,
  },
};

function montar() {
  return render(<RegistroScreen />);
}

async function rellenarDatosPersonales(datos: { telefono?: string; pin?: string; confirmacionPin?: string } = {}) {
  const valores = { ...DATOS_VALIDOS, ...datos };
  await fireEvent.changeText(screen.getByLabelText('Nombre completo'), valores.nombreCompleto);
  await fireEvent.changeText(screen.getByLabelText('Cédula de identidad'), valores.cedulaIdentidad);
  await fireEvent.changeText(screen.getByLabelText('Teléfono'), valores.telefono);
  await fireEvent.changeText(screen.getByLabelText('Crea un PIN'), valores.pin);
  await fireEvent.changeText(screen.getByLabelText('Confirma tu PIN'), valores.confirmacionPin);
}

async function rellenarVehiculo(datos: { capacidadPasajeros?: string } = {}) {
  const valores = { ...DATOS_VALIDOS, ...datos };
  await fireEvent.changeText(screen.getByLabelText('Placa'), valores.placa);
  await fireEvent.changeText(screen.getByLabelText('Marca'), valores.marca);
  await fireEvent.changeText(screen.getByLabelText('Modelo'), valores.modelo);
  await fireEvent.changeText(screen.getByLabelText('Color'), valores.color);
  await fireEvent.changeText(screen.getByLabelText('Pasajeros'), valores.capacidadPasajeros);
}

async function irAVehiculo() {
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar con mi vehículo' }));
}

async function rellenarCompleto(datos: { telefono?: string; pin?: string; confirmacionPin?: string; capacidadPasajeros?: string } = {}) {
  await rellenarDatosPersonales(datos);
  await irAVehiculo();
  await rellenarVehiculo(datos);
}

async function enviarFormulario() {
  await fireEvent.press(screen.getByRole('button', { name: 'Enviar registro' }));
}

async function retroceder() {
  await fireEvent.press(screen.getByRole('button', { name: 'Volver a mis datos' }));
}

beforeEach(() => {
  jest.resetAllMocks();
});

it('el paso 1 valida los datos personales y no avanza cuando faltan', async () => {
  await montar();
  await irAVehiculo();
  expect(await screen.findByText('Escribe tu nombre completo')).toBeTruthy();
  expect(screen.getByText('Escribe tu número de teléfono')).toBeTruthy();
  expect(screen.getByText('El PIN debe tener entre 4 y 6 dígitos')).toBeTruthy();
  expect(screen.queryByLabelText('Placa')).toBeNull();
  expect(mockRegistrar).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

it('el paso 2 valida el vehículo al enviar y no envia', async () => {
  await montar();
  await rellenarDatosPersonales();
  await irAVehiculo();
  await enviarFormulario();
  expect(await screen.findByText('Indica la capacidad de pasajeros')).toBeTruthy();
  expect(screen.getAllByText('Completa este dato del vehículo').length).toBe(4);
  expect(mockRegistrar).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

it('crea la cuenta con el cuerpo exacto, sin confirmacion, y vuelve al login sin sesion', async () => {
  mockRegistrar.mockResolvedValueOnce({
    id: 'conductor-nuevo',
    estado: 'pendiente',
  } as never);
  await montar();
  await rellenarCompleto({ telefono: '  70000000  ' });
  await enviarFormulario();
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  expect(mockRegistrar).toHaveBeenCalledWith(CUERPO_ESPERADO);
  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/login',
    params: { telefono: '70000000' },
  });
});

it('preserva los campos no sensibles y limpia el PIN tras un error del servidor', async () => {
  mockRegistrar.mockRejectedValueOnce(
    crearApiError({ code: 'SERVER', status: 500, message: 'boom' })
  );
  await montar();
  await rellenarCompleto();
  await enviarFormulario();
  expect(await screen.findByText(MENSAJE_ERROR_SERVER)).toBeTruthy();
  await retroceder();
  expect(screen.getByLabelText('Teléfono').props.value).toBe('70000000');
  expect(screen.getByLabelText('Nombre completo').props.value).toBe('Ana Pérez');
  expect(screen.getByLabelText('Crea un PIN').props.value).toBe('');
  expect(screen.getByLabelText('Confirma tu PIN').props.value).toBe('');
  expect(router.replace).not.toHaveBeenCalled();
});

it('un fallo de red muestra un mensaje de conexión en lugar del genérico', async () => {
  mockRegistrar.mockRejectedValueOnce(
    crearApiError({ code: 'RED', message: 'No hay conexión con el servidor' })
  );
  await montar();
  await rellenarCompleto();
  await enviarFormulario();
  expect(await screen.findByText(MENSAJE_ERROR_RED)).toBeTruthy();
  expect(screen.queryByText('No se pudo completar el registro. Intenta nuevamente')).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
});

it('una app sin URL configurada muestra su propio mensaje', async () => {
  mockRegistrar.mockRejectedValueOnce(
    crearApiError({
      code: 'SIN_CONFIGURACION',
      message: 'EXPO_PUBLIC_API_URL no está definida',
    })
  );
  await montar();
  await rellenarCompleto();
  await enviarFormulario();
  expect(await screen.findByText(MENSAJE_ERROR_SIN_CONFIGURACION)).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
});

it('un error desconocido cae en el mensaje genérico', async () => {
  mockRegistrar.mockRejectedValueOnce(
    crearApiError({ code: 'DESCONOCIDO', status: 418, message: 'teapot' })
  );
  await montar();
  await rellenarCompleto();
  await enviarFormulario();
  expect(await screen.findByText('No se pudo completar el registro. Intenta nuevamente')).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
});

it('el botón volver a mis datos regresa al paso 1 conservando los datos escritos', async () => {
  await montar();
  await rellenarDatosPersonales();
  await irAVehiculo();
  expect(screen.getByLabelText('Placa')).toBeTruthy();
  await retroceder();
  expect(screen.getByLabelText('Nombre completo').props.value).toBe('Ana Pérez');
  expect(screen.getByLabelText('Teléfono').props.value).toBe('70000000');
  expect(screen.queryByLabelText('Placa')).toBeNull();
});

it.each([
  ['El telefono ya esta registrado'],
  ['La placa ya esta registrada'],
  ['conflicto generico'],
])('un HTTP 409 (%s) muestra un aviso general sin atribuirlo a un campo', async (mensaje) => {
  mockRegistrar.mockRejectedValueOnce(
    crearApiError({ code: 'CONFLICT', status: 409, message: mensaje })
  );
  await montar();
  await rellenarCompleto();
  await enviarFormulario();
  expect(await screen.findByText(AVISO_CONFLICTO)).toBeTruthy();
  expect(screen.queryByText(mensaje)).toBeNull();
  expect(screen.getByRole('button', { name: 'Intentar ingresar' })).toBeTruthy();
  expect(screen.queryByText('Escribe tu número de teléfono')).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
});

it('un timeout muestra el aviso de resultado incierto y no navega por si solo', async () => {
  mockRegistrar.mockRejectedValueOnce(
    crearApiError({ code: 'TIMEOUT', message: 'excedió el tiempo de espera' })
  );
  await montar();
  await rellenarCompleto();
  await enviarFormulario();
  expect(await screen.findByText(AVISO_TIMEOUT)).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
});

it('"Intentar ingresar" navega al login con el telefono enviado y sin PIN', async () => {
  mockRegistrar.mockRejectedValueOnce(
    crearApiError({ code: 'TIMEOUT', message: 'excedió el tiempo de espera' })
  );
  await montar();
  await rellenarCompleto({ telefono: '80000000' });
  await enviarFormulario();
  await screen.findByText(AVISO_TIMEOUT);
  await fireEvent.press(screen.getByRole('button', { name: 'Intentar ingresar' }));
  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/login',
    params: { telefono: '80000000' },
  });
});

it('un nuevo intento tras un timeout puede terminar en 409 sin autenticar', async () => {
  mockRegistrar.mockRejectedValueOnce(crearApiError({ code: 'TIMEOUT', message: 'timeout' }));
  await montar();
  await rellenarCompleto();
  await enviarFormulario();
  await screen.findByText(AVISO_TIMEOUT);

  mockRegistrar.mockRejectedValueOnce(
    crearApiError({ code: 'CONFLICT', status: 409, message: 'El telefono ya esta registrado' })
  );
  await retroceder();
  await rellenarCompleto();
  await enviarFormulario();
  expect(await screen.findByText(AVISO_CONFLICTO)).toBeTruthy();
  expect(screen.queryByText(AVISO_TIMEOUT)).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
});

it('bloquea el doble envio: un solo POST mientras la peticion esta en curso', async () => {
  let confirmar!: (valor: unknown) => void;
  mockRegistrar.mockImplementationOnce(
    () => new Promise((resolver) => { confirmar = resolver; }) as never
  );
  await montar();
  await rellenarCompleto();
  const boton = screen.getByRole('button', { name: 'Enviar registro' });
  const { handler } = findEventHandler(boton, 'press', { bubbles: true });
  let solicitud: unknown;
  await act(() => { solicitud = handler!(); });
  await waitFor(() => expect(mockRegistrar).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Enviar registro' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Enviar registro' }));
  expect(mockRegistrar).toHaveBeenCalledTimes(1);
  await act(async () => {
    confirmar({ id: 'conductor-nuevo', estado: 'pendiente' });
    await solicitud;
  });
  expect(mockRegistrar).toHaveBeenCalledTimes(1);
});

it('cada conmutador mostrar/ocultar cambia la visibilidad de su PIN', async () => {
  await montar();
  expect(screen.getByLabelText('Crea un PIN').props.secureTextEntry).toBe(true);
  expect(screen.getByLabelText('Confirma tu PIN').props.secureTextEntry).toBe(true);

  await fireEvent.press(screen.getByLabelText('Mostrar crea un pin'));
  expect(screen.getByLabelText('Crea un PIN').props.secureTextEntry).toBe(false);
  expect(screen.getByLabelText('Confirma tu PIN').props.secureTextEntry).toBe(true);

  await fireEvent.press(screen.getByLabelText('Mostrar confirma tu pin'));
  expect(screen.getByLabelText('Confirma tu PIN').props.secureTextEntry).toBe(false);

  await fireEvent.press(screen.getByLabelText('Ocultar crea un pin'));
  expect(screen.getByLabelText('Crea un PIN').props.secureTextEntry).toBe(true);
  expect(screen.getByLabelText('Confirma tu PIN').props.secureTextEntry).toBe(false);
});
