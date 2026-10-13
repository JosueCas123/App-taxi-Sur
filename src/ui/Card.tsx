import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme/tokens';

type CardProps = {
  children: ReactNode;
  style?: ViewStyle;
  elevado?: boolean;
};

export function Card({ children, style, elevado = false }: CardProps) {
  return <View style={[styles.base, elevado && styles.elevado, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#ffffff',
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  elevado: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});