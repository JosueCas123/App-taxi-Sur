import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, minTouchTarget } from '../theme/tokens';

type SwitchToggleProps = {
  value: boolean;
  onToggle?: () => void;
  label: string;
  disabled?: boolean;
  style?: ViewStyle;
};

export function SwitchToggle({ value, onToggle, label, disabled = false, style }: SwitchToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={onToggle}
      hitSlop={8}
      style={[styles.zona, disabled && styles.deshabilitado, style]}
    >
      <View style={[styles.pista, value && styles.pistaActiva]}>
        <View style={[styles.perilla, value && styles.perillaActiva]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zona: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deshabilitado: {
    opacity: 0.48,
  },
  pista: {
    width: 53,
    height: 32,
    borderRadius: 50,
    padding: 3,
    backgroundColor: '#d1d9e4',
    justifyContent: 'center',
  },
  pistaActiva: {
    backgroundColor: colors.yellow,
  },
  perilla: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
    shadowColor: '#25364f',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  perillaActiva: {
    backgroundColor: colors.navy,
    alignSelf: 'flex-end',
  },
});
