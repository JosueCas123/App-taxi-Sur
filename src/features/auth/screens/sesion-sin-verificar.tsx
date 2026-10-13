import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useSession } from '../session-context';
import { rutaInicialPorEstado } from '../../../navigation/resolve-route';
import { colors, radius, spacing } from '../../../theme/tokens';
import { Button, Screen } from '../../../ui';

export function SesionSinVerificarScreen() {
  const { status, conductor, restaurarSesion, invalidarSesion } = useSession();
  const [reintentando, setReintentando] = useState(false);

  useEffect(() => {
    if (status === 'autenticado') {
      if (!conductor) {
        return;
      }
      router.replace(rutaInicialPorEstado(conductor.estado));
    } else if (status === 'no_autenticado' || status === 'sesion_incompatible') {
      router.replace('/login');
    }
  }, [status, conductor]);

  const reintentar = async () => {
    setReintentando(true);
    try {
      await restaurarSesion();
    } finally {
      setReintentando(false);
    }
  };

  const salir = async () => {
    await invalidarSesion();
  };

  return (
    <Screen contentContainerStyle={styles.contenido}>
      <View style={styles.icono}>
        <Svg height={56} width={56} viewBox="0 0 24 24" fill="none" stroke={colors.blue} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m10 10-3 3 3 3m4-6 3 3-3 3" />
          <Circle cx={12} cy={12} r={10} />
        </Svg>
      </View>

      <Text style={styles.titulo}>No pudimos confirmar tu sesión</Text>
      <Text style={styles.descripcion}>
        No hay conexión con el servidor en este momento. Guardamos tu sesión para que puedas
        reintentarlo cuando vuelvas a tener conexión.
      </Text>

      <View style={styles.acciones}>
        <Button
          label="Reintentar"
          onPress={reintentar}
          loading={reintentando || status === 'restaurando'}
        />
        <Button
          label="Salir"
          variant="secondary"
          onPress={salir}
          disabled={reintentando || status === 'restaurando'}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenido: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  icono: {
    width: 88,
    height: 88,
    borderRadius: radius,
    backgroundColor: '#eaf1fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  titulo: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  descripcion: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  acciones: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});