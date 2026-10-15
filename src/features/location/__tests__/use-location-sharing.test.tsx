import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { AppState, Button, Text } from 'react-native';

import type { ConductorDetalleDto } from '../../auth/api';
import { useSession } from '../../auth/session-context';
import { UBICACION_VIGENCIA_MS } from '../../shift/jornada-policy';
import { enviarUbicacion, type UbicacionDto } from '../api';
import { useCompartirUbicacion } from '../use-location-sharing';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

jest.mock('../../auth/session-context', () => ({
  useSession: jest.fn(),
}));

jest.mock('../api', () => ({
  enviarUbicacion: jest.fn(),
}));

const useSessionMock = useSession as unknown as jest.Mock;
const requestPerm = Location.requestForegroundPermissionsAsync as jest.MockedFunction<
  typeof Location.requestForegroundPermissionsAsync
>;
const getPerm = Location.getForegroundPermissionsAsync as jest.MockedFunction<
  typeof Location.getForegroundPermissionsAsync
>;
const hasServices = Location.hasServicesEnabledAsync as jest.MockedFunction<
  typeof Location.hasServicesEnabledAsync
>;
const getPos = Location.getCurrentPositionAsync as jest.MockedFunction<
  typeof Location.getCurrentPositionAsync
>;
const watch = Location.watchPositionAsync as jest.MockedFunction<
  typeof Location.watchPositionAsync
>;
const enviarMock = enviarUbicacion as jest.MockedFunction<typeof enviarUbicacion>;

type Sesion = {
  token: string | null;
  conductorId: string | null;
  conductor: ConductorDetalleDto | null;
};

let sesionActual: Sesion;
let appStateListener: ((estado: string) => void) | null;
let watchCallback: ((posicion: Location.LocationObject) => void) | null;
const watchRemove = jest.fn();

function permiso(status: string, granted: boolean, canAskAgain: boolean) {
  return { status, granted, canAskAgain, expires: 'never' } as unknown as Location.PermissionResponse;
}

function posicion(accuracy: number | null = 10): Location.LocationObject {
  return {
    timestamp: 111,
    coords: {
      latitude: -17.7,
      longitude: -63.1,
      altitude: null,
      accuracy,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
  } as unknown as Location.LocationObject;
}

function dto(parcial: Partial<UbicacionDto> = {}): UbicacionDto {
  return {
    id: '1',
    latitud: -17.7,
    longitud: -63.1,
    horaRegistro: '2000-01-01T00:00:00.000Z',
    esValida: true,
    ...parcial,
  };
}

function perfil(parcial: Partial<ConductorDetalleDto> = {}): ConductorDetalleDto {
  return {
    id: 'conductor-a',
    usuarioId: 'usuario-conductor-a',
    telefono: '00000000',
    nombreCompleto: 'Prueba',
    cedulaIdentidad: 'prueba',
    estado: 'aprobado',
    estadoJornada: 'activa',
    estadoDisponibilidad: 'no_disponible',
    cierreJornadaSolicitado: false,
    creadoEn: '2026-01-01T00:00:00.000Z',
    vehiculo: null,
    ...parcial,
  };
}

function diferida<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function estado(testID: string) {
  return screen.getByTestId(testID).props.children;
}

function montar() {
  return render(<Sonda />);
}

async function flush() {
  await act(async () => {});
}

async function iniciar() {
  await fireEvent.press(screen.getByTestId('iniciar'));
  await flush();
}

async function entrarSegundoPlano() {
  await act(async () => {
    appStateListener?.('background');
  });
}

async function volverActivo() {
  await act(async () => {
    appStateListener?.('active');
  });
  await flush();
}

function Sonda() {
  const c = useCompartirUbicacion();
  return (
    <>
      <Text testID="lista">{String(c.estado.lista)}</Text>
      <Text testID="motivo">{c.estado.motivo ?? 'sin-motivo'}</Text>
      <Text testID="antiguedad">{String(c.estado.antiguedadMs)}</Text>
      <Text testID="compartiendo">{String(c.compartiendo)}</Text>
      <Text testID="permiso">{c.permiso}</Text>
      <Text testID="esvalida">{String(c.esValidaUltima)}</Text>
      <Text testID="iniciando">{String(c.iniciando)}</Text>
      <Text testID="error">{c.error ?? 'sin-error'}</Text>
      <Button testID="iniciar" title="Iniciar" onPress={c.iniciar} />
      <Button testID="detener" title="Detener" onPress={c.detener} />
      <Button testID="reintentar" title="Reintentar" onPress={c.reintentar} />
    </>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  appStateListener = null;
  watchCallback = null;
  sesionActual = {
    token: 'token-1',
    conductorId: 'conductor-a',
    conductor: perfil({ estadoJornada: 'activa' }),
  };
  useSessionMock.mockImplementation(() => sesionActual);
  requestPerm.mockResolvedValue(permiso('granted', true, true));
  getPerm.mockResolvedValue(permiso('granted', true, true));
  hasServices.mockResolvedValue(true);
  getPos.mockResolvedValue(posicion(10));
  enviarMock.mockResolvedValue(dto());
  watch.mockImplementation(async (_opciones, callback) => {
    watchCallback = callback as (posicion: Location.LocationObject) => void;
    return { remove: watchRemove };
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_tipo, manejador) => {
    appStateListener = manejador as (estado: string) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('useCompartirUbicacion · arranque y envío', () => {
  it('arranca el ciclo, envía la muestra y queda lista con esValida:true', async () => {
    await montar();
    await iniciar();

    await waitFor(() => expect(estado('lista')).toBe('true'));
    expect(estado('compartiendo')).toBe('true');
    expect(estado('permiso')).toBe('concedido');
    expect(estado('esvalida')).toBe('true');
    expect(estado('motivo')).toBe('sin-motivo');

    expect(enviarMock).toHaveBeenCalledTimes(1);
    expect(enviarMock).toHaveBeenCalledWith('conductor-a', 'token-1', {
      latitud: -17.7,
      longitud: -63.1,
    });
    expect(watch).toHaveBeenCalledWith(
      expect.objectContaining({ accuracy: 4, timeInterval: 30_000 }),
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('la antigüedad es inmune al valor absoluto de horaRegistro (reloj monotónico)', async () => {
    enviarMock.mockResolvedValue(dto({ horaRegistro: '2000-01-01T00:00:00.000Z' }));
    await montar();
    await iniciar();

    await waitFor(() => expect(estado('lista')).toBe('true'));
    expect(Number(estado('antiguedad'))).toBeLessThan(60_000);
  });

  it('un 201 con esValida:false no declara GPS listo', async () => {
    enviarMock.mockResolvedValue(dto({ esValida: false }));
    await montar();
    await iniciar();

    await waitFor(() => expect(estado('esvalida')).toBe('false'));
    expect(estado('lista')).toBe('false');
    expect(estado('motivo')).toBe('sin_muestra');
  });

  it('una horaRegistro no interpretable no habilita disponibilidad', async () => {
    enviarMock.mockResolvedValue(dto({ horaRegistro: 'no-es-fecha' }));
    await montar();
    await iniciar();

    await waitFor(() => expect(estado('permiso')).toBe('concedido'));
    expect(estado('lista')).toBe('false');
    expect(estado('motivo')).toBe('sin_muestra');
  });
});

describe('useCompartirUbicacion · motivos y precedencia', () => {
  it('permiso denegado se distingue y no envía', async () => {
    requestPerm.mockResolvedValue(permiso('denied', false, true));
    await montar();
    await iniciar();

    await waitFor(() => expect(estado('motivo')).toBe('permiso_denegado'));
    expect(estado('permiso')).toBe('denegado');
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it('GPS apagado se distingue cuando el permiso está concedido', async () => {
    hasServices.mockResolvedValue(false);
    await montar();
    await iniciar();

    await waitFor(() => expect(estado('motivo')).toBe('gps_apagado'));
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it('precisión insuficiente no envía ni declara listo', async () => {
    getPos.mockResolvedValue(posicion(120));
    await montar();
    await iniciar();

    await waitFor(() => expect(estado('motivo')).toBe('precision_insuficiente'));
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it('error de red sin muestra fresca se muestra como error_red', async () => {
    enviarMock.mockRejectedValue({ code: 'RED', message: 'sin conexión' });
    await montar();
    await iniciar();

    await waitFor(() => expect(estado('motivo')).toBe('error_red'));
    expect(estado('error')).toBe(
      'No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo'
    );
  });

  it('un error de red con muestra fresca no revoca la disponibilidad ni muestra error_red', async () => {
    await montar();
    await iniciar();
    await waitFor(() => expect(estado('lista')).toBe('true'));

    enviarMock.mockRejectedValue({ code: 'RED', message: 'sin conexión' });
    await act(async () => {
      watchCallback?.(posicion(10));
    });

    expect(estado('lista')).toBe('true');
    expect(estado('motivo')).toBe('sin-motivo');
    expect(estado('error')).not.toBe('sin-error');
  });

  it('un permiso denegado tiene prioridad sobre GPS apagado', async () => {
    requestPerm.mockResolvedValue(permiso('denied', false, true));
    hasServices.mockResolvedValue(false);
    await montar();
    await iniciar();

    await waitFor(() => expect(estado('motivo')).toBe('permiso_denegado'));
  });
});

describe('useCompartirUbicacion · frescura y segundo plano', () => {
  it('al cumplir 5 minutos sin nueva muestra pasa a desactualizada', async () => {
    jest.useFakeTimers();
    await montar();
    await iniciar();

    await waitFor(() => expect(estado('lista')).toBe('true'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(UBICACION_VIGENCIA_MS - 1000);
    });
    expect(estado('lista')).toBe('true');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(estado('lista')).toBe('false');
    expect(estado('motivo')).toBe('desactualizada');
  });

  it('al pasar a segundo plano descarta el ancla; al volver exige una muestra nueva', async () => {
    await montar();
    await iniciar();
    await waitFor(() => expect(estado('lista')).toBe('true'));

    await entrarSegundoPlano();
    expect(estado('lista')).toBe('false');
    expect(estado('motivo')).toBe('sin_muestra');
    expect(watchRemove).toHaveBeenCalled();

    getPerm.mockClear();
    getPos.mockClear();
    watch.mockClear();

    await volverActivo();

    await waitFor(() => expect(estado('lista')).toBe('true'));
    expect(getPerm).toHaveBeenCalledTimes(1);
    expect(getPos).toHaveBeenCalledTimes(1);
    expect(watch).toHaveBeenCalledTimes(1);
  });
});

describe('useCompartirUbicacion · concurrencia y limpieza', () => {
  it('no solapa envíos: una sola petición en vuelo', async () => {
    const pendiente = diferida<UbicacionDto>();
    enviarMock.mockImplementation(() => pendiente.promise);
    await montar();
    await iniciar();

    expect(enviarMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      watchCallback?.(posicion(10));
    });
    expect(enviarMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendiente.resolve(dto());
    });
    await waitFor(() => expect(estado('lista')).toBe('true'));
  });

  it('detener limpia la suscripción y el estado', async () => {
    await montar();
    await iniciar();
    await waitFor(() => expect(estado('lista')).toBe('true'));

    await fireEvent.press(screen.getByTestId('detener'));
    await flush();

    expect(estado('compartiendo')).toBe('false');
    expect(estado('lista')).toBe('false');
    expect(watchRemove).toHaveBeenCalled();
    expect(estado('esvalida')).toBe('false');
  });

  it('reintentar vuelve a arrancar tras conceder el permiso', async () => {
    requestPerm.mockResolvedValue(permiso('denied', false, true));
    await montar();
    await iniciar();
    await waitFor(() => expect(estado('motivo')).toBe('permiso_denegado'));

    requestPerm.mockResolvedValue(permiso('granted', true, true));
    await fireEvent.press(screen.getByTestId('reintentar'));
    await flush();

    await waitFor(() => expect(estado('lista')).toBe('true'));
  });

  it('finalizar la jornada detiene el ciclo', async () => {
    const vista = await montar();
    await iniciar();
    await waitFor(() => expect(estado('compartiendo')).toBe('true'));

    sesionActual = { ...sesionActual, conductor: perfil({ estadoJornada: 'finalizada' }) };
    await act(async () => {
      await vista.rerender(<Sonda />);
    });

    expect(estado('compartiendo')).toBe('false');
    expect(watchRemove).toHaveBeenCalled();
  });

  it('cerrar sesión detiene el ciclo', async () => {
    const vista = await montar();
    await iniciar();
    await waitFor(() => expect(estado('compartiendo')).toBe('true'));

    sesionActual = { token: null, conductorId: null, conductor: null };
    await act(async () => {
      await vista.rerender(<Sonda />);
    });

    expect(estado('compartiendo')).toBe('false');
    expect(watchRemove).toHaveBeenCalled();
  });

  it('desmontar limpia la suscripción', async () => {
    const vista = await montar();
    await iniciar();
    await waitFor(() => expect(estado('lista')).toBe('true'));

    await vista.unmount();

    expect(watchRemove).toHaveBeenCalled();
  });
});
