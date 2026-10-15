import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, spacing } from '../../../theme/tokens';
import { Button, Card, StateBadge } from '../../../ui';

type EstadoUbicacionDesactualizadaProps = {
  onActualizar?: () => void;
  onVolverJornada?: () => void;
};

// Vista compartida de "ubicación desactualizada": inline en `ubicacion.tsx` y
// reutilizada por la ruta `ubicacion-desactualizada.tsx`.
export function EstadoUbicacionDesactualizada({
  onActualizar,
  onVolverJornada,
}: EstadoUbicacionDesactualizadaProps) {
  return (
    <View style={styles.base}>
      <View style={styles.orb}>
        <IconoPin color={colors.amber} />
      </View>

      <StateBadge label="Ubicación sin actualizar" tone="warning" />

      <Text style={styles.titulo}>Actualiza tu ubicación.</Text>
      <Text style={styles.descripcion}>
        Han pasado más de 5 minutos desde tu última actualización. No recibirás nuevas solicitudes
        hasta recuperarla.
      </Text>

      <Card style={styles.card}>
        <Paso
          numero={1}
          titulo="Revisa la ubicación del teléfono"
          detalle="Comprueba que el GPS esté activado y TaxiSur tenga permiso."
        />
        <Paso
          numero={2}
          titulo="Mantén abierta la app"
          detalle="Revisa también tu conexión a internet."
        />
      </Card>

      <View style={styles.acciones}>
        <Button label="Actualizar ubicación" onPress={onActualizar} />
        <Button label="Ir a mi jornada" variant="secondary" onPress={onVolverJornada} />
      </View>
    </View>
  );
}

function Paso({
  numero,
  titulo,
  detalle,
}: {
  numero: number;
  titulo: string;
  detalle: string;
}) {
  return (
    <View style={styles.paso}>
      <View style={styles.stepnum}>
        <Text style={styles.stepnumTexto}>{numero}</Text>
      </View>
      <View style={styles.grow}>
        <Text style={styles.pasoFuerte}>{titulo}</Text>
        <Text style={styles.pasoDetalle}>{detalle}</Text>
      </View>
    </View>
  );
}

function IconoPin({ color }: { color: string }) {
  return (
    <Svg
      height={30}
      width={30}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <Circle cx={12} cy={10} r={2.5} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  base: {
    gap: spacing.sm,
  },
  orb: {
    height: 72,
    width: 72,
    borderRadius: 24,
    backgroundColor: '#fdf3d6',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  titulo: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 33,
    marginTop: spacing.xs,
  },
  descripcion: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    marginTop: spacing.xs,
  },
  paso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stepnum: {
    height: 26,
    width: 26,
    borderRadius: 13,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepnumTexto: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  grow: {
    flex: 1,
  },
  pasoFuerte: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  pasoDetalle: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  acciones: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
