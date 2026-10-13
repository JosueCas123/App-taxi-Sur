import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, minTouchTarget, radius, spacing } from '../theme/tokens';

type ErrorBannerProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
};

export function ErrorBanner({
  message,
  onRetry,
  retryLabel = 'Reintentar',
  style,
}: ErrorBannerProps) {
  return (
    <View accessibilityRole="alert" style={[styles.base, style]}>
      <Text style={styles.texto}>{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          onPress={onRetry}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.reintento, pressed && styles.reintentoPresionado]}
        >
          <Text style={styles.reintentoTexto}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.red,
    borderRadius: radius,
    padding: spacing.md,
    gap: spacing.sm,
  },
  texto: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  reintento: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  reintentoPresionado: {
    opacity: 0.7,
  },
  reintentoTexto: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});