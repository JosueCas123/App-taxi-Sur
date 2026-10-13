import { useState, type ReactNode } from 'react';
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
  trailingAccessory?: ReactNode;
};

export function TextField({
  label,
  error,
  style,
  containerStyle,
  labelStyle,
  trailingAccessory,
  ...inputProps
}: TextFieldProps) {
  const [enfocado, setEnfocado] = useState(false);
  const conError = Boolean(error);

  return (
    <View style={[styles.contenedor, containerStyle]}>
      {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}
      <View style={styles.inputFila}>
        <TextInput
          {...inputProps}
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          accessibilityState={inputProps.accessibilityState}
          aria-invalid={conError}
          placeholderTextColor={inputProps.placeholderTextColor ?? colors.muted}
          style={[
            styles.input,
            styles.inputFlexible,
            style,
            enfocado && !conError && styles.inputEnfocado,
            conError && styles.inputError,
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
        {trailingAccessory ? <View style={styles.accesorio}>{trailingAccessory}</View> : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputFila: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputFlexible: {
    flex: 1,
    minWidth: 0,
  },
  accesorio: {
    position: 'absolute',
    right: 5,
  },
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
