import { createContext, useContext, type ReactNode } from 'react';

import {
  useDriverEvents,
  type OpcionesDriverEvents,
  type UseDriverEventsResult,
} from './use-driver-events';

const DriverEventsContext = createContext<UseDriverEventsResult | null>(null);

// Contexto del stream: mantiene una única conexión SSE por sesión/conductor y
// expone el estado operativo reconciliado al ámbito (operacion). El guard de
// ruta y el banner de conexión lo consumen.
export function DriverEventsProvider({
  children,
  fetchImpl,
}: OpcionesDriverEvents & { children: ReactNode }) {
  const valor = useDriverEvents({ fetchImpl });
  return <DriverEventsContext.Provider value={valor}>{children}</DriverEventsContext.Provider>;
}

export function useDriverEventsContext(): UseDriverEventsResult {
  const contexto = useContext(DriverEventsContext);
  if (!contexto) {
    throw new Error('useDriverEventsContext debe usarse dentro de DriverEventsProvider');
  }
  return contexto;
}
