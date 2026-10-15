import { createContext, useContext, type ReactNode } from 'react';

// Contrato de ubicación operativa consumido por el inicio (implementación real en M04).
export type MotivoUbicacionNoLista =
  | 'm04_pendiente'
  | 'permiso_denegado'
  | 'gps_apagado'
  | 'precision_insuficiente'
  | 'error_red'
  | 'sin_muestra'
  | 'desactualizada';

export type EstadoUbicacionOperativa = {
  lista: boolean;
  motivo: MotivoUbicacionNoLista | null;
  // Antigüedad de la última muestra aceptada por el servidor.
  antiguedadMs: number | null;
};

// Proveedor por defecto de la app entregable: GPS "no listo" mientras no hay ciclo real.
// M04 sustituye este valor inyectando el estado real mediante `valor` (puente real);
// fuera del proveedor o sin ciclo activo se conserva este valor "no listo".
const UBICACION_POR_DEFECTO: EstadoUbicacionOperativa = {
  lista: false,
  motivo: 'm04_pendiente',
  antiguedadMs: null,
};

const UbicacionOperativaContext = createContext<EstadoUbicacionOperativa | null>(null);

export function UbicacionOperativaProvider({
  children,
  valor,
}: {
  children: ReactNode;
  // `valor` es el punto de integración real: M04 inyecta el estado de ubicación
  // mediante el puente. Sin `valor` se usa el valor por defecto "no listo"; los
  // tests siguen inyectando dobles por esta misma vía.
  valor?: EstadoUbicacionOperativa;
}) {
  return (
    <UbicacionOperativaContext.Provider value={valor ?? UBICACION_POR_DEFECTO}>
      {children}
    </UbicacionOperativaContext.Provider>
  );
}

export function useUbicacionOperativa(): EstadoUbicacionOperativa {
  return useContext(UbicacionOperativaContext) ?? UBICACION_POR_DEFECTO;
}
