import { useEffect, useMemo, useState } from 'react';

export type Vencimiento = {
  tienePlazo: boolean;
  restanteMs: number;
  restanteSegundos: number;
  expirada: boolean;
  urgente: boolean;
};

// server - local, medido al recibir la cabecera Date. 0 si la fecha falta o no
// es un HTTP Date parseable (el contador cae al reloj local).
export function calcularDesfaseMs(
  fechaServidor: string | null,
  ahoraLocalMs: number
): number {
  if (!fechaServidor) {
    return 0;
  }
  const servidorMs = Date.parse(fechaServidor);
  if (Number.isNaN(servidorMs)) {
    return 0;
  }
  return servidorMs - ahoraLocalMs;
}

// Desfase estable de reloj: se recalcula solo cuando cambia la cabecera Date,
// midiendo contra el reloj local de ese momento (recepción). Así
// `ahoraMs() + desfase` avanza con el reloj real en vez de congelarse en el
// instante de la lectura. Mantener el mismo desfase entre pantalla y guard evita
// que la navegación de expiración sea revertida.
export function useDesfaseServidor(
  fechaServidor: string | null | undefined,
  ahoraMs: () => number = Date.now
): number {
  return useMemo(
    () => calcularDesfaseMs(fechaServidor ?? null, ahoraMs()),
    // Se mide una sola vez por cabecera: `ahoraMs` es estable por contrato.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fechaServidor]
  );
}

// Reloj del servidor estimado: reloj local ajustado por el desfase capturado.
// Encapsula la lectura del reloj (impura) para reutilizarla en la navegación.
export function useAhoraServidorMs(
  fechaServidor: string | null | undefined,
  ahoraMs: () => number = Date.now
): number {
  const desfase = useDesfaseServidor(fechaServidor, ahoraMs);
  return ahoraMs() + desfase;
}

// restanteMs = expiraEn - ahoraServidorMs, mínimo 0.
export function restanteMsHasta(expiraEn: string, ahoraServidorMs: number): number {
  const expiraMs = Date.parse(expiraEn);
  if (Number.isNaN(expiraMs)) {
    return 0;
  }
  return Math.max(0, expiraMs - ahoraServidorMs);
}

type Entrada = {
  expiraEn: string | null;
  fechaServidor?: string | null;
  ahoraMs?: () => number;
  intervaloMs?: number;
};

export function useOfferDeadline(entrada: Entrada): Vencimiento {
  const {
    expiraEn,
    fechaServidor,
    ahoraMs = Date.now,
    intervaloMs = 1000,
  } = entrada;

  const tienePlazo = expiraEn !== null;
  const [tick, setTick] = useState(0);
  const desfase = useDesfaseServidor(fechaServidor, ahoraMs);

  useEffect(() => {
    if (!tienePlazo) {
      return;
    }
    const id = setInterval(() => setTick((t) => t + 1), intervaloMs);
    return () => clearInterval(id);
  }, [tienePlazo, intervaloMs]);

  return useMemo<Vencimiento>(() => {
    if (!tienePlazo || !expiraEn) {
      return {
        tienePlazo: false,
        restanteMs: 0,
        restanteSegundos: 0,
        expirada: false,
        urgente: false,
      };
    }

    const ahoraServidor = ahoraMs() + desfase;
    const restanteMs = restanteMsHasta(expiraEn, ahoraServidor);
    const restanteSegundos = Math.ceil(restanteMs / 1000);

    return {
      tienePlazo: true,
      restanteMs,
      restanteSegundos,
      expirada: restanteMs <= 0,
      urgente: restanteSegundos <= 10,
    };
    // `tick` fuerza el recálculo en cada intervalo; no afecta al resultado lógico.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tienePlazo, expiraEn, desfase, ahoraMs, tick]);
}
