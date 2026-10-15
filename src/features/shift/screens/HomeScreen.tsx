import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, spacing } from '../../../theme/tokens';
import { ErrorBanner, LoadingState, Screen } from '../../../ui';
import { AppHeader } from '../../ui/AppHeader';
import { BottomNav } from '../../ui/BottomNav';
import { accionDisponibilidad, accionJornada } from '../jornada-policy';
import { useShift } from '../use-shift';
import { DisponibilidadCard } from '../components/DisponibilidadCard';
import { EstadoCuentaResumen } from '../components/EstadoCuentaResumen';
import { JornadaCard } from '../components/JornadaCard';
import { UbicacionCard } from '../components/UbicacionCard';

export function HomeScreen() {
  const {
    conductor,
    ubicacion,
    iniciarJornada,
    finalizarJornada,
    activarDisponibilidad,
    desactivarDisponibilidad,
    mutando,
    error,
    conflicto,
    noConfirmado,
    refrescando,
    refrescar,
    reintentarSincronizacion,
  } = useShift();

  if (!conductor) {
    return (
      <Screen header={<AppHeader />} footer={<BottomNav activo="inicio" />}>
        <LoadingState label="Cargando tu jornada…" />
      </Screen>
    );
  }

  const jornada = accionJornada(conductor);
  const disponibilidad = accionDisponibilidad({
    estadoCuenta: conductor.estado,
    estadoJornada: conductor.estadoJornada,
    estadoDisponibilidad: conductor.estadoDisponibilidad,
    ubicacion,
  });

  const nombre = conductor.nombreCompleto?.trim().split(/\s+/)[0] || 'Conductor';

  return (
    <Screen
      scroll
      header={<AppHeader />}
      footer={<BottomNav activo="inicio" />}
      refreshing={refrescando}
      onRefresh={refrescar}
      contentContainerStyle={styles.contenido}
    >
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>TU JORNADA, BAJO CONTROL</Text>
        <Text style={styles.saludo}>Hola, {nombre}......</Text>
        <Text style={styles.introTexto}>Todo listo para tu próximo recorrido.</Text>
      </View>

      {conflicto ? (
        <View style={styles.conflicto} accessibilityRole="alert">
          <Text style={styles.conflictoTexto}>{conflicto}</Text>
        </View>
      ) : null}

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={noConfirmado ? reintentarSincronizacion : undefined}
        />
      ) : null}

      <EstadoCuentaResumen estado={conductor.estado} />

      <View style={styles.stack}>
        <JornadaCard
          estadoJornada={conductor.estadoJornada}
          cierreJornadaSolicitado={conductor.cierreJornadaSolicitado}
          accion={jornada.accion}
          habilitado={jornada.habilitado}
          motivo={jornada.motivo}
          mutando={mutando === 'jornada'}
          onAccion={jornada.accion === 'iniciar' ? iniciarJornada : finalizarJornada}
        />

        <DisponibilidadCard
          estadoDisponibilidad={conductor.estadoDisponibilidad}
          tipo={disponibilidad.tipo}
          habilitado={disponibilidad.habilitado}
          motivo={disponibilidad.motivo}
          mutando={mutando === 'disponibilidad'}
          onActivar={activarDisponibilidad}
          onDesactivar={desactivarDisponibilidad}
        />
      </View>

      <UbicacionCard ubicacion={ubicacion} />

      <View style={styles.privacidad}>
        <Svg
          height={15}
          width={15}
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
        <Text style={styles.privacidadTexto}>
          Mantén la app abierta durante tu jornada para recibir solicitudes.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenido: {
    gap: spacing.md,
  },
  intro: {
    marginBottom: spacing.sm,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  saludo: {
    color: colors.ink,
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 34,
    marginTop: 10,
  },
  introTexto: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
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
  stack: {
    gap: spacing.sm,
  },
  privacidad: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  privacidadTexto: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 18,
  },
});
