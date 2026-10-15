import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';

import { EstadoConexionBanner } from '../components/EstadoConexionBanner';
import type { UseDriverEventsResult } from '../use-driver-events';

let mockEstadoEvents: UseDriverEventsResult;

jest.mock('../driver-events-provider', () => ({
  useDriverEventsContext: () => mockEstadoEvents,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));

function eventosPrueba(conexion: UseDriverEventsResult['conexion']): UseDriverEventsResult {
  return {
    conexion,
    reconciliando: false,
    reconciliacionInicial: 'completa',
    solicitudActiva: null,
    servicioConfirmado: null,
    reconciliar: async () => {},
  };
}

describe('EstadoConexionBanner', () => {
  beforeEach(() => {
    mockEstadoEvents = eventosPrueba('conectado');
  });

  it.each(['iniciando', 'conectado'] as const)('con conexion %s no se muestra', async (conexion) => {
    mockEstadoEvents = eventosPrueba(conexion);
    const vista = await render(<EstadoConexionBanner />);
    expect(vista.toJSON()).toBeNull();
  });

  it('con la conexión perdida avisa que se reintenta', async () => {
    mockEstadoEvents = eventosPrueba('perdida');
    const vista = await render(<EstadoConexionBanner />);
    expect(vista.getByText('Sin conexión con el servidor. Reintentando…')).toBeTruthy();
  });

  it('en reconexión avisa al conductor', async () => {
    mockEstadoEvents = eventosPrueba('reconectando');
    const vista = await render(<EstadoConexionBanner />);
    expect(vista.getByText('Reconectando con el servidor…')).toBeTruthy();
  });
});
