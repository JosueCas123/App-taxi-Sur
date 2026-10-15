import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

import {
  DriverEventsProvider,
  useDriverEventsContext,
} from '../../features/events/driver-events-provider';
import { EstadoConexionBanner } from '../../features/events/components/EstadoConexionBanner';
import {
  LocationSharingProvider,
  UbicacionOperativaPuente,
} from '../../features/location/location-sharing-provider';
import { ReconciliacionOfertaProvider } from '../../features/shift/reconciliacion-oferta';
import { GuardRutaOperativa, GuardRutaPrivada } from '../../navigation/guard-sesion';
import { colors } from '../../theme/tokens';

// Costura de M03 ↔ M05: el 409 invoca el reconciliador real de M05 (perfil +
// solicitud activa en una sola pasada) en lugar del no-op de M03.
function ReconciliacionOfertaInterna({ children }: { children: ReactNode }) {
  const { reconciliar } = useDriverEventsContext();
  return (
    <ReconciliacionOfertaProvider reconciliador={reconciliar}>
      {children}
    </ReconciliacionOfertaProvider>
  );
}

export default function OperacionLayout() {
  return (
    <GuardRutaPrivada>
      <DriverEventsProvider>
        <EstadoConexionBanner />
        <GuardRutaOperativa>
          <LocationSharingProvider>
            <UbicacionOperativaPuente>
              <ReconciliacionOfertaInterna>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.bg },
                  }}
                />
              </ReconciliacionOfertaInterna>
            </UbicacionOperativaPuente>
          </LocationSharingProvider>
        </GuardRutaOperativa>
      </DriverEventsProvider>
    </GuardRutaPrivada>
  );
}
