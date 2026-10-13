import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native';

import { colors, minTouchTarget, radius, spacing } from '../theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  trailingIcon?: ReactNode;
};

const VARIANTES: Record<ButtonVariant, { fondo: string; texto: string; contorno?: string }> = {
  primary: { fondo: colors.yellow, texto: colors.ink },
  secondary: { fondo: 'transparent', texto: colors.ink, contorno: colors.line },
  danger: { fondo: colors.red, texto: '#ffffff' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  trailingIcon,
}: ButtonProps) {
  const colores = VARIANTES[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: colores.fondo },
        colores.contorno && { borderWidth: 1, borderColor: colores.contorno },
        disabled && styles.deshabilitado,
        pressed && styles.presionado,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colores.texto} />
      ) : (
        <>
          <Text style={[styles.texto, { color: colores.texto }, textStyle]}>{label}</Text>
          {trailingIcon}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  deshabilitado: {
    opacity: 0.5,
  },
  presionado: {
    opacity: 0.85,
  },
  texto: {
    fontSize: 16,
    fontWeight: '700',
  },
});
