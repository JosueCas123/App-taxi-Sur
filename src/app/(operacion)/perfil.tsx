import { StyleSheet, Text } from 'react-native';

import { Screen } from '../../ui';
import { AppHeader } from '../../features/ui/AppHeader';
import { BottomNav } from '../../features/ui/BottomNav';

export default function PerfilScreen() {
  return (
    <Screen
      header={<AppHeader />}
      footer={<BottomNav activo="perfil" />}
      contentContainerStyle={styles.contenedor}
    >
      <Text style={styles.titulo}>Perfil</Text>
      <Text style={styles.cuerpo}>Datos del conductor (M03).</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  titulo: {
    color: '#172538',
    fontSize: 24,
    fontWeight: '700',
  },
  cuerpo: {
    color: '#627187',
    fontSize: 16,
    marginTop: 8,
  },
});
