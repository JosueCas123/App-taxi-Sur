import { useCallback, useEffect, useRef, useState } from 'react';

import { esErrorApi } from '../../lib/api-client';
import {
  finalizarSolicitud,
  type SolicitudDetalleDto,
  type SolicitudDto,
} from '../requests/api';
import { resolverResultadoFinalizacion } from './finalizacion';

export type FaseFinalizacion =
  | 'en_servicio'
  | 'finalizando'
  | 'verificando'
  | 'sigue_en_servicio'
  | 'no_verificable'
  | 'confirmada';

export type UseFinalizarServicioResult = {
  fase: FaseFinalizacion;
  finalizando: boolean;
  verificando: boolean;
  finalizar: () => void;
  reintentarVerificacion: () => void;
};

type Entrada = {
  solicitudId: string | null;
  token: string | null;
  conductorId: string | null;
  obtenerDetalle: (solicitudId: string, token: string) => Promise<SolicitudDetalleDto>;
  reconciliar: () => Promise<void>;
  marcarServicioFinalizado: (solicitudId: string) => void;
  marcarServicioEnVerificacion: (solicitudId: string) => void;
  limpiarServicioEnVerificacion: () => void;
  invalidarSesion: () => Promise<void>;
};

type SesionIntentada = {
  solicitudId: string;
  conductorId: string;
};

export function useFinalizarServicio(entrada: Entrada): UseFinalizarServicioResult {
  const {
    solicitudId,
    token,
    conductorId,
    obtenerDetalle,
    reconciliar,
    marcarServicioFinalizado,
    marcarServicioEnVerificacion,
    limpiarServicioEnVerificacion,
    invalidarSesion,
  } = entrada;

  const [fase, setFase] = useState<FaseFinalizacion>('en_servicio');

  // Bloqueo síncrono: una única petición/verificación en vuelo.
  const enVueloRef = useRef(false);
  const montadoRef = useRef(true);
  // Sesión vigente en cada render: una respuesta tardía de otra sesión no
  // confirma ni marca nada.
  const sesionRef = useRef<{ solicitudId: string | null; conductorId: string | null }>({
    solicitudId,
    conductorId,
  });

  useEffect(() => {
    sesionRef.current = { solicitudId, conductorId };
  }, [solicitudId, conductorId]);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const vigente = useCallback((intentada: SesionIntentada): boolean => {
    return (
      montadoRef.current &&
      sesionRef.current.solicitudId === intentada.solicitudId &&
      sesionRef.current.conductorId === intentada.conductorId
    );
  }, []);

  // El resultado ya decidido no se revierte si falla el refresco de perfil y
  // solicitud activa; la pantalla de éxito no se bloquea.
  const reconciliarSinRevertir = useCallback(async () => {
    try {
      await reconciliar();
    } catch {
      // El llamador ya fijó la fase con la evidencia del detalle propio.
    }
  }, [reconciliar]);

  const verificar = useCallback(
    async (
      intentada: SesionIntentada,
      tokenActual: string
    ): Promise<void> => {
      let detalle: SolicitudDetalleDto | null = null;
      try {
        detalle = await obtenerDetalle(intentada.solicitudId, tokenActual);
      } catch (error) {
        if (!vigente(intentada)) return;
        if (esErrorApi(error) && error.code === 'UNAUTHORIZED') {
          await invalidarSesion();
          if (vigente(intentada)) setFase('en_servicio');
          return;
        }
        detalle = null;
      }

      if (!vigente(intentada)) return;

      const resultado = resolverResultadoFinalizacion({
        solicitudId: intentada.solicitudId,
        conductorId: intentada.conductorId,
        respuesta: null,
        detalle,
      });

      if (resultado.tipo === 'confirmada') {
        marcarServicioFinalizado(intentada.solicitudId);
        setFase('confirmada');
      } else if (resultado.tipo === 'sigue_en_servicio') {
        limpiarServicioEnVerificacion();
        setFase('sigue_en_servicio');
      } else {
        setFase('no_verificable');
      }

      await reconciliarSinRevertir();
    },
    [
      obtenerDetalle,
      invalidarSesion,
      vigente,
      marcarServicioFinalizado,
      limpiarServicioEnVerificacion,
      reconciliarSinRevertir,
    ]
  );

  const finalizar = useCallback(() => {
    if (enVueloRef.current) return;
    if (fase !== 'en_servicio' && fase !== 'sigue_en_servicio') return;

    const solicitudActual = solicitudId;
    const tokenActual = token;
    const conductorActual = conductorId;
    if (!solicitudActual || !tokenActual || !conductorActual) return;

    const intentada: SesionIntentada = {
      solicitudId: solicitudActual,
      conductorId: conductorActual,
    };

    enVueloRef.current = true;
    setFase('finalizando');

    void (async () => {
      try {
        let respuesta: SolicitudDto | null = null;
        try {
          respuesta = await finalizarSolicitud(solicitudActual, tokenActual);
        } catch (error) {
          if (!vigente(intentada)) return;
          if (esErrorApi(error) && error.code === 'UNAUTHORIZED') {
            await invalidarSesion();
            if (vigente(intentada)) setFase('en_servicio');
            return;
          }
          // 409, timeout, 5xx, red o respuesta inesperada: nunca es éxito por
          // sí solo. Se verifica por UUID antes de decidir.
          marcarServicioEnVerificacion(solicitudActual);
          setFase('verificando');
          await verificar(intentada, tokenActual);
          return;
        }

        if (!vigente(intentada)) return;

        const resultado = resolverResultadoFinalizacion({
          solicitudId: solicitudActual,
          conductorId: conductorActual,
          respuesta,
          detalle: null,
        });

        if (resultado.tipo === 'confirmada') {
          marcarServicioFinalizado(solicitudActual);
          setFase('confirmada');
          await reconciliarSinRevertir();
          return;
        }

        // Un 200 ajeno o con estado inesperado tampoco confirma: se verifica.
        marcarServicioEnVerificacion(solicitudActual);
        setFase('verificando');
        await verificar(intentada, tokenActual);
      } finally {
        enVueloRef.current = false;
      }
    })();
  }, [
    fase,
    solicitudId,
    token,
    conductorId,
    vigente,
    invalidarSesion,
    marcarServicioEnVerificacion,
    marcarServicioFinalizado,
    reconciliarSinRevertir,
    verificar,
  ]);

  const reintentarVerificacion = useCallback(() => {
    if (enVueloRef.current || fase !== 'no_verificable') return;

    const solicitudActual = solicitudId;
    const tokenActual = token;
    const conductorActual = conductorId;
    if (!solicitudActual || !tokenActual || !conductorActual) return;

    const intentada: SesionIntentada = {
      solicitudId: solicitudActual,
      conductorId: conductorActual,
    };

    enVueloRef.current = true;
    setFase('verificando');

    void (async () => {
      try {
        await verificar(intentada, tokenActual);
      } finally {
        enVueloRef.current = false;
      }
    })();
  }, [fase, solicitudId, token, conductorId, verificar]);

  return {
    fase,
    finalizando: fase === 'finalizando',
    verificando: fase === 'verificando',
    finalizar,
    reintentarVerificacion,
  };
}
