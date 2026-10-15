import { Stack } from 'expo-router';

import {
  LocationSharingProvider,
  UbicacionOperativaPuente,
} from '../../features/location/location-sharing-provider';
import { ReconciliacionOfertaProvider } from '../../features/shift/reconciliacion-oferta';
import { GuardRutaOperativa, GuardRutaPrivada } from '../../navigation/guard-sesion';
import { colors } from '../../theme/tokens';

export default function OperacionLayout() {
  return (
    <GuardRutaPrivada>
      <GuardRutaOperativa>
        <LocationSharingProvider>
          <UbicacionOperativaPuente>
            <ReconciliacionOfertaProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                }}
              />
            </ReconciliacionOfertaProvider>
          </UbicacionOperativaPuente>
        </LocationSharingProvider>
      </GuardRutaOperativa>
    </GuardRutaPrivada>
  );
}