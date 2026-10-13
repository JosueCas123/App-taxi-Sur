import { expect, it } from '@jest/globals';
import { Buffer } from 'buffer';

import { decodificarPayloadJwt } from '../jwt';

it('decodifica base64url sin padding y UTF-8 sin verificar firma', () => {
  const payload = { conductorId: 'conductor-a', sub: 'usuario-a', exp: 123, nombre: '\u00bf\u00ff?' };
  const segmento = Buffer.from(JSON.stringify(payload)).toString('base64url');
  expect(decodificarPayloadJwt(`cabecera.${segmento}.firma-no-verificada`)).toEqual(payload);
});

it('no usa sub como conductorId', () => {
  const segmento = Buffer.from(JSON.stringify({ sub: 'usuario-a' })).toString('base64url');
  expect(decodificarPayloadJwt(`cabecera.${segmento}.firma`)).toEqual({ sub: 'usuario-a' });
});

it.each(['', 'sin-segmentos', 'a..c', 'a.%%%.c', 'a.bm8tZXMtanNvbg.c', 'a.bnVsbA.c', 'a.MTIz.c'])
('rechaza payload ausente, corrupto o no objeto: %s', (token) => {
  expect(decodificarPayloadJwt(token)).toBeNull();
});
