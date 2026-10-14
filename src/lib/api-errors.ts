export type ApiErrorCode =
  | 'RED'
  | 'TIMEOUT'
  | 'SIN_CONFIGURACION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER'
  | 'BAD_REQUEST'
  | 'DESCONOCIDO';

export type ApiError = {
  code: ApiErrorCode;
  status?: number;
  backendCode?: string;
  message: string;
};

export function crearApiError(error: Partial<ApiError> & { message: string }): ApiError {
  return {
    code: error.code ?? 'DESCONOCIDO',
    status: error.status,
    backendCode: error.backendCode,
    message: error.message,
  };
}

// Mensajes de UI por código de error. No interpretan `message` ni atribuyen
// el fallo a un campo del formulario: solo traducen la categoría del error.
export const MENSAJE_ERROR_RED =
  'No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo';
export const MENSAJE_ERROR_SIN_CONFIGURACION =
  'La app no tiene configurada la dirección del servidor';
export const MENSAJE_ERROR_SERVER =
  'El servicio no está disponible en este momento. Inténtalo más tarde';
export const MENSAJE_ERROR_BAD_REQUEST =
  'Los datos enviados no son válidos. Revísalos e intenta nuevamente';
export const MENSAJE_ERROR_NOT_FOUND = 'No pudimos contactar el servidor. Inténtalo más tarde';

export function mensajeDeErrorApi(error: unknown, generico: string): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return generico;
  }
  switch ((error as ApiError).code) {
    case 'RED':
      return MENSAJE_ERROR_RED;
    case 'SIN_CONFIGURACION':
      return MENSAJE_ERROR_SIN_CONFIGURACION;
    case 'SERVER':
      return MENSAJE_ERROR_SERVER;
    case 'BAD_REQUEST':
      return MENSAJE_ERROR_BAD_REQUEST;
    case 'NOT_FOUND':
      return MENSAJE_ERROR_NOT_FOUND;
    default:
      return generico;
  }
}