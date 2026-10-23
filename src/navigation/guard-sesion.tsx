import { router, usePathname } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { RefrescoPerfilProvider } from '../features/account/use-refresco-perfil';
import { useSession } from '../features/auth/session-context';
import { useDriverEventsContext } from '../features/events/driver-events-provider';
import { useAhoraServidorMs } from '../features/requests/use-offer-deadline';
import { LoadingState } from '../ui';
import {
  evaluarAccesoOperativo,
  esRutaTabOperativa,
  pathnameCuentaPorEstado,
  pathnameDeRuta,
  resolverRutaOperativa,
  RUTA_OPERATIVA_NEUTRA,
  rutaInicialPorEstado,
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

// Bloquea el render de rutas operativas para cuentas restringidas sin servicio
// confirmado, antes de redirigir, evitando que deep links eludan el estado.
// La compuerta de reconciliación inicial evita decidir con datos incompletos:
// hasta que la primera lectura no complete no se evalúa acceso ni se navega
// (`servicioConfirmado: null` no significa "sin servicio").
export function GuardRutaOperativa({ children }: { children: ReactNode }) {
  const { status, conductor } = useSession();
  const {
    servicioConfirmado,
    solicitudActiva,
    reconciliacionInicial,
    fechaServidorSolicitud,
    ofertaDescartadaId,
  } = useDriverEventsContext();
  const pathname = usePathname();

  // Mismo reloj estimado que la pantalla: desfase estable desde la cabecera
  // Date, aplicado al reloj local para orientar la navegación de expiración.
  const ahoraServidorMs = useAhoraServidorMs(fechaServidorSolicitud, Date.now);

  const gateAbierto = reconciliacionInicial === 'completa';

  const acceso =
    status === 'autenticado' && conductor && gateAbierto
      ? evaluarAccesoOperativo(conductor.estado, conductor.id, servicioConfirmado)
      : 'bloqueado_por_estado';

  const rutaResuelta =
    status === 'autenticado' && conductor && gateAbierto
      ? resolverRutaOperativa({ conductor, solicitudActiva }, ahoraServidorMs, ofertaDescartadaId)
      : null;

  useEffect(() => {
    if (status !== 'autenticado' || !conductor || !rutaResuelta) {
      return;
    }
    if (acceso === 'bloqueado_por_estado') {
      router.replace(rutaResuelta);
      return;
    }
    // Las pestañas operativas (inicio/ubicación/mi cuenta) se recorren con
    // libertad mientras la ruta resuelta sea el neutro `inicio`. Cualquier
    // oferta/servicio (o un estado de cuenta) que resuelva otra ruta sí alinea
    // la navegación y expulsa de la pestaña.
    const rutaResueltaPath = pathnameDeRuta(rutaResuelta);
    const enTabLibre =
      rutaResueltaPath === pathnameDeRuta(RUTA_OPERATIVA_NEUTRA) && esRutaTabOperativa(pathname);
    // Oferta/servicio propio: alinea la ruta con el estado reconciliado.
    if (!enTabLibre && rutaResueltaPath !== pathname) {
      router.replace(rutaResuelta);
    }
  }, [status, conductor, acceso, rutaResuelta, pathname]);

  if (status === 'autenticado' && conductor && acceso !== 'bloqueado_por_estado') {
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