export type EstadoJornada = 'no_iniciada' | 'activa' | 'finalizada';

export type EstadoDisponibilidad =
  | 'disponible'
  | 'no_disponible'
  | 'solicitud_pendiente'
  | 'en_servicio';

export type EventoConductor = {
  tipo: 'conectado' | 'actualizado';
  conductorId: string;
  estadoJornada: EstadoJornada;
  estadoDisponibilidad: EstadoDisponibilidad;
  fecha: string;
};

export type MotivoFin =
  | 'cerrado'
  | 'fin_servidor'
  | 'error_red'
  | 'error_http'
  | 'no_autorizado'
  | 'contenido_invalido';

export type OpcionesConexion = {
  url: string;
  token: string;
  conductorId: string;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  onEvento: (evento: EventoConductor) => void;
  onApertura?: () => void;
  // Pista `retry:` del servidor, sin acotar: el llamador decide cómo mezclarla
  // con su backoff (la spec exige que nunca reduzca el cálculo).
  onRetry?: (ms: number) => void;
  onFin?: (motivo: MotivoFin, detalle?: { status?: number }) => void;
};

export type ConexionSse = { cerrar: () => void };

export type MarcasSse = {
  eventos: EventoConductor[];
  comentarios: string[];
  retryMs: number | null;
  resto: string;
};

const TIPOS_EVENTO: readonly EventoConductor['tipo'][] = ['conectado', 'actualizado'];

const ESTADOS_JORNADA: readonly EstadoJornada[] = ['no_iniciada', 'activa', 'finalizada'];

const ESTADOS_DISPONIBILIDAD: readonly EstadoDisponibilidad[] = [
  'disponible',
  'no_disponible',
  'solicitud_pendiente',
  'en_servicio',
];

function esTipoEvento(valor: unknown): valor is EventoConductor['tipo'] {
  return typeof valor === 'string' && (TIPOS_EVENTO as readonly string[]).includes(valor);
}

function esEstadoJornada(valor: unknown): valor is EstadoJornada {
  return typeof valor === 'string' && (ESTADOS_JORNADA as readonly string[]).includes(valor);
}

function esEstadoDisponibilidad(valor: unknown): valor is EstadoDisponibilidad {
  return (
    typeof valor === 'string' && (ESTADOS_DISPONIBILIDAD as readonly string[]).includes(valor)
  );
}

// Convierte CRLF y CR sueltos a LF. Si el texto termina en un CR aislado, lo
// conserva para poder combinarlo con un LF del próximo chunk sin inventar un
// salto de línea extra.
function normalizarFinales(texto: string): string {
  if (texto.endsWith('\r')) {
    return `${texto.slice(0, -1).replace(/\r\n?/g, '\n')}\r`;
  }
  return texto.replace(/\r\n?/g, '\n');
}

function interpretarBloque(bloque: string): {
  evento: EventoConductor | null;
  comentarios: string[];
  retryMs: number | null;
} {
  const comentarios: string[] = [];
  const datos: string[] = [];
  let tipoEvento: string | null = null;
  let retryMs: number | null = null;

  for (const linea of bloque.split('\n')) {
    if (linea === '') continue;
    if (linea.startsWith(':')) {
      comentarios.push(linea.slice(1).trim());
      continue;
    }
    const separador = linea.indexOf(':');
    const campo = separador === -1 ? linea : linea.slice(0, separador);
    let valor = separador === -1 ? '' : linea.slice(separador + 1);
    if (valor.startsWith(' ')) valor = valor.slice(1);

    if (campo === 'data') {
      datos.push(valor);
    } else if (campo === 'event') {
      tipoEvento = valor;
    } else if (campo === 'retry') {
      const numero = Number(valor.trim());
      if (Number.isFinite(numero) && numero >= 0) retryMs = numero;
    }
  }

  let evento: EventoConductor | null = null;
  if (datos.length > 0) {
    evento = parsearEvento(datos.join('\n'), tipoEvento);
  }

  return { evento, comentarios, retryMs };
}

function parsearEvento(texto: string, tipoEvento: string | null): EventoConductor | null {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof crudo !== 'object' || crudo === null) return null;

  const datos = crudo as Record<string, unknown>;
  const tipo = datos.tipo ?? tipoEvento;
  if (!esTipoEvento(tipo)) return null;
  if (typeof datos.conductorId !== 'string') return null;
  if (!esEstadoJornada(datos.estadoJornada)) return null;
  if (!esEstadoDisponibilidad(datos.estadoDisponibilidad)) return null;
  if (typeof datos.fecha !== 'string') return null;

  return {
    tipo,
    conductorId: datos.conductorId,
    estadoJornada: datos.estadoJornada,
    estadoDisponibilidad: datos.estadoDisponibilidad,
    fecha: datos.fecha,
  };
}

export function extraerMarcosSse(resto: string, chunk: string): MarcasSse {
  const buffer = normalizarFinales(resto + chunk);
  const corte = buffer.lastIndexOf('\n\n');
  const completos = corte === -1 ? '' : buffer.slice(0, corte);
  const restoFinal = corte === -1 ? buffer : buffer.slice(corte + 2);

  const eventos: EventoConductor[] = [];
  const comentarios: string[] = [];
  let retryMs: number | null = null;

  if (completos) {
    for (const bloque of completos.split('\n\n')) {
      if (bloque === '') continue;
      const resultado = interpretarBloque(bloque);
      if (resultado.evento) eventos.push(resultado.evento);
      comentarios.push(...resultado.comentarios);
      if (resultado.retryMs !== null) retryMs = resultado.retryMs;
    }
  }

  return { eventos, comentarios, retryMs, resto: restoFinal };
}

function esAborto(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function descartarCuerpo(respuesta: Response): void {
  const cuerpo = respuesta.body;
  if (!cuerpo) return;
  void cuerpo.cancel().catch(() => undefined);
}

export function abrirConexionSse(opciones: OpcionesConexion): ConexionSse {
  const { url, token, conductorId, signal, onEvento, onApertura, onFin, onRetry } = opciones;
  const hacerFetch = opciones.fetchImpl ?? fetch;

  let finalizado = false;
  let cerradoPorLlamador = false;
  let cancelarLectura: (() => void) | null = null;
  let resto = '';

  const finalizar = (motivo: MotivoFin, detalle?: { status?: number }): void => {
    if (finalizado) return;
    finalizado = true;
    onFin?.(motivo, detalle);
  };

  const cerrar = (): void => {
    if (finalizado) return;
    cerradoPorLlamador = true;
    cancelarLectura?.();
  };

  const procesar = (texto: string): void => {
    const marcos = extraerMarcosSse(resto, texto);
    resto = marcos.resto;
    if (marcos.retryMs !== null && !finalizado) {
      onRetry?.(marcos.retryMs);
    }
    for (const evento of marcos.eventos) {
      if (evento.conductorId !== conductorId) continue;
      onEvento(evento);
    }
  };

  const ejecutar = async (): Promise<void> => {
    let respuesta: Response;
    try {
      respuesta = await hacerFetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
        },
        signal,
      });
    } catch (error) {
      if (esAborto(error) || signal.aborted || cerradoPorLlamador) {
        finalizar('cerrado');
        return;
      }
      finalizar('error_red');
      return;
    }

    if (cerradoPorLlamador) {
      descartarCuerpo(respuesta);
      finalizar('cerrado');
      return;
    }

    if (!respuesta.ok) {
      const status = respuesta.status;
      if (status === 401 || status === 403) {
        finalizar('no_autorizado', { status });
        return;
      }
      finalizar('error_http', { status });
      return;
    }

    const tipoContenido = respuesta.headers.get('Content-Type') ?? '';
    if (!tipoContenido.toLowerCase().includes('text/event-stream')) {
      descartarCuerpo(respuesta);
      finalizar('contenido_invalido', { status: respuesta.status });
      return;
    }

    if (!respuesta.body) {
      finalizar('fin_servidor');
      return;
    }

    if (signal.aborted) {
      descartarCuerpo(respuesta);
      finalizar('cerrado');
      return;
    }

    onApertura?.();

    const lector = respuesta.body.getReader();
    cancelarLectura = () => {
      void lector.cancel().catch(() => undefined);
    };

    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await lector.read();
        if (done) {
          const sobrante = decoder.decode();
          if (sobrante) procesar(sobrante);
          finalizar(cerradoPorLlamador || signal.aborted ? 'cerrado' : 'fin_servidor');
          return;
        }
        procesar(decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      if (esAborto(error) || signal.aborted || cerradoPorLlamador) {
        finalizar('cerrado');
        return;
      }
      finalizar('error_red');
    }
  };

  void ejecutar();

  return { cerrar };
}
