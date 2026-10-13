import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSession } from '../features/auth/session-context';
import { LoadingState } from '../ui';
import { rutaInicialPorEstado } from './resolve-route';

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
    return children;
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

const styles = StyleSheet.create({
  espera: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
});