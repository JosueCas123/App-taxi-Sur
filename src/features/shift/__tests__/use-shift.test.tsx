import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import { Button, Text } from 'react-native';

import type { ConductorDetalleDto } from '../../auth/api';
import { SessionProvider, useSession } from '../../auth/session-context';
import { queryKeys } from '../../../lib/query-client';
import { ReconciliacionOfertaProvider, type ReconciliadorOferta } from '../reconciliacion-oferta';
import {
  UbicacionOperativaProvider,
  type EstadoUbicacionOperativa,
} from '../ubicacion-operativa';
import { useShift } from '../use-shift';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../../../config/runtime', () => ({
  runtimeConfig: { apiUrl: 'https://api.example.test', contactoAyuda: null },
}));

const fetchOriginal = globalThis.fetch;
let fetchMock: jest.MockedFunction<typeof fetch>;
let almacenado: string | null;
let client: QueryClient;

const UBICACION_LISTA: EstadoUbicacionOperativa = { lista: true, motivo: null, antiguedadMs: 1000 };
const UBICACION_M04: EstadoUbicacionOperativa = {
  lista: false,
  motivo: 'm04_pendiente',
  antiguedadMs: null,
};

function jwt(payload: object = { conductorId: 'conductor-a', exp: 4102444800 }) {
  return `cabecera.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.firma`;
}

function perfil(parcial: Partial<ConductorDetalleDto> = {}): ConductorDetalleDto {
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

function respuesta(datos: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(datos),
  } as Response;
}

function diferida<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function estado(testID: string) {
  return screen.getByTestId(testID).props.children;
}

function presionar(testID: string) {
  return fireEvent.press(screen.getByTestId(testID));
}

function Sonda() {
  const { invalidarSesion, conductor } = useSession();
  const shift = useShift();
  return (
    <>
      <Text testID="conductor">{conductor?.estadoJornada ?? 'sin-perfil'}</Text>
      <Text testID="disponibilidad-estado">{conductor?.estadoDisponibilidad ?? 'sin-perfil'}</Text>
      <Text testID="cierre">{String(conductor?.cierreJornadaSolicitado ?? false)}</Text>
      <Text testID="permitido">{String(shift.disponibilidad.permitido)}</Text>
      <Text testID="motivo">{shift.disponibilidad.motivo ?? 'sin-motivo'}</Text>
      <Text testID="mutando">{shift.mutando ?? 'sin-mutacion'}</Text>
      <Text testID="error">{shift.error ?? 'sin-error'}</Text>
      <Text testID="conflicto">{shift.conflicto ?? 'sin-conflicto'}</Text>
      <Text testID="no-confirmado">{String(shift.noConfirmado)}</Text>
      <Button testID="iniciar" title="Iniciar" onPress={shift.iniciarJornada} />
      <Button testID="finalizar" title="Finalizar" onPress={shift.finalizarJornada} />
      <Button testID="activar" title="Activar" onPress={shift.activarDisponibilidad} />
      <Button testID="desactivar" title="Desactivar" onPress={shift.desactivarDisponibilidad} />
      <Button testID="reintentar" title="Reintentar" onPress={shift.reintentarSincronizacion} />
      <Button testID="limpiar" title="Limpiar" onPress={shift.limpiarMensajes} />
      <Button testID="invalidar" title="Invalidar" onPress={() => void invalidarSesion()} />
    </>
  );
}

async function montar(opciones: {
  valor?: EstadoUbicacionOperativa;
  reconciliador?: ReconciliadorOferta;
} = {}) {
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <UbicacionOperativaProvider valor={opciones.valor}>
          <ReconciliacionOfertaProvider reconciliador={opciones.reconciliador}>
            <Sonda />
          </ReconciliacionOfertaProvider>
        </UbicacionOperativaProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

async function montarAutenticado(opciones?: {
  valor?: EstadoUbicacionOperativa;
  reconciliador?: ReconciliadorOferta;
}) {
  const vista = await montar(opciones);
  await waitFor(() => expect(estado('conductor')).toBe('no_iniciada'));
  return vista;
}

beforeEach(() => {
  jest.resetAllMocks();
  almacenado = jwt();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  fetchMock = jest.fn<typeof fetch>();
  fetchMock.mockResolvedValue(respuesta(perfil()));
  globalThis.fetch = fetchMock;
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async () => almacenado);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (_key, token) => {
    almacenado = token;
  });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async () => {
    almacenado = null;
  });
});

afterEach(() => {
  client.clear();
  globalThis.fetch = fetchOriginal;
  jest.restoreAllMocks();
});

describe('useShift · mutaciones y caché', () => {
  it('iniciar jornada escribe el perfil devuelto en queryKeys.conductor y refleja activa/no_disponible', async () => {
    await montarAutenticado();
    fetchMock.mockResolvedValueOnce(
      respuesta(perfil({ estadoJornada: 'activa', estadoDisponibilidad: 'no_disponible' }))
    );

    await presionar('iniciar');

    await waitFor(() => expect(estado('conductor')).toBe('activa'));
    expect(estado('disponibilidad-estado')).toBe('no_disponible');
    const cache = client.getQueryData<ConductorDetalleDto>(queryKeys.conductor('conductor-a'));
    expect(cache?.estadoJornada).toBe('activa');
    expect(cache?.estadoDisponibilidad).toBe('no_disponible');
  });

  it('activar disponibilidad envía disponible:true y confirma con la respuesta', async () => {
    await montarAutenticado({ valor: UBICACION_LISTA });
    fetchMock.mockResolvedValueOnce(
      respuesta(perfil({ estadoJornada: 'activa', estadoDisponibilidad: 'disponible' }))
    );

    await presionar('activar');

    await waitFor(() => expect(estado('disponibilidad-estado')).toBe('disponible'));
    const [, opciones] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(String(opciones.body))).toEqual({ disponible: true });
  });

  it('una doble pulsación genera una sola mutación concurrente', async () => {
    await montarAutenticado();
    const pendiente = diferida<Response>();
    fetchMock.mockReturnValueOnce(pendiente.promise);

    await fireEvent.press(screen.getByTestId('iniciar'));
    await fireEvent.press(screen.getByTestId('iniciar'));

    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 restauración + 1 mutación
    await waitFor(() => expect(estado('mutando')).toBe('jornada'));

    await act(async () => {
      pendiente.resolve(respuesta(perfil({ estadoJornada: 'activa' })));
    });
    await waitFor(() => expect(estado('conductor')).toBe('activa'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('no muestra el cambio como confirmado antes de la respuesta del servidor', async () => {
    await montarAutenticado();
    const pendiente = diferida<Response>();
    fetchMock.mockReturnValueOnce(pendiente.promise);

    await presionar('iniciar');
    await waitFor(() => expect(estado('mutando')).toBe('jornada'));

    // Aún sin respuesta: el perfil observado sigue siendo el anterior.
    expect(estado('conductor')).toBe('no_iniciada');

    await act(async () => {
      pendiente.resolve(respuesta(perfil({ estadoJornada: 'activa' })));
    });
    await waitFor(() => expect(estado('conductor')).toBe('activa'));
  });

  it('un error recuperable se expone y no reemplaza el perfil', async () => {
    await montarAutenticado();
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));

    await presionar('iniciar');

    await waitFor(() =>
      expect(estado('error')).toBe('No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo')
    );
    expect(estado('conductor')).toBe('no_iniciada');
    await presionar('limpiar');
    expect(estado('error')).toBe('sin-error');
  });

  it('computa la disponibilidad con la política y el doble de ubicación', async () => {
    await montarAutenticado({ valor: UBICACION_LISTA });
    // Jornada no activa -> bloqueo por jornada.
    expect(estado('permitido')).toBe('false');
    expect(estado('motivo')).toBe('jornada_no_activa');

    fetchMock.mockResolvedValueOnce(respuesta(perfil({ estadoJornada: 'activa' })));
    await presionar('iniciar');
    await waitFor(() => expect(estado('permitido')).toBe('true'));
    expect(estado('motivo')).toBe('sin-motivo');
  });

  it('con la ubicación por defecto (m04_pendiente) bloquea la disponibilidad', async () => {
    await montarAutenticado({ valor: UBICACION_M04 });
    fetchMock.mockResolvedValueOnce(respuesta(perfil({ estadoJornada: 'activa' })));
    await presionar('iniciar');
    await waitFor(() => expect(estado('conductor')).toBe('activa'));
    expect(estado('permitido')).toBe('false');
    expect(estado('motivo')).toBe('ubicacion_no_lista');
  });
});

describe('useShift · 409 y reconciliación', () => {
  it('ante 409 muestra el conflicto, refresca el perfil e invoca la costura sin desbloquear si sigue inválida', async () => {
    const reconciliador = jest.fn<ReconciliadorOferta>(async () => {});
    await montarAutenticado({ valor: UBICACION_LISTA, reconciliador });
    fetchMock.mockResolvedValueOnce(
      respuesta(perfil({ estadoJornada: 'activa', estadoDisponibilidad: 'disponible' }))
    );
    await presionar('iniciar');
    await waitFor(() => expect(estado('permitido')).toBe('true'));

    // La activación devuelve 409; el refresco trae una jornada no activa.
    fetchMock
      .mockResolvedValueOnce(
        respuesta({ error: { code: 'INVALID_STATE_TRANSITION', message: 'conflicto' } }, 409)
      )
      .mockResolvedValueOnce(respuesta(perfil({ estadoJornada: 'no_iniciada' })));

    await presionar('activar');

    await waitFor(() => expect(estado('conflicto')).not.toBe('sin-conflicto'));
    expect(reconciliador).toHaveBeenCalledTimes(1);
    expect(estado('no-confirmado')).toBe('false');
    expect(estado('permitido')).toBe('false');
    expect(estado('motivo')).toBe('jornada_no_activa');
  });

  it('tras un 409 con reconciliador no-op, el perfil recuperado válido vuelve a habilitar la acción', async () => {
    await montarAutenticado({ valor: UBICACION_LISTA });
    fetchMock.mockResolvedValueOnce(
      respuesta(perfil({ estadoJornada: 'activa', estadoDisponibilidad: 'no_disponible' }))
    );
    await presionar('iniciar');
    await waitFor(() => expect(estado('permitido')).toBe('true'));

    fetchMock
      .mockResolvedValueOnce(
        respuesta({ error: { code: 'INVALID_STATE_TRANSITION', message: 'conflicto' } }, 409)
      )
      .mockResolvedValueOnce(
        respuesta(perfil({ estadoJornada: 'activa', estadoDisponibilidad: 'no_disponible' }))
      );

    await presionar('activar');

    await waitFor(() => expect(estado('conflicto')).not.toBe('sin-conflicto'));
    await waitFor(() => expect(estado('no-confirmado')).toBe('false'));
    expect(estado('permitido')).toBe('true');
  });

  it('si el refresco tras 409 falla, queda no confirmado, avisa y permite reintentar', async () => {
    await montarAutenticado({ valor: UBICACION_LISTA });
    fetchMock.mockResolvedValueOnce(respuesta(perfil({ estadoJornada: 'activa' })));
    await presionar('iniciar');
    await waitFor(() => expect(estado('conductor')).toBe('activa'));

    fetchMock
      .mockResolvedValueOnce(
        respuesta({ error: { code: 'INVALID_STATE_TRANSITION', message: 'conflicto' } }, 409)
      )
      .mockRejectedValueOnce(new TypeError('Network request failed'));

    await presionar('activar');

    await waitFor(() =>
      expect(estado('error')).toBe('No pudimos sincronizar tu información. Reintenta para continuar')
    );
    expect(estado('no-confirmado')).toBe('true');

    // Reintento exitoso.
    fetchMock.mockResolvedValueOnce(respuesta(perfil({ estadoJornada: 'activa' })));
    await presionar('reintentar');
    await waitFor(() => expect(estado('no-confirmado')).toBe('false'));
    expect(estado('error')).toBe('sin-error');
  });
});

describe('useShift · generación de sesión', () => {
  it('una respuesta tardía de otra sesión no reemplaza el perfil actual', async () => {
    await montarAutenticado();
    const pendiente = diferida<Response>();
    fetchMock.mockReturnValueOnce(pendiente.promise);

    await presionar('iniciar');
    await waitFor(() => expect(estado('mutando')).toBe('jornada'));

    await presionar('invalidar');
    await waitFor(() => expect(estado('conductor')).toBe('sin-perfil'));

    await act(async () => {
      pendiente.resolve(respuesta(perfil({ estadoJornada: 'activa' })));
    });

    // No debe recrear ni reemplazar el perfil de la sesión cerrada.
    expect(client.getQueryData(queryKeys.conductor('conductor-a'))).toBeUndefined();
    expect(estado('conductor')).toBe('sin-perfil');
  });
});
