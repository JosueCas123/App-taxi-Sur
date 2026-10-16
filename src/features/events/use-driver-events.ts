import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { runtimeConfig } from '../../config/runtime';
import { esErrorApi } from '../../lib/api-client';
import type { ServicioConfirmado } from '../../navigation/resolve-route';
import { registrarAlInvalidar, useSession } from '../auth/session-context';
import type { SolicitudDetalleDto } from '../requests/api';
import { recuperarInstantaneaOperativa, servicioConfirmadoDe } from '../requests/reconcile';
import { abrirConexionSse, type ConexionSse, type MotivoFin } from './sse-transport';

export type EstadoConexion = 'iniciando' | 'conectado' | 'reconectando' | 'perdida';

// Compuerta de arranque: hasta que la PRIMERA reconciliación no termine, no se
// resuelve ninguna ruta (evita bloquear a una cuenta suspendida con servicio).
export type EstadoReconciliacion = 'pendiente' | 'completa' | 'fallida';

export type UseDriverEventsResult = {
  conexion: EstadoConexion;
  reconciliando: boolean;
  reconciliacionInicial: EstadoReconciliacion;
  solicitudActiva: SolicitudDetalleDto | null;
  servicioConfirmado: ServicioConfirmado | null;
  reconciliar: () => Promise<void>;
  // Cabecera HTTP Date cruda de la última lectura de solicitud-activa (en
  // memoria, por sesión/conductor). Se limpia al cambiar de sesión o perder la
  // conexión; la siguiente lectura exitosa la reestima. No se limpia al reconciliar.
  fechaServidorSolicitud: string | null;
  // Oferta vencida que el conductor ya descartó con "Volver a mi jornada". Se
  // limpia cuando la reconciliación deja de devolver esa oferta o cambia la sesión.
  ofertaDescartadaId: string | null;
  descartarOfertaVencida: (solicitudId: string) => void;
};

export type OpcionesDriverEvents = {
  fetchImpl?: typeof fetch;
};

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30000;

// Espera progresiva acotada: `min(1000 * 2^(fallos-1), 30000)`. La pista
// `retry:` del servidor se acota a [1000, 30000] y solo puede alargar la espera,
// nunca reducir la calculada.
export function backoffMs(fallos: number, pistaMs?: number | null): number {
  const exponente = Math.max(0, fallos - 1);
  const calculado = Math.min(BACKOFF_BASE_MS * 2 ** exponente, BACKOFF_MAX_MS);
  if (pistaMs === null || pistaMs === undefined) return calculado;
  const pista = Math.min(Math.max(pistaMs, BACKOFF_BASE_MS), BACKOFF_MAX_MS);
  return Math.max(calculado, pista);
}

export function useDriverEvents(opciones: OpcionesDriverEvents = {}): UseDriverEventsResult {
  const { token, conductorId, invalidarSesion } = useSession();

  const [conexion, setConexion] = useState<EstadoConexion>('iniciando');
  const [reconciliando, setReconciliando] = useState(false);
  const [reconciliacionInicial, setReconciliacionInicial] =
    useState<EstadoReconciliacion>('pendiente');
  const [solicitudActiva, setSolicitudActiva] = useState<SolicitudDetalleDto | null>(null);
  const [servicioConfirmado, setServicioConfirmado] = useState<ServicioConfirmado | null>(null);
  const [fechaServidorSolicitud, setFechaServidorSolicitud] = useState<string | null>(null);
  const [ofertaDescartadaId, setOfertaDescartadaId] = useState<string | null>(null);

  const montadoRef = useRef(true);
  // Generación de sesión/conductor: descarta respuestas y eventos previos.
  const generacionRef = useRef(0);
  const tokenRef = useRef<string | null>(null);
  const conductorIdRef = useRef<string | null>(null);
  const sesionRef = useRef<{ token: string; conductorId: string } | null>(null);
  const invalidarRef = useRef(invalidarSesion);
  const fetchImplRef = useRef(opciones.fetchImpl);
  // Espejo en ref del descarte: `reconciliar` (estable) lo lee sin depender del estado.
  const ofertaDescartadaRef = useRef<string | null>(null);

  // Ciclo de conexión SSE: el AbortController lo posee este hook.
  const conexionRef = useRef<ConexionSse | null>(null);
  const controladorRef = useRef<AbortController | null>(null);
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conectadoRef = useRef(false);
  const fallosRef = useRef(0);
  const pistaRetryRef = useRef<number | null>(null);

  // Agrupación de invalidaciones: mientras hay una lectura en curso, las que
  // lleguen se resumen en UNA relanzada posterior.
  const enVueloRef = useRef(false);
  const pendienteRef = useRef(false);

  useEffect(() => {
    invalidarRef.current = invalidarSesion;
    fetchImplRef.current = opciones.fetchImpl;
  });

  // Una única reconciliación en vuelo; agrupa las simultáneas y descarta por
  // generación cualquier respuesta de otra sesión/conductor.
  const reconciliar = useCallback(async () => {
    if (enVueloRef.current) {
      pendienteRef.current = true;
      return;
    }
    enVueloRef.current = true;
    setReconciliando(true);
    try {
      do {
        pendienteRef.current = false;
        const generacion = generacionRef.current;
        const tokenActual = tokenRef.current;
        const conductorIdActual = conductorIdRef.current;
        if (!tokenActual || !conductorIdActual) break;
        try {
          const instantanea = await recuperarInstantaneaOperativa(
            conductorIdActual,
            tokenActual,
            undefined,
            (fechaServidor) => {
              if (generacionRef.current === generacion && montadoRef.current) {
                setFechaServidorSolicitud(fechaServidor);
              }
            }
          );
          if (generacionRef.current !== generacion) {
            // Respuesta de otra sesión/conductor: no se aplica, pero deja
            // correr la relanzada que la nueva generación ya pidió.
            continue;
          }
          if (!montadoRef.current) break;
          setSolicitudActiva(instantanea.solicitudActiva);
          setServicioConfirmado(servicioConfirmadoDe(instantanea));
          // El descarte solo se limpia cuando la reconciliación deja de devolver
          // esa misma oferta (o cambia la sesión, resuelto en su efecto).
          if (
            ofertaDescartadaRef.current !== null &&
            instantanea.solicitudActiva?.id !== ofertaDescartadaRef.current
          ) {
            ofertaDescartadaRef.current = null;
            setOfertaDescartadaId(null);
          }
          setReconciliacionInicial('completa');
        } catch (error) {
          if (generacionRef.current !== generacion) continue;
          if (!montadoRef.current) break;
          if (esErrorApi(error) && error.code === 'UNAUTHORIZED') {
            // El manejo de sesión actúa; no hay nada que avisar al llamador.
            void invalidarRef.current();
            break;
          }
          setReconciliacionInicial((prev) => (prev === 'completa' ? 'completa' : 'fallida'));
          // El llamador que espera (costura de 409) decide cómo avisar; los
          // disparos internos (stream, arranque, primer plano) ignoran el rechazo.
          throw error;
        }
      } while (pendienteRef.current);
    } finally {
      enVueloRef.current = false;
      if (montadoRef.current) setReconciliando(false);
    }
  }, []);

  // "Volver a mi jornada": registra la oferta vencida descartada en memoria para
  // que el guard la trate como ausente mientras el backend siga devolviéndola.
  const descartarOfertaVencida = useCallback((solicitudId: string) => {
    ofertaDescartadaRef.current = solicitudId;
    setOfertaDescartadaId(solicitudId);
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  // Cierre: cancela cualquier backoff pendiente y termina la lectura a través
  // del mismo AbortController que posee este hook.
  const detenerCiclo = useCallback(() => {
    if (temporizadorRef.current !== null) {
      clearTimeout(temporizadorRef.current);
      temporizadorRef.current = null;
    }
    conexionRef.current?.cerrar();
    controladorRef.current?.abort();
    conexionRef.current = null;
    controladorRef.current = null;
    conectadoRef.current = false;
  }, []);

  // Una única conexión por sesión y por conductor.
  useEffect(() => {
    tokenRef.current = token;
    conductorIdRef.current = conductorId;

    if (!token || !conductorId) {
      sesionRef.current = null;
      ofertaDescartadaRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sesión cerrada: limpia el desfase y el descarte en memoria
      setFechaServidorSolicitud(null);
      setOfertaDescartadaId(null);
      detenerCiclo();
      return;
    }

    const sesion = { token, conductorId };
    sesionRef.current = sesion;
    const generacion = ++generacionRef.current;

    fallosRef.current = 0;
    pistaRetryRef.current = null;
    setConexion('iniciando');
    setReconciliacionInicial('pendiente');
    ofertaDescartadaRef.current = null;
    setFechaServidorSolicitud(null);
    setOfertaDescartadaId(null);
    setSolicitudActiva(null);
    setServicioConfirmado(null);

    // Instantánea inicial: recupera el estado aunque no llegue ningún evento.
    void reconciliar().catch(() => {});

    function limpiarIntento(): void {
      if (temporizadorRef.current !== null) {
        clearTimeout(temporizadorRef.current);
        temporizadorRef.current = null;
      }
    }

    function abrir(): void {
      if (generacionRef.current !== generacion || !montadoRef.current) return;
      limpiarIntento();
      const controlador = new AbortController();
      controladorRef.current = controlador;
      conectadoRef.current = false;
      pistaRetryRef.current = null;
      setConexion(fallosRef.current > 0 ? 'reconectando' : 'iniciando');
      const base = (runtimeConfig.apiUrl ?? '').replace(/\/+$/, '');
      const url = `${base}/api/conductores/${encodeURIComponent(sesion.conductorId)}/eventos`;
      conexionRef.current = abrirConexionSse({
        url,
        token: sesion.token,
        conductorId: sesion.conductorId,
        signal: controlador.signal,
        fetchImpl: fetchImplRef.current,
        onRetry: (ms) => {
          if (generacionRef.current === generacion) pistaRetryRef.current = ms;
        },
        onApertura: () => {
          if (generacionRef.current !== generacion || !montadoRef.current) return;
          // El backoff se reinicia al abrir la conexión, no al recibir `conectado`.
          fallosRef.current = 0;
          conectadoRef.current = true;
          setConexion('conectado');
        },
        onEvento: () => {
          // El evento es una invalidación, nunca una copia de la entidad.
          // `conectado` solo dispara la reconciliación de arranque.
          if (generacionRef.current !== generacion) return;
          void reconciliar().catch(() => {});
        },
        onFin: (motivo) => {
          if (generacionRef.current !== generacion || !montadoRef.current) return;
          manejarFin(motivo);
        },
      });
    }

    function manejarFin(motivo: MotivoFin): void {
      if (motivo === 'cerrado') return;
      conexionRef.current = null;
      controladorRef.current = null;
      conectadoRef.current = false;
      setConexion('perdida');
      // Al perder la conexión se descarta el desfase estimado; la próxima
      // lectura exitosa de solicitud-activa lo reestima.
      setFechaServidorSolicitud(null);
      if (motivo === 'no_autorizado') {
        // 401/403 delegan al manejo de sesión: sin backoff.
        void invalidarRef.current();
        return;
      }
      fallosRef.current += 1;
      temporizadorRef.current = setTimeout(() => {
        temporizadorRef.current = null;
        abrir();
      }, backoffMs(fallosRef.current, pistaRetryRef.current));
    }

    abrir();

    // Al volver a primer plano se consulta el estado; si el stream estaba en
    // espera de backoff se reintenta de inmediato (sin polling en segundo plano).
    const suscripcionApp = AppState.addEventListener('change', (estadoApp) => {
      if (estadoApp !== 'active') return;
      void reconciliar().catch(() => {});
      if (conectadoRef.current || conexionRef.current !== null) return;
      limpiarIntento();
      abrir();
    });

    return () => {
      suscripcionApp.remove();
      detenerCiclo();
    };
  }, [token, conductorId, reconciliar, detenerCiclo, opciones.fetchImpl]);

  // Logout, vencimiento local de sesión o cambio de conductor cierran el stream.
  useEffect(() => {
    return registrarAlInvalidar(() => {
      ++generacionRef.current;
      sesionRef.current = null;
      detenerCiclo();
    });
  }, [detenerCiclo]);

  return useMemo<UseDriverEventsResult>(
    () => ({
      conexion,
      reconciliando,
      reconciliacionInicial,
      solicitudActiva,
      servicioConfirmado,
      reconciliar,
      fechaServidorSolicitud,
      ofertaDescartadaId,
      descartarOfertaVencida,
    }),
    [
      conexion,
      reconciliando,
      reconciliacionInicial,
      solicitudActiva,
      servicioConfirmado,
      reconciliar,
      fechaServidorSolicitud,
      ofertaDescartadaId,
      descartarOfertaVencida,
    ]
  );
}
