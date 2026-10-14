import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useSession } from '../../features/auth/session-context';
import { esErrorApi } from '../../lib/api-client';
import { colors } from '../../theme/tokens';
import { Button, ErrorBanner, Screen, TextField } from '../../ui';

const MENSAJE_CREDENCIALES = 'Teléfono o PIN incorrecto';
const MENSAJE_TELEFONO = 'Escribe tu número de teléfono';
const MENSAJE_PIN = 'Tu PIN debe tener entre 4 y 6 dígitos';
const MAX_TELEFONO = 30;
const PATRON_PIN = /^\d{4,6}$/;

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const margen = width <= 355 ? 18 : 22;
  const { status, mensajeSesion, iniciarSesion } = useSession();
  const { telefono: telefonoPrellenado } = useLocalSearchParams<{ telefono?: string }>();
  const [telefono, setTelefono] = useState('');
  const [pin, setPin] = useState('');
  const [mostrarPin, setMostrarPin] = useState(false);
  const [errorTelefono, setErrorTelefono] = useState<string | null>(null);
  const [errorPin, setErrorPin] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const envioEnCurso = useRef(false);

  // Prellenado desde el registro: precarga solo el teléfono y vacía siempre el PIN,
  // aunque la navegación reutilice una pantalla de login ya montada.
  useFocusEffect(
    useCallback(() => {
      const prellenado = typeof telefonoPrellenado === 'string' ? telefonoPrellenado.trim() : '';
      if (!prellenado) {
        return;
      }
      setTelefono(prellenado);
      setPin('');
      setErrorTelefono(null);
      setErrorPin(null);
      setErrorGeneral(null);
    }, [telefonoPrellenado])
  );

  const cambiarTelefono = (texto: string) => {
    setTelefono(texto);
    setErrorTelefono(null);
  };

  const cambiarPin = (texto: string) => {
    setPin(texto.replace(/\D/g, ''));
    setErrorPin(null);
  };

  const enviar = async () => {
    if (envioEnCurso.current || status === 'restaurando') return;
    const telefonoLimpio = telefono.trim();
    setErrorTelefono(null);
    setErrorPin(null);
    setErrorGeneral(null);

    if (!telefonoLimpio || telefonoLimpio.length > MAX_TELEFONO) {
      setErrorTelefono(MENSAJE_TELEFONO);
      return;
    }
    if (!PATRON_PIN.test(pin)) {
      setErrorPin(MENSAJE_PIN);
      return;
    }

    envioEnCurso.current = true;
    setEnviando(true);
    try {
      await iniciarSesion(telefonoLimpio, pin);
    } catch (error) {
      setErrorGeneral(
        esErrorApi(error) && error.code === 'UNAUTHORIZED'
          ? MENSAJE_CREDENCIALES
          : 'No se pudo iniciar sesión. Intenta nuevamente'
      );
    } finally {
      envioEnCurso.current = false;
      setEnviando(false);
    }
  };

  const banner = errorGeneral ?? mensajeSesion;

  return (
    <Screen
      scroll
      background={colors.bg}
      style={styles.pantalla}
      contentContainerStyle={{ ...styles.contenido, paddingHorizontal: margen, paddingVertical: margen }}
      header={
        <View style={[styles.marca, { paddingHorizontal: margen }]}>
          <View style={styles.marcaIcono}>
            <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={colors.navy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
              <Path d="m5 6-2 6v7h3v-2h12v2h3v-7l-2-6Z" />
              <Path d="M3 12h18M7 6l1-3h8l1 3M6 14h2m8 0h2" />
            </Svg>
          </View>
          <View style={styles.marcaPalabras}>
            <Text style={styles.marcaNombre}>Taxi<Text style={styles.marcaSur}>Sur</Text></Text>
            <Text style={styles.marcaSubtitulo}>CONDUCTORES</Text>
          </View>
        </View>
      }
    >
      <View style={styles.cabecera}>
        <Text style={styles.antetitulo}>BIENVENIDO A TAXISUR</Text>
        <Text accessibilityRole="header" style={styles.titulo}>Qué bueno verte.</Text>
        <Text style={styles.subtitulo}>Ingresa para empezar tu jornada.</Text>
      </View>

      {banner ? <ErrorBanner message={banner} style={styles.banner} /> : null}

      <TextField
        label="Número de teléfono"
        value={telefono}
        onChangeText={cambiarTelefono}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        maxLength={MAX_TELEFONO}
        autoComplete="tel"
        error={errorTelefono ?? undefined}
        placeholder="Número de teléfono"
        placeholderTextColor="#8894a5"
        containerStyle={styles.campo}
        labelStyle={styles.etiqueta}
        style={{ ...styles.input, fontSize: telefono ? 16 : 14 }}
      />

      <TextField
        label="PIN de acceso"
        value={pin}
        onChangeText={cambiarPin}
        keyboardType="number-pad"
        secureTextEntry={!mostrarPin}
        maxLength={6}
        error={errorPin ?? undefined}
        accessibilityLabel="PIN"
        placeholder="De 4 a 6 dígitos"
        placeholderTextColor="#8894a5"
        containerStyle={styles.campo}
        labelStyle={styles.etiqueta}
        style={{ ...styles.input, paddingRight: 54, fontSize: pin ? 16 : 14 }}
        trailingAccessory={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mostrarPin ? 'Ocultar pin de acceso' : 'Mostrar pin de acceso'}
            accessibilityState={{ selected: mostrarPin }}
            onPress={() => setMostrarPin((anterior) => !anterior)}
            style={({ pressed }) => [styles.conmutador, pressed && styles.conmutadorPresionado]}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
              <Path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
              <Circle cx={12} cy={12} r={3} />
              {mostrarPin ? <Path d="m3 3 18 18" /> : null}
            </Svg>
          </Pressable>
        }
      />

      <View style={styles.recuperacion}>
        <Link href="/recuperar-pin" asChild>
          <Pressable accessibilityRole="link" style={styles.enlaceRecuperar}>
            <Text style={styles.enlaceTexto}>¿Olvidaste tu PIN?</Text>
          </Pressable>
        </Link>
      </View>

      <Button
        label="Ingresar"
        onPress={enviar}
        loading={enviando}
        disabled={status === 'restaurando'}
        style={styles.botonIngresar}
        textStyle={styles.botonTexto}
        trailingIcon={
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.navy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
            <Path d="M5 12h14m-6-6 6 6-6 6" />
          </Svg>
        }
      />

      <View style={styles.separador}>
        <View style={styles.linea} />
        <Text style={styles.separadorTexto}>¿Aún no tienes cuenta?</Text>
        <View style={styles.linea} />
      </View>
      <Button
        label="Registrarme como conductor"
        variant="secondary"
        onPress={() => router.push('/registro')}
        style={styles.botonRegistro}
        textStyle={styles.botonTexto}
      />
      <View style={styles.aviso}>
        <Svg style={styles.escudo} width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
          <Path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" />
          <Path d="m8 12 3 3 5-6" />
        </Svg>
        <Text style={styles.avisoTexto}>
          Tu cuenta debe estar aprobada por la administración para recibir solicitudes.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    backgroundColor: colors.bg,
  },
  contenido: {
    // Override Screen's flex: 1 so large text and the keyboard can scroll naturally.
    flex: 0,
    flexGrow: 1,
    flexShrink: 0,
    gap: 0,
    backgroundColor: colors.bg,
  },
  marca: {
    minHeight: 64,
    paddingTop: 9,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg,
  },
  marcaIcono: {
    width: 33,
    height: 33,
    borderRadius: 10,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaPalabras: { flexShrink: 1 },
  marcaNombre: {
    color: colors.ink,
    fontSize: 23,
    lineHeight: 26.45,
    fontWeight: '800',
    letterSpacing: -1,
  },
  marcaSur: { color: '#ad7908' },
  marcaSubtitulo: {
    color: colors.muted,
    fontSize: 9,
    lineHeight: 10.35,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  cabecera: {
    marginBottom: 24,
  },
  antetitulo: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  titulo: {
    color: colors.ink,
    fontSize: 29,
    lineHeight: 34.22,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  subtitulo: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22.4,
    marginTop: 8,
  },
  banner: {
    marginBottom: 15,
  },
  campo: {
    gap: 8,
    marginBottom: 18,
  },
  etiqueta: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    minHeight: 54,
    borderRadius: 13,
    borderColor: '#cbd5e2',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  conmutador: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 13,
  },
  conmutadorPresionado: {
    opacity: 0.6,
  },
  recuperacion: {
    alignItems: 'flex-end',
    marginTop: -16,
    marginBottom: 12,
  },
  botonIngresar: {
    minHeight: 54,
    borderRadius: 15,
    paddingVertical: 13,
    paddingHorizontal: 17,
    gap: 9,
    borderWidth: 1,
    borderColor: colors.yellow,
  },
  botonTexto: {
    color: colors.navy,
    fontSize: 15,
    lineHeight: 19.5,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  botonRegistro: {
    minHeight: 54,
    borderRadius: 15,
    paddingVertical: 13,
    paddingHorizontal: 17,
    backgroundColor: '#ffffff',
  },
  separador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginVertical: 25,
  },
  linea: { flex: 1, height: 1, backgroundColor: colors.line },
  separadorTexto: { color: colors.muted, fontSize: 11, flexShrink: 1, textAlign: 'center' },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 22,
  },
  escudo: { marginTop: 2, flexShrink: 0 },
  avisoTexto: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17.6,
  },
  enlaceRecuperar: {
    minHeight: 44,
    justifyContent: 'center',
  },
  enlaceTexto: {
    color: '#285b96',
    fontSize: 13,
    lineHeight: 20.15,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textAlign: 'right',
  },
});
