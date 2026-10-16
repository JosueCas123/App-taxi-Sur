import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../../theme/tokens';

type ContadorOfertaProps = {
  segundos: number;
  urgente: boolean;
};

// Contador derivado de `expiraEn`: solo presenta el tiempo restante ya
// calculado; nunca inicia ni reinicia el plazo por sí mismo.
export function ContadorOferta({ segundos, urgente }: ContadorOfertaProps) {
  return (
    <View
      accessible
      accessibilityLabel={`Tiempo restante para responder: ${segundos} segundos`}
      style={[styles.base, urgente && styles.baseUrgente]}
    >
      <Text style={styles.etiqueta}>Tiempo restante para responder</Text>
      <View style={styles.fila}>
        <Text style={[styles.numero, urgente && styles.numeroUrgente]}>{segundos}</Text>
        <Text style={styles.unidad}>segundos</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#ffffff',
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  baseUrgente: {
    borderColor: colors.amber,
    backgroundColor: '#fdf3d6',
  },
  etiqueta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  numero: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  numeroUrgente: {
    color: colors.amber,
  },
  unidad: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700',
  },
});
