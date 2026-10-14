import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { esErrorApi } from '../../../lib/api-client';
import { mensajeDeErrorApi } from '../../../lib/api-errors';
import { colors, minTouchTarget, radius, spacing } from '../../../theme/tokens';
import { Button, ErrorBanner, Screen, TextField } from '../../../ui';
import { registrarConductor } from '../api';
import { validarRegistro, type CamposRegistro, type ErroresRegistro } from '../registration-schema';

const CAMPOS_INICIALES: CamposRegistro = {
  telefono: '',
  pin: '',
  confirmacionPin: '',
  nombreCompleto: '',
  cedulaIdentidad: '',
  placa: '',
  marca: '',
  modelo: '',
  color: '',
  capacidadPasajeros: '',
};

const MAX_TELEFONO = 30;
const MAX_NOMBRE = 100;
const MAX_CEDULA = 50;
const MAX_VEHICULO = 30;

const CAMPOS_PERSONALES: (keyof CamposRegistro)[] = [
  'telefono',
  'nombreCompleto',
  'cedulaIdentidad',
  'pin',
  'confirmacionPin',
];

const AVISO_TIMEOUT =
  'No pudimos confirmar si tu cuenta se creó. Puedes intentar ingresar con el teléfono y PIN que elegiste';
const AVISO_CONFLICTO =
  'No se pudo completar el registro por un conflicto con los datos enviados. Si ya tienes una cuenta, puedes intentar ingresar';
const ERROR_GENERAL = 'No se pudo completar el registro. Intenta nuevamente';

type Aviso = { tipo: 'timeout' | 'conflicto'; mensaje: string };
type Paso = 1 | 2;

function ConmutadorPin({
  visible,
  etiqueta,
  onToggle,
}: {
  visible: boolean;
  etiqueta: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visible ? `Ocultar ${etiqueta}` : `Mostrar ${etiqueta}`}
      accessibilityState={{ selected: visible }}
      onPress={onToggle}
      style={({ pressed }) => [styles.conmutador, pressed && styles.botonPresionado]}
    >
      <Svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        stroke={colors.ink}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        accessible={false}
      >
        <Path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <Circle cx={12} cy={12} r={3} />
        {visible ? <Path d="m3 3 18 18" /> : null}
      </Svg>
    </Pressable>
  );
}

export function RegistroScreen() {
  const [campos, setCampos] = useState<CamposRegistro>(CAMPOS_INICIALES);
  const [errores, setErrores] = useState<ErroresRegistro>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [paso, setPaso] = useState<Paso>(1);
  const [mostrarPin, setMostrarPin] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const envioEnCurso = useRef(false);
  const telefonoEnviado = useRef('');

  const actualizar = <C extends keyof CamposRegistro>(campo: C, valor: CamposRegistro[C]) => {
    setCampos((previos) => ({ ...previos, [campo]: valor }));
    setErrores((previos) => ({ ...previos, [campo]: undefined }));
  };

  const continuar = () => {
    setErrorGeneral(null);
    setAviso(null);

    const resultado = validarRegistro(campos);
    const personales: ErroresRegistro = {};
    if (!resultado.ok) {
      for (const campo of CAMPOS_PERSONALES) {
        const mensaje = resultado.errores[campo];
        if (mensaje) personales[campo] = mensaje;
      }
    }

    setErrores(personales);
    if (Object.keys(personales).length > 0) return;

    setPaso(2);
  };

  const volver = () => {
    setErrorGeneral(null);
    setAviso(null);
    setErrores({});
    setPaso(1);
  };

  const irALoginConTelefono = () => {
    router.replace({
      pathname: '/login',
      params: { telefono: telefonoEnviado.current },
    });
  };

  const enviar = async () => {
    if (envioEnCurso.current) return;
    setErrorGeneral(null);
    setAviso(null);

    const resultado = validarRegistro(campos);
    if (!resultado.ok) {
      setErrores(resultado.errores);
      if (CAMPOS_PERSONALES.some((campo) => resultado.errores[campo])) {
        setPaso(1);
      }
      return;
    }

    setErrores({});
    envioEnCurso.current = true;
    setEnviando(true);
    telefonoEnviado.current = resultado.datos.telefono;

    // Los valores sensibles no deben sobrevivir al envío.
    setCampos((previos) => ({ ...previos, pin: '', confirmacionPin: '' }));

    try {
      await registrarConductor(resultado.datos);
      // El registro nunca autentica: se vuelve al login con el teléfono prellenado.
      router.replace({
        pathname: '/login',
        params: { telefono: resultado.datos.telefono },
      });
    } catch (error) {
      if (esErrorApi(error) && error.code === 'TIMEOUT') {
        setAviso({ tipo: 'timeout', mensaje: AVISO_TIMEOUT });
      } else if (esErrorApi(error) && error.status === 409) {
        setAviso({ tipo: 'conflicto', mensaje: AVISO_CONFLICTO });
      } else {
        setErrorGeneral(mensajeDeErrorApi(error, ERROR_GENERAL));
      }
    } finally {
      envioEnCurso.current = false;
      setEnviando(false);
    }
  };

  return (
    <Screen
      scroll
      contentContainerStyle={styles.contenido}
      header={
        <View style={styles.cabecera}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
            hitSlop={spacing.sm}
            style={({ pressed }) => [styles.botonVolver, pressed && styles.botonPresionado]}
          >
            <Svg
              height={22}
              width={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.navy}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              accessible={false}
            >
              <Path d="M19 12H5m6-6-6 6 6 6" />
            </Svg>
          </Pressable>
          <Text style={styles.tituloCabecera}>Registro</Text>
        </View>
      }
    >
      <View style={styles.progreso} accessibilityElementsHidden importantForAccessibility="no">
        <View style={[styles.barra, styles.barraActiva]} />
        <View style={[styles.barra, paso === 2 && styles.barraActiva]} />
      </View>
      <Text style={styles.etiquetaPaso}>
        {paso === 1 ? 'PASO 1 DE 2 · TUS DATOS' : 'PASO 2 DE 2 · TU VEHÍCULO'}
      </Text>

      {aviso ? (
        <ErrorBanner
          message={aviso.mensaje}
          onRetry={irALoginConTelefono}
          retryLabel="Intentar ingresar"
        />
      ) : errorGeneral ? (
        <ErrorBanner message={errorGeneral} />
      ) : null}

      {paso === 1 ? (
        <View style={styles.paso}>
          <Text accessibilityRole="header" style={styles.leyenda}>
            Comencemos por ti.
          </Text>
          <Text style={styles.descripcionPaso}>Completa tus datos para solicitar tu cuenta.</Text>

          <TextField
            label="Nombre completo"
            value={campos.nombreCompleto}
            onChangeText={(texto) => actualizar('nombreCompleto', texto)}
            textContentType="name"
            autoComplete="name"
            maxLength={MAX_NOMBRE}
            error={errores.nombreCompleto}
            placeholder="Como figura en tu documento"
            containerStyle={styles.campo}
          />
          <TextField
            label="Cédula de identidad"
            value={campos.cedulaIdentidad}
            onChangeText={(texto) => actualizar('cedulaIdentidad', texto)}
            autoCapitalize="none"
            maxLength={MAX_CEDULA}
            error={errores.cedulaIdentidad}
            placeholder="Ej. 1234567 LP"
            containerStyle={styles.campo}
          />
          <TextField
            label="Teléfono"
            value={campos.telefono}
            onChangeText={(texto) => actualizar('telefono', texto)}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel-national"
            autoCapitalize="none"
            maxLength={MAX_TELEFONO}
            error={errores.telefono}
            placeholder="Ej. 70000000"
            containerStyle={styles.campo}
          />
          <TextField
            label="Crea un PIN"
            value={campos.pin}
            onChangeText={(texto) => actualizar('pin', texto.replace(/\D/g, ''))}
            keyboardType="number-pad"
            secureTextEntry={!mostrarPin}
            maxLength={6}
            error={errores.pin}
            placeholder="De 4 a 6 dígitos"
            containerStyle={styles.campo}
            trailingAccessory={
              <ConmutadorPin
                visible={mostrarPin}
                etiqueta="crea un pin"
                onToggle={() => setMostrarPin((anterior) => !anterior)}
              />
            }
          />
          <TextField
            label="Confirma tu PIN"
            value={campos.confirmacionPin}
            onChangeText={(texto) => actualizar('confirmacionPin', texto.replace(/\D/g, ''))}
            keyboardType="number-pad"
            secureTextEntry={!mostrarConfirmacion}
            maxLength={6}
            error={errores.confirmacionPin}
            placeholder="De 4 a 6 dígitos"
            containerStyle={styles.campo}
            trailingAccessory={
              <ConmutadorPin
                visible={mostrarConfirmacion}
                etiqueta="confirma tu pin"
                onToggle={() => setMostrarConfirmacion((anterior) => !anterior)}
              />
            }
          />

          <Button
            label="Continuar con mi vehículo"
            onPress={continuar}
            style={styles.botonPaso}
            trailingIcon={
              <Svg
                height={22}
                width={22}
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.navy}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                accessible={false}
              >
                <Path d="M5 12h14m-6-6 6 6-6 6" />
              </Svg>
            }
          />
        </View>
      ) : (
        <View style={styles.paso}>
          <Text accessibilityRole="header" style={styles.leyenda}>
            Ahora, tu vehículo.
          </Text>
          <Text style={styles.descripcionPaso}>
            La empresa revisará estos datos antes de activar tu cuenta.
          </Text>

          <TextField
            label="Placa"
            value={campos.placa}
            onChangeText={(texto) => actualizar('placa', texto)}
            autoCapitalize="characters"
            maxLength={MAX_VEHICULO}
            error={errores.placa}
            placeholder="Ej. 2847 ABC"
            containerStyle={styles.campo}
          />
          <TextField
            label="Marca"
            value={campos.marca}
            onChangeText={(texto) => actualizar('marca', texto)}
            maxLength={MAX_VEHICULO}
            error={errores.marca}
            placeholder="Ej. Toyota"
            containerStyle={styles.campo}
          />
          <TextField
            label="Modelo"
            value={campos.modelo}
            onChangeText={(texto) => actualizar('modelo', texto)}
            maxLength={MAX_VEHICULO}
            error={errores.modelo}
            placeholder="Ej. Corolla"
            containerStyle={styles.campo}
          />
          <View style={styles.grid}>
            <TextField
              label="Color"
              value={campos.color}
              onChangeText={(texto) => actualizar('color', texto)}
              maxLength={MAX_VEHICULO}
              error={errores.color}
              placeholder="Ej. Blanco"
              containerStyle={styles.campoGrid}
            />
            <TextField
              label="Pasajeros"
              value={campos.capacidadPasajeros}
              onChangeText={(texto) => actualizar('capacidadPasajeros', texto.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={3}
              error={errores.capacidadPasajeros}
              placeholder="Ej. 4"
              containerStyle={styles.campoGrid}
            />
          </View>

          <View style={styles.nota}>
            <Svg
              style={styles.notaIcono}
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6c5012"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              accessible={false}
            >
              <Path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" />
              <Path d="m8 12 3 3 5-6" />
            </Svg>
            <Text style={styles.notaTexto}>
              Al enviar, tu cuenta quedará{' '}
              <Text style={styles.notaFuerte}>en revisión.</Text> Podrás operar cuando la empresa la
              apruebe.
            </Text>
          </View>

          <View style={styles.acciones}>
            <Button
              label="Enviar registro"
              onPress={enviar}
              loading={enviando}
              trailingIcon={
                <Svg
                  height={22}
                  width={22}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.navy}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  accessible={false}
                >
                  <Path d="m5 12 4 4L20 5" />
                </Svg>
              }
            />
            <Button label="Volver a mis datos" variant="secondary" onPress={volver} />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenido: {
    flexGrow: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
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
  progreso: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  barra: {
    height: 4,
    flex: 1,
    backgroundColor: '#dfe5ed',
    borderRadius: 5,
  },
  barraActiva: {
    backgroundColor: colors.yellow,
  },
  etiquetaPaso: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 18,
  },
  paso: {
    gap: 0,
  },
  leyenda: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  descripcionPaso: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 22,
  },
  campo: {
    gap: 8,
    marginBottom: 18,
  },
  campoGrid: {
    flex: 1,
    gap: 8,
    marginBottom: 0,
  },
  grid: {
    flexDirection: 'row',
    gap: 13,
    marginBottom: 18,
  },
  conmutador: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius,
  },
  botonPaso: {
    marginTop: spacing.sm,
  },
  nota: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5d6b3',
    backgroundColor: '#fff9e8',
    borderRadius: 14,
    padding: 13,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  notaIcono: {
    marginTop: 1,
    flexShrink: 0,
  },
  notaTexto: {
    flex: 1,
    color: '#6c5012',
    fontSize: 12,
    lineHeight: 18,
  },
  notaFuerte: {
    fontWeight: '700',
  },
  acciones: {
    gap: 10,
    marginTop: spacing.sm,
  },
});
