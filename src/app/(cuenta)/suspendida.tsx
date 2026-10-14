import { useCallback } from 'react';

import { EstadoCuentaScreen } from '../../features/account/screens/estado-cuenta';
import { useRefrescoPerfil } from '../../features/account/use-refresco-perfil';
import { useSession } from '../../features/auth/session-context';

export default function SuspendidaScreen() {
  const { conductor } = useSession();
  const { refrescar, refrescando, error } = useRefrescoPerfil();

  const manejarActualizar = useCallback(async () => {
    await refrescar();
  }, [refrescar]);

  return (
    <EstadoCuentaScreen
      estado="suspendido"
      perfil={conductor}
      cargando={refrescando}
      error={error}
      onActualizar={manejarActualizar}
    />
  );
}
