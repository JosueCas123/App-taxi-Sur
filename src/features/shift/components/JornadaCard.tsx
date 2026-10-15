import { StyleSheet, Text, View } from 'react-native';

import type { ConductorDetalleDto } from '../../auth/api';
import { colors, spacing } from '../../../theme/tokens';
import { Card, StateBadge, SwitchToggle } from '../../../ui';

type Tono = 'neutral' | 'success' | 'warning' | 'info' | 'danger';

const ETIQUETA_JORNADA: Record<ConductorDetalleDto['estadoJornada'], string> = {
  no_iniciada: 'Sin iniciar',
  activa: 'Activa',
  finalizada: 'Finalizada',
};

const TONO_JORNADA: Record<ConductorDetalleDto['estadoJornada'], Tono> = {
  no_iniciada: 'neutral',
  activa: 'success',
  finalizada: 'neutral',
};

const ETIQUETA_ACCION: Record<'iniciar' | 'finalizar', string> = {
  iniciar: 'Iniciar jornada',
  finalizar: 'Finalizar jornada',
};

const AYUDA_JORNADA: Record<ConductorDetalleDto['estadoJornada'], string> = {
  no_iniciada: 'Activa tu día de trabajo.',
  activa: 'Tu jornada de trabajo está activa.',
  finalizada: 'Tu jornada terminó. Puedes iniciar una nueva.',
};

export type JornadaCardProps = {
  estadoJornada: ConductorDetalleDto['estadoJornada'];
  cierreJornadaSolicitado: boolean;
  accion: 'iniciar' | 'finalizar';
  habilitado: boolean;
  motivo: 'cierre_solicitado' | null;
  mutando: boolean;
  onAccion: () => void;
};

export function JornadaCard({
  estadoJornada,
  cierreJornadaSolicitado,
  accion,
  habilitado,
  motivo,
  mutando,
  onAccion,
}: JornadaCardProps) {
  const activa = estadoJornada === 'activa';
  const etiqueta = cierreJornadaSolicitado ? 'Cierre solicitado' : ETIQUETA_ACCION[accion];
  const ayuda = cierreJornadaSolicitado
    ? 'Se cerrará al completar tu servicio.'
    : AYUDA_JORNADA[estadoJornada];

  return (
    <Card>
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>Jornada</Text>
        <StateBadge label={ETIQUETA_JORNADA[estadoJornada]} tone={TONO_JORNADA[estadoJornada]} />
      </View>

      <View style={styles.switchrow}>
        <View style={styles.grow}>
          <Text style={styles.accion}>{etiqueta}</Text>
          <Text style={styles.ayuda}>{ayuda}</Text>
        </View>
        <SwitchToggle
          value={activa}
          onToggle={onAccion}
          label={ETIQUETA_ACCION[accion]}
          disabled={!habilitado || mutando}
        />
      </View>

      {cierreJornadaSolicitado ? (
        <View style={styles.aviso} accessibilityRole="alert">
          <Text style={styles.avisoTexto}>
            Cierre de jornada pendiente: se completará al terminar el servicio en curso.
          </Text>
        </View>
      ) : null}

      {motivo === 'cierre_solicitado' ? (
        <Text style={styles.motivo}>Ya solicitaste cerrar la jornada.</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titulo: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  switchrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  grow: {
    flex: 1,
  },
  accion: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  ayuda: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  aviso: {
    backgroundColor: 'rgba(134, 92, 8, 0.12)',
    borderRadius: spacing.sm,
    padding: spacing.sm,
  },
  avisoTexto: {
    color: colors.amber,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  motivo: {
    color: colors.muted,
    fontSize: 12,
  },
});
