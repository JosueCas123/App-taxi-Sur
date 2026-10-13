import { beforeEach, expect, it, jest } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';

import { borrarToken, guardarToken, leerToken } from '../token-storage';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

beforeEach(() => { jest.resetAllMocks(); });

it('persiste solo el token con la clave acordada', async () => {
  await guardarToken('jwt-de-prueba');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('taxitur.session.token', 'jwt-de-prueba');
  expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
});

it.each([null, 'jwt-de-prueba'])('lee el valor almacenado: %s', async (token) => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(token);
  await expect(leerToken()).resolves.toBe(token);
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith('taxitur.session.token');
});

it('borra el token de SecureStore', async () => {
  await borrarToken();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('taxitur.session.token');
});

it('propaga errores de almacenamiento sin simular exito', async () => {
  const error = new Error('SecureStore no disponible');
  jest.mocked(SecureStore.setItemAsync).mockRejectedValue(error);
  jest.mocked(SecureStore.getItemAsync).mockRejectedValue(error);
  jest.mocked(SecureStore.deleteItemAsync).mockRejectedValue(error);
  await expect(guardarToken('jwt-de-prueba')).rejects.toBe(error);
  await expect(leerToken()).rejects.toBe(error);
  await expect(borrarToken()).rejects.toBe(error);
});
