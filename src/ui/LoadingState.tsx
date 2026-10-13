import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, spacing } from '../theme/tokens';

type LoadingStateProps = {
  label?: string;
  color?: string;
  style?: ViewStyle;
};

export function LoadingState({ label = 'Cargando…', color = colors.navy, style }: LoadingStateProps) {
  return (
    <View accessibilityRole="progressbar" style={[styles.base, style]} accessible>
      <ActivityIndicator size="large" color={color} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  label: {
    color: colors.muted,
    fontSize: 14,
  },
});