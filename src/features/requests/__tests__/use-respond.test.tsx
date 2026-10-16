import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { responderSolicitud, type SolicitudDto } from '../api';
import { useResponderSolicitud } from '../use-respond';

jest.mock('../api', () => ({
  responderSolicitud: jest.fn(),
}));

const responderMock = responderSolicitud as jest.MockedFunction<typeof responderSolicitud>;

function dto(parcial: Partial<SolicitudDto> = {}): SolicitudDto {
  return {
    id: 'solicitud-1',
    pasajeroId: 'pasajero-1',
    conductorAsignadoId: 'conductor-a',
    estado: 'aceptada',
    latitudRecogida: -17.78,
    longitudRecogida: -63.18,
    destino: null,
    puntoRecogidaTexto: null,
    expiraEn: '2026-10-15T12:00:00.000Z',
    aceptadaEn: null,
    finalizadaEn: null,
    creadoEn: '2026-10-15T11:59:00.000Z',
    ...parcial,
  };
}

function errorApi(parcial: Record<string, unknown>): unknown {
  return { code: 'CONFLICT', message: 'Conflicto', ...parcial };
}

beforeEach(() => {
  jest.resetAllMocks();
});

async function montar(overrides: Partial<Parameters<typeof useResponderSolicitud>[0]> = {}) {
  const reconciliar = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const vista = await renderHook(() =>
    useResponderSolicitud({
      solicitudId: 'solicitud-1',
      token: 'token-123',
      reconciliar,
      ...overrides,
    })
  );
  return { ...vista, reconciliar };
}

describe('useResponderSolicitud', () => {
  it('aceptar llama a responderSolicitud con true y reconcilia una vez', async () => {
    responderMock.mockResolvedValue(dto());
    const { result, reconciliar } = await montar();

    await act(async () => {
      result.current.aceptar();
    });

    expect(responderMock).toHaveBeenCalledTimes(1);
    expect(responderMock).toHaveBeenCalledWith('solicitud-1', 'token-123', true);
    expect(reconciliar).toHaveBeenCalledTimes(1);
  });

  it('rechazar llama a responderSolicitud con false y reconcilia una vez', async () => {
    responderMock.mockResolvedValue(dto({ estado: 'rechazada' }));
    const { result, reconciliar } = await montar();

    await act(async () => {
      result.current.rechazar();
    });

    expect(responderMock).toHaveBeenCalledWith('solicitud-1', 'token-123', false);
    expect(reconciliar).toHaveBeenCalledTimes(1);
  });

  it('bloqueo síncrono: pulsar aceptar repetidamente produce una única petición', async () => {
    let resolver: (valor: SolicitudDto) => void = () => {};
    responderMock.mockImplementation(
      () => new Promise<SolicitudDto>((res) => {
        resolver = res;
      })
    );
    const { result, reconciliar } = await montar();

    // Las tres pulsaciones ocurren en el mismo tick, antes de cualquier await.
    await act(async () => {
      result.current.aceptar();
      result.current.aceptar();
      result.current.aceptar();
    });

    expect(responderMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolver(dto());
    });

    expect(responderMock).toHaveBeenCalledTimes(1);
    expect(reconciliar).toHaveBeenCalledTimes(1);
  });

  it('marcar respondiendo mientras la petición está en vuelo', async () => {
    let resolver: (valor: SolicitudDto) => void = () => {};
    responderMock.mockImplementation(
      () => new Promise<SolicitudDto>((res) => {
        resolver = res;
      })
    );
    const { result } = await montar();

    await act(async () => {
      result.current.aceptar();
    });

    await waitFor(() => {
      expect(result.current.respondiendo).toBe('aceptar');
    });

    await act(async () => {
      resolver(dto());
    });

    await waitFor(() => {
      expect(result.current.respondiendo).toBeNull();
    });
  });

  it('409 ESTADO_INVALIDO marca conflicto, reconcilia una vez y no reintenta', async () => {
    responderMock.mockRejectedValue(errorApi({ status: 409, backendCode: 'ESTADO_INVALIDO' }));
    const { result, reconciliar } = await montar();

    await act(async () => {
      result.current.aceptar();
    });

    await waitFor(() => {
      expect(result.current.conflicto).toBe(true);
    });
    expect(result.current.error).toBeNull();
    expect(reconciliar).toHaveBeenCalledTimes(1);
    expect(responderMock).toHaveBeenCalledTimes(1);
  });

  it('409 sin backendCode también marca conflicto', async () => {
    responderMock.mockRejectedValue(errorApi({ status: 409 }));
    const { result } = await montar();

    await act(async () => {
      result.current.rechazar();
    });

    await waitFor(() => {
      expect(result.current.conflicto).toBe(true);
    });
  });

  it('timeout/error de red: guarda mensaje, reconcilia una vez y no reintenta', async () => {
    responderMock.mockRejectedValue(errorApi({ code: 'TIMEOUT', status: undefined, message: 'Tiempo agotado' }));
    const { result, reconciliar } = await montar();

    await act(async () => {
      result.current.aceptar();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Tiempo agotado');
    });
    expect(result.current.conflicto).toBe(false);
    expect(reconciliar).toHaveBeenCalledTimes(1);
    expect(responderMock).toHaveBeenCalledTimes(1);
  });

  it('un 409 nunca se convierte en aceptación: no queda en-servicio por sí solo', async () => {
    responderMock.mockRejectedValue(errorApi({ status: 409, backendCode: 'ESTADO_INVALIDO' }));
    const reconciliar = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { result } = await renderHook(() =>
      useResponderSolicitud({ solicitudId: 'solicitud-1', token: 'token-123', reconciliar })
    );

    await act(async () => {
      result.current.aceptar();
    });

    await waitFor(() => {
      expect(result.current.conflicto).toBe(true);
    });
    // El resultado no expone ninguna señal de aceptación ni éxito.
    expect(result.current.respondiendo).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('limpiarMensajes borra error y conflicto', async () => {
    responderMock.mockRejectedValue(errorApi({ status: 409, backendCode: 'ESTADO_INVALIDO' }));
    const { result } = await montar();

    await act(async () => {
      result.current.aceptar();
    });

    await waitFor(() => {
      expect(result.current.conflicto).toBe(true);
    });

    await act(async () => {
      result.current.limpiarMensajes();
    });

    expect(result.current.conflicto).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sin solicitudId no envía ninguna petición', async () => {
    const { result } = await montar({ solicitudId: null });

    await act(async () => {
      result.current.aceptar();
    });

    expect(responderMock).not.toHaveBeenCalled();
  });

  it('sin token no envía ninguna petición', async () => {
    const { result } = await montar({ token: null });

    await act(async () => {
      result.current.aceptar();
    });

    expect(responderMock).not.toHaveBeenCalled();
  });
});
