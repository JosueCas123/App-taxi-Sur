import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { mensajeDeErrorApi } from '../../lib/api-errors';
import { useSession } from '../auth/session-context';
import { UBICACION_VIGENCIA_MS } from '../shift/jornada-policy';
import type {
  EstadoUbicacionOperativa,
  MotivoUbicacionNoLista,
} from '../shift/ubicacion-operativa';
import { enviarUbicacion } from './api';
import {
  capturarMuestraAsync,
  clasificarMuestra,
  LOCATION_INTERVAL_MS,
  permisoConcedidoAsync,
  solicitarPermisoAsync,
  tieneServiciosActivos,
  type MuestraCapturada,
  type PermisoUbicacion,
} from './location-service';

export type EstadoComparticion = {
  estado: EstadoUbicacionOperativa;
  compartiendo: boolean;
  permiso: PermisoUbicacion;
  esValidaUltima: boolean;
  iniciando: boolean;
  error: string | null;
  iniciar: () => void;
  detener: () => void;
  reintentar: () => void;
};

const ESTADO_INICIAL: EstadoUbicacionOperativa = {
  lista: false,
  motivo: 'sin_muestra',
  antiguedadMs: null,
};

const MENSAJE_ERROR_ENVIO =
  'No pudimos enviar tu ubicación. Revisa tu conexión e inténtalo de nuevo';

// Cadencia del temporizador de frescura que refresca la antigüedad y marca
// `desactualizada` al cumplir el umbral de M03, aunque no llegue otra muestra.
const FRESCURA_TICK_MS = 1000;

// Reloj monotónico local: la antigüedad no depende del reloj absoluto del
// dispositivo ni del valor de `horaRegistro` del servidor.
function ahoraMonotonico(): number {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function esHoraInterpretable(horaRegistro: string): boolean {
  return (
    typeof horaRegistro === 'string' &&
    horaRegistro.trim().length > 0 &&
    !Number.isNaN(Date.parse(horaRegistro))
  );
}

function muestraDesdePosicion(posicion: Location.LocationObject): MuestraCapturada {
  return {
    latitud: posicion.coords.latitude,
    longitud: posicion.coords.longitude,
    capturadaEn: posicion.timestamp,
    precisionM: typeof posicion.coords.accuracy === 'number' ? posicion.coords.accuracy : null,
  };
}

export function useCompartirUbicacion(): EstadoComparticion {
  const { token, conductorId, conductor } = useSession();

  const [estado, setEstado] = useState<EstadoUbicacionOperativa>(ESTADO_INICIAL);
  const [compartiendo, setCompartiendo] = useState(false);
  const [permiso, setPermiso] = useState<PermisoUbicacion>('no_solicitado');
  const [esValidaUltima, setEsValidaUltima] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montadoRef = useRef(true);
  const generacionRef = useRef(0);
  const compartiendoRef = useRef(false);
  const suscripcionRef = useRef<Location.LocationSubscription | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enVueloRef = useRef(false);
  // Última muestra aceptada por el servidor (solo en memoria): ancla monotónica,
  // horaRegistro del servidor y permiso/servicios observados.
  const anclaRef = useRef<number | null>(null);
  const horaRegistroRef = useRef<string | null>(null);
  const permisoRef = useRef<PermisoUbicacion>('no_solicitado');
  const serviciosActivosRef = useRef<boolean | null>(null);
  const precisionInsuficienteRef = useRef(false);
  const errorRedRef = useRef(false);
  const tokenRef = useRef(token);
  const conductorIdRef = useRef(conductorId);

  useEffect(() => {
    tokenRef.current = token;
    conductorIdRef.current = conductorId;
  }, [token, conductorId]);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  // Deriva el EstadoUbicacionOperativa de M03 por precedencia explícita.
  const recomputar = useCallback(() => {
    const ancla = anclaRef.current;
    const edad = ancla === null ? null : Math.max(0, ahoraMonotonico() - ancla);
    const fresca = edad !== null && edad < UBICACION_VIGENCIA_MS;
    if (fresca) {
      setEstado({ lista: true, motivo: null, antiguedadMs: edad });
      return;
    }
    let motivo: MotivoUbicacionNoLista;
    if (permisoRef.current === 'denegado' || permisoRef.current === 'denegado_permanente') {
      motivo = 'permiso_denegado';
    } else if (serviciosActivosRef.current === false) {
      motivo = 'gps_apagado';
    } else if (precisionInsuficienteRef.current) {
      motivo = 'precision_insuficiente';
    } else if (edad !== null) {
      motivo = 'desactualizada';
    } else if (errorRedRef.current) {
      motivo = 'error_red';
    } else {
      motivo = 'sin_muestra';
    }
    setEstado({ lista: false, motivo, antiguedadMs: edad });
  }, []);

  const limpiarSuscripcion = useCallback(() => {
    if (suscripcionRef.current) {
      suscripcionRef.current.remove();
      suscripcionRef.current = null;
    }
  }, []);

  const limpiarTick = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const arrancarTick = useCallback(
    (generacion: number) => {
      limpiarTick();
      tickRef.current = setInterval(() => {
        if (generacionRef.current !== generacion || !montadoRef.current) return;
        recomputar();
      }, FRESCURA_TICK_MS);
    },
    [limpiarTick, recomputar]
  );

  // Clasifica la muestra, evita envíos simultáneos y actualiza el ancla de frescura
  // con la respuesta del servidor (esValida + horaRegistro interpretable).
  const procesarMuestra = useCallback(
    async (muestra: MuestraCapturada, generacion: number) => {
      if (clasificarMuestra(muestra) === 'precision_insuficiente') {
        precisionInsuficienteRef.current = true;
        recomputar();
        return;
      }
      precisionInsuficienteRef.current = false;

      if (enVueloRef.current) return;
      const tokenActual = tokenRef.current;
      const idActual = conductorIdRef.current;
      if (!tokenActual || !idActual) return;

      enVueloRef.current = true;
      try {
        const dto = await enviarUbicacion(idActual, tokenActual, {
          latitud: muestra.latitud,
          longitud: muestra.longitud,
        });
        if (generacionRef.current !== generacion || !montadoRef.current) return;
        setEsValidaUltima(dto.esValida);
        if (dto.esValida && esHoraInterpretable(dto.horaRegistro)) {
          anclaRef.current = ahoraMonotonico();
          horaRegistroRef.current = dto.horaRegistro;
        } else {
          // esValida:false o horaRegistro no interpretable: no habilita disponibilidad
          // y no se recurre a la hora de captura local.
          anclaRef.current = null;
          horaRegistroRef.current = null;
        }
        errorRedRef.current = false;
        setError(null);
      } catch (fallo) {
        if (generacionRef.current !== generacion || !montadoRef.current) return;
        errorRedRef.current = true;
        setError(mensajeDeErrorApi(fallo, MENSAJE_ERROR_ENVIO));
      } finally {
        if (generacionRef.current === generacion) {
          enVueloRef.current = false;
        }
        if (montadoRef.current) recomputar();
      }
    },
    [recomputar]
  );

  const iniciarCiclo = useCallback(
    async (generacion: number) => {
      limpiarSuscripcion();
      limpiarTick();
      const servicios = await tieneServiciosActivos();
      if (generacionRef.current !== generacion || !montadoRef.current) return;
      serviciosActivosRef.current = servicios;
      if (!servicios) {
        recomputar();
        return;
      }
      const muestra = await capturarMuestraAsync();
      if (generacionRef.current !== generacion || !montadoRef.current) return;
      if (muestra) {
        void procesarMuestra(muestra, generacion);
      }
      if (generacionRef.current !== generacion || !montadoRef.current) return;
      try {
        const suscripcion = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: LOCATION_INTERVAL_MS,
            distanceInterval: 0,
          },
          (posicion) => {
            void procesarMuestra(muestraDesdePosicion(posicion), generacion);
          },
          () => {
            // Si el GPS se apaga, el temporizador de frescura marcará desactualizada.
          }
        );
        if (generacionRef.current !== generacion || !montadoRef.current) {
          suscripcion.remove();
          return;
        }
        suscripcionRef.current = suscripcion;
      } catch {
        // No se pudo observar: el estado queda sin muestra.
      }
      arrancarTick(generacion);
      recomputar();
    },
    [arrancarTick, limpiarSuscripcion, limpiarTick, procesarMuestra, recomputar]
  );

  const arrancar = useCallback(async () => {
    const generacion = ++generacionRef.current;
    enVueloRef.current = false;
    setIniciando(true);
    setError(null);
    try {
      const permisoActual = await solicitarPermisoAsync();
      if (generacionRef.current !== generacion || !montadoRef.current) return;
      permisoRef.current = permisoActual;
      setPermiso(permisoActual);
      if (permisoActual !== 'concedido') {
        recomputar();
        return;
      }
      await iniciarCiclo(generacion);
    } finally {
      if (generacionRef.current === generacion && montadoRef.current) {
        setIniciando(false);
        recomputar();
      }
    }
  }, [iniciarCiclo, recomputar]);

  const detener = useCallback(() => {
    ++generacionRef.current;
    compartiendoRef.current = false;
    setCompartiendo(false);
    limpiarSuscripcion();
    limpiarTick();
    enVueloRef.current = false;
    anclaRef.current = null;
    horaRegistroRef.current = null;
    precisionInsuficienteRef.current = false;
    errorRedRef.current = false;
    serviciosActivosRef.current = null;
    setIniciando(false);
    setError(null);
    setEsValidaUltima(false);
    recomputar();
  }, [limpiarSuscripcion, limpiarTick, recomputar]);

  const iniciar = useCallback(() => {
    if (compartiendoRef.current) return;
    compartiendoRef.current = true;
    setCompartiendo(true);
    void arrancar();
  }, [arrancar]);

  const reintentar = useCallback(() => {
    setError(null);
    if (!compartiendoRef.current) {
      iniciar();
      return;
    }
    void arrancar();
  }, [arrancar, iniciar]);

  const pausar = useCallback(() => {
    ++generacionRef.current;
    limpiarSuscripcion();
    limpiarTick();
    enVueloRef.current = false;
    // Al pasar a segundo plano se descarta la muestra aceptada.
    anclaRef.current = null;
    horaRegistroRef.current = null;
    recomputar();
  }, [limpiarSuscripcion, limpiarTick, recomputar]);

  const reanudar = useCallback(async () => {
    if (!compartiendoRef.current) return;
    const generacion = ++generacionRef.current;
    anclaRef.current = null;
    horaRegistroRef.current = null;
    precisionInsuficienteRef.current = false;
    errorRedRef.current = false;
    recomputar();
    const permisoActual = await permisoConcedidoAsync();
    if (generacionRef.current !== generacion || !montadoRef.current) return;
    permisoRef.current = permisoActual;
    setPermiso(permisoActual);
    if (permisoActual !== 'concedido') {
      recomputar();
      return;
    }
    await iniciarCiclo(generacion);
  }, [iniciarCiclo, recomputar]);

  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estadoApp) => {
      if (estadoApp === 'active') {
        void reanudar();
      } else {
        pausar();
      }
    });
    return () => suscripcion.remove();
  }, [pausar, reanudar]);

  // Parada al finalizar jornada o cerrar sesión.
  useEffect(() => {
    if (!compartiendo) return;
    const sesionInvalida = !token || !conductorId;
    const jornadaInactiva = !!conductor && conductor.estadoJornada !== 'activa';
    if (sesionInvalida || jornadaInactiva) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      detener();
    }
  }, [compartiendo, token, conductorId, conductor, detener]);

  useEffect(() => {
    const generacion = generacionRef;
    const suscripcion = suscripcionRef;
    const tick = tickRef;
    return () => {
      montadoRef.current = false;
      ++generacion.current;
      if (suscripcion.current) {
        suscripcion.current.remove();
        suscripcion.current = null;
      }
      if (tick.current !== null) {
        clearInterval(tick.current);
        tick.current = null;
      }
    };
  }, []);

  return useMemo<EstadoComparticion>(
    () => ({
      estado,
      compartiendo,
      permiso,
      esValidaUltima,
      iniciando,
      error,
      iniciar,
      detener,
      reintentar,
    }),
    [estado, compartiendo, permiso, esValidaUltima, iniciando, error, iniciar, detener, reintentar]
  );
}
