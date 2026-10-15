import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { UBICACION_VIGENCIA_MS, esUbicacionOperativaLista } from '../jornada-policy';
import {
  UbicacionOperativaProvider,
  useUbicacionOperativa,
  type EstadoUbicacionOperativa,
} from '../ubicacion-operativa';

function Sonda() {
  const ubicacion = useUbicacionOperativa();
  return (
    <>
      <Text testID="lista">{String(ubicacion.lista)}</Text>
      <Text testID="motivo">{ubicacion.motivo ?? 'sin-motivo'}</Text>
      <Text testID="antiguedad">{String(ubicacion.antiguedadMs)}</Text>
      <Text testID="operativa">{String(esUbicacionOperativaLista(ubicacion))}</Text>
    </>
  );
}

function doble(antiguedadMs: number | null): EstadoUbicacionOperativa {
  return { lista: true, motivo: null, antiguedadMs };
}

async function montar(valor?: EstadoUbicacionOperativa) {
  return render(
    <UbicacionOperativaProvider valor={valor}>
      <Sonda />
    </UbicacionOperativaProvider>
  );
}

describe('UbicacionOperativaProvider', () => {
  it('usa el valor por defecto "no lista" con motivo m04_pendiente', async () => {
    await montar();
    expect(screen.getByTestId('lista').props.children).toBe('false');
    expect(screen.getByTestId('motivo').props.children).toBe('m04_pendiente');
    expect(screen.getByTestId('antiguedad').props.children).toBe('null');
    expect(screen.getByTestId('operativa').props.children).toBe('false');
  });

  it('expone el doble inyectado sin alterar sus valores', async () => {
    await montar({ lista: false, motivo: 'gps_apagado', antiguedadMs: null });
    expect(screen.getByTestId('motivo').props.children).toBe('gps_apagado');
  });

  it('con un doble de ubicación lista, la política la considera operativa', async () => {
    await montar(doble(1000));
    expect(screen.getByTestId('operativa').props.children).toBe('true');
  });

  it('la política aplica el umbral estricto de 5 minutos: 299999 ms es lista', async () => {
    await montar(doble(UBICACION_VIGENCIA_MS - 1));
    expect(screen.getByTestId('operativa').props.children).toBe('true');
  });

  it('la política aplica el umbral estricto de 5 minutos: 300000 ms no es lista', async () => {
    await montar(doble(UBICACION_VIGENCIA_MS));
    expect(screen.getByTestId('operativa').props.children).toBe('false');
  });
});

describe('useUbicacionOperativa', () => {
  it('fuera del proveedor devuelve el valor por defecto "no lista"', async () => {
    await render(<Sonda />);
    expect(screen.getByTestId('lista').props.children).toBe('false');
    expect(screen.getByTestId('motivo').props.children).toBe('m04_pendiente');
    expect(screen.getByTestId('operativa').props.children).toBe('false');
  });
});
