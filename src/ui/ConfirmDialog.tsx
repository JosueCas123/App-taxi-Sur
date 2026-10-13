import { Modal, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme/tokens';
import { Button } from './Button';

type ConfirmDialogProps = {
  visible: boolean;
  titulo: string;
  mensaje: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmarLabel?: string;
  cancelarLabel?: string;
  confirmacionPeligrosa?: boolean;
  confirmando?: boolean;
};

export function ConfirmDialog({
  visible,
  titulo,
  mensaje,
  onConfirm,
  onCancel,
  confirmarLabel = 'Confirmar',
  cancelarLabel = 'Cancelar',
  confirmacionPeligrosa = false,
  confirmando = false,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.capa}>
        <View style={styles.panel}>
          <Text style={styles.titulo}>{titulo}</Text>
          <Text style={styles.mensaje}>{mensaje}</Text>
          <View style={styles.botones}>
            <Button
              label={cancelarLabel}
              variant="secondary"
              onPress={onCancel}
              disabled={confirmando}
              style={styles.boton}
            />
            <Button
              label={confirmarLabel}
              variant={confirmacionPeligrosa ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={confirmando}
              style={styles.boton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  capa: {
    flex: 1,
    backgroundColor: 'rgba(17, 30, 47, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: radius,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
  },
  titulo: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  mensaje: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
  },
  botones: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  boton: {
    flex: 1,
  },
});