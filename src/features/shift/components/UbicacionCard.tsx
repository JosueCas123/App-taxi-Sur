import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { EstadoUbicacionOperativa, MotivoUbicacionNoLista } from '../ubicacion-operativa';
import { colors, spacing } from '../../../theme/tokens';
import { Card } from '../../../ui';

const MOTIVO_UBICACION: Record<MotivoUbicacionNoLista, string> = {
  m04_pendiente: 'La ubicación en tiempo real estará disponible próximamente.',
  permiso_denegado: 'Permiso de ubicación denegado. Actívalo para continuar.',
  gps_apagado: 'El GPS está apagado. Actívalo para continuar.',
  precision_insuficiente: 'La precisión del GPS es insuficiente. Muévete a un lugar abierto e inténtalo de nuevo.',
  error_red: 'No pudimos enviar tu ubicación. Revisa tu conexión e inténtalo de nuevo.',
  sin_muestra: 'Aún no tenemos una ubicación tuya.',
  desactualizada: 'Tu ubicación está desactualizada. Espera una muestra nueva.',
};

export function UbicacionCard({ ubicacion }: { ubicacion: EstadoUbicacionOperativa }) {
  const titulo = ubicacion.lista ? 'Ubicación lista' : 'Configura tu ubicación';
  const sub = ubicacion.lista
    ? 'Compartiendo durante tu jornada.'
    : ubicacion.motivo
      ? MOTIVO_UBICACION[ubicacion.motivo]
      : 'Tu ubicación no está lista.';

  return (
    <Card>
      <Text style={styles.titulo}>Ubicación (GPS)</Text>
      <View style={styles.rowlink} accessibilityRole="summary">
        <View style={[styles.iconbox, ubicacion.lista && styles.iconboxLista]}>
          <IconoPin color={ubicacion.lista ? colors.green : '#456284'} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.strong}>{titulo}</Text>
          <Text style={styles.small}>{sub}</Text>
        </View>
        <Svg
          height={22}
          width={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.muted}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="m9 5 7 7-7 7" />
        </Svg>
      </View>
    </Card>
  );
}

function IconoPin({ color }: { color: string }) {
  return (
    <Svg
      height={22}
      width={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <Circle cx={12} cy={10} r={2.5} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  titulo: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rowlink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  iconbox: {
    height: 40,
    width: 40,
    borderRadius: 12,
    backgroundColor: '#eef3f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconboxLista: {
    backgroundColor: '#e7f5ee',
  },
  grow: {
    flex: 1,
  },
  strong: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  small: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
