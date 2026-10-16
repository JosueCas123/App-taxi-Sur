import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useSession } from '../auth/session-context';
import { colors } from '../../theme/tokens';

function inicialesDe(nombre?: string | null) {
  if (!nombre) {
    return '?';
  }
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) {
    return '?';
  }
  const primera = partes[0]?.[0] ?? '';
  const segunda = partes.length > 1 ? (partes[1]?.[0] ?? '') : '';
  return (primera + segunda).toUpperCase() || '?';
}

function IconoTaxi() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 6l-2 6v7h3v-2h12v2h3v-7l-2-6Z"
        stroke={colors.navy}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 12h18M7 6l1-3h8l1 3M6 14h2m8 0h2"
        stroke={colors.navy}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { conductor } = useSession();
  const iniciales = inicialesDe(conductor?.nombreCompleto);

  return (
    <View style={[styles.barra, { paddingTop: insets.top + 9 }]}>
      <View style={styles.marca}>
        <View style={styles.marcaCaja}>
          <IconoTaxi />
        </View>
        <View>
          <Text style={styles.marcaNombre}>
            Taxi<Text style={styles.marcaAcento}>Sur</Text>
          </Text>
          <Text style={styles.submarca}>Conductores</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver mi cuenta"
        hitSlop={8}
        onPress={() => router.navigate('/(operacion)/perfil')}
        style={({ pressed }) => [styles.avatar, pressed && styles.avatarPresionado]}
      >
        <Text style={styles.avatarTexto}>{iniciales}</Text>
      </Pressable>
    </View>
  );
}

export { inicialesDe };

const styles = StyleSheet.create({
  barra: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
  },
  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  marcaCaja: {
    width: 33,
    height: 33,
    borderRadius: 10,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaNombre: {
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 26,
    color: colors.ink,
  },
  marcaAcento: {
    color: '#ad7908',
  },
  submarca: {
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: colors.muted,
  },
  avatar: {
    marginLeft: 'auto',
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#edf1f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPresionado: {
    opacity: 0.7,
  },
  avatarTexto: {
    fontSize: 12,
    fontWeight: '800',
    color: '#405771',
  },
});
