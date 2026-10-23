import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, spacing } from '../../../theme/tokens';
import { Button, Screen, StateBadge } from '../../../ui';
import { useDriverEventsContext } from '../../events/driver-events-provider';

export function ExpiredRequestScreen() {
  const { solicitudActiva, descartarOfertaVencida, reconciliar } = useDriverEventsContext();

  // "Volver a mi jornada": descarta la oferta vencida en memoria para que el
  // guard no regrese a esta pantalla mientras el backend siga devolviéndola,
  // reconcilia una vez y vuelve al inicio.
  function volverAJornada() {
    if (solicitudActiva) {
      descartarOfertaVencida(solicitudActiva.id);
    }
    void reconciliar().catch(() => {});
    router.replace('/(operacion)/inicio');
  }

  return (
    <Screen contentContainerStyle={styles.contenido}>
      <View style={styles.orb}>
        <Svg
          height={30}
          width={30}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.amber}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 7v5l3 2" />
        </Svg>
      </View>

      <StateBadge label="El tiempo se terminó" tone="warning" />

      <Text style={styles.titulo}>La solicitud ha expirado.</Text>
      <Text style={styles.detalle}>
        Pasó el tiempo para responder. La central buscará otro conductor para este servicio.
      </Text>
      <Text style={styles.detalle}>
        Podrás recibir una nueva solicitud si tu jornada, disponibilidad y ubicación siguen activas.
      </Text>

      <Button label="Volver a mi jornada" onPress={volverAJornada} style={styles.accion} />
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
    backgroundColor: '#fdf3d6',
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
  accion: {
    marginTop: spacing.md,
  },
});
