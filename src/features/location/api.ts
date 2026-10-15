import { apiRequest } from '../../lib/api-client';

export type UbicacionDto = {
  id: string;
  latitud: number;
  longitud: number;
  horaRegistro: string;
  esValida: boolean;
};

// POST /api/conductores/:id/ubicacion  {latitud,longitud} estricto; Bearer; sin reintento.
// UbicacionDto es cuerpo directo (sin envoltorio data). La app no envía timestamp ni campos extra.
export function enviarUbicacion(
  conductorId: string,
  token: string,
  muestra: { latitud: number; longitud: number }
): Promise<UbicacionDto> {
  return apiRequest<UbicacionDto>(
    `/api/conductores/${encodeURIComponent(conductorId)}/ubicacion`,
    {
      metodo: 'POST',
      token,
      cuerpo: { latitud: muestra.latitud, longitud: muestra.longitud },
    }
  );
}
