import { afterEach, describe, expect, it, jest } from '@jest/globals';
import * as Location from 'expo-location';
import { Linking } from 'react-native';

import {
  abrirAjustes,
  capturarMuestraAsync,
  clasificarMuestra,
  LOCATION_INTERVAL_MS,
  permisoConcedidoAsync,
  PRECISION_MAXIMA_M,
  solicitarPermisoAsync,
  tieneServiciosActivos,
  type MuestraCapturada,
} from '../location-service';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const getForegroundPermissionsAsync = Location.getForegroundPermissionsAsync as jest.MockedFunction<
  typeof Location.getForegroundPermissionsAsync
>;
const requestForegroundPermissionsAsync =
  Location.requestForegroundPermissionsAsync as jest.MockedFunction<
    typeof Location.requestForegroundPermissionsAsync
  >;
const hasServicesEnabledAsync = Location.hasServicesEnabledAsync as jest.MockedFunction<
  typeof Location.hasServicesEnabledAsync
>;
const getCurrentPositionAsync = Location.getCurrentPositionAsync as jest.MockedFunction<
  typeof Location.getCurrentPositionAsync
>;

function permiso(
  status: string,
  granted: boolean,
  canAskAgain: boolean
): Location.PermissionResponse {
  return { status, granted, canAskAgain, expires: 'never' } as unknown as Location.PermissionResponse;
}

function posicion(parcial: Partial<Location.LocationObjectCoords> = {}): Location.LocationObject {
  return {
    timestamp: 1_700_000_000_000,
    coords: {
      latitude: -17.78,
      longitude: -63.18,
      altitude: 400,
      accuracy: 12,
      altitudeAccuracy: 5,
      heading: 0,
      speed: 0,
      ...parcial,
    },
  } as Location.LocationObject;
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('constantes', () => {
  it('define el intervalo objetivo y el umbral de precisión', () => {
    expect(LOCATION_INTERVAL_MS).toBe(30_000);
    expect(PRECISION_MAXIMA_M).toBe(50);
  });
});

describe('permisoConcedidoAsync', () => {
  it('devuelve "concedido" cuando el permiso está otorgado', async () => {
    getForegroundPermissionsAsync.mockResolvedValue(permiso('granted', true, true));
    await expect(permisoConcedidoAsync()).resolves.toBe('concedido');
  });

  it('devuelve "denegado" cuando se rechazó pero se puede volver a preguntar', async () => {
    getForegroundPermissionsAsync.mockResolvedValue(permiso('denied', false, true));
    await expect(permisoConcedidoAsync()).resolves.toBe('denegado');
  });

  it('devuelve "denegado_permanente" cuando no se puede volver a preguntar', async () => {
    getForegroundPermissionsAsync.mockResolvedValue(permiso('denied', false, false));
    await expect(permisoConcedidoAsync()).resolves.toBe('denegado_permanente');
  });

  it('devuelve "no_solicitado" cuando aún no se ha preguntado', async () => {
    getForegroundPermissionsAsync.mockResolvedValue(permiso('undetermined', false, true));
    await expect(permisoConcedidoAsync()).resolves.toBe('no_solicitado');
  });
});

describe('solicitarPermisoAsync', () => {
  it('solicita el permiso y mapea la concesión', async () => {
    requestForegroundPermissionsAsync.mockResolvedValue(permiso('granted', true, true));
    await expect(solicitarPermisoAsync()).resolves.toBe('concedido');
    expect(requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('mapea el rechazo permanente', async () => {
    requestForegroundPermissionsAsync.mockResolvedValue(permiso('denied', false, false));
    await expect(solicitarPermisoAsync()).resolves.toBe('denegado_permanente');
  });
});

describe('tieneServiciosActivos', () => {
  it('propaga el estado de los servicios de ubicación', async () => {
    hasServicesEnabledAsync.mockResolvedValue(true);
    await expect(tieneServiciosActivos()).resolves.toBe(true);

    hasServicesEnabledAsync.mockResolvedValue(false);
    await expect(tieneServiciosActivos()).resolves.toBe(false);
  });
});

describe('capturarMuestraAsync', () => {
  it('mapea la posición a una muestra capturada', async () => {
    getCurrentPositionAsync.mockResolvedValue(posicion());

    const muestra = await capturarMuestraAsync();

    expect(muestra).toEqual({
      latitud: -17.78,
      longitud: -63.18,
      capturadaEn: 1_700_000_000_000,
      precisionM: 12,
    });
  });

  it('usa precisión nula cuando la posición no la reporta', async () => {
    getCurrentPositionAsync.mockResolvedValue(posicion({ accuracy: null }));

    const muestra = await capturarMuestraAsync();

    expect(muestra?.precisionM).toBeNull();
  });

  it('devuelve null si la captura falla', async () => {
    getCurrentPositionAsync.mockRejectedValue(new Error('location disabled'));

    await expect(capturarMuestraAsync()).resolves.toBeNull();
  });
});

describe('clasificarMuestra', () => {
  function muestra(precisionM: number | null): MuestraCapturada {
    return { latitud: 0, longitud: 0, capturadaEn: 0, precisionM };
  }

  it('clasifica como ok una precisión dentro del umbral', () => {
    expect(clasificarMuestra(muestra(PRECISION_MAXIMA_M))).toBe('ok');
    expect(clasificarMuestra(muestra(10))).toBe('ok');
  });

  it('clasifica como insuficiente una precisión mayor al umbral', () => {
    expect(clasificarMuestra(muestra(PRECISION_MAXIMA_M + 1))).toBe('precision_insuficiente');
  });

  it('clasifica como insuficiente una precisión nula', () => {
    expect(clasificarMuestra(muestra(null))).toBe('precision_insuficiente');
  });
});

describe('abrirAjustes', () => {
  it('abre los ajustes del sistema', () => {
    const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);

    abrirAjustes();

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
