import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../../theme/tokens';

type FilaDatoProps = {
  etiqueta: string;
  valor: string;
  detalle?: string | null;
};

// Fila reutilizable etiqueta/valor para los datos de la oferta. Los valores
// nullable se resuelven en la pantalla con alternativas honestas.
export function FilaDato({ etiqueta, valor, detalle }: FilaDatoProps) {
  return (
    <View style={styles.fila}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Text style={styles.valor}>{valor}</Text>
      {detalle ? <Text style={styles.detalle}>{detalle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    gap: 2,
  },
  etiqueta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  valor: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  detalle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs / 2,
  },
});
