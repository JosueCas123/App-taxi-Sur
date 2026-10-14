import { Stack } from 'expo-router';

import { GuardRutaOperativa, GuardRutaPrivada } from '../../navigation/guard-sesion';
import { colors } from '../../theme/tokens';

export default function OperacionLayout() {
  return (
    <GuardRutaPrivada>
      <GuardRutaOperativa>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </GuardRutaOperativa>
    </GuardRutaPrivada>
  );
}