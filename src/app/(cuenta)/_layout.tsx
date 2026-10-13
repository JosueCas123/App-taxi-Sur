import { Stack } from 'expo-router';

import { GuardRutaPrivada } from '../../navigation/guard-sesion';
import { colors } from '../../theme/tokens';

export default function CuentaLayout() {
  return (
    <GuardRutaPrivada>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </GuardRutaPrivada>
  );
}