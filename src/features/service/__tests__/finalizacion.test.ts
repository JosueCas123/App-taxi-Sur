import { describe, expect, it } from '@jest/globals';

import type { SolicitudDetalleDto, SolicitudDto } from '../../requests/api';
import { abreviarUuid, resolverResultadoFinalizacion } from '../finalizacion';

const SOLICITUD_ID = '11111111-2222-3333-4444-555555555555';
const OTRA_SOLICITUD_ID = '99999999-8888-7777-6666-555555555555';
const CONDUCTOR_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const OTRO_CONDUCTOR_ID = 'ffffffff-1111-2222-3333-444444444444';

function solicitud(sobrescrituras: Partial<SolicitudDto> = {}): SolicitudDto {
  return {
    id: SOLICITUD_ID,
    pasajeroId: 'pasajero-1',
    conductorAsignadoId: CONDUCTOR_ID,
    estado: 'finalizada',
    latitudRecogida: -17.7833,
    longitudRecogida: -63.1821,
    destino: 'Plan 3000',
    puntoRecogidaTexto: 'Radial 10',
    expiraEn: null,
    aceptadaEn: '2026-10-15T12:00:00.000Z',
    finalizadaEn: '2026-10-15T12:05:00.000Z',
    creadoEn: '2026-10-15T11:55:00.000Z',
    ...sobrescrituras,
  };
}

function detalle(sobrescrituras: Partial<SolicitudDetalleDto> = {}): SolicitudDetalleDto {
  return {
    ...solicitud(),
    pasajero: { id: 'pasajero-1', nombre: 'Ana' },
    conductorAsignado: {
      id: CONDUCTOR_ID,
      nombreCompleto: 'Luis Pérez',
      vehiculo: null,
    },
    distanciaAproximadaKm: 1.2,
    ...sobrescrituras,
  };
}

describe('abreviarUuid', () => {
  it('abrevia un UUID completo como primeros 8 + "." + últimos 4', () => {
    expect(abreviarUuid(SOLICITUD_ID)).toBe('11111111.5555');
  });

  it('conserva el UUID completo para la API', () => {
    const completo = SOLICITUD_ID;
    const abreviado = abreviarUuid(completo);

    expect(abreviado).not.toBe(completo);
    expect(completo).toBe(SOLICITUD_ID);
  });

  it('devuelve sin recortar un valor corto o de 12 caracteres', () => {
    expect(abreviarUuid('corto')).toBe('corto');
    expect(abreviarUuid('123456789012')).toBe('123456789012');
  });

  it('abrevia un valor de 13 caracteres sin solaparse', () => {
    expect(abreviarUuid('1234567890123')).toBe('12345678.0123');
  });
});

describe('resolverResultadoFinalizacion', () => {
  it('confirma el éxito propio a partir de la respuesta del POST', () => {
    expect(
      resolverResultadoFinalizacion({
        solicitudId: SOLICITUD_ID,
        conductorId: CONDUCTOR_ID,
        respuesta: solicitud(),
        detalle: null,
      })
    ).toEqual({ tipo: 'confirmada' });
  });

  it('confirma el éxito propio a partir del detalle si la respuesta se perdió', () => {
    expect(
      resolverResultadoFinalizacion({
        solicitudId: SOLICITUD_ID,
        conductorId: CONDUCTOR_ID,
        respuesta: null,
        detalle: detalle(),
      })
    ).toEqual({ tipo: 'confirmada' });
  });

  it('prioriza la respuesta propia finalizada sobre el detalle', () => {
    expect(
      resolverResultadoFinalizacion({
        solicitudId: SOLICITUD_ID,
        conductorId: CONDUCTOR_ID,
        respuesta: solicitud(),
        detalle: detalle({ estado: 'en_servicio', finalizadaEn: null }),
      })
    ).toEqual({ tipo: 'confirmada' });
  });

  it('confirma por detalle propio aunque la respuesta traiga otro estado', () => {
    expect(
      resolverResultadoFinalizacion({
        solicitudId: SOLICITUD_ID,
        conductorId: CONDUCTOR_ID,
        respuesta: solicitud({ estado: 'en_servicio', finalizadaEn: null }),
        detalle: detalle(),
      })
    ).toEqual({ tipo: 'confirmada' });
  });

  it('indica que el servicio sigue en curso cuando el detalle propio está en_servicio', () => {
    expect(
      resolverResultadoFinalizacion({
        solicitudId: SOLICITUD_ID,
        conductorId: CONDUCTOR_ID,
        respuesta: null,
        detalle: detalle({ estado: 'en_servicio', finalizadaEn: null }),
      })
    ).toEqual({ tipo: 'sigue_en_servicio' });
  });

  it('descarta una respuesta finalizada de otro UUID', () => {
    expect(
      resolverResultadoFinalizacion({
        solicitudId: SOLICITUD_ID,
        conductorId: CONDUCTOR_ID,
        respuesta: solicitud({ id: OTRA_SOLICITUD_ID }),
        detalle: null,
      })
    ).toEqual({ tipo: 'no_verificable' });
  });

  it('descarta una respuesta finalizada de otro conductor', () => {
    expect(
      resolverResultadoFinalizacion({
        solicitudId: SOLICITUD_ID,
        conductorId: CONDUCTOR_ID,
        respuesta: solicitud({ conductorAsignadoId: OTRO_CONDUCTOR_ID }),
        detalle: null,
      })
    ).toEqual({ tipo: 'no_verificable' });
  });

  it('descarta un detalle finalizado de otro UUID', () => {
    expect(
      resolverResultadoFinalizacion({
        solicitudId: SOLICITUD_ID,
        conductorId: CONDUCTOR_ID,
        respuesta: null,
        detalle: detalle({ id: OTRA_SOLICITUD_ID }),
      })
    ).toEqual({ tipo: 'no_verificable' });
  });

  it('descarta un detalle finalizado de otro conductor', () => {
    expect(
      resolverResultadoFinalizacion({
        solicitudId: SOLICITUD_ID,
        conductorId: CONDUCTOR_ID,
        respuesta: null,
        detalle: detalle({ conductorAsignadoId: OTRO_CONDUCTOR_ID }),
      })
    ).toEqual({ tipo: 'no_verificable' });
  });

  it('descarta un detalle propio en_servicio cuando el UUID no coincide', () => {
    expect(
      resolverResultadoFinalizacion({
        solicitudId: SOLICITUD_ID,
        conductorId: CONDUCTOR_ID,
        respuesta: null,
        detalle: detalle({ id: OTRA_SOLICITUD_ID, estado: 'en_servicio' }),
      })
    ).toEqual({ tipo: 'no_verificable' });
  });

  it('trata la ausencia de respuesta y detalle (403/404/red) como no verificable', () => {
    expect(
      resolverResultadoFinalizacion({
        solicitudId: SOLICITUD_ID,
        conductorId: CONDUCTOR_ID,
        respuesta: null,
        detalle: null,
      })
    ).toEqual({ tipo: 'no_verificable' });
  });

  it('no confirma con un estado distinto de finalizada o en_servicio', () => {
    expect(
      resolverResultadoFinalizacion({
        solicitudId: SOLICITUD_ID,
        conductorId: CONDUCTOR_ID,
        respuesta: null,
        detalle: detalle({ estado: 'aceptada', finalizadaEn: null }),
      })
    ).toEqual({ tipo: 'no_verificable' });
  });

  it('no confirma cuando falta el conductor asignado', () => {
    expect(
      resolverResultadoFinalizacion({
        solicitudId: SOLICITUD_ID,
        conductorId: CONDUCTOR_ID,
        respuesta: solicitud({ conductorAsignadoId: null }),
        detalle: null,
      })
    ).toEqual({ tipo: 'no_verificable' });
  });
});
