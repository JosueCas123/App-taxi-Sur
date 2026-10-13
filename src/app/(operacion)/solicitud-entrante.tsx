import { StyleSheet, Text } from 'react-native';

import { Screen } from '../../ui';

export default function SolicitudEntranteScreen() {
  return (
    <Screen contentContainerStyle={styles.contenedor}>
      <Text style={styles.titulo}>Solicitud entrante</Text>
      <Text style={styles.cuerpo}>Notificación de solicitud de servicio (M03).</Text>
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