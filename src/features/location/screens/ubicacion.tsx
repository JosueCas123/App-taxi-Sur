import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, spacing } from '../../../theme/tokens';
import { Button, Card, ErrorBanner, LoadingState, Screen, StateBadge } from '../../../ui';
import type { BadgeTone } from '../../../ui/StateBadge';
import type { MotivoUbicacionNoLista } from '../../shift/ubicacion-operativa';
import { EstadoUbicacionDesactualizada } from '../components/EstadoUbicacionDesactualizada';
import { abrirAjustes } from '../location-service';
import { useLocationSharing } from '../location-sharing-provider';

const MENSAJE_ERROR_RED =
  'No pudimos enviar tu ubicación. Revisa tu conexión e inténtalo de nuevo.';

const MENSAJE_DENEGADO_PERMANENTE =
  'El permiso está bloqueado. Ábrelo en los ajustes del sistema para volver a intentarlo.';

type MotivoSimple = Exclude<MotivoUbicacionNoLista, 'desactualizada' | 'error_red'>;

const ESTADO_SIN_MUESTRA: Record<MotivoSimple, { etiqueta: string; detalle: string; tono: BadgeTone }> =
  {
    m04_pendiente: {
      etiqueta: 'Sin ubicación',
      detalle: 'Comparte tu ubicación para estar operativo.',
      tono: 'neutral',
    },
    sin_muestra: {
      etiqueta: 'Sin ubicación',
      detalle: 'Aún no tenemos una ubicación tuya.',
      tono: 'neutral',
    },
    permiso_denegado: {
      etiqueta: 'Permiso denegado',
      detalle: 'Necesitamos tu permiso para compartir la ubicación.',
      tono: 'danger',
    },
    gps_apagado: {
      etiqueta: 'GPS apagado',
      detalle: 'Activa la ubicación del teléfono para continuar.',
      tono: 'warning',
    },
    precision_insuficiente: {
      etiqueta: 'Precisión insuficiente',
      detalle: 'Muévete a un lugar abierto e inténtalo de nuevo.',
      tono: 'warning',
    },
  };

function volverAJornada() {
  router.replace('/(operacion)/inicio');
}

// Explicación concreta mostrada antes de solicitar el permiso del sistema.
const FACETAS: { titulo: string; detalle: string; icono: ReactNode }[] = [
  {
    titulo: 'Durante tu jornada',
    detalle: 'Se actualiza mientras tu jornada esté activa y usas la app.',
    icono: (
      <Svg
        height={20}
        width={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke={colors.amber}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Circle cx={12} cy={12} r={4} />
        <Path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </Svg>
    ),
  },
  {
    titulo: 'Para coordinar tus servicios',
    detalle: 'La administración supervisa tu ubicación desde la central.',
    icono: (
      <Svg
        height={20}
        width={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke={colors.muted}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" />
        <Path d="m8 12 3 3 5-6" />
      </Svg>
    ),
  },
  {
    titulo: 'Tú decides cuándo trabajar',
    detalle: 'Puedes iniciar jornada sin este permiso, pero no ponerte disponible.',
    icono: (
      <Svg
        height={20}
        width={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke={colors.muted}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Circle cx={12} cy={12} r={9} />
        <Path d="M12 11v6m0-10v.2" />
      </Svg>
    ),
  },
];

export function UbicacionScreen() {
  const { estado, compartiendo, permiso, iniciando, error, iniciar, detener, reintentar } =
    useLocationSharing();

  const permanente = permiso === 'denegado_permanente';

  let estadoUI: ReactNode;
  if (estado.lista) {
    estadoUI = (
      <Card>
        <StateBadge label="Ubicación lista" tone="success" />
        <Text style={styles.estadoDetalle}>Compartiendo durante tu jornada.</Text>
      </Card>
    );
  } else if (estado.motivo === 'desactualizada') {
    estadoUI = (
      <EstadoUbicacionDesactualizada
        onActualizar={reintentar}
        onVolverJornada={volverAJornada}
      />
    );
  } else if (estado.motivo === 'error_red') {
    estadoUI = <ErrorBanner message={error ?? MENSAJE_ERROR_RED} onRetry={reintentar} />;
  } else {
    const clave: MotivoSimple = estado.motivo ?? 'sin_muestra';
    const info = ESTADO_SIN_MUESTRA[clave];
    estadoUI = (
      <Card>
        <StateBadge label={info.etiqueta} tone={info.tono} />
        <Text style={styles.estadoDetalle}>
          {clave === 'permiso_denegado' && permanente ? MENSAJE_DENEGADO_PERMANENTE : info.detalle}
        </Text>
        {clave === 'permiso_denegado' && permanente ? (
          <Button
            label="Abrir ajustes"
            variant="secondary"
            onPress={abrirAjustes}
            style={styles.ajustes}
          />
        ) : null}
      </Card>
    );
  }

  // Variables auxiliares para renderizado de acciones (no utilizadas directamente)

  return (
    <Screen
      scroll
      edges={['left', 'right']}
      contentContainerStyle={styles.contenido}
    >
      <View style={styles.orb}>
        <View style={styles.orbIconBox}>
          <Svg
            height={24}
            width={24}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.navy}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
            <Circle cx={12} cy={10} r={2.5} />
          </Svg>
        </View>
      </View>

      <View style={styles.intro}>
        <Text style={styles.titulo}>Comparte tu ubicación.</Text>
        <Text style={styles.descripcion}>
          La central la necesita para conectarte con solicitudes cercanas.
        </Text>
      </View>

      <Card style={styles.checklistCard}>
        <View style={styles.checklist}>
          {FACETAS.map((faceta, index) => (
            <View key={faceta.titulo} style={styles.checkitem}>
              <View
                style={[
                  styles.iconbox,
                  index === 0 && styles.iconboxYellow,
                ]}
              >
                {faceta.icono}
              </View>
              <View style={styles.checkitemText}>
                <Text style={styles.facetaTitulo}>{faceta.titulo}</Text>
                <Text style={styles.facetaDetalle}>{faceta.detalle}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      {iniciando ? <LoadingState label="Solicitando permiso…" /> : estadoUI}

      <View style={styles.acciones}>
        {!compartiendo && !estado.lista && estado.motivo !== 'desactualizada' && estado.motivo !== 'error_red' ? (
          <>
            <Button
              label={iniciando ? 'Compartiendo...' : 'Permitir ubicación'}
              loading={iniciando}
              disabled={iniciando}
              onPress={iniciar}
              trailingIcon={
                <Svg
                  height={18}
                  width={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.ink}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
                  <Circle cx={12} cy={10} r={2.5} />
                </Svg>
              }
            />
            <Button label="Volver a mi jornada" variant="secondary" onPress={volverAJornada} />
          </>
        ) : null}

        {compartiendo && !estado.lista && estado.motivo !== 'desactualizada' && estado.motivo !== 'error_red' ? (
          <>
            <Button
              label={iniciando ? 'Compartiendo...' : 'Reintentar compartir'}
              loading={iniciando}
              disabled={iniciando}
              onPress={reintentar}
              variant="secondary"
            />
            <Button label="Volver a mi jornada" variant="secondary" onPress={volverAJornada} />
          </>
        ) : null}

        {estado.lista && compartiendo ? (
          <>
            <Button label="Dejar de compartir" variant="secondary" onPress={detener} disabled={iniciando} />
            <Button label="Volver a mi jornada" variant="secondary" onPress={volverAJornada} />
          </>
        ) : null}

        {estado.lista && !compartiendo ? (
          <>
            <Button label="Compartir ubicación" onPress={iniciar} loading={iniciando} disabled={iniciando} />
            <Button label="Volver a mi jornada" variant="secondary" onPress={volverAJornada} />
          </>
        ) : null}

        {estado.motivo === 'desactualizada' || estado.motivo === 'error_red' ? (
          <Button label="Volver a mi jornada" variant="secondary" onPress={volverAJornada} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenido: {
    gap: spacing.md,
  },
  orb: {
    height: 72,
    width: 72,
    borderRadius: 24,
    backgroundColor: '#eef3f8',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  orbIconBox: {
    height: 48,
    width: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(17,30,47,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intro: {
    gap: spacing.xs,
  },
  titulo: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 33,
  },
  descripcion: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  checklistCard: {
    padding: 0,
    overflow: 'hidden',
  },
  checklist: {
    gap: spacing.md,
    padding: spacing.md,
  },
  checkitem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconbox: {
    height: 40,
    width: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(17,30,47,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconboxYellow: {
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  checkitemText: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  faceta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  facetaTitulo: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  facetaDetalle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  facetaIcono: {
    height: 40,
    width: 40,
    borderRadius: 12,
    backgroundColor: '#eef3f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
  },
  estadoDetalle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  ajustes: {
    marginTop: spacing.xs,
  },
  acciones: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
