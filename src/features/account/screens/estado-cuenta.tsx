import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { runtimeConfig } from '../../../config/runtime';
import { useSession } from '../../../features/auth/session-context';
import type { ConductorDetalleDto } from '../../../features/auth/api';
import { colors, spacing } from '../../../theme/tokens';
import { Screen } from '../../../ui';

export type EstadoCuenta = 'pendiente' | 'rechazado' | 'suspendido';

export interface EstadoCuentaScreenProps {
  estado: EstadoCuenta;
  perfil?: ConductorDetalleDto | null;
  cargando?: boolean;
  error?: string | null;
  onActualizar?: () => void | Promise<void>;
  mostrarActualizar?: boolean;
  onSalir?: () => void;
}

function formatearEstado(estado: EstadoCuenta): string {
  switch (estado) {
    case 'pendiente':
      return 'Cuenta en revisión';
    case 'rechazado':
      return 'Cuenta rechazada';
    case 'suspendido':
      return 'Cuenta suspendida';
    default:
      return 'Estado de cuenta';
  }
}

function obtenerMensaje(estado: EstadoCuenta): string {
  switch (estado) {
    case 'pendiente':
      return 'Tu cuenta está siendo revisada por el equipo. Te avisaremos cuando haya novedades.';
    case 'rechazado':
      return 'Tu solicitud fue rechazada. Puedes revisar tus datos y volver a intentarlo más adelante.';
    case 'suspendido':
      return 'Tu cuenta está suspendida. Ponte en contacto con soporte para más información.';
    default:
      return 'Tu cuenta requiere atención.';
  }
}

export function EstadoCuentaScreen({
  estado,
  perfil,
  cargando = false,
  error = null,
  onActualizar,
  mostrarActualizar = true,
  onSalir,
}: EstadoCuentaScreenProps) {
  const { invalidarSesion } = useSession();
  // Ayuda solo con el contacto público ya configurado; nunca un teléfono inventado.
  const contactoAyuda = runtimeConfig.contactoAyuda;

  const manejarActualizar = useCallback(async () => {
    if (!onActualizar || cargando) {
      return;
    }
    await onActualizar();
  }, [cargando, onActualizar]);

  const manejarAyuda = useCallback(() => {
    if (contactoAyuda) {
      void Linking.openURL(`tel:${contactoAyuda}`);
    }
  }, [contactoAyuda]);

  const manejarSalir = useCallback(() => {
    if (onSalir) {
      onSalir();
      return;
    }
    void invalidarSesion();
  }, [invalidarSesion, onSalir]);

  const nombreMostrado = useMemo(() => {
    const nombre = perfil?.nombreCompleto?.trim();
    if (nombre && nombre.length > 0) {
      return nombre;
    }
    return 'Conductor';
  }, [perfil?.nombreCompleto]);

  const telefonoMostrado = useMemo(() => {
    const telefono = perfil?.telefono?.trim();
    if (telefono && telefono.length > 0) {
      return telefono;
    }
    return null;
  }, [perfil?.telefono]);

  const placaMostrada = useMemo(() => {
    const placa = perfil?.vehiculo?.placa?.trim();
    if (placa && placa.length > 0) {
      return placa.toUpperCase();
    }
    return null;
  }, [perfil?.vehiculo?.placa]);

  return (
    <Screen contentContainerStyle={styles.contenedor}>
      <View style={styles.tarjeta}>
        <Text style={styles.titulo}>{formatearEstado(estado)}</Text>
        <Text style={styles.mensaje}>{obtenerMensaje(estado)}</Text>

        <View style={styles.separador} />

        <View style={styles.infoGrupo}>
          <Text style={styles.etiqueta}>Nombre completo</Text>
          <Text style={styles.valor}>{nombreMostrado}</Text>
        </View>

        {telefonoMostrado ? (
          <View style={styles.infoGrupo}>
            <Text style={styles.etiqueta}>Teléfono</Text>
            <Text style={styles.valor}>{telefonoMostrado}</Text>
          </View>
        ) : null}

        {placaMostrada ? (
          <View style={styles.infoGrupo}>
            <Text style={styles.etiqueta}>Placa del vehículo</Text>
            <Text style={styles.valor}>{placaMostrada}</Text>
          </View>
        ) : null}

        {perfil?.estado ? (
          <View style={styles.infoGrupo}>
            <Text style={styles.etiqueta}>Estado de aprobación</Text>
            <Text style={styles.valor}>{perfil.estado}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorContenedor} accessibilityRole="alert">
            <Text style={styles.errorTexto}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.acciones}>
          {mostrarActualizar ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Actualizar información de cuenta"
              onPress={manejarActualizar}
              disabled={cargando}
              style={[styles.botonPrimario, cargando && styles.botonDeshabilitado]}
            >
              {cargando ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.botonPrimarioTexto}>Actualizar</Text>
              )}
            </Pressable>
          ) : null}

          {contactoAyuda ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Obtener ayuda sobre el estado de cuenta"
              onPress={manejarAyuda}
              disabled={cargando}
              style={[styles.botonSecundario, cargando && styles.botonDeshabilitado]}
            >
              <Text style={styles.botonSecundarioTexto}>Ayuda</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Salir de la sesión"
            onPress={manejarSalir}
            disabled={cargando}
            style={[styles.botonTerciario, cargando && styles.botonDeshabilitado]}
          >
            <Text style={styles.botonTerciarioTexto}>Salir</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  tarjeta: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: spacing.xl,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  titulo: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  mensaje: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm,
  },
  separador: {
    backgroundColor: colors.line,
    height: 1,
    marginVertical: spacing.lg,
    width: '100%',
  },
  infoGrupo: {
    marginBottom: spacing.md,
  },
  etiqueta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  valor: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.xs,
  },
  errorContenedor: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderColor: 'rgba(220, 38, 38, 0.4)',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  errorTexto: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
  },
  acciones: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  botonPrimario: {
    alignItems: 'center',
    backgroundColor: colors.yellow,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  botonPrimarioTexto: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
  },
  botonSecundario: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  botonSecundarioTexto: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  botonTerciario: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  botonTerciarioTexto: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '700',
  },
  botonDeshabilitado: {
    opacity: 0.5,
  },
});
