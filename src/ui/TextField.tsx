import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, minTouchTarget, radius, spacing } from '../theme/tokens';

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
};

export function TextField({
  label,
  error,
  style,
  containerStyle,
  labelStyle,
  ...inputProps
}: TextFieldProps) {
  const [enfocado, setEnfocado] = useState(false);
  const conError = Boolean(error);

  return (
    <View style={[styles.contenedor, containerStyle]}>
      {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}
      <TextInput
        {...inputProps}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        accessibilityState={inputProps.accessibilityState}
        aria-invalid={conError}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          enfocado && !conError && styles.inputEnfocado,
          conError && styles.inputError,
          style,
        ]}
        onFocus={(evento) => {
          setEnfocado(true);
          inputProps.onFocus?.(evento);
        }}
        onBlur={(evento) => {
          setEnfocado(false);
          inputProps.onBlur?.(evento);
        }}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    gap: spacing.xs,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
  inputEnfocado: {
    borderColor: colors.navy,
  },
  inputError: {
    borderColor: colors.red,
  },
  error: {
    color: colors.red,
    fontSize: 13,
  },
});