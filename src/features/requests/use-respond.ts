import { useCallback, useRef, useState } from 'react';

import { responderSolicitud } from './api';

export type AccionRespuesta = 'aceptar' | 'rechazar';

export type UseResponderResult = {
  respondiendo: AccionRespuesta | null;
  aceptar: () => void;
  rechazar: () => void;
  error: string | null;
  conflicto: boolean;
  limpiarMensajes: () => void;
};

type Entrada = {
  solicitudId: string | null;
  token: string | null;
  reconciliar: () => Promise<void>;
  ahoraMs?: () => number;
};

export function useResponderSolicitud(entrada: Entrada): UseResponderResult {
  const { solicitudId, token, reconciliar } = entrada;
  const [respondiendo, setRespondiendo] = useState<AccionRespuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState(false);

  // Bloqueo síncrono de doble pulsación: una única petición en vuelo.
  const enVueloRef = useRef(false);

  const responder = useCallback(
    (acepta: boolean) => {
      if (enVueloRef.current) {
        return;
      }
      if (!solicitudId || !token) {
        return;
      }

      enVueloRef.current = true;
      setRespondiendo(acepta ? 'aceptar' : 'rechazar');
      setError(null);
      setConflicto(false);

      responderSolicitud(solicitudId, token, acepta)
        .then(() => {
          // Éxito: reconciliar una vez; la navegación la resuelve el guard.
          return reconciliar();
        })
        .catch((err: unknown) => {
          const status =
            typeof err === 'object' && err !== null && 'status' in err
              ? (err as { status?: number }).status
              : undefined;
          const backendCode =
            typeof err === 'object' && err !== null && 'backendCode' in err
              ? (err as { backendCode?: string }).backendCode
              : undefined;

          // 409 ESTADO_INVALIDO: conflicto o vencimiento. Nunca se convierte
          // en aceptación. Reconciliar una vez, sin reintento.
          if (status === 409 || backendCode === 'ESTADO_INVALIDO') {
            setConflicto(true);
          } else {
            const mensaje =
              typeof err === 'object' && err !== null && 'message' in err
                ? String((err as { message: string }).message)
                : 'Error inesperado';
            setError(mensaje);
          }

          // Timeout, 409 o cualquier fallo: reconciliar una sola vez, sin
          // reintento automático y sin asumir aceptación.
          return reconciliar();
        })
        .finally(() => {
          enVueloRef.current = false;
          setRespondiendo(null);
        });
    },
    [solicitudId, token, reconciliar]
  );

  const aceptar = useCallback(() => responder(true), [responder]);
  const rechazar = useCallback(() => responder(false), [responder]);

  const limpiarMensajes = useCallback(() => {
    setError(null);
    setConflicto(false);
  }, []);

  return {
    respondiendo,
    aceptar,
    rechazar,
    error,
    conflicto,
    limpiarMensajes,
  };
}
