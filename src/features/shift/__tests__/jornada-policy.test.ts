import { describe, expect, it } from '@jest/globals';

import type { ConductorDetalleDto } from '../../auth/api';
import {
  UBICACION_VIGENCIA_MS,
  accionDisponibilidad,
  accionJornada,
  esUbicacionOperativaLista,
  puedeActivarDisponibilidad,
  type EntradaDisponibilidad,
} from '../jornada-policy';
import type { EstadoUbicacionOperativa } from '../ubicacion-operativa';

function conductor(parcial: Partial<ConductorDetalleDto> = {}): ConductorDetalleDto {
  return {
    id: 'conductor-a',
    usuarioId: 'usuario-conductor-a',
    telefono: '00000000',
    nombreCompleto: 'Prueba',
    cedulaIdentidad: 'prueba',
    estado: 'aprobado',
    estadoJornada: 'no_iniciada',
    estadoDisponibilidad: 'no_disponible',
    cierreJornadaSolicitado: false,
    creadoEn: '2026-01-01T00:00:00.000Z',
    vehiculo: null,
    ...parcial,
  };
}

function ubicacionLista(antiguedadMs: number | null = 1000): EstadoUbicacionOperativa {
  return { lista: true, motivo: null, antiguedadMs };
}

function ubicacionNoLista(
  motivo: EstadoUbicacionOperativa['motivo'] = 'desactualizada'
): EstadoUbicacionOperativa {
  return { lista: false, motivo, antiguedadMs: UBICACION_VIGENCIA_MS };
}

function entrada(parcial: Partial<EntradaDisponibilidad> = {}): EntradaDisponibilidad {
  return {
    estadoCuenta: 'aprobado',
    estadoJornada: 'activa',
    estadoDisponibilidad: 'no_disponible',
    ubicacion: ubicacionLista(),
    ...parcial,
  };
}

describe('esUbicacionOperativaLista', () => {
  it('no está lista si el proveedor no la marca como lista', () => {
    expect(esUbicacionOperativaLista(ubicacionNoLista('sin_muestra'))).toBe(false);
  });

  it('está lista si la marca está activa aunque no traiga antigüedad', () => {
    expect(esUbicacionOperativaLista(ubicacionLista(null))).toBe(true);
  });

  it('está lista por debajo del umbral estricto de 5 minutos', () => {
    expect(esUbicacionOperativaLista(ubicacionLista(UBICACION_VIGENCIA_MS - 1))).toBe(true);
  });

  it('no está lista al cumplir exactamente 5 minutos', () => {
    expect(esUbicacionOperativaLista(ubicacionLista(UBICACION_VIGENCIA_MS))).toBe(false);
  });

  it('no está lista por encima de 5 minutos', () => {
    expect(esUbicacionOperativaLista(ubicacionLista(UBICACION_VIGENCIA_MS + 1))).toBe(false);
  });
});

describe('puedeActivarDisponibilidad', () => {
  it('permite activar con cuenta aprobada, jornada activa, ubicación lista y no disponible', () => {
    expect(puedeActivarDisponibilidad(entrada())).toEqual({ permitido: true, motivo: null });
  });

  it.each(['pendiente', 'rechazado', 'suspendido'] as const)(
    'bloquea por cuenta %s',
    (estadoCuenta) => {
      expect(puedeActivarDisponibilidad(entrada({ estadoCuenta }))).toEqual({
        permitido: false,
        motivo: 'cuenta_no_aprobada',
      });
    }
  );

  it.each(['no_iniciada', 'finalizada'] as const)('bloquea con jornada %s', (estadoJornada) => {
    expect(puedeActivarDisponibilidad(entrada({ estadoJornada }))).toEqual({
      permitido: false,
      motivo: 'jornada_no_activa',
    });
  });

  it('bloquea si la ubicación no está lista', () => {
    expect(puedeActivarDisponibilidad(entrada({ ubicacion: ubicacionNoLista('m04_pendiente') }))).toEqual({
      permitido: false,
      motivo: 'ubicacion_no_lista',
    });
  });

  it('bloquea si la ubicación cumple 5 minutos', () => {
    expect(
      puedeActivarDisponibilidad(entrada({ ubicacion: ubicacionLista(UBICACION_VIGENCIA_MS) }))
    ).toEqual({ permitido: false, motivo: 'ubicacion_no_lista' });
  });

  it.each(['en_servicio', 'solicitud_pendiente'] as const)(
    'bloquea con estado de disponibilidad %s',
    (estadoDisponibilidad) => {
      expect(puedeActivarDisponibilidad(entrada({ estadoDisponibilidad }))).toEqual({
        permitido: false,
        motivo: 'estado_no_disponible',
      });
    }
  );

  it('prioriza el motivo de cuenta sobre los demás', () => {
    expect(
      puedeActivarDisponibilidad(
        entrada({
          estadoCuenta: 'suspendido',
          estadoJornada: 'no_iniciada',
          ubicacion: ubicacionNoLista(),
          estadoDisponibilidad: 'en_servicio',
        })
      ).motivo
    ).toBe('cuenta_no_aprobada');
  });

  it('prioriza el motivo de jornada sobre ubicación y estado', () => {
    expect(
      puedeActivarDisponibilidad(
        entrada({
          estadoCuenta: 'aprobado',
          estadoJornada: 'finalizada',
          ubicacion: ubicacionNoLista(),
          estadoDisponibilidad: 'en_servicio',
        })
      ).motivo
    ).toBe('jornada_no_activa');
  });

  it('prioriza el motivo de ubicación sobre el estado de disponibilidad', () => {
    expect(
      puedeActivarDisponibilidad(
        entrada({ ubicacion: ubicacionNoLista(), estadoDisponibilidad: 'en_servicio' })
      ).motivo
    ).toBe('ubicacion_no_lista');
  });
});

describe('accionJornada', () => {
  it('muestra iniciar habilitado con jornada no iniciada', () => {
    expect(accionJornada(conductor({ estadoJornada: 'no_iniciada' }))).toEqual({
      accion: 'iniciar',
      habilitado: true,
      motivo: null,
    });
  });

  it('muestra iniciar habilitado con jornada finalizada', () => {
    expect(accionJornada(conductor({ estadoJornada: 'finalizada' }))).toEqual({
      accion: 'iniciar',
      habilitado: true,
      motivo: null,
    });
  });

  it('muestra finalizar habilitado con jornada activa', () => {
    expect(accionJornada(conductor({ estadoJornada: 'activa' }))).toEqual({
      accion: 'finalizar',
      habilitado: true,
      motivo: null,
    });
  });

  it('deshabilita finalizar cuando el cierre ya fue solicitado', () => {
    expect(
      accionJornada(conductor({ estadoJornada: 'activa', cierreJornadaSolicitado: true }))
    ).toEqual({ accion: 'finalizar', habilitado: false, motivo: 'cierre_solicitado' });
  });
});

describe('accionDisponibilidad', () => {
  it('muestra desactivar habilitado cuando está disponible', () => {
    expect(accionDisponibilidad(entrada({ estadoDisponibilidad: 'disponible' }))).toEqual({
      tipo: 'desactivar',
      habilitado: true,
      motivo: null,
    });
  });

  it.each(['en_servicio', 'solicitud_pendiente'] as const)(
    'bloquea el control con estado %s',
    (estadoDisponibilidad) => {
      expect(accionDisponibilidad(entrada({ estadoDisponibilidad }))).toEqual({
        tipo: 'bloqueado',
        habilitado: false,
        motivo: 'estado_no_disponible',
      });
    }
  );

  it('muestra activar habilitado cuando la política lo permite', () => {
    expect(accionDisponibilidad(entrada())).toEqual({
      tipo: 'activar',
      habilitado: true,
      motivo: null,
    });
  });

  it.each([
    ['cuenta_no_aprobada', { estadoCuenta: 'pendiente' as const }],
    ['jornada_no_activa', { estadoJornada: 'no_iniciada' as const }],
    ['ubicacion_no_lista', { ubicacion: ubicacionNoLista('m04_pendiente') }],
  ])('muestra activar deshabilitado con motivo %s', (motivo, parcial) => {
    expect(accionDisponibilidad(entrada(parcial))).toEqual({
      tipo: 'activar',
      habilitado: false,
      motivo,
    });
  });
});
