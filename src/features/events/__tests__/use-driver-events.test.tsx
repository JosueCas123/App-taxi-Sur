import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import type { ConductorDetalleDto } from '../../auth/api';
import { useSession } from '../../auth/session-context';
import type { SolicitudDetalleDto } from '../../requests/api';
import { backoffMs, useDriverEvents, type UseDriverEventsResult } from '../use-driver-events';

jest.mock('../../../config/runtime', () => ({
  runtimeConfig: { apiUrl: 'https://api.example.test', contactoAyuda: null },
}));

// Registro real de listeners para simular logout/cambio de cuenta sin montar
// el SessionProvider completo.
jest.mock('../../auth/session-context', () => {
  const listeners = new Set<() => void>();
  return {
    useSession: jest.fn(),
    registrarAlInvalidar: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    __dispararInvalidacion: () => {
      for (const listener of [...listeners]) listener();
      listeners.clear();
    },
  };
});

type SesionPrueba = { token: string; conductorId: string; invalidarSesion: jest.Mock };

const useSessionMock = useSession as unknown as jest.Mock;
const { __dispararInvalidacion } = jest.requireMock('../../auth/session-context') as {
  __dispararInvalidacion: () => void;
};

const CONDUCTOR_A = 'conductor-a';
const CODIGO_CONDUCTOR_A = 'a1111111-1111-4111-8111-111111111111';
const CODIGO_CONDUCTOR_B = 'b2222222-2222-4222-8222-222222222222';

function perfil(id: string): ConductorDetalleDto {
  return {
    id,
    usuarioId: `usuario-${id}`,
    telefono: '70000000',
    nombreCompleto: `Conductor ${id}`,
    cedulaIdentidad: '1234567',
    estado: 'aprobado',
    estadoJornada: 'activa',
    estadoDisponibilidad: 'solicitud_pendiente',
    cierreJornadaSolicitado: false,
    creadoEn: '2026-10-01T10:00:00.000Z',
    vehiculo: null,
  };
}

function solicitud(conductorAsignadoId: string): SolicitudDetalleDto {
  return {
    id: `solicitud-${conductorAsignadoId}`,
    pasajeroId: 'pasajero-1',
    conductorAsignadoId,
    estado: 'esperando_respuesta',
    latitudRecogida: -17.78,
    longitudRecogida: -63.18,
    destino: 'Centro',
    puntoRecogidaTexto: 'Plaza',
    expiraEn: '2026-10-15T12:01:00.000Z',
    aceptadaEn: null,
    finalizadaEn: null,
    creadoEn: '2026-10-15T12:00:00.000Z',
    pasajero: { id: 'pasajero-1', nombre: 'Ana' },
    conductorAsignado: null,
    distanciaAproximadaKm: 1,
  };
}

function json(datos: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(datos),
  } as Response;
}

function conductorDeUrl(url: string): string {
  const coincidencia = url.match(/\/api\/conductores\/([^/?]+)/);
  return coincidencia ? decodeURIComponent(coincidencia[1]) : 'desconocido';
}

// Marco SSE válido: el parser exige la forma completa del evento del backend.
function marcosSse(
  tipo: 'conectado' | 'actualizado',
  conductorId = CONDUCTOR_A
): string {
  return `event: ${tipo}\ndata: ${JSON.stringify({
    tipo,
    conductorId,
    estadoJornada: 'activa',
    estadoDisponibilidad: 'disponible',
    fecha: '2026-10-15T12:00:00.000Z',
  })}\n\n`;
}

function datosDeApi(url: string): unknown {
  const id = conductorDeUrl(url);
  return url.includes('solicitud-activa') ? solicitud(id) : perfil(id);
}

// --- API (obtenerConductor + obtenerSolicitudActiva) bajo control manual -----
const pendientes: { url: string; resolvente: (r: Response) => void }[] = [];
let consultasSolicitudActiva = 0;

// Drena microtareas (lectura del stream + cadena de `reconciliar`) en temporizadores reales.
function drenar(): Promise<void> {
  return new Promise<void>((resolver) => setTimeout(resolver, 0));
}

function resolverPendientes(filtro?: (url: string) => boolean): number {
  const elegidos = pendientes.filter((p) => !filtro || filtro(p.url));
  for (let i = pendientes.length - 1; i >= 0; i -= 1) {
    if (elegidos.includes(pendientes[i])) pendientes.splice(i, 1);
  }
  for (const pendiente of elegidos) {
    pendiente.resolvente(json(datosDeApi(pendiente.url)));
  }
  return elegidos.length;
}

function rechazarPendientes(filtro?: (url: string) => boolean): number {
  const elegidos = pendientes.filter((p) => !filtro || filtro(p.url));
  for (let i = pendientes.length - 1; i >= 0; i -= 1) {
    if (elegidos.includes(pendientes[i])) pendientes.splice(i, 1);
  }
  for (const pendiente of elegidos) {
    pendiente.resolvente(json({ error: { code: 'SERVER', message: 'caido' } }, 500));
  }
  return elegidos.length;
}

// --- Servidor SSE falso con control manual -----------------------------------
// Cada conexión tiene su cola: cerrar un stream no puede vaciar ni despertar
// el de la sesión siguiente.
function crearServidorSse() {
  const encoder = new TextEncoder();
  const llamadas: { url: string; cabeceras: Record<string, string> }[] = [];
  let modo: 'ok' | 'red' | 'http' = 'ok';
  let statusHttp = 500;

  type ConexionPrueba = {
    cola: Uint8Array[];
    finDeStream: boolean;
    errorLectura: Error | null;
    despertar: (() => void) | null;
  };

  let actual: ConexionPrueba | null = null;

  function despertarLector(conexion: ConexionPrueba): void {
    const resolver = conexion.despertar;
    conexion.despertar = null;
    resolver?.();
  }

  async function read(conexion: ConexionPrueba): Promise<{ done: boolean; value?: Uint8Array }> {
    for (;;) {
      if (conexion.cola.length > 0) return { done: false, value: conexion.cola.shift() as Uint8Array };
      if (conexion.errorLectura) {
        const error = conexion.errorLectura;
        conexion.errorLectura = null;
        throw error;
      }
      if (conexion.finDeStream) return { done: true, value: undefined };
      await new Promise<void>((resolver) => {
        conexion.despertar = resolver;
      });
    }
  }

  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    llamadas.push({
      url: String(input),
      cabeceras: { ...((init?.headers ?? {}) as Record<string, string>) },
    });
    if (modo === 'red') throw new TypeError('Network request failed');
    if (modo === 'http') {
      return {
        ok: false,
        status: statusHttp,
        headers: { get: () => null },
        body: null,
      } as unknown as Response;
    }
    const conexion: ConexionPrueba = {
      cola: [],
      finDeStream: false,
      errorLectura: null,
      despertar: null,
    };
    actual = conexion;
    const body = {
      getReader: () => ({
        read: () => read(conexion),
        cancel: async () => {
          conexion.finDeStream = true;
          despertarLector(conexion);
        },
      }),
      cancel: async () => {
        conexion.finDeStream = true;
        despertarLector(conexion);
      },
    };
    return {
      ok: true,
      status: 200,
      headers: {
        get: (nombre: string) =>
          nombre.toLowerCase() === 'content-type'
            ? 'text/event-stream; charset=utf-8'
            : null,
      },
      body,
    } as unknown as Response;
  }) as unknown as typeof fetch;

  function conexionActual(): ConexionPrueba {
    if (!actual) throw new Error('sin conexión SSE activa');
    return actual;
  }

  return {
    fetchImpl,
    llamadas,
    caerRed() {
      modo = 'red';
    },
    caerHttp(status: number) {
      modo = 'http';
      statusHttp = status;
    },
    recuperar() {
      modo = 'ok';
    },
    emitir(texto: string) {
      const conexion = conexionActual();
      conexion.cola.push(encoder.encode(texto));
      despertarLector(conexion);
    },
    fin() {
      const conexion = conexionActual();
      conexion.finDeStream = true;
      despertarLector(conexion);
    },
    fallar(error: Error) {
      const conexion = conexionActual();
      conexion.errorLectura = error;
      despertarLector(conexion);
    },
  };
}

type ServidorSse = ReturnType<typeof crearServidorSse>;

function sesion(conductorId: string, invalidarSesion: jest.Mock): SesionPrueba {
  return { token: `token-${conductorId}`, conductorId, invalidarSesion };
}

async function montar(
  servidor: ServidorSse,
  sesionInicial: SesionPrueba
): Promise<{
  result: { current: UseDriverEventsResult };
  rerender: (props: { sesion: SesionPrueba }) => Promise<void>;
}> {
  const envuelto = await renderHook(
    ({ sesion: sesionActual }: { sesion: SesionPrueba }) => {
      useSessionMock.mockReturnValue(sesionActual);
      return useDriverEvents({ fetchImpl: servidor.fetchImpl });
    },
    { initialProps: { sesion: sesionInicial } }
  );
  return { result: envuelto.result as { current: UseDriverEventsResult }, rerender: envuelto.rerender };
}

let invalidar: jest.Mock;
let servidor: ServidorSse;
let appStateListener: ((estado: string) => void) | null;
const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  appStateListener = null;
  invalidar = jest.fn();
  servidor = crearServidorSse();
  pendientes.length = 0;
  consultasSolicitudActiva = 0;

  globalThis.fetch = ((input: unknown) => {
    const url = String(input);
    if (url.includes('solicitud-activa')) consultasSolicitudActiva += 1;
    return new Promise<Response>((resolver) => {
      pendientes.push({ url, resolvente: resolver });
    });
  }) as unknown as typeof fetch;

  jest.spyOn(AppState, 'addEventListener').mockImplementation((_tipo, manejador) => {
    appStateListener = manejador as unknown as (estado: string) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  globalThis.fetch = fetchOriginal;
  appStateListener = null;
});

describe('arranque y snapshot', () => {
  it('abre el stream con Bearer/Accept y recupera la instantánea aunque no llegue ningún evento', async () => {
    const { result } = await montar(servidor, sesion(CONDUCTOR_A, invalidar));

    expect(result.current.reconciliacionInicial).toBe('pendiente');
    expect(servidor.llamadas).toHaveLength(1);
    expect(servidor.llamadas[0].url).toContain(`/api/conductores/${CONDUCTOR_A}/eventos`);
    expect(servidor.llamadas[0].cabeceras.Authorization).toBe('Bearer token-conductor-a');
    expect(servidor.llamadas[0].cabeceras.Accept).toBe('text/event-stream');

    await waitFor(() => expect(result.current.conexion).toBe('conectado'));
    expect(result.current.reconciliando).toBe(true);

    await act(async () => {
      resolverPendientes();
      await drenar();
    });

    expect(result.current.reconciliacionInicial).toBe('completa');
    expect(result.current.solicitudActiva?.id).toBe(`solicitud-${CONDUCTOR_A}`);
    expect(result.current.reconciliando).toBe(false);
  });

  it('deriva servicioConfirmado cuando la solicitud activa es en_servicio propia', async () => {
    const { result } = await montar(servidor, sesion(CONDUCTOR_A, invalidar));

    await act(async () => {
      pendientes.forEach((p) => {
        if (p.url.includes('solicitud-activa')) {
          const datos = solicitud(CONDUCTOR_A);
          datos.estado = 'en_servicio';
          p.resolvente(json(datos));
        } else {
          p.resolvente(json(perfil(CONDUCTOR_A)));
        }
      });
      pendientes.length = 0;
    });

    expect(result.current.servicioConfirmado).toEqual({
      id: `solicitud-${CONDUCTOR_A}`,
      conductorAsignadoId: CONDUCTOR_A,
      estado: 'en_servicio',
    });
    expect(result.current.reconciliacionInicial).toBe('completa');
  });

  it('marca reconciliacionInicial como fallida si la primera lectura falla por red', async () => {
    const { result } = await montar(servidor, sesion(CONDUCTOR_A, invalidar));

    await act(async () => {
      rechazarPendientes();
    });

    expect(result.current.reconciliacionInicial).toBe('fallida');
    expect(result.current.solicitudActiva).toBeNull();
  });
});

describe('eventos como invalidaciones', () => {
  it('el evento conectado vuelve a reconciliar para cubrir la carrera inicial', async () => {
    const { result } = await montar(servidor, sesion(CONDUCTOR_A, invalidar));
    await waitFor(() => expect(result.current.conexion).toBe('conectado'));

    await act(async () => {
      resolverPendientes();
      await drenar();
    });
    expect(result.current.reconciliacionInicial).toBe('completa');
    expect(consultasSolicitudActiva).toBe(1);

    await act(async () => {
      servidor.emitir(marcosSse('conectado'));
      await drenar();
    });

    expect(consultasSolicitudActiva).toBe(2);
    await act(async () => {
      resolverPendientes();
      await drenar();
    });

    expect(result.current.reconciliacionInicial).toBe('completa');
    expect(result.current.solicitudActiva?.id).toBe(`solicitud-${CONDUCTOR_A}`);
  });

  it('agrupa eventos simultáneos en una sola relanzada y mantiene una única conexión', async () => {
    const { result } = await montar(servidor, sesion(CONDUCTOR_A, invalidar));
    await waitFor(() => expect(result.current.conexion).toBe('conectado'));
    expect(servidor.llamadas).toHaveLength(1);
    // La reconciliación de arranque sigue en vuelo.
    expect(consultasSolicitudActiva).toBe(1);

    await act(async () => {
      for (let i = 0; i < 3; i += 1) {
        servidor.emitir(marcosSse('actualizado'));
      }
      await drenar();
    });

    // Mientras hay una lectura en vuelo, los 3 eventos se resumen: no se lanza ninguna nueva.
    expect(servidor.llamadas).toHaveLength(1);
    expect(consultasSolicitudActiva).toBe(1);

    await act(async () => {
      resolverPendientes();
      await drenar();
    });

    // Al terminar la inicial corre UNA sola relanzada agrupada.
    expect(consultasSolicitudActiva).toBe(2);
    expect(pendientes).toHaveLength(2);

    await act(async () => {
      resolverPendientes();
      await drenar();
    });

    expect(consultasSolicitudActiva).toBe(2);
    expect(pendientes).toHaveLength(0);
    expect(servidor.llamadas).toHaveLength(1);
  });

  it('descarta un evento con conductorId distinto al autenticado', async () => {
    const { result } = await montar(servidor, sesion(CONDUCTOR_A, invalidar));
    await waitFor(() => expect(result.current.conexion).toBe('conectado'));
    await act(async () => {
      resolverPendientes();
    });

    await act(async () => {
      servidor.emitir(marcosSse('actualizado', CODIGO_CONDUCTOR_B));
      await drenar();
    });

    expect(pendientes).toHaveLength(0);
    expect(result.current.solicitudActiva?.id).toBe(`solicitud-${CONDUCTOR_A}`);
  });

  it('los comentarios heartbeat no producen reconciliación', async () => {
    const { result } = await montar(servidor, sesion(CONDUCTOR_A, invalidar));
    await waitFor(() => expect(result.current.conexion).toBe('conectado'));
    await act(async () => {
      resolverPendientes();
    });

    await act(async () => {
      servidor.emitir(': heartbeat\n\n');
    });

    expect(pendientes).toHaveLength(0);
    expect(result.current.solicitudActiva).not.toBeNull();
  });
});

describe('clasificación de motivos de fin', () => {
  it('fin de stream, error de red, error_http y contenido inválido reconectan con backoff', async () => {
    jest.useFakeTimers();
    const { result } = await montar(servidor, sesion(CONDUCTOR_A, invalidar));
    await act(async () => {
      resolverPendientes();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current.conexion).toBe('conectado');

    await act(async () => {
      servidor.fin();
    });
    expect(result.current.conexion).toBe('perdida');
    expect(servidor.llamadas).toHaveLength(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(999);
    });
    expect(servidor.llamadas).toHaveLength(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(servidor.llamadas).toHaveLength(2);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current.conexion).toBe('conectado');
  });

  it('un fallo de red acumula espera progresiva acotada a 30 s', async () => {
    jest.useFakeTimers();
    servidor.caerRed();
    const { result } = await montar(servidor, sesion(CONDUCTOR_A, invalidar));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current.conexion).toBe('perdida');
    expect(servidor.llamadas).toHaveLength(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(999);
    });
    expect(servidor.llamadas).toHaveLength(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(servidor.llamadas).toHaveLength(2);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1999);
    });
    expect(servidor.llamadas).toHaveLength(2);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(servidor.llamadas).toHaveLength(3);
  });

  it('un 401 invalida la sesión sin backoff y sin reconectar', async () => {
    jest.useFakeTimers();
    servidor.caerHttp(401);
    const { result } = await montar(servidor, sesion(CONDUCTOR_A, invalidar));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current.conexion).toBe('perdida');
    expect(invalidar).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(60000);
    });
    expect(servidor.llamadas).toHaveLength(1);
  });

  it('el cierre intencional no programa reconexión', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await montarCompleto(servidor, sesion(CONDUCTOR_A, invalidar));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current.conexion).toBe('conectado');

    await act(async () => {
      unmount();
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(120000);
    });
    expect(servidor.llamadas).toHaveLength(1);
  });
});

async function montarCompleto(servidorSse: ServidorSse, sesionInicial: SesionPrueba) {
  const envuelto = await renderHook(
    ({ sesion: sesionActual }: { sesion: SesionPrueba }) => {
      useSessionMock.mockReturnValue(sesionActual);
      return useDriverEvents({ fetchImpl: servidorSse.fetchImpl });
    },
    { initialProps: { sesion: sesionInicial } }
  );
  return {
    result: envuelto.result as { current: UseDriverEventsResult },
    rerender: envuelto.rerender,
    unmount: envuelto.unmount,
  };
}

describe('sesión y generación', () => {
  it('al cambiar de conductor cierra el stream y abre uno nuevo', async () => {
    const { rerender, result } = await montarCompleto(
      servidor,
      sesion(CODIGO_CONDUCTOR_A, invalidar)
    );
    await waitFor(() => expect(result.current.conexion).toBe('conectado'));
    await act(async () => {
      resolverPendientes();
    });
    expect(servidor.llamadas).toHaveLength(1);

    await rerender({ sesion: sesion(CODIGO_CONDUCTOR_B, invalidar) });

    expect(servidor.llamadas).toHaveLength(2);
    expect(servidor.llamadas[1].url).toContain(`/eventos`);
    expect(result.current.reconciliacionInicial).toBe('pendiente');
    expect(result.current.solicitudActiva).toBeNull();

    await act(async () => {
      resolverPendientes();
    });
    expect(result.current.solicitudActiva?.id).toBe(`solicitud-${CODIGO_CONDUCTOR_B}`);
    expect(result.current.reconciliacionInicial).toBe('completa');
  });

  it('una respuesta tardía de la generación anterior no sobrescribe el estado', async () => {
    const { rerender, result } = await montarCompleto(
      servidor,
      sesion(CODIGO_CONDUCTOR_A, invalidar)
    );
    await waitFor(() => expect(result.current.conexion).toBe('conectado'));
    expect(pendientes).toHaveLength(2);

    await rerender({ sesion: sesion(CODIGO_CONDUCTOR_B, invalidar) });
    // La cuenta nueva no duplica llamadas: su reconciliación se encola detrás
    // de la que ya estaba en vuelo para A.
    expect(pendientes).toHaveLength(2);

    await act(async () => {
      resolverPendientes((url) => url.includes(CODIGO_CONDUCTOR_A));
      await drenar();
    });

    // La respuesta de A se descarta y en su lugar corre la relanzada de B.
    expect(result.current.reconciliacionInicial).toBe('pendiente');
    expect(result.current.solicitudActiva).toBeNull();
    expect(pendientes).toHaveLength(2);

    await act(async () => {
      resolverPendientes((url) => url.includes(CODIGO_CONDUCTOR_B));
      await drenar();
    });

    expect(result.current.reconciliacionInicial).toBe('completa');
    expect(result.current.solicitudActiva?.id).toBe(`solicitud-${CODIGO_CONDUCTOR_B}`);
  });

  it('el logout invalida la sesión y cierra el stream sin reconectar', async () => {
    jest.useFakeTimers();
    const { result } = await montarCompleto(servidor, sesion(CONDUCTOR_A, invalidar));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current.conexion).toBe('conectado');

    await act(async () => {
      __dispararInvalidacion();
    });

    expect(servidor.llamadas).toHaveLength(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60000);
    });
    expect(servidor.llamadas).toHaveLength(1);
  });
});

describe('AppState', () => {
  it('al volver a primer plano reconcilia el estado', async () => {
    const { result } = await montar(servidor, sesion(CONDUCTOR_A, invalidar));
    await waitFor(() => expect(result.current.conexion).toBe('conectado'));
    await act(async () => {
      resolverPendientes();
      await drenar();
    });
    expect(pendientes).toHaveLength(0);

    await act(async () => {
      appStateListener?.('active');
      await drenar();
    });

    expect(pendientes).toHaveLength(2);
    await act(async () => {
      resolverPendientes();
      await drenar();
    });
    expect(result.current.reconciliacionInicial).toBe('completa');
  });
});

describe('backoffMs', () => {
  it('duplica desde 1 s y se acota a 30 s', () => {
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(2)).toBe(2000);
    expect(backoffMs(3)).toBe(4000);
    expect(backoffMs(5)).toBe(16000);
    expect(backoffMs(6)).toBe(30000);
    expect(backoffMs(50)).toBe(30000);
  });

  it('acota la pista del servidor a [1000, 30000] y nunca reduce el cálculo', () => {
    expect(backoffMs(1, 5000)).toBe(5000);
    expect(backoffMs(1, 100)).toBe(1000);
    expect(backoffMs(1, 999999)).toBe(30000);
    expect(backoffMs(4, 5000)).toBe(8000);
    expect(backoffMs(1, null)).toBe(1000);
  });
});
