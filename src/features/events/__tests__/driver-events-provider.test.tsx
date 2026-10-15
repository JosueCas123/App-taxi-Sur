import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DriverEventsProvider, useDriverEventsContext } from '../driver-events-provider';

jest.mock('../../../config/runtime', () => ({
  runtimeConfig: { apiUrl: 'https://api.example.test', contactoAyuda: null },
}));

// Sesión sin token: el hook queda inerte (sin stream ni instantánea) y el
// contexto expone la compuerta en 'pendiente'.
jest.mock('../../auth/session-context', () => ({
  useSession: () => ({
    status: 'autenticado',
    token: null,
    conductorId: null,
    conductor: null,
    mensajeSesion: null,
  }),
  registrarAlInvalidar: () => () => {},
}));

function Sonda() {
  const estado = useDriverEventsContext();
  return <Text testID="sonda">{`${estado.reconciliacionInicial}/${estado.conexion}`}</Text>;
}

describe('DriverEventsProvider', () => {
  it('expone el estado del stream reconciliado a los hijos', async () => {
    const vista = await render(
      <DriverEventsProvider>
        <Sonda />
      </DriverEventsProvider>
    );
    expect(vista.getByTestId('sonda').props.children).toBe('pendiente/iniciando');
  });

  it('useDriverEventsContext lanza fuera del provider', async () => {
    await expect(render(<Sonda />)).rejects.toThrow(
      'useDriverEventsContext debe usarse dentro de DriverEventsProvider'
    );
  });
});
