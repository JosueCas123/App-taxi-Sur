import { useQueryClient } from '@tanstack/react-query';
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
import { AppState, type AppStateStatus } from 'react-native';

import { esErrorApi } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-client';
import { useSession } from '../auth/session-context';

const MENSAJE_ERROR_ACTUALIZACION =
  'No pudimos actualizar tu cuenta. Revisa tu conexión e inténtalo de nuevo.';

type RefrescoPerfilContextValue = {
  refrescando: boolean;
  error: string | null;
  refrescar: () => Promise<void>;
  limpiarError: () => void;
};

const RefrescoPerfilContext = createContext<RefrescoPerfilContextValue | null>(null);

function mensajeDeError(fallo: unknown): string {
  if (esErrorApi(fallo) && fallo.message) {
    return fallo.message;
  }
  return MENSAJE_ERROR_ACTUALIZACION;
}

export function RefrescoPerfilProvider({ children }: { children: ReactNode }) {
  const { status, conductorId, actualizarPerfil } = useSession();
  const queryClient = useQueryClient();
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const montadoRef = useRef(true);
  const solicitudRef = useRef(0);
  const estadoAppRef = useRef<AppStateStatus>(AppState.currentState);

  const refrescar = useCallback(async () => {
    if (!montadoRef.current || status !== 'autenticado') {
      return;
    }
    const solicitud = ++solicitudRef.current;
    setRefrescando(true);
    setError(null);
    try {
      await actualizarPerfil();
      if (!montadoRef.current || solicitud !== solicitudRef.current) return;
    } catch (fallo) {
      if (!montadoRef.current || solicitud !== solicitudRef.current) return;
      setError(mensajeDeError(fallo));
    } finally {
      if (montadoRef.current && solicitud === solicitudRef.current) {
        setRefrescando(false);
      }
    }
  }, [actualizarPerfil, status]);

  const refrescarRef = useRef(refrescar);
  useEffect(() => {
    refrescarRef.current = refrescar;
  }, [refrescar]);

  useEffect(() => {
    montadoRef.current = true;
    const suscripcion = AppState.addEventListener('change', (siguiente: AppStateStatus) => {
      const anterior = estadoAppRef.current;
      estadoAppRef.current = siguiente;
      if (siguiente === 'active' && anterior !== 'active') {
        void refrescarRef.current();
      }
    });
    return () => {
      montadoRef.current = false;
      suscripcion.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (conductorId) {
        void queryClient.cancelQueries({ queryKey: queryKeys.conductor(conductorId) });
      }
    };
  }, [conductorId, queryClient]);

  const limpiarError = useCallback(() => setError(null), []);

  const value = useMemo<RefrescoPerfilContextValue>(
    () => ({ refrescando, error, refrescar, limpiarError }),
    [error, limpiarError, refrescar, refrescando]
  );

  return <RefrescoPerfilContext.Provider value={value}>{children}</RefrescoPerfilContext.Provider>;
}

export function useRefrescoPerfil() {
  const ctx = useContext(RefrescoPerfilContext);
  if (!ctx) {
    throw new Error('useRefrescoPerfil debe usarse dentro de RefrescoPerfilProvider');
  }
  return ctx;
}
