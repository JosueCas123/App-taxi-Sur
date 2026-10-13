import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type SessionStatus = 'restaurando' | 'autenticado' | 'no_autenticado';

type SessionContextValue = {
  status: SessionStatus;
  restaurarSesion: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('restaurando');

  const restaurarSesion = useMemo(
    () => async () => {
      // Restauración real de sesión (SecureStore/JWT) -> M01. Stub en M00.
      setStatus('no_autenticado');
    },
    []
  );

  const value = useMemo(
    () => ({ status, restaurarSesion }),
    [status, restaurarSesion]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession debe usarse dentro de SessionProvider');
  }
  return ctx;
}