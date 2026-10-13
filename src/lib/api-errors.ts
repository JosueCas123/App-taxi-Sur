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