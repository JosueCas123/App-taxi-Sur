import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { mensajeDeErrorApi } from '../../lib/api-errors';
import { esErrorApi } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-client';
import { useSession } from '../auth/session-context';
import type { ConductorDetalleDto } from '../auth/api';
import { cambiarDisponibilidad, finalizarJornada, iniciarJornada } from './api';
import { puedeActivarDisponibilidad, type MotivoDisponibilidadBloqueada } from './jornada-policy';
import { useReconciliacionOferta } from './reconciliacion-oferta';
import { useUbicacionOperativa, type EstadoUbicacionOperativa } from './ubicacion-operativa';

type GrupoMutacion = 'jornada' | 'disponibilidad';

const MENSAJE_ERROR_GENERICO = 'No pudimos completar la acción. Inténtalo de nuevo';
const MENSAJE_CONFLICTO =
  'El servidor rechazó la acción porque el estado cambió. Actualizamos tu información';
const MENSAJE_NO_SINCRONIZADO =
  'No pudimos sincronizar tu información. Reintenta para continuar';

export type UseShiftResult = {
  conductor: ConductorDetalleDto | null;
  ubicacion: EstadoUbicacionOperativa;
  disponibilidad: { permitido: boolean; motivo: MotivoDisponibilidadBloqueada | null };
  iniciarJornada: () => void;
  finalizarJornada: () => void;
  activarDisponibilidad: () => void;
  desactivarDisponibilidad: () => void;
  mutando: GrupoMutacion | null;
  error: string | null;
  conflicto: string | null;
  noConfirmado: boolean;
  refrescando: boolean;
  refrescar: () => void;
  reintentarSincronizacion: () => void;
  limpiarMensajes: () => void;
};

export function useShift(): UseShiftResult {
  const { token, conductorId, conductor, actualizarPerfil } = useSession();
  const ubicacion = useUbicacionOperativa();
  const reconciliar = useReconciliacionOferta();
  const queryClient = useQueryClient();

  const [mutando, setMutando] = useState<GrupoMutacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState<string | null>(null);
  const [noConfirmado, setNoConfirmado] = useState(false);
  const [refrescando, setRefrescando] = useState(false);

  const montadoRef = useRef(true);
  const enVueloRef = useRef<GrupoMutacion | null>(null);
  const noConfirmadoRef = useRef(false);
  const tokenRef = useRef(token);
  const conductorIdRef = useRef(conductorId);
  const reconciliarRef = useRef(reconciliar);

  useEffect(() => {
    tokenRef.current = token;
    conductorIdRef.current = conductorId;
    reconciliarRef.current = reconciliar;
  }, [token, conductorId, reconciliar]);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const esVigente = useCallback(
    (tokenCapturado: string, idCapturado: string) =>
      montadoRef.current &&
      tokenRef.current === tokenCapturado &&
      conductorIdRef.current === idCapturado,
    []
  );

  const marcarNoConfirmado = useCallback((valor: boolean) => {
    noConfirmadoRef.current = valor;
    setNoConfirmado(valor);
  }, []);

  // En 409: la costura de M05 recupera perfil y solicitud activa en una sola
  // pasada; no se dispara un `actualizarPerfil` separado (evita doble consulta).
  const manejarConflicto = useCallback(
    async (idCapturado: string, tokenCapturado: string) => {
      marcarNoConfirmado(true);
      try {
        await reconciliarRef.current();
      } catch {
        if (!esVigente(tokenCapturado, idCapturado)) return;
        setError(MENSAJE_NO_SINCRONIZADO);
        return;
      }
      if (!esVigente(tokenCapturado, idCapturado)) return;
      marcarNoConfirmado(false);
    },
    [esVigente, marcarNoConfirmado]
  );

  const ejecutar = useCallback(
    async (
      grupo: GrupoMutacion,
      peticion: (id: string, token: string) => Promise<ConductorDetalleDto>
    ) => {
      // Bloqueo síncrono de doble pulsación: el control afectado queda en vuelo.
      if (enVueloRef.current !== null || noConfirmadoRef.current) return;
      const tokenActual = tokenRef.current;
      const idActual = conductorIdRef.current;
      if (!tokenActual || !idActual) return;

      enVueloRef.current = grupo;
      setMutando(grupo);
      setError(null);
      setConflicto(null);
      try {
        const perfil = await peticion(idActual, tokenActual);
        // Una respuesta de otra generación de sesión no reemplaza el perfil actual.
        if (!esVigente(tokenActual, idActual)) return;
        queryClient.setQueryData(queryKeys.conductor(idActual), perfil);
      } catch (fallo) {
        if (!esVigente(tokenActual, idActual)) return;
        if (esErrorApi(fallo) && fallo.code === 'CONFLICT') {
          setConflicto(MENSAJE_CONFLICTO);
          await manejarConflicto(idActual, tokenActual);
        } else {
          setError(mensajeDeErrorApi(fallo, MENSAJE_ERROR_GENERICO));
        }
      } finally {
        if (montadoRef.current) {
          enVueloRef.current = null;
          setMutando(null);
        }
      }
    },
    [esVigente, manejarConflicto, queryClient]
  );

  const iniciarJornadaAccion = useCallback(() => {
    void ejecutar('jornada', (id, token) => iniciarJornada(id, token));
  }, [ejecutar]);

  const finalizarJornadaAccion = useCallback(() => {
    void ejecutar('jornada', (id, token) => finalizarJornada(id, token));
  }, [ejecutar]);

  const activarDisponibilidad = useCallback(() => {
    void ejecutar('disponibilidad', (id, token) => cambiarDisponibilidad(id, token, true));
  }, [ejecutar]);

  const desactivarDisponibilidad = useCallback(() => {
    void ejecutar('disponibilidad', (id, token) => cambiarDisponibilidad(id, token, false));
  }, [ejecutar]);

  const reintentarSincronizacion = useCallback(() => {
    void (async () => {
      const tokenActual = tokenRef.current;
      const idActual = conductorIdRef.current;
      if (!tokenActual || !idActual) return;
      setError(null);
      try {
        await actualizarPerfil();
      } catch {
        if (!esVigente(tokenActual, idActual)) return;
        marcarNoConfirmado(true);
        setError(MENSAJE_NO_SINCRONIZADO);
        return;
      }
      if (!esVigente(tokenActual, idActual)) return;
      marcarNoConfirmado(false);
    })();
  }, [actualizarPerfil, esVigente, marcarNoConfirmado]);

  const limpiarMensajes = useCallback(() => {
    setError(null);
    setConflicto(null);
  }, []);

  // Pull-to-refresh: reutiliza la misma petición del perfil sin inventar estado.
  const refrescar = useCallback(() => {
    void (async () => {
      const tokenActual = tokenRef.current;
      const idActual = conductorIdRef.current;
      if (!tokenActual || !idActual) return;
      setRefrescando(true);
      setError(null);
      try {
        await actualizarPerfil();
      } catch {
        if (!esVigente(tokenActual, idActual)) return;
        setError(MENSAJE_NO_SINCRONIZADO);
      } finally {
        if (montadoRef.current) {
          setRefrescando(false);
        }
      }
    })();
  }, [actualizarPerfil, esVigente]);

  const disponibilidad = useMemo<UseShiftResult['disponibilidad']>(() => {
    if (!conductor) {
      return { permitido: false, motivo: 'cuenta_no_aprobada' };
    }
    return puedeActivarDisponibilidad({
      estadoCuenta: conductor.estado,
      estadoJornada: conductor.estadoJornada,
      estadoDisponibilidad: conductor.estadoDisponibilidad,
      ubicacion,
    });
  }, [conductor, ubicacion]);

  return useMemo<UseShiftResult>(
    () => ({
      conductor,
      ubicacion,
      disponibilidad,
      iniciarJornada: iniciarJornadaAccion,
      finalizarJornada: finalizarJornadaAccion,
      activarDisponibilidad,
      desactivarDisponibilidad,
      mutando,
      error,
      conflicto,
      noConfirmado,
      refrescando,
      refrescar,
      reintentarSincronizacion,
      limpiarMensajes,
    }),
    [
      conductor,
      ubicacion,
      disponibilidad,
      iniciarJornadaAccion,
      finalizarJornadaAccion,
      activarDisponibilidad,
      desactivarDisponibilidad,
      mutando,
      error,
      conflicto,
      noConfirmado,
      refrescando,
      refrescar,
      reintentarSincronizacion,
      limpiarMensajes,
    ]
  );
}
