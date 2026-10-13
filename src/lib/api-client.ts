import { runtimeConfig } from '../config/runtime';

import { crearApiError, type ApiError, type ApiErrorCode } from './api-errors';

type ApiRequestOptions = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  cuerpo?: unknown;
  token?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

const TIEMPO_POR_DEFECTO_MS = 15000;

function codigoDesdeStatus(status: number): ApiErrorCode {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 400:
    case 422:
      return 'BAD_REQUEST';
    default:
      return status >= 500 ? 'SERVER' : 'DESCONOCIDO';
  }
}

function parsearErrorBackend(datos: unknown): { code?: string; message?: string } {
  if (typeof datos === 'object' && datos !== null) {
    const obj = datos as Record<string, unknown>;
    if (typeof obj.error === 'object' && obj.error !== null) {
      const error = obj.error as Record<string, unknown>;
      return {
        code: typeof error.code === 'string' ? error.code : undefined,
        message: typeof error.message === 'string' ? error.message : undefined,
      };
    }
  }
  return {};
}

export async function apiRequest<T>(ruta: string, opciones: ApiRequestOptions = {}): Promise<T> {
  const { metodo = 'GET', cuerpo, token, timeoutMs, signal } = opciones;

  if (!runtimeConfig.apiUrl) {
    throw crearApiError({
      code: 'SIN_CONFIGURACION',
      message: 'EXPO_PUBLIC_API_URL no está definida',
    });
  }

  const url = `${runtimeConfig.apiUrl.replace(/\/+$/, '')}/${ruta.replace(/^\/+/, '')}`;
  const controlador = new AbortController();

  const alAbortarExterno = () => controlador.abort();
  signal?.addEventListener('abort', alAbortarExterno);

  const temporizador = setTimeout(() => controlador.abort(), timeoutMs ?? TIEMPO_POR_DEFECTO_MS);

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      signal: controlador.signal,
      headers: {
        Accept: 'application/json',
        ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    if (signal?.aborted) {
      throw Object.assign(
        crearApiError({ code: 'SIN_CONFIGURACION', message: 'Solicitud cancelada' }),
        { name: 'AbortError' }
      );
    }
    if (controlador.signal.aborted) {
      throw crearApiError({
        code: 'TIMEOUT',
        message: `La petición a ${ruta} excedió el tiempo de espera`,
      });
    }
    throw crearApiError({
      code: 'RED',
      message: 'No hay conexión con el servidor',
    });
  } finally {
    clearTimeout(temporizador);
    signal?.removeEventListener('abort', alAbortarExterno);
  }

  const texto = await respuesta.text();
  let datos: unknown = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }
  const errorBackend = parsearErrorBackend(datos);

  if (!respuesta.ok) {
    throw crearApiError({
      code: codigoDesdeStatus(respuesta.status),
      status: respuesta.status,
      backendCode: errorBackend.code,
      message: errorBackend.message ?? 'Error inesperado en el servidor',
    });
  }

  return datos as T;
}

export function esErrorApi(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as ApiError).message === 'string'
  );
}