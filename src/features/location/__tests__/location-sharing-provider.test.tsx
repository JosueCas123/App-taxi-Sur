import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useUbicacionOperativa } from '../../shift/ubicacion-operativa';
import {
  LocationSharingProvider,
  UbicacionOperativaPuente,
  useLocationSharing,
} from '../location-sharing-provider';
import { useCompartirUbicacion, type EstadoComparticion } from '../use-location-sharing';

jest.mock('../use-location-sharing', () => ({
  useCompartirUbicacion: jest.fn(),
}));

const useCompartirMock = useCompartirUbicacion as jest.MockedFunction<typeof useCompartirUbicacion>;

function compartir(estado: Partial<EstadoComparticion['estado']> = {}): EstadoComparticion {
  return {
    estado: { lista: false, motivo: 'sin_muestra', antiguedadMs: null, ...estado },
    compartiendo: false,
    permiso: 'no_solicitado',
    esValidaUltima: false,
    iniciando: false,
    error: null,
    iniciar: jest.fn(),
    detener: jest.fn(),
    reintentar: jest.fn(),
  };
}

function Sonda() {
  const sharing = useLocationSharing();
  const ubicacion = useUbicacionOperativa();
  return (
    <>
      <Text testID="lista">{String(ubicacion.lista)}</Text>
      <Text testID="motivo">{ubicacion.motivo ?? 'sin-motivo'}</Text>
      <Text testID="antiguedad">{String(ubicacion.antiguedadMs)}</Text>
      <Text testID="mismo-estado">{String(sharing.estado === ubicacion)}</Text>
    </>
  );
}

function montar() {
  return render(
    <LocationSharingProvider>
      <UbicacionOperativaPuente>
        <Sonda />
      </UbicacionOperativaPuente>
    </LocationSharingProvider>
  );
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('LocationSharingProvider · puente M04 -> M03', () => {
  it('inyecta el estado real del hook en UbicacionOperativa (mismo objeto)', async () => {
    useCompartirMock.mockReturnValue(compartir());
    await montar();

    expect(screen.getByTestId('lista').props.children).toBe('false');
    expect(screen.getByTestId('motivo').props.children).toBe('sin_muestra');
    expect(screen.getByTestId('antiguedad').props.children).toBe('null');
    expect(screen.getByTestId('mismo-estado').props.children).toBe('true');
  });

  it('refleja una ubicación lista del hook con su antigüedad', async () => {
    useCompartirMock.mockReturnValue(
      compartir({ lista: true, motivo: null, antiguedadMs: 1200 })
    );
    await montar();

    expect(screen.getByTestId('lista').props.children).toBe('true');
    expect(screen.getByTestId('motivo').props.children).toBe('sin-motivo');
    expect(screen.getByTestId('antiguedad').props.children).toBe('1200');
  });

  it('useLocationSharing falla fuera del proveedor', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    function Huerfana() {
      useLocationSharing();
      return null;
    }
    await expect(render(<Huerfana />)).rejects.toThrow(
      'useLocationSharing debe usarse dentro de LocationSharingProvider'
    );
    errorSpy.mockRestore();
  });
});
