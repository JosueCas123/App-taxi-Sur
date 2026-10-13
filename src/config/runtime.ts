export type RuntimeConfig = {
  apiUrl: string | null;
  contactoAyuda: string | null;
};

export const runtimeConfig: RuntimeConfig = {
  // Expo solo incorpora al bundle las referencias estaticas a variables publicas.
  apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim() || null,
  contactoAyuda: process.env.EXPO_PUBLIC_CONTACTO_AYUDA?.trim() || null,
};
