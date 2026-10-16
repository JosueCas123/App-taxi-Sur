import { Tabs } from 'expo-router/js-tabs';

import { AppHeader } from '../../../features/ui/AppHeader';
import { BottomNav } from '../../../features/ui/BottomNav';
import { colors } from '../../../theme/tokens';

// Pestañas inferiores del grupo operativo: Mi jornada, Ubicación y Mi cuenta.
// El header y la barra inferior son compartidos por el navegador, de modo que
// al cambiar de pestaña solo cambia el contenido (las pantallas permanecen
// montadas y no se remonta toda la pantalla).
export default function OperacionTabsLayout() {
  return (
    <Tabs
      tabBar={() => <BottomNav />}
      screenOptions={{
        headerShown: true,
        header: () => <AppHeader />,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="inicio" options={{ title: 'Mi jornada' }} />
      <Tabs.Screen name="ubicacion" options={{ title: 'Ubicación' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Mi cuenta' }} />
    </Tabs>
  );
}
