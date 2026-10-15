import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useScreenBackground } from '../features/ui/system-bar-context';
import { colors, spacing } from '../theme/tokens';

type ScreenProps = {
  children?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  background?: string;
};

export function Screen({
  children,
  header,
  footer,
  scroll = false,
  refreshing = false,
  onRefresh,
  style,
  contentContainerStyle,
  background,
}: ScreenProps) {
  const backgroundColor =
    background ?? (style?.backgroundColor as string | undefined) ?? colors.bg;
  useScreenBackground(backgroundColor);

  // El header y el footer gestionan su propio inset (safe area) para que su
  // fondo cubra el área del sistema.
  const edges: Edge[] = [];
  if (!header) {
    edges.push('top');
  }
  edges.push('left', 'right');
  if (!footer) {
    edges.push('bottom');
  }

  const contenido = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.contenidoScroll, contentContainerStyle]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.navy}
            colors={[colors.navy]}
            progressBackgroundColor="#ffffff"
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.contenido, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.base, style, { backgroundColor }]}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {contenido}
      </KeyboardAvoidingView>
      {footer}
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
  contenidoScroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
});
