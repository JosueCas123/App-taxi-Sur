import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { Platform, StatusBar as NativeStatusBar, StyleSheet, View } from 'react-native';

import { colors } from '../../theme/tokens';

type SystemBarContextValue = {
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
};

const SystemBarContext = createContext<SystemBarContextValue>({
  backgroundColor: colors.bg,
  setBackgroundColor: () => {},
});

export function SystemBarProvider({ children }: { children: React.ReactNode }) {
  const [backgroundColor, setBackgroundColor] = useState<string>(colors.bg);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(backgroundColor);
  }, [backgroundColor]);

  const barStyle = isDarkColor(backgroundColor) ? 'light' : 'dark';

  return (
    <SystemBarContext.Provider value={{ backgroundColor, setBackgroundColor }}>
      <View style={[styles.root, { backgroundColor }]}>
        {/* RN 0.86 still supports native bar colors on pre-Android 15 non-edge-to-edge hosts. */}
        {Platform.OS === 'android' && Platform.Version < 35 ? (
          <NativeStatusBar
            barStyle={barStyle === 'light' ? 'light-content' : 'dark-content'}
            backgroundColor={backgroundColor}
            translucent={false}
          />
        ) : (
          <StatusBar style={barStyle} />
        )}
        <NavigationBar style={barStyle} />
        {children}
      </View>
    </SystemBarContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export function useSystemBar() {
  return useContext(SystemBarContext);
}

export function useScreenBackground(color: string = colors.bg) {
  const { setBackgroundColor } = useSystemBar();
  useFocusEffect(
    useCallback(() => {
      setBackgroundColor(color);
    }, [color, setBackgroundColor])
  );
}

function isDarkColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}
