import { describe, expect, it, jest } from '@jest/globals';

import {
  abrirConexionSse,
  extraerMarcosSse,
  type EventoConductor,
  type MotivoFin,
} from '../sse-transport';

function evento(parcial: Partial<EventoConductor> = {}): EventoConductor {
  return {
    tipo: 'actualizado',
    conductorId: 'c1',
    estadoJornada: 'activa',
    estadoDisponibilidad: 'solicitud_pendiente',
    fecha: '2026-01-01T00:00:00.000Z',
    ...parcial,
  };
}

function marco(dato: EventoConductor, tipo = dato.tipo): string {
  return `event: ${tipo}\ndata: ${JSON.stringify(dato)}\n\n`;
}

const flush = () => new Promise<void>((resolver) => setTimeout(resolver, 0));

type Resultado = {
  motivo: MotivoFin;
  detalle?: { status?: number };
  eventos: EventoConductor[];
  aperturas: number;
};

function crearLector(chunks: (string | Uint8Array)[]) {
  let indice = 0;
  const estado = { leido: false };
  const lector = {
    read: async (): Promise<{ done: boolean; value: Uint8Array | undefined }> => {
      if (indice >= chunks.length) return { done: true, value: undefined };
      estado.leido = true;
      const chunk = chunks[indice++];
      const value = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
      return { done: false, value };
    },
    cancel: async () => {
      indice = chunks.length;
    },
  };
  return { lector, estado };
}

function respuestaSse(
  opciones: {
    status?: number;
    tipo?: string | null;
    chunks?: (string | Uint8Array)[];
    cuerpo?: boolean;
  } = {}
) {
  const {
    status = 200,
    tipo = 'text/event-stream; charset=utf-8',
    chunks = [],
    cuerpo = true,
  } = opciones;
  const { lector, estado } = crearLector(chunks);
  const respuesta = {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (nombre: string) => (nombre.toLowerCase() === 'content-type' ? tipo : null),
    },
    body: cuerpo
      ? { getReader: () => lector, cancel: async () => undefined }
      : null,
  };
  return { respuesta: respuesta as unknown as Response, estado };
}

function iniciar(opciones: {
  conductorId: string;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
  token?: string;
}) {
  let resolver!: (resultado: Resultado) => void;
  const promesa = new Promise<Resultado>((res) => {
    resolver = res;
  });
  const eventos: EventoConductor[] = [];
  let aperturas = 0;
  const conexion = abrirConexionSse({
    url: 'http://backend/api/conductores/c1/eventos',
    token: opciones.token ?? 'token-123',
    conductorId: opciones.conductorId,
    signal: opciones.signal ?? new AbortController().signal,
    fetchImpl: opciones.fetchImpl,
    onApertura: () => {
      aperturas += 1;
    },
    onEvento: (eventoRecibido) => eventos.push(eventoRecibido),
    onFin: (motivo, detalle) => resolver({ motivo, detalle, eventos, aperturas }),
  });
  return { promesa, conexion };
}

describe('extraerMarcosSse · marcos', () => {
  it('parsea un marco LF con evento y datos', () => {
    const dato = evento();
    const resultado = extraerMarcosSse('', marco(dato));
    expect(resultado.eventos).toEqual([dato]);
    expect(resultado.resto).toBe('');
    expect(resultado.comentarios).toEqual([]);
  });

  it('acepta finales de línea CRLF', () => {
    const dato = evento();
    const crudo = `event: actualizado\r\ndata: ${JSON.stringify(dato)}\r\n\r\n`;
    const resultado = extraerMarcosSse('', crudo);
    expect(resultado.eventos).toEqual([dato]);
    expect(resultado.resto).toBe('');
  });

  it('reconstruye marcos partidos entre chunks', () => {
    const dato = evento();
    const crudo = marco(dato);
    const corte = Math.floor(crudo.length / 2);
    const primero = extraerMarcosSse('', crudo.slice(0, corte));
    expect(primero.eventos).toEqual([]);
    const segundo = extraerMarcosSse(primero.resto, crudo.slice(corte));
    expect(segundo.eventos).toEqual([dato]);
    expect(segundo.resto).toBe('');
  });

  it('no inventa un salto cuando un CRLF se parte entre chunks', () => {
    const dato = evento();
    const crudo = `event: actualizado\r\ndata: ${JSON.stringify(dato)}`;
    const conCr = `${crudo}\r`;
    const primero = extraerMarcosSse('', conCr);
    expect(primero.eventos).toEqual([]);
    expect(primero.resto.endsWith('\r')).toBe(true);
    const segundo = extraerMarcosSse(primero.resto, '\n\r\n');
    expect(segundo.eventos).toEqual([dato]);
  });

  it('une varias líneas data con salto de línea', () => {
    const dato = evento();
    const json = JSON.stringify(dato);
    const corte = json.indexOf('"estadoJornada"');
    const bloque = `data: ${json.slice(0, corte)}\ndata: ${json.slice(corte)}\n\n`;
    const resultado = extraerMarcosSse('', bloque);
    expect(resultado.eventos).toEqual([dato]);
  });

  it('ignora comentarios heartbeat y los expone', () => {
    const resultado = extraerMarcosSse('', ': heartbeat\n\n');
    expect(resultado.eventos).toEqual([]);
    expect(resultado.comentarios).toEqual(['heartbeat']);
  });

  it('expone retry como pista numérica', () => {
    const resultado = extraerMarcosSse('', 'retry: 5000\n\n');
    expect(resultado.retryMs).toBe(5000);
    expect(resultado.eventos).toEqual([]);
  });

  it('descarta data que no es JSON válido o no cumple el contrato', () => {
    expect(extraerMarcosSse('', 'data: no-es-json\n\n').eventos).toEqual([]);
    expect(extraerMarcosSse('', 'data: {}\n\n').eventos).toEqual([]);
    expect(
      extraerMarcosSse('', `data: ${JSON.stringify({ tipo: 'otro' })}\n\n`).eventos
    ).toEqual([]);
  });
});

describe('abrirConexionSse · apertura y cabeceras', () => {
  it('envía Authorization Bearer y Accept text/event-stream', async () => {
    const llamadas: { url: string; init?: RequestInit }[] = [];
    const fetchFalso = jest.fn(async (url: string, init?: RequestInit) => {
      llamadas.push({ url, init });
      return respuestaSse({ chunks: [] }).respuesta;
    }) as unknown as typeof fetch;

    const { promesa } = iniciar({ conductorId: 'c1', fetchImpl: fetchFalso, token: 'abc' });
    const resultado = await promesa;

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toBe('http://backend/api/conductores/c1/eventos');
    const cabeceras = llamadas[0].init?.headers as Record<string, string>;
    expect(cabeceras.Authorization).toBe('Bearer abc');
    expect(cabeceras.Accept).toBe('text/event-stream');
    expect(resultado.motivo).toBe('fin_servidor');
    expect(resultado.aperturas).toBe(1);
  });

  it('entrega eventos propios y descarta los de otro conductor', async () => {
    const propio = evento({ conductorId: 'c1' });
    const ajeno = evento({ conductorId: 'c2' });
    const fetchFalso = jest.fn(async () =>
      respuestaSse({ chunks: [marco(propio) + marco(ajeno)] }).respuesta
    ) as unknown as typeof fetch;

    const { promesa } = iniciar({ conductorId: 'c1', fetchImpl: fetchFalso });
    const resultado = await promesa;

    expect(resultado.eventos).toEqual([propio]);
    expect(resultado.motivo).toBe('fin_servidor');
  });

  it('decodifica un multibyte partido entre chunks sin corromperlo', async () => {
    const conductorId = 'conductor-ñ';
    const dato = evento({ conductorId });
    const bytes = new TextEncoder().encode(marco(dato));
    const indiceMultibyte = bytes.findIndex((byte) => byte >= 0x80);
    expect(indiceMultibyte).toBeGreaterThan(-1);
    const parteA = bytes.slice(0, indiceMultibyte + 1);
    const parteB = bytes.slice(indiceMultibyte + 1);
    const fetchFalso = jest.fn(async () =>
      respuestaSse({ chunks: [parteA, parteB] }).respuesta
    ) as unknown as typeof fetch;

    const { promesa } = iniciar({ conductorId, fetchImpl: fetchFalso });
    const resultado = await promesa;

    expect(resultado.eventos).toEqual([dato]);
    expect(resultado.eventos[0].conductorId).toBe(conductorId);
  });
});

describe('abrirConexionSse · validación antes de leer el cuerpo', () => {
  it('401 y 403 se clasifican como no_autorizado sin leer el cuerpo', async () => {
    for (const status of [401, 403]) {
      const { respuesta, estado } = respuestaSse({ status, chunks: [marco(evento())] });
      const fetchFalso = jest.fn(async () => respuesta) as unknown as typeof fetch;
      const { promesa } = iniciar({ conductorId: 'c1', fetchImpl: fetchFalso });
      const resultado = await promesa;
      expect(resultado.motivo).toBe('no_autorizado');
      expect(resultado.detalle?.status).toBe(status);
      expect(resultado.aperturas).toBe(0);
      expect(estado.leido).toBe(false);
    }
  });

  it('otros 4xx y 5xx se clasifican como error_http sin leer el cuerpo', async () => {
    for (const status of [400, 404, 500, 503]) {
      const { respuesta, estado } = respuestaSse({ status });
      const fetchFalso = jest.fn(async () => respuesta) as unknown as typeof fetch;
      const { promesa } = iniciar({ conductorId: 'c1', fetchImpl: fetchFalso });
      const resultado = await promesa;
      expect(resultado.motivo).toBe('error_http');
      expect(resultado.detalle?.status).toBe(status);
      expect(estado.leido).toBe(false);
    }
  });

  it('un Content-Type distinto no se parsea y cuenta como contenido_invalido', async () => {
    const { respuesta, estado } = respuestaSse({
      tipo: 'application/json',
      chunks: [marco(evento())],
    });
    const fetchFalso = jest.fn(async () => respuesta) as unknown as typeof fetch;
    const { promesa } = iniciar({ conductorId: 'c1', fetchImpl: fetchFalso });
    const resultado = await promesa;

    expect(resultado.motivo).toBe('contenido_invalido');
    expect(resultado.eventos).toEqual([]);
    expect(resultado.aperturas).toBe(0);
    expect(estado.leido).toBe(false);
  });

  it('un cuerpo nulo termina como fin_servidor', async () => {
    const { respuesta } = respuestaSse({ cuerpo: false });
    const fetchFalso = jest.fn(async () => respuesta) as unknown as typeof fetch;
    const { promesa } = iniciar({ conductorId: 'c1', fetchImpl: fetchFalso });
    const resultado = await promesa;
    expect(resultado.motivo).toBe('fin_servidor');
    expect(resultado.aperturas).toBe(0);
  });

  it('un fallo de red se clasifica como error_red', async () => {
    const fetchFalso = jest.fn(async () => {
      throw new Error('sin red');
    }) as unknown as typeof fetch;
    const { promesa } = iniciar({ conductorId: 'c1', fetchImpl: fetchFalso });
    const resultado = await promesa;
    expect(resultado.motivo).toBe('error_red');
  });

  it('un fallo de lectura distinto de AbortError se clasifica como error_red', async () => {
    const respuesta = {
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: {
        getReader: () => ({
          read: async () => {
            throw new Error('lectura rota');
          },
          cancel: async () => undefined,
        }),
        cancel: async () => undefined,
      },
    } as unknown as Response;
    const fetchFalso = jest.fn(async () => respuesta) as unknown as typeof fetch;
    const { promesa } = iniciar({ conductorId: 'c1', fetchImpl: fetchFalso });
    const resultado = await promesa;
    expect(resultado.motivo).toBe('error_red');
    expect(resultado.aperturas).toBe(1);
  });
});

describe('abrirConexionSse · cierre con el mismo controlador', () => {
  it('el abort del signal del llamador termina la lectura como cerrado', async () => {
    const controlador = new AbortController();
    let entregado = false;
    const respuesta = {
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: {
        getReader: () => ({
          read: () =>
            new Promise<{ done: boolean; value: Uint8Array | undefined }>((resolver, rechazar) => {
              if (!entregado) {
                entregado = true;
                resolver({ done: false, value: new TextEncoder().encode(marco(evento())) });
                return;
              }
              const alAbortar = () => {
                const error = new Error('abortado');
                error.name = 'AbortError';
                rechazar(error);
              };
              if (controlador.signal.aborted) {
                alAbortar();
                return;
              }
              controlador.signal.addEventListener('abort', alAbortar, { once: true });
            }),
          cancel: async () => undefined,
        }),
        cancel: async () => undefined,
      },
    } as unknown as Response;
    const fetchFalso = jest.fn(async () => respuesta) as unknown as typeof fetch;

    const { promesa } = iniciar({
      conductorId: 'c1',
      fetchImpl: fetchFalso,
      signal: controlador.signal,
    });
    await flush();
    controlador.abort();
    const resultado = await promesa;

    expect(resultado.motivo).toBe('cerrado');
    expect(resultado.eventos).toHaveLength(1);
  });

  it('cerrar() detiene la lectura y la marca como cerrado', async () => {
    let resolverLectura: ((valor: { done: boolean; value: Uint8Array | undefined }) => void) | null =
      null;
    const respuesta = {
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: {
        getReader: () => ({
          read: () =>
            new Promise<{ done: boolean; value: Uint8Array | undefined }>((resolver) => {
              resolverLectura = resolver;
            }),
          cancel: async () => {
            resolverLectura?.({ done: true, value: undefined });
          },
        }),
        cancel: async () => undefined,
      },
    } as unknown as Response;
    const fetchFalso = jest.fn(async () => respuesta) as unknown as typeof fetch;

    const { promesa, conexion } = iniciar({ conductorId: 'c1', fetchImpl: fetchFalso });
    await flush();
    conexion.cerrar();
    const resultado = await promesa;

    expect(resultado.motivo).toBe('cerrado');
    expect(resultado.aperturas).toBe(1);
  });
});
