import { Stack } from 'expo-router';

import { GuardRutaAuth } from '../../navigation/guard-sesion';
import { colors } from '../../theme/tokens';

export default function AuthLayout() {
  return (
    <GuardRutaAuth>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </GuardRutaAuth>
  );
}