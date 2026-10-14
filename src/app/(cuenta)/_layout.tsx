import { Stack } from 'expo-router';

import { GuardRutaCuenta, GuardRutaPrivada } from '../../navigation/guard-sesion';
import { colors } from '../../theme/tokens';

export default function CuentaLayout() {
  return (
    <GuardRutaPrivada>
      <GuardRutaCuenta>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </GuardRutaCuenta>
    </GuardRutaPrivada>
  );
}