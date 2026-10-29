import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { ConductorDetalleDto } from '../../auth/api';
import { useSession } from '../../auth/session-context';
import { useDriverEventsContext } from '../../events/driver-events-provider';
import { colors, radius, spacing } from '../../../theme/tokens';
import { Button, Card, ErrorBanner, Screen, StateBadge } from '../../../ui';
import { abreviarUuid } from '../finalizacion';

const MENSAJE_ERROR_RECONCILIAR =
  'No pudimos actualizar tu jornada. Reintenta para continuar.';

function mensajeJornada(conductor: ConductorDetalleDto | null): string | null {
  if (!conductor) {
    return null;
  }
  if (conductor.cierreJornadaSolicitado) {
    return 'Tu jornada se cerrará al finalizar el servicio.';
  }
  if (conductor.estadoJornada === 'finalizada') {
    return 'Tu jornada quedó finalizada. No estás disponible para nuevos servicios.';
  }
  if (conductor.estadoDisponibilidad === 'disponible') {
    return 'Estás disponible para un nuevo servicio.';
  }
  return 'Tu jornada sigue activa.';
}

export function ServicioFinalizadoScreen() {
  const { conductor } = useSession();
  const { servicioFinalizadoId, reconciliar, limpiarServicioFinalizado } =
    useDriverEventsContext();

  const [volviendo, setVolviendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enVuelo = useRef(false);

  const jornada = mensajeJornada(conductor);

  async function volverAJornada() {
    if (enVuelo.current) {
      return;
    }
    enVuelo.current = true;
    setVolviendo(true);
    setError(null);
    try {
      await reconciliar();
      limpiarServicioFinalizado();
      router.replace('/(operacion)/inicio');
    } catch {
      setError(MENSAJE_ERROR_RECONCILIAR);
    } finally {
      enVuelo.current = false;
      setVolviendo(false);
    }
  }

  return (
    <Screen contentContainerStyle={styles.contenido}>
      <View style={styles.orb}>
        <Svg
          height={30}
          width={30}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.green}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="m5 12 4 4L20 5" />
        </Svg>
      </View>

      <StateBadge label="Servicio finalizado" tone="success" />

      <Text style={styles.titulo}>Buen recorrido.{'\n'}Servicio completado.</Text>
      <Text style={styles.detalle}>La finalización del servicio quedó confirmada.</Text>

      {servicioFinalizadoId ? (
        <View style={styles.uuidCaja}>
          <Text style={styles.uuidEtiqueta}>SERVICIO</Text>
          <Text style={styles.uuidValor}>{abreviarUuid(servicioFinalizadoId)}</Text>
        </View>
      ) : null}

      {jornada ? (
        <Card style={styles.jornada}>
          <Text style={styles.jornadaEtiqueta}>Tu jornada</Text>
          <Text style={styles.jornadaTexto}>{jornada}</Text>
        </Card>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}

      <Button
        label="Volver a mi jornada"
        onPress={() => {
          void volverAJornada();
        }}
        loading={volviendo}
        disabled={volviendo}
        style={styles.accion}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenido: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  orb: {
    height: 72,
    width: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(22, 129, 96, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  titulo: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 33,
    marginTop: spacing.xs,
  },
  detalle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  uuidCaja: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderColor: colors.line,
    borderRadius: radius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  uuidEtiqueta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  uuidValor: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  jornada: {
    marginTop: spacing.sm,
  },
  jornadaEtiqueta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  jornadaTexto: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  accion: {
    marginTop: spacing.md,
  },
});
