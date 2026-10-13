import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { esErrorApi } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-client';
import { obtenerConductor, loginConductor, type ConductorDetalleDto } from './api';
import { decodificarPayloadJwt } from './jwt';
import { borrarToken, guardarToken, leerToken } from './token-storage';

export type SessionStatus =
  | 'restaurando'
  | 'autenticado'
  | 'sesion_sin_verificar'
  | 'sesion_incompatible'
  | 'no_autenticado';

type EstadoSesion = {
  status: SessionStatus;
  token: string | null;
  conductorId: string | null;
  mensajeSesion: string | null;
};

type SessionContextValue = {
  status: SessionStatus;
  token: string | null;
  conductorId: string | null;
  conductor: ConductorDetalleDto | null;
  mensajeSesion: string | null;
  iniciarSesion: (telefono: string, pin: string) => Promise<void>;
  restaurarSesion: () => Promise<void>;
  invalidarSesion: () => Promise<void>;
};

const MENSAJE_SESION_INCOMPATIBLE = 'Tu sesión ya no es válida';
const MENSAJE_SESION_VENCIDA = 'Tu sesión expiró. Ingresa nuevamente';

const SessionContext = createContext<SessionContextValue | null>(null);

type ListenerInvalidacion = () => void;
const listenersInvalidacion = new Set<ListenerInvalidacion>();

export function registrarAlInvalidar(listener: ListenerInvalidacion): () => void {
  listenersInvalidacion.add(listener);
  return () => {
    listenersInvalidacion.delete(listener);
  };
}

function sinSesion(mensaje: string | null): EstadoSesion {
  return {
    status: 'no_autenticado',
    token: null,
    conductorId: null,
    mensajeSesion: mensaje,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoSesion>({
    status: 'restaurando',
    token: null,
    conductorId: null,
    mensajeSesion: null,
  });
  const conductorIdActualRef = useRef<string | null>(null);
  const operacionRef = useRef(0);
  const almacenamientoRef = useRef<Promise<void>>(Promise.resolve());
  const { data: conductor } = useQuery<ConductorDetalleDto>({
    queryKey: queryKeys.conductor(estado.conductorId ?? ''),
    queryFn: skipToken,
    enabled: false,
  });

  const persistirToken = useCallback((token: string | null) => {
    // El borrado debe esperar cualquier escritura pendiente del login invalidado.
    const operacion = almacenamientoRef.current.then(() =>
      token === null ? borrarToken() : guardarToken(token)
    );
    almacenamientoRef.current = operacion.catch(() => {});
    return operacion;
  }, []);

  const limpiarCachesConductor = useCallback(
    (conductorId: string) => {
      const filtrar = (queryKey: readonly unknown[]) =>
        typeof queryKey[1] === 'string' &&
        queryKey[1] === conductorId &&
        (queryKey[0] === 'conductor' || queryKey[0] === 'solicitudActiva');
      void queryClient.cancelQueries({ predicate: (consulta) => filtrar(consulta.queryKey) });
      queryClient.removeQueries({ predicate: (consulta) => filtrar(consulta.queryKey) });
    },
    [queryClient]
  );

  const ejecutarInvalidacion = useCallback(
    async (mensaje: string | null) => {
      ++operacionRef.current;
      const conductorIdActual = conductorIdActualRef.current;
      conductorIdActualRef.current = null;
      setEstado(sinSesion(mensaje));
      if (conductorIdActual) {
        limpiarCachesConductor(conductorIdActual);
      }
      // Un listener externo no debe impedir el borrado ni los otros cierres.
      await Promise.all([
        persistirToken(null),
        Promise.allSettled([...listenersInvalidacion].map(async (listener) => listener())),
      ]);
    },
    [limpiarCachesConductor, persistirToken]
  );

  const invalidarSesion = useCallback(() => ejecutarInvalidacion(null), [ejecutarInvalidacion]);

  const sesionIncompatible = useCallback(async () => {
    const invalidacion = ejecutarInvalidacion(MENSAJE_SESION_INCOMPATIBLE);
    setEstado({
      status: 'sesion_incompatible',
      token: null,
      conductorId: null,
      mensajeSesion: MENSAJE_SESION_INCOMPATIBLE,
    });
    await invalidacion;
  }, [ejecutarInvalidacion]);

  const confirmarConductor = useCallback(
    async (token: string, conductorId: string, operacion: number) => {
      conductorIdActualRef.current = conductorId;
      await queryClient.fetchQuery({
        queryKey: queryKeys.conductor(conductorId),
        queryFn: ({ signal }) => obtenerConductor(conductorId, token, signal),
        staleTime: 0,
        retry: false,
        networkMode: 'always',
      });
      // Una respuesta de una sesion anterior nunca puede volver a autenticar.
      if (operacion !== operacionRef.current) return;
      setEstado({
        status: 'autenticado',
        token,
        conductorId,
        mensajeSesion: null,
      });
    },
    [queryClient]
  );

  const restaurarSesion = useCallback(async () => {
    const operacion = ++operacionRef.current;
    setEstado((prev) => ({ ...prev, status: 'restaurando' }));
    await almacenamientoRef.current;
    if (operacion !== operacionRef.current) return;
    let tokenAlmacenado: string | null;
    try {
      tokenAlmacenado = await leerToken();
    } catch {
      if (operacion !== operacionRef.current) return;
      const conductorAnterior = conductorIdActualRef.current;
      conductorIdActualRef.current = null;
      if (conductorAnterior) limpiarCachesConductor(conductorAnterior);
      setEstado(sinSesion('No se pudo leer la sesión segura. Intenta ingresar nuevamente'));
      return;
    }
    if (operacion !== operacionRef.current) return;
    if (!tokenAlmacenado) {
      setEstado(sinSesion(null));
      return;
    }

    const payload = decodificarPayloadJwt(tokenAlmacenado);
    const conductorId = payload?.conductorId;
    if (!payload || !conductorId) {
      await sesionIncompatible();
      return;
    }
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      await ejecutarInvalidacion(null);
      return;
    }

    try {
      await confirmarConductor(tokenAlmacenado, conductorId, operacion);
    } catch (error) {
      if (operacion !== operacionRef.current) return;
      if (esErrorApi(error) && error.code === 'UNAUTHORIZED') {
        await ejecutarInvalidacion(MENSAJE_SESION_VENCIDA);
        return;
      }
      if (esErrorApi(error) && (error.code === 'FORBIDDEN' || error.code === 'NOT_FOUND')) {
        await sesionIncompatible();
        return;
      }
      conductorIdActualRef.current = conductorId;
      setEstado({
        status: 'sesion_sin_verificar',
        token: tokenAlmacenado,
        conductorId,
        mensajeSesion: null,
      });
    }
  }, [confirmarConductor, ejecutarInvalidacion, limpiarCachesConductor, sesionIncompatible]);

  const disparadoRef = useRef(false);
  useEffect(() => {
    if (disparadoRef.current) {
      return;
    }
    disparadoRef.current = true;
    void restaurarSesion();
  }, [restaurarSesion]);

  const iniciarSesion = useCallback(
    async (telefono: string, pin: string) => {
      const operacion = ++operacionRef.current;
      if (conductorIdActualRef.current) {
        void queryClient.cancelQueries({ queryKey: queryKeys.conductor(conductorIdActualRef.current) });
      }
      setEstado((prev) => ({ ...prev, status: 'restaurando' }));
      try {
        const { token } = await loginConductor({ telefono, pin });
        if (operacion !== operacionRef.current) return;
        const payload = decodificarPayloadJwt(token);
        const conductorId = payload?.conductorId;
        if (!payload || !conductorId) {
          await sesionIncompatible();
          return;
        }

        const conductorAnterior = conductorIdActualRef.current;
        if (conductorAnterior && conductorAnterior !== conductorId) {
          limpiarCachesConductor(conductorAnterior);
        }
        await persistirToken(token);
        if (operacion !== operacionRef.current) return;

        try {
          await confirmarConductor(token, conductorId, operacion);
        } catch (error) {
          if (operacion !== operacionRef.current) return;
          if (esErrorApi(error) && error.code === 'UNAUTHORIZED') {
            await ejecutarInvalidacion(MENSAJE_SESION_VENCIDA);
            return;
          }
          if (esErrorApi(error) && (error.code === 'FORBIDDEN' || error.code === 'NOT_FOUND')) {
            await sesionIncompatible();
            return;
          }
          conductorIdActualRef.current = conductorId;
          setEstado({
            status: 'sesion_sin_verificar',
            token,
            conductorId,
            mensajeSesion: null,
          });
        }
      } catch (error) {
        if (operacion !== operacionRef.current) return;
        setEstado((prev) => ({
          ...prev,
          status: prev.token ? prev.status : 'no_autenticado',
        }));
        throw error;
      }
    },
    [confirmarConductor, ejecutarInvalidacion, limpiarCachesConductor, persistirToken, queryClient, sesionIncompatible]
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      status: estado.status,
      token: estado.token,
      conductorId: estado.conductorId,
      conductor: estado.status === 'autenticado' ? conductor ?? null : null,
      mensajeSesion: estado.mensajeSesion,
      iniciarSesion,
      restaurarSesion,
      invalidarSesion,
    }),
    [estado, conductor, iniciarSesion, invalidarSesion, restaurarSesion]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession debe usarse dentro de SessionProvider');
  }
  return ctx;
}
