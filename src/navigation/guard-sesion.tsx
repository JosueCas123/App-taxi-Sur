import { router, usePathname } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { RefrescoPerfilProvider } from '../features/account/use-refresco-perfil';
import { useSession } from '../features/auth/session-context';
import { LoadingState } from '../ui';
import {
  evaluarAccesoOperativo,
  pathnameCuentaPorEstado,
  rutaInicialPorEstado,
  type ServicioConfirmado,
} from './resolve-route';

function PantallaDeEspera() {
  return (
    <View style={styles.espera}>
      <LoadingState label="Restaurando sesión…" />
    </View>
  );
}

export function GuardRutaPrivada({ children }: { children: ReactNode }) {
  const { status } = useSession();

  useEffect(() => {
    if (status === 'no_autenticado' || status === 'sesion_incompatible') {
      router.replace('/login');
    } else if (status === 'sesion_sin_verificar') {
      router.replace('/sesion-sin-verificar');
    }
  }, [status]);

  if (status === 'autenticado') {
    return <RefrescoPerfilProvider>{children}</RefrescoPerfilProvider>;
  }
  return <PantallaDeEspera />;
}

export function GuardRutaAuth({ children }: { children: ReactNode }) {
  const { status, conductor } = useSession();

  useEffect(() => {
    if (status === 'autenticado') {
      if (!conductor) {
        return;
      }
      router.replace(rutaInicialPorEstado(conductor.estado));
    } else if (status === 'sesion_sin_verificar') {
      router.replace('/sesion-sin-verificar');
    }
  }, [status, conductor]);

  if (status === 'autenticado' || status === 'sesion_sin_verificar') {
    return <PantallaDeEspera />;
  }
  return children;
}

// M02 no integra M05: aún no existe una fuente de servicio confirmado.
// M05 deberá inyectar aquí la entrada producida desde la API real.
const servicioConfirmado: ServicioConfirmado | null = null;

// Bloquea el render de rutas operativas para cuentas restringidas sin servicio
// confirmado, antes de redirigir, evitando que deep links eludan el estado.
export function GuardRutaOperativa({ children }: { children: ReactNode }) {
  const { status, conductor } = useSession();

  const acceso =
    status === 'autenticado' && conductor
      ? evaluarAccesoOperativo(conductor.estado, conductor.id, servicioConfirmado)
      : 'bloqueado_por_estado';

  useEffect(() => {
    if (status !== 'autenticado' || !conductor) {
      return;
    }
    if (acceso !== 'permitido') {
      router.replace(rutaInicialPorEstado(conductor.estado));
    }
  }, [status, conductor, acceso]);

  if (status === 'autenticado' && conductor && acceso === 'permitido') {
    return <>{children}</>;
  }
  return <PantallaDeEspera />;
}

// Mantiene cada pantalla de cuenta alineada con el perfil real: redirige al
// estado que corresponde (incluido aprobado → inicio) sin renderizar otra cuenta.
export function GuardRutaCuenta({ children }: { children: ReactNode }) {
  const { status, conductor } = useSession();
  const pathname = usePathname();

  const desalineado =
    status === 'autenticado' &&
    conductor != null &&
    (conductor.estado === 'aprobado' ||
      pathname !== pathnameCuentaPorEstado(conductor.estado));

  useEffect(() => {
    if (status !== 'autenticado' || !conductor || !desalineado) {
      return;
    }
    router.replace(rutaInicialPorEstado(conductor.estado));
  }, [status, conductor, desalineado]);

  if (desalineado) {
    return <PantallaDeEspera />;
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  espera: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
});