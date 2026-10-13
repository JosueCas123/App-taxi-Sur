import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useSession } from '../features/auth/session-context';
import { colors } from '../theme/tokens';
import { LoadingState, Screen } from '../ui';

export default function BienvenidaScreen() {
  const router = useRouter();
  const { status, restaurarSesion } = useSession();
  const { height } = useWindowDimensions();
  const escenaAlto = height < 740 ? 150 : 200;

  useEffect(() => {
    if (status === 'restaurando') {
      restaurarSesion();
    }
  }, [status, restaurarSesion]);

  if (status === 'restaurando') {
    return (
      <Screen style={styles.fondo}>
        <LoadingState label="Restaurando sesión…" color={colors.yellow} style={styles.centrado} />
      </Screen>
    );
  }

  if (status === 'autenticado') {
    return <Screen style={styles.fondo} />;
  }

  return (
    <Screen
      style={styles.fondo}
      scroll
      contentContainerStyle={styles.pantalla}
      
    
    >
      <View style={styles.cabecera}
      
      >
        <View style={styles.marcaCaja}>
          <IconoTaxi color={colors.navy} />
        </View>
        <View style={styles.marcaPalabras}>
          <Text style={styles.marcaNombre}>
            Taxi
            <Text style={styles.marcaNombreAcento}>Sur</Text>
          </Text>
          <Text style={styles.marcaSub}>Conductores</Text>
        </View>
      </View>

      <View style={[styles.escena, { height: escenaAlto }]}>
        <EscenaIlustracion />
      </View>

      <View style={styles.contenido}>
        <Text style={styles.eyebrow}>Tu central. contigo.</Text>
        <Text style={styles.titulo}>
          Conectamos{'\n'}tu próxima{'\n'}
          <Text style={styles.tituloAcento}>ruta.</Text>
        </Text>
        <Text style={styles.descripcion}>
          Gestiona tu jornada y recibe solicitudes de TaxiSur desde un solo lugar.
        </Text>
        <View style={styles.caracteristicas}>
          <View style={styles.caracteristica}>
            <IconoEscudo color={colors.yellow} />
            <Text style={styles.caracteristicaTexto}>Cuenta verificada</Text>
          </View>
          <View style={styles.caracteristica}>
            <IconoRuta color={colors.yellow} />
            <Text style={styles.caracteristicaTexto}>Una ruta a la vez</Text>
          </View>
        </View>
      </View>

      <View style={styles.acciones}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ingresar"
          onPress={() => router.push('/login')}
          style={({ pressed }) => [
            styles.boton,
            styles.botonPrimario,
            pressed && styles.botonPresionado,
          ]}
        >
          <IconoFlecha color={colors.navy} />
          <Text style={styles.botonPrimarioTexto}>Ingresar</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quiero ser conductor"
          accessibilityHint="El registro de conductores estará disponible en una próxima versión"
          onPress={undefined}
          style={({ pressed }) => [
            styles.boton,
            styles.botonContorno,
            pressed && styles.botonPresionado,
          ]}
        >
          <Text style={styles.botonContornoTexto}>Quiero ser conductor</Text>
        </Pressable>
        <Text style={styles.nota}>Aplicación exclusiva para conductores TaxiSur</Text>
      </View>
    </Screen>
  );
}

function EscenaIlustracion() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 400 225">
      <Circle cx={285} cy={45} r={24} fill="#f6c343" />
      <Path d="m0 132 47-54 35 31 50-72 71 98 59-54 53 46 42-46 43 48v96H0Z" fill="#203146" />
      <Path d="m105 74 27-37 29 41-29-14Z" fill="#5a6d82" />
      <Path d="m0 170 110-43 92 44 85-17 113 28v43H0Z" fill="#293e52" />
      <Path
        d="M-20 213c130-55 173 35 282-17s150-36 190-35"
        stroke="#b2c4d5"
        opacity={0.11}
        strokeWidth={34}
        fill="none"
      />
      <Path
        d="M-20 213c130-55 173 35 282-17s150-36 190-35"
        stroke="#f6c343"
        opacity={0.4}
        strokeWidth={2}
        strokeDasharray="10 13"
        fill="none"
      />
      <G transform="translate(74 100) scale(1.08)">
        <Ellipse cx={128} cy={86} rx={96} ry={8} fill="#000000" opacity={0.22} />
        <Path d="m42 47 24-29h86l33 28 30 8 8 24H24l3-24Z" fill="#f6c343" />
        <Path d="m75 24-17 23h52V24Zm43 0v23h55l-28-23Z" fill="#527088" />
        <Path d="M66 33h36M135 32h14" stroke="#7b95a9" strokeWidth={3} />
        <Rect x={100} y={8} width={36} height={11} rx={3} fill="#f6c343" />
        <SvgText x={108} y={16} fontFamily="Arial" fontSize={7} fontWeight="bold" fill="#111e2f">
          TAXI
        </SvgText>
        <Path d="M31 58h15m154 0h12M27 71h195M110 25v45m66-20 9 21" stroke="#d8a427" strokeWidth={2} />
        <Rect x={119} y={54} width={13} height={3} rx={1.5} fill="#111e2f" />
        <Circle cx={62} cy={77} r={17} fill="#111e2f" />
        <Circle cx={62} cy={77} r={8} fill="#9baaba" />
        <Circle cx={186} cy={77} r={17} fill="#111e2f" />
        <Circle cx={186} cy={77} r={8} fill="#9baaba" />
        <Path d="M26 56h10v8H25m187-8h7l3 8h-10" fill="#fff3c6" />
      </G>
    </Svg>
  );
}

function IconoTaxi({ color }: { color: string }) {
  return (
    <Svg
      height={21}
      width={21}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="m5 6-2 6v7h3v-2h12v2h3v-7l-2-6Z" />
      <Path d="M3 12h18M7 6l1-3h8l1 3M6 14h2m8 0h2" />
    </Svg>
  );
}

function IconoFlecha({ color }: { color: string }) {
  return (
    <Svg
      height={18}
      width={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M5 12h14m-6-6 6 6-6 6" />
    </Svg>
  );
}

function IconoEscudo({ color }: { color: string }) {
  return (
    <Svg
      height={15}
      width={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" />
      <Path d="m8 12 3 3 5-6" />
    </Svg>
  );
}

function IconoRuta({ color }: { color: string }) {
  return (
    <Svg
      height={15}
      width={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={5} cy={5} r={2} />
      <Circle cx={19} cy={19} r={2} />
      <Path d="M9 5h7a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h7" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fondo: {
    backgroundColor: colors.navy,
  },
  pantalla: {
    flexGrow: 1,
    padding: 0,
    gap: 0,
  },
  centrado: {
    flex: 1,
  },
  cabecera: {
    minHeight: 64,
    paddingHorizontal: 18,
    paddingTop: 9,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.navy,
  },
  marcaCaja: {
    width: 33,
    height: 33,
    borderRadius: 10,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaPalabras: {
    justifyContent: 'center',
  },
  marcaNombre: {
    color: '#ffffff',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  marcaNombreAcento: {
    color: colors.yellow,
  },
  marcaSub: {
    color: '#9aabbe',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  escena: {
    overflow: 'hidden',
  },
  contenido: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  eyebrow: {
    color: '#9aacbf',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 15,
  },
  titulo: {
    color: '#ffffff',
    fontSize: 33,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 38,
  },
  tituloAcento: {
    color: colors.yellow,
  },
  descripcion: {
    color: '#b5c5d9',
    fontSize: 14,
    lineHeight: 23,
    marginTop: 18,
  },
  caracteristicas: {
    flexDirection: 'row',
    gap: 17,
    marginTop: 24,
    marginBottom: 8,
  },
  caracteristica: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  caracteristicaTexto: {
    color: '#d3ddeb',
    fontSize: 11,
  },
  acciones: {
    marginTop: 'auto',
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  boton: {
    minHeight: 54,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 13,
    paddingHorizontal: 17,
    width: '100%',
  },
  botonPrimario: {
    backgroundColor: colors.yellow,
    borderColor: colors.yellow,
  },
  botonPrimarioTexto: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '800',
  },
  botonContorno: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.27)',
    marginTop: 10,
  },
  botonContornoTexto: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  botonPresionado: {
    opacity: 0.85,
  },
  nota: {
    color: '#a2b3c8',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 18,
  },
});