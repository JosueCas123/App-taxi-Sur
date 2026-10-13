export type RuntimeConfig = {
  apiUrl: string | null;
};

const valorDefinido = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';

export const runtimeConfig: RuntimeConfig = {
  apiUrl: valorDefinido || null,
};