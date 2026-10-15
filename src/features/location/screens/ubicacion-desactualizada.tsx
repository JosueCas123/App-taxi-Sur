import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { spacing } from '../../../theme/tokens';
import { Screen } from '../../../ui';
import { EstadoUbicacionDesactualizada } from '../components/EstadoUbicacionDesactualizada';
import { useLocationSharing } from '../location-sharing-provider';

export function UbicacionDesactualizadaScreen() {
  const { reintentar } = useLocationSharing();

  return (
    <Screen contentContainerStyle={styles.contenedor}>
      <EstadoUbicacionDesactualizada
        onActualizar={reintentar}
        onVolverJornada={() => router.replace('/(operacion)/inicio')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
});
