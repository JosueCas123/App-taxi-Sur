import { StyleSheet, Text, View } from 'react-native';

import type { ConductorDetalleDto } from '../../auth/api';
import type { MotivoDisponibilidadBloqueada } from '../jornada-policy';
import { colors, spacing } from '../../../theme/tokens';
import { Card, StateBadge, SwitchToggle } from '../../../ui';

type Tono = 'neutral' | 'success' | 'warning' | 'info' | 'danger';

const ETIQUETA_DISPONIBILIDAD: Record<ConductorDetalleDto['estadoDisponibilidad'], string> = {
  no_disponible: 'No disponible',
  disponible: 'Disponible',
  solicitud_pendiente: 'Solicitud pendiente',
  en_servicio: 'En servicio',
};

const TONO_DISPONIBILIDAD: Record<ConductorDetalleDto['estadoDisponibilidad'], Tono> = {
  no_disponible: 'neutral',
  disponible: 'success',
  solicitud_pendiente: 'info',
  en_servicio: 'info',
};

const AYUDA_DISPONIBILIDAD: Record<ConductorDetalleDto['estadoDisponibilidad'], string> = {
  no_disponible: 'Activa este control cuando puedas recibir servicios.',
  disponible: 'Recibirás solicitudes cercanas.',
  solicitud_pendiente: 'No recibirás otra solicitud mientras atiendes esta.',
  en_servicio: 'Tienes un servicio activo. No recibirás otras solicitudes.',
};

const MOTIVO_BLOQUEO: Record<MotivoDisponibilidadBloqueada, string> = {
  cuenta_no_aprobada: 'Tu cuenta debe estar aprobada para ponerte disponible.',
  jornada_no_activa: 'Inicia tu jornada para ponerte disponible.',
  ubicacion_no_lista: 'Necesitamos tu ubicación vigente para ponerte disponible.',
  estado_no_disponible: 'No puedes cambiar tu disponibilidad durante un servicio o con una solicitud pendiente.',
};

export type DisponibilidadCardProps = {
  estadoDisponibilidad: ConductorDetalleDto['estadoDisponibilidad'];
  tipo: 'activar' | 'desactivar' | 'bloqueado';
  habilitado: boolean;
  motivo: MotivoDisponibilidadBloqueada | null;
  mutando: boolean;
  onActivar: () => void;
  onDesactivar: () => void;
};

export function DisponibilidadCard({
  estadoDisponibilidad,
  tipo,
  habilitado,
  motivo,
  mutando,
  onActivar,
  onDesactivar,
}: DisponibilidadCardProps) {
  const desactivar = tipo === 'desactivar';
  const disponible = estadoDisponibilidad === 'disponible';
  const etiquetaAccion = desactivar ? 'Dejar de estar disponible' : 'Ponerse disponible';
  const ayuda = motivo ? MOTIVO_BLOQUEO[motivo] : AYUDA_DISPONIBILIDAD[estadoDisponibilidad];

  return (
    <Card>
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>Disponibilidad</Text>
        <StateBadge
          label={ETIQUETA_DISPONIBILIDAD[estadoDisponibilidad]}
          tone={TONO_DISPONIBILIDAD[estadoDisponibilidad]}
        />
      </View>

      <View style={styles.switchrow}>
        <View style={styles.grow}>
          <Text style={styles.accion}>Disponible para solicitudes</Text>
          <Text style={[styles.ayuda, motivo ? styles.ayudaBloqueo : null]}>{ayuda}</Text>
        </View>
        <SwitchToggle
          value={disponible}
          onToggle={desactivar ? onDesactivar : onActivar}
          label={etiquetaAccion}
          disabled={!habilitado || mutando}
        />
      </View>
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
  ayudaBloqueo: {
    color: colors.amber,
    fontWeight: '600',
  },
});
