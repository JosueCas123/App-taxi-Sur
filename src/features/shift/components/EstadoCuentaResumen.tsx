import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { ConductorDetalleDto } from '../../auth/api';
import { colors } from '../../../theme/tokens';
import { StateBadge } from '../../../ui';
import { CarArt } from './CarArt';

type Tono = 'neutral' | 'success' | 'warning' | 'info' | 'danger';

const ETIQUETA_ESTADO: Record<ConductorDetalleDto['estado'], string> = {
  pendiente: 'En revisión',
  aprobado: 'Aprobada',
  rechazado: 'Rechazada',
  suspendido: 'Suspendida',
};

const TONO_ESTADO: Record<ConductorDetalleDto['estado'], Tono> = {
  pendiente: 'warning',
  aprobado: 'success',
  rechazado: 'danger',
  suspendido: 'danger',
};

const TITULO_ESTADO: Record<ConductorDetalleDto['estado'], string> = {
  pendiente: 'Estamos revisando tu cuenta.',
  aprobado: 'Tu cuenta está aprobada.',
  rechazado: 'Tu registro no fue aprobado.',
  suspendido: 'Tu cuenta está suspendida.',
};

const DETALLE_ESTADO: Record<ConductorDetalleDto['estado'], string> = {
  pendiente: 'TaxiSur está revisando tu cuenta.',
  aprobado: 'Tu cuenta está aprobada para trabajar.',
  rechazado: 'Tu cuenta fue rechazada. Contacta a soporte para más información.',
  suspendido: 'Tu cuenta está suspendida. Contacta a soporte para más información.',
};

const ESTILO_BADGE: Record<ConductorDetalleDto['estado'], { fondo: string; texto: string }> = {
  pendiente: { fondo: colors.yellow, texto: colors.navy },
  aprobado: { fondo: '#245543', texto: '#ccffe5' },
  rechazado: { fondo: '#55242c', texto: '#ffc9d0' },
  suspendido: { fondo: '#55242c', texto: '#ffc9d0' },
};

export function EstadoCuentaResumen({ estado }: { estado: ConductorDetalleDto['estado'] }) {
  const badge = ESTILO_BADGE[estado];

  return (
    <View style={styles.hero} accessibilityRole="summary">
      <Text style={styles.etiqueta}>Estado de cuenta</Text>
      <StateBadge
        label={ETIQUETA_ESTADO[estado]}
        tone={TONO_ESTADO[estado]}
        style={{ ...styles.badge, backgroundColor: badge.fondo }}
        textStyle={{ color: badge.texto }}
      />
      <Text style={styles.titulo}>{TITULO_ESTADO[estado]}</Text>
      <Text style={styles.detalle}>{DETALLE_ESTADO[estado]}</Text>
      <View style={styles.carArt}>
        <CarArt />
      </View>
      <View style={styles.pie}>
        <IconoEscudo />
        <Text style={styles.pieTexto}>Conductor aprobado por TaxiSur</Text>
      </View>
    </View>
  );
}

function IconoEscudo() {
  return (
    <Svg
      height={16}
      width={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.yellow}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" />
      <Path d="m8 12 3 3 5-6" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.navy,
    borderRadius: 23,
    padding: 23,
  },
  etiqueta: {
    color: '#9fb0c6',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  badge: {
    marginTop: 12,
  },
  titulo: {
    color: '#ffffff',
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 34,
    marginTop: 15,
  },
  detalle: {
    color: '#bdcada',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 260,
  },
  carArt: {
    alignItems: 'flex-end',
    marginTop: 5,
    marginBottom: -5,
  },
  pie: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.13)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingTop: 13,
  },
  pieTexto: {
    color: '#d1dbe8',
    fontSize: 11,
  },
});
