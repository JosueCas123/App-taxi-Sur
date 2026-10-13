import { StyleSheet, Text } from 'react-native';

import { Screen } from '../../ui';

export default function LoginScreen() {
  return (
    <Screen contentContainerStyle={styles.contenedor}>
      <Text style={styles.titulo}>Iniciar sesión</Text>
      <Text style={styles.cuerpo}>Pantalla de inicio de sesión (M01).</Text>
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