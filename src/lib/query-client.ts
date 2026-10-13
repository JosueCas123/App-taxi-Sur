import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  conductor: (id: string) => ['conductor', id] as const,
  solicitudActiva: (conductorId: string) => ['solicitudActiva', conductorId] as const,
  solicitud: (id: string) => ['solicitud', id] as const,
  configuracion: () => ['configuracion'] as const,
};

const REINTENTOS_LECTURAS = 2;
const SIN_REINTENTO_MUTACIONES = 0;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: REINTENTOS_LECTURAS,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: SIN_REINTENTO_MUTACIONES,
    },
  },
});