import { router, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, minTouchTarget } from '../../theme/tokens';

export type SeccionOperacion = 'inicio' | 'ubicacion' | 'perfil';

const SECCION_POR_PATHNAME: Record<string, SeccionOperacion> = {
  '/inicio': 'inicio',
  '/ubicacion': 'ubicacion',
  '/perfil': 'perfil',
};

type IconoProps = { color: string; grosor: number };

function IconoJornada({ color, grosor }: IconoProps) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"
        stroke={color}
        strokeWidth={grosor}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconoUbicacion({ color, grosor }: IconoProps) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"
        stroke={color}
        strokeWidth={grosor}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10} r={2.5} stroke={color} strokeWidth={grosor} />
    </Svg>
  );
}

function IconoCuenta({ color, grosor }: IconoProps) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={7} r={4} stroke={color} strokeWidth={grosor} />
      <Path
        d="M4 22v-3a8 8 0 0 1 16 0v3"
        stroke={color}
        strokeWidth={grosor}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const ITEMS: {
  seccion: SeccionOperacion;
  href: Href;
  etiqueta: string;
  Icono: (props: IconoProps) => React.ReactElement;
}[] = [
  { seccion: 'inicio', href: '/(operacion)/inicio', etiqueta: 'Mi jornada', Icono: IconoJornada },
  { seccion: 'ubicacion', href: '/(operacion)/ubicacion', etiqueta: 'Ubicación', Icono: IconoUbicacion },
  { seccion: 'perfil', href: '/(operacion)/perfil', etiqueta: 'Mi cuenta', Icono: IconoCuenta },
];

export function BottomNav() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const activo = SECCION_POR_PATHNAME[pathname] ?? 'inicio';

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.barra, { paddingBottom: insets.bottom + 16 }]}
    >
      {ITEMS.map(({ seccion, href, etiqueta, Icono }) => {
        const seleccionado = seccion === activo;
        const color = seleccionado ? colors.navy : colors.muted;
        return (
          <Pressable
            key={seccion}
            accessibilityRole="tab"
            accessibilityState={{ selected: seleccionado }}
            accessibilityLabel={etiqueta}
            onPress={() => {
              if (!seleccionado) {
                router.navigate(href);
              }
            }}
            style={({ pressed }) => [
              styles.item,
              seleccionado && styles.itemActivo,
              pressed && styles.itemPresionado,
            ]}
          >
            <Icono color={color} grosor={seleccionado ? 2.3 : 1.8} />
            <Text style={[styles.etiqueta, seleccionado && styles.etiquetaActiva]}>
              {etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    minHeight: 75,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: '#ffffff',
  },
  item: {
    minWidth: 82,
    minHeight: minTouchTarget,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  itemActivo: {
    backgroundColor: '#fff4d5',
  },
  itemPresionado: {
    opacity: 0.7,
  },
  etiqueta: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
  },
  etiquetaActiva: {
    color: colors.navy,
  },
});
