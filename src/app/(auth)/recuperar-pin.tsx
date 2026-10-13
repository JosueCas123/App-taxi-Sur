import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { runtimeConfig } from '../../config/runtime';
import { colors, minTouchTarget, radius, spacing } from '../../theme/tokens';
import { Button, Screen } from '../../ui';

const PASOS: { titulo: string; descripcion: string }[] = [
  {
    titulo: 'Comunícate con la administración',
    descripcion: 'Utiliza el canal habitual de contacto de tu empresa.',
  },
  {
    titulo: 'Solicita restablecer tu PIN',
    descripcion: 'Ten a mano tu CI y el teléfono de tu cuenta para verificar tu identidad.',
  },
  {
    titulo: 'Vuelve a ingresar',
    descripcion: 'Utiliza el PIN que te entregue el administrador.',
  },
];

export default function RecuperarPinScreen() {
  const contacto = runtimeConfig.contactoAyuda;

  const contactar = () => {
    if (contacto) {
      Linking.openURL(`tel:${contacto}`);
    }
  };

  return (
    <Screen scroll contentContainerStyle={styles.contenido}>
      <View style={styles.cabecera}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.botonVolver, pressed && styles.botonPresionado]}
        >
          <Svg height={22} width={22} viewBox="0 0 24 24" fill="none" stroke={colors.navy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5m6-6-6 6 6 6" />
          </Svg>
        </Pressable>
        <Text style={styles.tituloCabecera}>Ayuda con el PIN</Text>
      </View>

      <Text style={styles.titulo}>Recupera tu acceso.</Text>
      <Text style={styles.intro}>El administrador de TaxiSur puede restablecer tu PIN desde la central.</Text>

      <View style={styles.tarjeta}>
        {PASOS.map((paso, indice) => (
          <View key={paso.titulo} style={styles.paso}>
            <View style={styles.numero}>
              <Text style={styles.numeroTexto}>{indice + 1}</Text>
            </View>
            <View style={styles.pasoTexto}>
              <Text style={styles.pasoTitulo}>{paso.titulo}</Text>
              <Text style={styles.pasoDescripcion}>{paso.descripcion}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.acciones}>
        {contacto ? (
          <Button label="Llamar a administración" onPress={contactar} />
        ) : null}
        <Button label="Volver al inicio de sesión" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenido: {
    flexGrow: 1,
    paddingTop: spacing.md,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  botonVolver: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius,
  },
  botonPresionado: {
    opacity: 0.6,
  },
  tituloCabecera: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  titulo: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  intro: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  tarjeta: {
    backgroundColor: '#ffffff',
    borderRadius: radius,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  paso: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  numero: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroTexto: {
    color: colors.yellow,
    fontSize: 14,
    fontWeight: '800',
  },
  pasoTexto: {
    flex: 1,
    gap: 2,
  },
  pasoTitulo: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  pasoDescripcion: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  acciones: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});