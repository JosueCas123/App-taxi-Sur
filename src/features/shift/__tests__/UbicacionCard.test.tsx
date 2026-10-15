import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { UbicacionCard } from '../components/UbicacionCard';
import type { EstadoUbicacionOperativa, MotivoUbicacionNoLista } from '../ubicacion-operativa';

function noLista(motivo: MotivoUbicacionNoLista): EstadoUbicacionOperativa {
  return { lista: false, motivo, antiguedadMs: null };
}

describe('UbicacionCard', () => {
  it('muestra la ubicación lista cuando la muestra es aceptada', async () => {
    await render(<UbicacionCard ubicacion={{ lista: true, motivo: null, antiguedadMs: 1000 }} />);
    expect(screen.getByText('Ubicación lista')).toBeTruthy();
    expect(screen.getByText('Compartiendo durante tu jornada.')).toBeTruthy();
  });

  it('explica el motivo precision_insuficiente', async () => {
    await render(<UbicacionCard ubicacion={noLista('precision_insuficiente')} />);
    expect(
      screen.getByText('La precisión del GPS es insuficiente. Muévete a un lugar abierto e inténtalo de nuevo.')
    ).toBeTruthy();
  });

  it('explica el motivo error_red', async () => {
    await render(<UbicacionCard ubicacion={noLista('error_red')} />);
    expect(
      screen.getByText('No pudimos enviar tu ubicación. Revisa tu conexión e inténtalo de nuevo.')
    ).toBeTruthy();
  });

  it('explica el motivo permiso_denegado', async () => {
    await render(<UbicacionCard ubicacion={noLista('permiso_denegado')} />);
    expect(screen.getByText('Permiso de ubicación denegado. Actívalo para continuar.')).toBeTruthy();
  });

  it('explica el motivo gps_apagado', async () => {
    await render(<UbicacionCard ubicacion={noLista('gps_apagado')} />);
    expect(screen.getByText('El GPS está apagado. Actívalo para continuar.')).toBeTruthy();
  });

  it('explica el motivo desactualizada', async () => {
    await render(<UbicacionCard ubicacion={noLista('desactualizada')} />);
    expect(
      screen.getByText('Tu ubicación está desactualizada. Espera una muestra nueva.')
    ).toBeTruthy();
  });

  it('explica el motivo sin_muestra', async () => {
    await render(<UbicacionCard ubicacion={noLista('sin_muestra')} />);
    expect(screen.getByText('Aún no tenemos una ubicación tuya.')).toBeTruthy();
  });

  it('explica el motivo m04_pendiente por defecto', async () => {
    await render(<UbicacionCard ubicacion={noLista('m04_pendiente')} />);
    expect(
      screen.getByText('La ubicación en tiempo real estará disponible próximamente.')
    ).toBeTruthy();
  });
});
