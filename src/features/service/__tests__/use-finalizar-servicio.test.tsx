import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { finalizarSolicitud, type SolicitudDetalleDto, type SolicitudDto } from '../../requests/api';
import { useFinalizarServicio } from '../use-finalizar-servicio';

jest.mock('../../requests/api', () => ({
  finalizarSolicitud: jest.fn(),
}));

const finalizarMock = finalizarSolicitud as jest.MockedFunction<typeof finalizarSolicitud>;

function dto(parcial: Partial<SolicitudDto> = {}): SolicitudDto {
  return {
    id: 'solicitud-1',
    pasajeroId: 'pasajero-1',
    conductorAsignadoId: 'conductor-a',
    estado: 'finalizada',
    latitudRecogida: -17.78,
    longitudRecogida: -63.18,
    destino: 'Centro',
    puntoRecogidaTexto: 'Plaza',
    expiraEn: null,
    aceptadaEn: '2026-10-15T12:00:00.000Z',
    finalizadaEn: '2026-10-15T12:05:00.000Z',
    creadoEn: '2026-10-15T11:59:00.000Z',
    ...parcial,
  };
}

function detalle(parcial: Partial<SolicitudDetalleDto> = {}): SolicitudDetalleDto {
  return {
    ...dto(),
    pasajero: { id: 'pasajero-1', nombre: 'Ana' },
    conductorAsignado: null,
    distanciaAproximadaKm: 1,
    ...parcial,
  };
}

function errorApi(parcial: Record<string, unknown>): unknown {
  return { code: 'CONFLICT', message: 'Error', ...parcial };
}

type Props = { solicitudId: string | null; conductorId: string | null };

async function montar(
  overrides: Partial<Parameters<typeof useFinalizarServicio>[0]> = {},
  propsIniciales: Props = { solicitudId: 'solicitud-1', conductorId: 'conductor-a' }
) {
  const reconciliar = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const obtenerDetalle = jest.fn<
    (solicitudId: string, token: string) => Promise<SolicitudDetalleDto>
  >();
  const marcarServicioFinalizado = jest.fn();
  const marcarServicioEnVerificacion = jest.fn();
  const limpiarServicioEnVerificacion = jest.fn();
  const invalidarSesion = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

  const vista = await renderHook(
    (props: Props) =>
      useFinalizarServicio({
        solicitudId: props.solicitudId,
        conductorId: props.conductorId,
        token: 'token-123',
        obtenerDetalle,
        reconciliar,
        marcarServicioFinalizado,
        marcarServicioEnVerificacion,
        limpiarServicioEnVerificacion,
        invalidarSesion,
        ...overrides,
      }),
    { initialProps: propsIniciales }
  );

  return {
    ...vista,
    reconciliar,
    obtenerDetalle,
    marcarServicioFinalizado,
    marcarServicioEnVerificacion,
    limpiarServicioEnVerificacion,
    invalidarSesion,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('useFinalizarServicio', () => {
  it('bloqueo síncrono: varias pulsaciones producen una única petición', async () => {
    let resolver: (valor: SolicitudDto) => void = () => {};
    finalizarMock.mockImplementation(
      () =>
        new Promise<SolicitudDto>((res) => {
          resolver = res;
        })
    );
    const { result } = await montar();

    await act(async () => {
      result.current.finalizar();
      result.current.finalizar();
      result.current.finalizar();
    });

    expect(finalizarMock).toHaveBeenCalledTimes(1);
    expect(result.current.finalizando).toBe(true);

    await act(async () => {
      resolver(dto());
    });

    await waitFor(() => expect(result.current.fase).toBe('confirmada'));
  });

  it('un 200 propio finalizada marca el servicio y reconcilia una vez', async () => {
    finalizarMock.mockResolvedValue(dto());
    const { result, marcarServicioFinalizado, reconciliar } = await montar();

    await act(async () => {
      result.current.finalizar();
    });

    await waitFor(() => expect(result.current.fase).toBe('confirmada'));
    expect(marcarServicioFinalizado).toHaveBeenCalledWith('solicitud-1');
    expect(reconciliar).toHaveBeenCalledTimes(1);
    expect(finalizarMock).toHaveBeenCalledWith('solicitud-1', 'token-123');
    expect(result.current.finalizando).toBe(false);
  });

  it('una respuesta de otro UUID no confirma y consulta el detalle por UUID', async () => {
    finalizarMock.mockResolvedValue(dto({ id: 'solicitud-ajena' }));
    const { result, marcarServicioFinalizado, obtenerDetalle, marcarServicioEnVerificacion } =
      await montar();
    obtenerDetalle.mockResolvedValue(detalle({ id: 'solicitud-ajena' }));

    await act(async () => {
      result.current.finalizar();
    });

    await waitFor(() => expect(result.current.fase).toBe('no_verificable'));
    expect(marcarServicioFinalizado).not.toHaveBeenCalled();
    expect(marcarServicioEnVerificacion).toHaveBeenCalledWith('solicitud-1');
    expect(obtenerDetalle).toHaveBeenCalledWith('solicitud-1', 'token-123');
  });

  it('timeout tras un commit confirmado se resuelve con el detalle propio y reconcilia después', async () => {
    const orden: string[] = [];
    finalizarMock.mockRejectedValue(errorApi({ code: 'TIMEOUT' }));
    const { result, obtenerDetalle, reconciliar, marcarServicioFinalizado } = await montar();
    obtenerDetalle.mockImplementation(async () => {
      orden.push('detalle');
      return detalle();
    });
    reconciliar.mockImplementation(async () => {
      orden.push('reconciliar');
    });

    await act(async () => {
      result.current.finalizar();
    });

    await waitFor(() => expect(result.current.fase).toBe('confirmada'));
    expect(marcarServicioFinalizado).toHaveBeenCalledWith('solicitud-1');
    expect(obtenerDetalle).toHaveBeenCalledTimes(1);
    expect(reconciliar).toHaveBeenCalledTimes(1);
    expect(orden).toEqual(['detalle', 'reconciliar']);
  });

  it('409 con detalle propio en_servicio limpia la verificación y permite reintentar', async () => {
    finalizarMock.mockRejectedValue(
      errorApi({ status: 409, backendCode: 'ESTADO_INVALIDO', code: 'CONFLICT' })
    );
    const { result, obtenerDetalle, limpiarServicioEnVerificacion } = await montar();
    obtenerDetalle.mockResolvedValue(detalle({ estado: 'en_servicio', finalizadaEn: null }));

    await act(async () => {
      result.current.finalizar();
    });

    await waitFor(() => expect(result.current.fase).toBe('sigue_en_servicio'));
    expect(limpiarServicioEnVerificacion).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.finalizar();
    });
    await waitFor(() => expect(finalizarMock).toHaveBeenCalledTimes(2));
  });

  it('403 en el detalle conserva el estado no verificable y permite volver a verificar', async () => {
    finalizarMock.mockRejectedValue(errorApi({ status: 409, code: 'CONFLICT' }));
    const { result, obtenerDetalle, marcarServicioFinalizado } = await montar();
    obtenerDetalle.mockRejectedValue(errorApi({ status: 403, code: 'FORBIDDEN' }));

    await act(async () => {
      result.current.finalizar();
    });

    await waitFor(() => expect(result.current.fase).toBe('no_verificable'));
    expect(marcarServicioFinalizado).not.toHaveBeenCalled();
    expect(obtenerDetalle).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.reintentarVerificacion();
    });
    await waitFor(() => expect(obtenerDetalle).toHaveBeenCalledTimes(2));
    expect(result.current.fase).toBe('no_verificable');
  });

  it('reintentarVerificacion no ejecuta fuera de no_verificable', async () => {
    const { result, obtenerDetalle } = await montar();

    await act(async () => {
      result.current.reintentarVerificacion();
    });

    expect(obtenerDetalle).not.toHaveBeenCalled();
  });

  it('un 401 delega en invalidarSesion y no marca verificación', async () => {
    finalizarMock.mockRejectedValue(
      errorApi({ status: 401, code: 'UNAUTHORIZED', message: 'No autorizado' })
    );
    const { result, invalidarSesion, marcarServicioEnVerificacion } = await montar();

    await act(async () => {
      result.current.finalizar();
    });

    await waitFor(() => expect(invalidarSesion).toHaveBeenCalledTimes(1));
    expect(marcarServicioEnVerificacion).not.toHaveBeenCalled();
  });

  it('un fallo de reconciliar no revierte la confirmación', async () => {
    finalizarMock.mockResolvedValue(dto());
    const reconciliar = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('sin red'));
    const { result } = await montar({ reconciliar });

    await act(async () => {
      result.current.finalizar();
    });

    await waitFor(() => expect(result.current.fase).toBe('confirmada'));
    expect(reconciliar).toHaveBeenCalledTimes(1);
  });

  it('una respuesta tardía de otra sesión no confirma ni reconcilia', async () => {
    let resolver: (valor: SolicitudDto) => void = () => {};
    finalizarMock.mockImplementation(
      () =>
        new Promise<SolicitudDto>((res) => {
          resolver = res;
        })
    );
    const { result, rerender, marcarServicioFinalizado, reconciliar } = await montar();

    await act(async () => {
      result.current.finalizar();
    });

    await rerender({ solicitudId: 'solicitud-1', conductorId: 'conductor-b' });

    await act(async () => {
      resolver(dto());
    });

    expect(marcarServicioFinalizado).not.toHaveBeenCalled();
    expect(reconciliar).not.toHaveBeenCalled();
  });

  it('sin solicitud o token no envía ninguna petición', async () => {
    const sinToken = await montar({ token: null });
    await act(async () => {
      sinToken.result.current.finalizar();
    });
    expect(finalizarMock).not.toHaveBeenCalled();

    const sinSolicitud = await montar({}, { solicitudId: null, conductorId: 'conductor-a' });
    await act(async () => {
      sinSolicitud.result.current.finalizar();
    });
    expect(finalizarMock).not.toHaveBeenCalled();
  });

  it('un 200 inesperado en_servicio se confirma con el detalle propio finalizada', async () => {
    finalizarMock.mockResolvedValue(dto({ estado: 'en_servicio', finalizadaEn: null }));
    const { result, obtenerDetalle, marcarServicioFinalizado } = await montar();
    obtenerDetalle.mockResolvedValue(detalle());

    await act(async () => {
      result.current.finalizar();
    });

    await waitFor(() => expect(result.current.fase).toBe('confirmada'));
    expect(marcarServicioFinalizado).toHaveBeenCalledWith('solicitud-1');
  });
});
