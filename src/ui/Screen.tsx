import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useScreenBackground } from '../features/ui/system-bar-context';
import { colors, spacing } from '../theme/tokens';

type ScreenProps = {
  children?: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  background?: string;
};

export function Screen({
  children,
  scroll = false,
  style,
  contentContainerStyle,
  background,
}: ScreenProps) {
  const backgroundColor =
    background ?? (style?.backgroundColor as string | undefined) ?? colors.bg;
  useScreenBackground(backgroundColor);

  const contenido = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.contenido, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.contenido, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.base, style]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {contenido}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  contenido: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
});