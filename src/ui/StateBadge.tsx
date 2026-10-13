import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme/tokens';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'info' | 'danger';

type StateBadgeProps = {
  label: string;
  tone?: BadgeTone;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

const TONOS: Record<BadgeTone, { fondo: string; texto: string }> = {
  neutral: { fondo: colors.line, texto: colors.ink },
  success: { fondo: colors.green, texto: '#ffffff' },
  warning: { fondo: colors.amber, texto: '#ffffff' },
  info: { fondo: colors.blue, texto: '#ffffff' },
  danger: { fondo: colors.red, texto: '#ffffff' },
};

export function StateBadge({ label, tone = 'neutral', style, textStyle }: StateBadgeProps) {
  const tono = TONOS[tone];

  return (
    <View style={[styles.base, { backgroundColor: tono.fondo }, style]} accessible>
      <Text style={[styles.texto, { color: tono.texto }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radius,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  texto: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});