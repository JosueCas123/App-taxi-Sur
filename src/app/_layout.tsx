import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '../features/auth/session-context';
import { SystemBarProvider } from '../features/ui/system-bar-context';
import { queryClient } from '../lib/query-client';
import { colors } from '../theme/tokens';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <SystemBarProvider>
            <NavigationBar style="dark" />
            <Stack
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
            />
          </SystemBarProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}