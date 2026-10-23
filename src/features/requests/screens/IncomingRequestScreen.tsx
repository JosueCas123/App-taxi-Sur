import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../../theme/tokens';
import { Button, Card, ErrorBanner, LoadingState, Screen, StateBadge } from '../../../ui';
import { useSession } from '../../auth/session-context';
import { useDriverEventsContext } from '../../events/driver-events-provider';
import type { SolicitudDetalleDto } from '../api';
import { ContadorOferta } from '../components/ContadorOferta';
import { FilaDato } from '../components/FilaDato';
import { useOfferDeadline } from '../use-offer-deadline';
import { useResponderSolicitud } from '../use-respond';

// Distancia en km con coma decimal (presentación local); "1,2 km".
function formatoDistanciaKm(km: number): string {
  const redondeado = Math.round(km * 10) / 10;
  return `${String(redondeado).replace('.', ',')} km`;
}

function coordenadasDe(solicitud: SolicitudDetalleDto): string {
  return `${solicitud.latitudRecogida.toFixed(4)}, ${solicitud.longitudRecogida.toFixed(4)}`;
}

export function IncomingRequestScreen() {
  const { token } = useSession();
  const { solicitudActiva, fechaServidorSolicitud, reconciliar } = useDriverEventsContext();

  const vencimiento = useOfferDeadline({
    expiraEn: solicitudActiva?.expiraEn ?? null,
    fechaServidor: fechaServidorSolicitud,
  });

  const { respondiendo, aceptar, rechazar, error, conflicto } = useResponderSolicitud({
    solicitudId: solicitudActiva?.id ?? null,
    token,
    reconciliar,
  });

  // Al llegar a cero: reconciliar una sola vez y navegar a la pantalla de
  // expiración. No existe endpoint de expiración; el backend procesa después.
  const expirada = vencimiento.expirada;
  const navegadoRef = useRef(false);
  useEffect(() => {
    if (!expirada || navegadoRef.current) {
      return;
    }
    navegadoRef.current = true;
    void reconciliar().catch(() => {});
    router.replace('/(operacion)/solicitud-expirada');
  }, [expirada, reconciliar]);

  if (!solicitudActiva) {
    return (
      <Screen contentContainerStyle={styles.centrado}>
        <LoadingState label="Cargando solicitud…" />
      </Screen>
    );
  }

  const enVuelo = respondiendo !== null;
  const accionesBloqueadas = enVuelo || expirada;

  const puntoRecogida = solicitudActiva.puntoRecogidaTexto?.trim() || null;
  const coordenadas = coordenadasDe(solicitudActiva);

  return (
    <Screen scroll contentContainerStyle={styles.contenido}>
      <View style={styles.encabezado}>
        <StateBadge label="Solicitud pendiente" tone="warning" />
        <Text style={styles.titulo}>Un nuevo recorrido.</Text>
      </View>

      {vencimiento.tienePlazo ? (
        <ContadorOferta segundos={vencimiento.restanteSegundos} urgente={vencimiento.urgente} />
      ) : null}

      <Card>
        <FilaDato etiqueta="Pasajero" valor={solicitudActiva.pasajero.nombre} />
        <FilaDato
          etiqueta="Punto de recogida"
          valor={puntoRecogida ?? coordenadas}
        />
        <FilaDato
          etiqueta="Destino"
          valor={solicitudActiva.destino?.trim() || 'Destino no indicado'}
        />
        <FilaDato
          etiqueta="Distancia aproximada a la recogida"
          valor={
            solicitudActiva.distanciaAproximadaKm !== null
              ? formatoDistanciaKm(solicitudActiva.distanciaAproximadaKm)
              : 'Distancia no disponible'
          }
        />
      </Card>

      <Text style={styles.nota}>
        La solicitud queda reservada para ti mientras decides. El teléfono del pasajero es privado.
      </Text>

      {conflicto ? (
        <View accessibilityRole="alert" style={styles.conflicto}>
          <Text style={styles.conflictoTexto}>
            La solicitud ya no está disponible. Actualizando tu jornada…
          </Text>
        </View>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.acciones}>
        <Button
          label="Aceptar"
          onPress={aceptar}
          loading={respondiendo === 'aceptar'}
          disabled={accionesBloqueadas}
        />
        <Button
          label="Rechazar"
          variant="secondary"
          onPress={rechazar}
          loading={respondiendo === 'rechazar'}
          disabled={accionesBloqueadas}
        />
      </View>

      <Text style={styles.aviso}>Responde solo cuando estés detenido.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centrado: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  contenido: {
    gap: spacing.md,
  },
  encabezado: {
    gap: spacing.sm,
  },
  titulo: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 33,
  },
  nota: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  conflicto: {
    backgroundColor: 'rgba(40, 100, 185, 0.12)',
    borderRadius: spacing.sm,
    padding: spacing.md,
  },
  conflictoTexto: {
    color: colors.blue,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  acciones: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  aviso: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
});
