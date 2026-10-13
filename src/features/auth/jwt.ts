export type PayloadJwt = {
  sub?: string;
  conductorId?: string;
  exp?: number;
};

export function decodificarPayloadJwt(token: string): PayloadJwt | null {
  const segmento = token.split('.')[1];
  if (!segmento) {
    return null;
  }
  try {
    const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/');
    const relleno = ''.padEnd((4 - (base64.length % 4)) % 4, '=');
    const codificado = atob(base64 + relleno);
    const json = decodeURIComponent(
      codificado
        .split('')
        .map((caracter) => '%' + caracter.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    const payload: unknown = JSON.parse(json);
    if (typeof payload === 'object' && payload !== null) {
      return payload as PayloadJwt;
    }
    return null;
  } catch {
    return null;
  }
}