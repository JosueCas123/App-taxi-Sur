import { createContext, useContext, type ReactNode } from 'react';

// Costura de integración para M05/M06: reconcilia una oferta activa antes de
// reintentar tras un 409. NO es una reconciliación efectiva en M03.
export type ReconciliadorOferta = () => Promise<void>;

const reconciliadorNoOp: ReconciliadorOferta = () => Promise.resolve();

// Valor por defecto no-op: el hook funciona aunque el proveedor no esté montado.
const ReconciliacionOfertaContext = createContext<ReconciliadorOferta>(reconciliadorNoOp);

export function ReconciliacionOfertaProvider({
  children,
  reconciliador,
}: {
  children: ReactNode;
  // `reconciliador` existe solo para inyectar un doble en pruebas; la app entregable usa el no-op.
  reconciliador?: ReconciliadorOferta;
}) {
  return (
    <ReconciliacionOfertaContext.Provider value={reconciliador ?? reconciliadorNoOp}>
      {children}
    </ReconciliacionOfertaContext.Provider>
  );
}

export function useReconciliacionOferta(): ReconciliadorOferta {
  return useContext(ReconciliacionOfertaContext);
}
