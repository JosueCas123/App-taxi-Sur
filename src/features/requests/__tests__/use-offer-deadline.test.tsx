import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import {
  calcularDesfaseMs,
  restanteMsHasta,
  useDesfaseServidor,
  useOfferDeadline,
  type Vencimiento,
} from '../use-offer-deadline';

describe('calcularDesfaseMs', () => {
  it('devuelve 0 si la fecha es null', () => {
    expect(calcularDesfaseMs(null, 1_000_000)).toBe(0);
  });

  it('devuelve 0 si la fecha no es parseable', () => {
    expect(calcularDesfaseMs('no-es-fecha', 1_000_000)).toBe(0);
  });

  it('devuelve server - local con cabecera HTTP Date válida', () => {
    // 2026-10-15T12:00:00Z
    const fecha = 'Wed, 15 Oct 2026 12:00:00 GMT';
    const local = Date.parse('2026-10-15T11:59:50.000Z'); // 10 s por detrás
    expect(calcularDesfaseMs(fecha, local)).toBe(10_000);
  });
});

describe('restanteMsHasta', () => {
  it('devuelve la diferencia positiva', () => {
    const ahora = Date.parse('2026-10-15T12:00:00.000Z');
    const expira = '2026-10-15T12:00:30.000Z';
    expect(restanteMsHasta(expira, ahora)).toBe(30_000);
  });

  it('devuelve 0 si ya venció', () => {
    const ahora = Date.parse('2026-10-15T12:00:30.000Z');
    const expira = '2026-10-15T12:00:00.000Z';
    expect(restanteMsHasta(expira, ahora)).toBe(0);
  });

  it('devuelve 0 si expiraEn no es parseable', () => {
    expect(restanteMsHasta('no-es-fecha', Date.now())).toBe(0);
  });
});

describe('useOfferDeadline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function ahoraFijo(ms: number): () => number {
    return () => ms;
  }

  it('expiraEn null → tienePlazo false, sin expirar, acciones activas', async () => {
    const { result } = await renderHook(() =>
      useOfferDeadline({ expiraEn: null, ahoraMs: ahoraFijo(Date.now()) })
    );
    const v: Vencimiento = result.current;
    expect(v.tienePlazo).toBe(false);
    expect(v.restanteMs).toBe(0);
    expect(v.restanteSegundos).toBe(0);
    expect(v.expirada).toBe(false);
    expect(v.urgente).toBe(false);
  });

  it('reabrir a mitad de ventana muestra solo el tiempo restante (no reinicia 60 s)', async () => {
    const ahora = Date.parse('2026-10-15T12:00:00.000Z');
    const expiraEn = '2026-10-15T12:01:00.000Z'; // 60 s de ventana
    const ahoraMediaventana = ahora + 30_000; // quedan 30 s
    const { result } = await renderHook(() =>
      useOfferDeadline({ expiraEn, ahoraMs: ahoraFijo(ahoraMediaventana) })
    );
    expect(result.current.restanteSegundos).toBe(30);
    expect(result.current.expirada).toBe(false);
  });

  it('urgente cuando restanteSegundos <= 10', async () => {
    const ahora = Date.parse('2026-10-15T12:00:00.000Z');
    const expiraEn = '2026-10-15T12:00:08.000Z'; // 8 s
    const { result } = await renderHook(() =>
      useOfferDeadline({ expiraEn, ahoraMs: ahoraFijo(ahora) })
    );
    expect(result.current.urgente).toBe(true);
    expect(result.current.restanteSegundos).toBe(8);
  });

  it('no urgente cuando restanteSegundos > 10', async () => {
    const ahora = Date.parse('2026-10-15T12:00:00.000Z');
    const expiraEn = '2026-10-15T12:00:20.000Z'; // 20 s
    const { result } = await renderHook(() =>
      useOfferDeadline({ expiraEn, ahoraMs: ahoraFijo(ahora) })
    );
    expect(result.current.urgente).toBe(false);
  });

  it('expirada cuando restanteMs <= 0', async () => {
    const ahora = Date.parse('2026-10-15T12:00:10.000Z');
    const expiraEn = '2026-10-15T12:00:00.000Z';
    const { result } = await renderHook(() =>
      useOfferDeadline({ expiraEn, ahoraMs: ahoraFijo(ahora) })
    );
    expect(result.current.expirada).toBe(true);
    expect(result.current.restanteSegundos).toBe(0);
  });

  it('reloj adelantado (local 10 s por delante): el contador se ajusta con desfase -10 s', async () => {
    const ahoraLocal = Date.parse('2026-10-15T12:00:10.000Z');
    const fechaServidor = 'Wed, 15 Oct 2026 12:00:00 GMT'; // servidor 10 s por detrás del local
    const expiraEn = '2026-10-15T12:00:50.000Z';
    // sin desfase: quedarían 40 s de local; con desfase -10 s de servidor, quedan 50 s
    const { result } = await renderHook(() =>
      useOfferDeadline({ expiraEn, fechaServidor, ahoraMs: ahoraFijo(ahoraLocal) })
    );
    expect(result.current.restanteSegundos).toBe(50);
  });

  it('reloj atrasado (local 10 s por detrás): el contador se ajusta con desfase +10 s', async () => {
    const ahoraLocal = Date.parse('2026-10-15T11:59:50.000Z');
    const fechaServidor = 'Wed, 15 Oct 2026 12:00:00 GMT'; // servidor 10 s por delante del local
    const expiraEn = '2026-10-15T12:00:50.000Z';
    // sin desfase: quedarían 60 s; con desfase +10 s de servidor, quedan 50 s
    const { result } = await renderHook(() =>
      useOfferDeadline({ expiraEn, fechaServidor, ahoraMs: ahoraFijo(ahoraLocal) })
    );
    expect(result.current.restanteSegundos).toBe(50);
  });

  it('fecha inválida → desfase 0, usa reloj local', async () => {
    const ahoraLocal = Date.parse('2026-10-15T12:00:00.000Z');
    const expiraEn = '2026-10-15T12:00:30.000Z';
    const { result } = await renderHook(() =>
      useOfferDeadline({
        expiraEn,
        fechaServidor: 'no-es-fecha',
        ahoraMs: ahoraFijo(ahoraLocal),
      })
    );
    expect(result.current.restanteSegundos).toBe(30);
  });

  it('fecha ausente → desfase 0, usa reloj local', async () => {
    const ahoraLocal = Date.parse('2026-10-15T12:00:00.000Z');
    const expiraEn = '2026-10-15T12:00:45.000Z';
    const { result } = await renderHook(() =>
      useOfferDeadline({ expiraEn, ahoraMs: ahoraFijo(ahoraLocal) })
    );
    expect(result.current.restanteSegundos).toBe(45);
  });

  it('con un reloj que avanza el contador decrece (el desfase no lo congela)', async () => {
    let ahora = Date.parse('2026-10-15T12:00:00.000Z');
    const fechaServidor = 'Wed, 15 Oct 2026 12:00:10 GMT'; // servidor 10 s por delante
    const expiraEn = '2026-10-15T12:01:00.000Z'; // faltan 50 s en hora del servidor
    const { result } = await renderHook(() =>
      useOfferDeadline({ expiraEn, fechaServidor, ahoraMs: () => ahora, intervaloMs: 1000 })
    );
    expect(result.current.restanteSegundos).toBe(50);

    ahora += 5000;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.restanteSegundos).toBe(45);
  });
});

describe('useDesfaseServidor', () => {
  it('captura el desfase una sola vez por fecha y lo reestima al cambiar la cabecera', async () => {
    let ahora = Date.parse('2026-10-15T12:00:00.000Z');
    const { result, rerender } = await renderHook(
      ({ fecha }: { fecha: string }) => useDesfaseServidor(fecha, () => ahora),
      { initialProps: { fecha: 'Wed, 15 Oct 2026 12:00:10 GMT' } }
    );
    expect(result.current).toBe(10_000);

    ahora += 5000;
    await rerender({ fecha: 'Wed, 15 Oct 2026 12:00:10 GMT' });
    expect(result.current).toBe(10_000);

    await rerender({ fecha: 'Wed, 15 Oct 2026 12:00:20 GMT' });
    expect(result.current).toBe(15_000);
  });

  it('fecha null o inválida deja el desfase en 0', async () => {
    const { result } = await renderHook(() => useDesfaseServidor(null, () => 0));
    expect(result.current).toBe(0);
  });
});
