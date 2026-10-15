import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../../../theme/tokens';
import { useDriverEventsContext } from '../driver-events-provider';

const MENSAJES = {
  reconectando: 'Reconectando con el servidor…',
  perdida: 'Sin conexión con el servidor. Reintentando…',
} as const;

// Aviso global de pérdida de conexión operativa (M05). Se monta sobre el Stack
// de (operacion) para cubrir también la pantalla de espera del guard mientras
// la reconciliación inicial siga pendiente.
export function EstadoConexionBanner() {
  const { conexion } = useDriverEventsContext();
  const insets = useSafeAreaInsets();

  if (conexion !== 'perdida' && conexion !== 'reconectando') {
    return null;
  }

  return (
    <View
      accessibilityRole="alert"
      style={[styles.base, { paddingTop: insets.top + spacing.sm }]}
    >
      <Text style={styles.texto}>{MENSAJES[conexion]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: colors.red,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  texto: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});
