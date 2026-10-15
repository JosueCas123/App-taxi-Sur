import * as Location from 'expo-location';
import { Linking } from 'react-native';

// Intervalo objetivo de observación en primer plano (decisión inicial; el SO no garantiza cadencia exacta).
export const LOCATION_INTERVAL_MS = 30_000;

// Umbral de precisión suficiente: radio en metros (menor es mejor). Criterio de app, ajustable.
export const PRECISION_MAXIMA_M = 50;

export type MuestraCapturada = {
  latitud: number;
  longitud: number;
  capturadaEn: number;
  precisionM: number | null;
};

export type PermisoUbicacion =
  | 'concedido'
  | 'denegado'
  | 'denegado_permanente'
  | 'no_solicitado';

export type DiagnosticoUbicacion = 'ok' | 'gps_apagado' | 'precision_insuficiente';

function aPermisoUbicacion(respuesta: Location.PermissionResponse): PermisoUbicacion {
  if (respuesta.granted) {
    return 'concedido';
  }
  if (respuesta.canAskAgain === false) {
    return 'denegado_permanente';
  }
  if (respuesta.status === 'undetermined') {
    return 'no_solicitado';
  }
  return 'denegado';
}

// Consulta el permiso de primer plano sin abrir el diálogo del sistema.
export async function permisoConcedidoAsync(): Promise<PermisoUbicacion> {
  const respuesta = await Location.getForegroundPermissionsAsync();
  return aPermisoUbicacion(respuesta);
}

// Solicita el permiso de primer plano (abre el diálogo del sistema una sola vez por decisión del SO).
export async function solicitarPermisoAsync(): Promise<PermisoUbicacion> {
  const respuesta = await Location.requestForegroundPermissionsAsync();
  return aPermisoUbicacion(respuesta);
}

// Indica si los servicios de ubicación del dispositivo están encendidos (GPS activo).
export async function tieneServiciosActivos(): Promise<boolean> {
  return Location.hasServicesEnabledAsync();
}

// Obtiene una muestra puntual; devuelve null si la captura falla (servicios apagados, error transitorio).
export async function capturarMuestraAsync(): Promise<MuestraCapturada | null> {
  try {
    const posicion = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitud: posicion.coords.latitude,
      longitud: posicion.coords.longitude,
      capturadaEn: posicion.timestamp,
      precisionM: typeof posicion.coords.accuracy === 'number' ? posicion.coords.accuracy : null,
    };
  } catch {
    return null;
  }
}

// Clasifica una muestra capturada. Una precisión nula o mayor al umbral no es suficiente.
export function clasificarMuestra(muestra: MuestraCapturada): DiagnosticoUbicacion {
  if (muestra.precisionM === null || muestra.precisionM > PRECISION_MAXIMA_M) {
    return 'precision_insuficiente';
  }
  return 'ok';
}

// Vía de recuperación cuando el permiso fue denegado: abre los ajustes del sistema.
export function abrirAjustes(): void {
  void Linking.openSettings().catch(() => {
    // Sin recuperación automática si el sistema no permite abrir ajustes.
  });
}
