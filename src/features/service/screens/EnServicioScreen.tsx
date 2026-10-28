import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { runtimeConfig } from '../../../config/runtime';
import { colors, radius, spacing } from '../../../theme/tokens';
import { Button, Card, ConfirmDialog, LoadingState, Screen, StateBadge } from '../../../ui';
import { useSession } from '../../auth/session-context';
import { useDriverEventsContext } from '../../events/driver-events-provider';
import { obtenerSolicitud, type SolicitudDetalleDto } from '../../requests/api';
import { FilaDato } from '../../requests/components/FilaDato';
import { abreviarUuid } from '../finalizacion';
import { useFinalizarServicio } from '../use-finalizar-servicio';

function coordenadasDe(solicitud: SolicitudDetalleDto): string {
  return `${solicitud.latitudRecogida.toFixed(4)}, ${solicitud.longitudRecogida.toFixed(4)}`;
}

function PanelVerificando() {
  return (
    <Card style={styles.panel}>
      <ActivityIndicator color={colors.blue} />
      <Text style={styles.panelTitulo}>Verificando la finalización…</Text>
      <Text style={styles.panelTexto}>
        No cierres la app. Estamos confirmando con el servidor si el servicio terminó.
      </Text>
    </Card>
  );
}

type PanelNoVerificableProps = {
  solicitudId: string | null;
  onVolverAVerificar: () => void;
  contactoAyuda: string | null;
  onAyuda: () => void;
};

function PanelNoVerificable({
  solicitudId,
  onVolverAVerificar,
  contactoAyuda,
  onAyuda,
}: PanelNoVerificableProps) {
  return (
    <Card style={styles.panel}>
      <StateBadge label="Sin verificar" tone="warning" />
      <Text style={styles.panelTitulo}>No pudimos verificar la finalización</Text>
      <Text style={styles.panelTexto}>
        No confirmamos que el servicio haya terminado. Vuelve a verificar cuando tengas conexión
        o contacta al centro de ayuda.
      </Text>
      {solicitudId ? (
        <Text style={styles.panelUuid}>Servicio {abreviarUuid(solicitudId)}</Text>
      ) : null}
      <Button
        label="Volver a verificar"
        onPress={onVolverAVerificar}
        style={styles.panelAccion}
      />
      {contactoAyuda ? (
        <Button
          label="Llamar al centro de ayuda"
          variant="secondary"
          onPress={onAyuda}
          style={styles.panelAccion}
        />
      ) : null}
    </Card>
  );
}

export function EnServicioScreen() {
  const { token, conductorId, conductor, invalidarSesion } = useSession();
  const {
    solicitudActiva,
    servicioFinalizadoId,
    servicioEnVerificacionId,
    reconciliar,
    marcarServicioFinalizado,
    marcarServicioEnVerificacion,
    limpiarServicioEnVerificacion,
  } = useDriverEventsContext();

  const { fase, finalizando, finalizar, reintentarVerificacion } = useFinalizarServicio({
    solicitudId: solicitudActiva?.id ?? null,
    token,
    conductorId,
    obtenerDetalle: obtenerSolicitud,
    reconciliar,
    marcarServicioFinalizado,
    marcarServicioEnVerificacion,
    limpiarServicioEnVerificacion,
    invalidarSesion,
  });

  const [confirmacionVisible, setConfirmacionVisible] = useState(false);

  useEffect(() => {
    if (fase === 'confirmada') {
      router.replace('/(operacion)/servicio-finalizado');
    }
  }, [fase]);

  const contactoAyuda = runtimeConfig.contactoAyuda;
  const solicitudIdConocida =
    solicitudActiva?.id ?? servicioEnVerificacionId ?? servicioFinalizadoId;

  function pedirAyuda() {
    if (contactoAyuda) {
      void Linking.openURL(`tel:${contactoAyuda}`);
    }
  }

  function confirmarFinalizacion() {
    setConfirmacionVisible(false);
    finalizar();
  }

  if (!solicitudActiva) {
    if (fase === 'no_verificable') {
      return (
        <Screen contentContainerStyle={styles.contenido}>
          <PanelNoVerificable
            solicitudId={solicitudIdConocida}
            onVolverAVerificar={reintentarVerificacion}
            contactoAyuda={contactoAyuda}
            onAyuda={pedirAyuda}
          />
        </Screen>
      );
    }
    return (
      <Screen contentContainerStyle={styles.centrado}>
        <LoadingState
          label={fase === 'verificando' ? 'Verificando la finalización…' : 'Cargando servicio…'}
        />
      </Screen>
    );
  }

  const puntoRecogida = solicitudActiva.puntoRecogidaTexto?.trim() || null;
  const coordenadas = coordenadasDe(solicitudActiva);
  const sinVerificar = fase === 'no_verificable';
  const verificando = fase === 'verificando';

  return (
    <Screen scroll contentContainerStyle={styles.contenido}>
      <View style={styles.encabezado}>
        <View style={styles.filaEncabezado}>
          <StateBadge label="En servicio" tone="info" />
          <Text style={styles.uuid}>Servicio {abreviarUuid(solicitudActiva.id)}</Text>
        </View>
        <Text style={styles.titulo}>Tu servicio actual.</Text>
        <Text style={styles.subtitulo}>La información que necesitas para este recorrido.</Text>
      </View>

      <Card>
        <FilaDato etiqueta="Pasajero" valor={solicitudActiva.pasajero.nombre} />
        <FilaDato etiqueta="Punto de recogida" valor={puntoRecogida ?? coordenadas} />
        <FilaDato
          etiqueta="Destino"
          valor={solicitudActiva.destino?.trim() || 'Destino no indicado'}
        />
      </Card>

      {conductor?.estado === 'suspendido' ? (
        <View accessibilityRole="alert" style={[styles.aviso, styles.avisoAlerta]}>
          <Text style={styles.avisoTitulo}>Cuenta suspendida</Text>
          <Text style={styles.avisoTexto}>
            Puedes finalizar este servicio, pero no iniciar una nueva jornada ni activar tu
            disponibilidad.
          </Text>
        </View>
      ) : null}

      {conductor?.cierreJornadaSolicitado ? (
        <View style={[styles.aviso, styles.avisoInfo]}>
          <Text style={styles.avisoTitulo}>Cierre de jornada solicitado</Text>
          <Text style={styles.avisoTexto}>
            Tu jornada se cerrará automáticamente al finalizar este servicio.
          </Text>
        </View>
      ) : null}

      {fase === 'sigue_en_servicio' ? (
        <View accessibilityRole="alert" style={[styles.aviso, styles.avisoAlerta]}>
          <Text style={styles.avisoTitulo}>El servicio sigue activo</Text>
          <Text style={styles.avisoTexto}>
            El servidor no confirmó la finalización. Puedes volver a intentarlo.
          </Text>
        </View>
      ) : null}

      {verificando ? <PanelVerificando /> : null}

      {sinVerificar ? (
        <PanelNoVerificable
          solicitudId={null}
          onVolverAVerificar={reintentarVerificacion}
          contactoAyuda={contactoAyuda}
          onAyuda={pedirAyuda}
        />
      ) : !verificando ? (
        <>
          <Text style={styles.nota}>
            Finaliza el servicio solo cuando hayas completado el recorrido.
          </Text>
          <Button
            label="Finalizar servicio"
            onPress={() => setConfirmacionVisible(true)}
            loading={finalizando}
            disabled={finalizando}
          />
        </>
      ) : null}

      <Text style={styles.privacidad}>El teléfono del pasajero es privado.</Text>

      <ConfirmDialog
        visible={confirmacionVisible}
        titulo="¿Finalizar el servicio?"
        mensaje="Confirma que completaste el recorrido. Esta acción no se puede deshacer."
        confirmarLabel="Sí, finalizar"
        cancelarLabel="Cancelar"
        confirmacionPeligrosa
        confirmando={finalizando}
        onCancel={() => setConfirmacionVisible(false)}
        onConfirm={confirmarFinalizacion}
      />
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
  filaEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  uuid: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  titulo: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 33,
  },
  subtitulo: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  aviso: {
    borderRadius: radius,
    padding: spacing.md,
    gap: spacing.xs,
  },
  avisoInfo: {
    backgroundColor: 'rgba(40, 100, 185, 0.12)',
  },
  avisoAlerta: {
    backgroundColor: 'rgba(134, 92, 8, 0.14)',
  },
  avisoTitulo: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  avisoTexto: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
  },
  panel: {
    gap: spacing.sm,
  },
  panelTitulo: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  panelTexto: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  panelUuid: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  panelAccion: {
    marginTop: spacing.xs,
  },
  nota: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  privacidad: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
});
