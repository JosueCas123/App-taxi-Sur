import { createContext, useContext, type ReactNode } from 'react';

import { UbicacionOperativaProvider } from '../shift/ubicacion-operativa';
import { useCompartirUbicacion, type EstadoComparticion } from './use-location-sharing';

const LocationSharingContext = createContext<EstadoComparticion | null>(null);

// Proveedor real de M04: ejecuta el ciclo de compartición una sola vez y expone
// su estado/acciones al subárbol operativo.
export function LocationSharingProvider({ children }: { children: ReactNode }) {
  const compartir = useCompartirUbicacion();
  return (
    <LocationSharingContext.Provider value={compartir}>{children}</LocationSharingContext.Provider>
  );
}

export function useLocationSharing(): EstadoComparticion {
  const ctx = useContext(LocationSharingContext);
  if (!ctx) {
    throw new Error('useLocationSharing debe usarse dentro de LocationSharingProvider');
  }
  return ctx;
}

// Puente M04 -> M03: inyecta el estado real en el contrato que consume `use-shift`.
// Los tests siguen inyectando dobles directamente en `UbicacionOperativaProvider valor`.
export function UbicacionOperativaPuente({ children }: { children: ReactNode }) {
  const { estado } = useLocationSharing();
  return <UbicacionOperativaProvider valor={estado}>{children}</UbicacionOperativaProvider>;
}
