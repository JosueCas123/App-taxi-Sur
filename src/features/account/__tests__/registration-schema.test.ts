import { expect, it } from '@jest/globals';

import { validarRegistro, type CamposRegistro } from '../registration-schema';

function campos(parcial: Partial<CamposRegistro> = {}): CamposRegistro {
  return {
    telefono: '70000000',
    pin: '0012',
    confirmacionPin: '0012',
    nombreCompleto: 'Ana Pérez',
    cedulaIdentidad: '1234567',
    placa: 'ABC123',
    marca: 'Toyota',
    modelo: 'Corolla',
    color: 'Blanco',
    capacidadPasajeros: '4',
    ...parcial,
  };
}

it('un formulario válido construye el cuerpo exacto del contrato', () => {
  const resultado = validarRegistro(campos());
  expect(resultado).toEqual({
    ok: true,
    datos: {
      telefono: '70000000',
      pin: '0012',
      nombreCompleto: 'Ana Pérez',
      cedulaIdentidad: '1234567',
      vehiculo: {
        placa: 'ABC123',
        marca: 'Toyota',
        modelo: 'Corolla',
        color: 'Blanco',
        capacidadPasajeros: 4,
      },
    },
  });
});

it('el cuerpo válido no incluye confirmación ni campos auxiliares', () => {
  const resultado = validarRegistro(campos());
  expect(resultado.ok).toBe(true);
  if (!resultado.ok) return;
  expect(Object.keys(resultado.datos).sort()).toEqual(
    ['telefono', 'pin', 'nombreCompleto', 'cedulaIdentidad', 'vehiculo'].sort()
  );
  expect(Object.keys(resultado.datos.vehiculo).sort()).toEqual(
    ['placa', 'marca', 'modelo', 'color', 'capacidadPasajeros'].sort()
  );
  expect((resultado.datos as Record<string, unknown>).confirmacionPin).toBeUndefined();
});

it('recorta los textos antes de construir el cuerpo', () => {
  const resultado = validarRegistro(
    campos({
      telefono: '  70000000  ',
      nombreCompleto: '  Ana Pérez ',
      cedulaIdentidad: ' 1234567 ',
      placa: ' ABC123 ',
      marca: ' Toyota ',
      modelo: ' Corolla ',
      color: ' Blanco ',
    })
  );
  expect(resultado.ok).toBe(true);
  if (!resultado.ok) return;
  expect(resultado.datos.telefono).toBe('70000000');
  expect(resultado.datos.nombreCompleto).toBe('Ana Pérez');
  expect(resultado.datos.cedulaIdentidad).toBe('1234567');
  expect(resultado.datos.vehiculo).toEqual({
    placa: 'ABC123',
    marca: 'Toyota',
    modelo: 'Corolla',
    color: 'Blanco',
    capacidadPasajeros: 4,
  });
});

it('preserva los ceros iniciales del PIN y no lo recorta', () => {
  const resultado = validarRegistro(campos({ pin: '0012', confirmacionPin: '0012' }));
  expect(resultado.ok).toBe(true);
  if (!resultado.ok) return;
  expect(resultado.datos.pin).toBe('0012');
});

it.each([
  ['un carácter', '7'],
  ['30 caracteres', '7'.repeat(30)],
])('acepta teléfono %s dentro del contrato', (_caso, valor) => {
  const resultado = validarRegistro(campos({ telefono: valor }));
  expect(resultado.ok).toBe(true);
});

it('rechaza teléfono vacío', () => {
  const resultado = validarRegistro(campos({ telefono: '   ' }));
  expect(resultado).toEqual({ ok: false, errores: { telefono: 'Escribe tu número de teléfono' } });
});

it('rechaza teléfono de más de 30 caracteres', () => {
  const resultado = validarRegistro(campos({ telefono: '7'.repeat(31) }));
  expect(resultado).toEqual({
    ok: false,
    errores: { telefono: 'El teléfono debe tener como máximo 30 caracteres' },
  });
});

it('no impone un patrón telefónico adicional sobre el formato', () => {
  const resultado = validarRegistro(campos({ telefono: 'no-es-numero' }));
  expect(resultado.ok).toBe(true);
});

it.each([
  ['1 caracteres', 'A'],
  ['100 caracteres', 'A'.repeat(100)],
])('acepta nombre completo de %s', (_caso, valor) => {
  expect(validarRegistro(campos({ nombreCompleto: valor })).ok).toBe(true);
});

it('rechaza nombre completo vacío y de 101 caracteres', () => {
  expect(validarRegistro(campos({ nombreCompleto: '  ' }))).toEqual({
    ok: false,
    errores: { nombreCompleto: 'Escribe tu nombre completo' },
  });
  expect(validarRegistro(campos({ nombreCompleto: 'A'.repeat(101) }))).toEqual({
    ok: false,
    errores: { nombreCompleto: 'El nombre completo debe tener como máximo 100 caracteres' },
  });
});

it('acepta cédula de 50 caracteres y rechaza 51 y vacío', () => {
  expect(validarRegistro(campos({ cedulaIdentidad: 'C'.repeat(50) })).ok).toBe(true);
  expect(validarRegistro(campos({ cedulaIdentidad: 'C'.repeat(51) }))).toEqual({
    ok: false,
    errores: { cedulaIdentidad: 'La cédula de identidad debe tener como máximo 50 caracteres' },
  });
  expect(validarRegistro(campos({ cedulaIdentidad: ' ' }))).toEqual({
    ok: false,
    errores: { cedulaIdentidad: 'Escribe tu cédula de identidad' },
  });
});

it.each(['placa', 'marca', 'modelo', 'color'] as const)(
  'valida el límite de 30 caracteres del campo %s',
  (campo) => {
    expect(validarRegistro(campos({ [campo]: 'X'.repeat(30) })).ok).toBe(true);
    expect(validarRegistro(campos({ [campo]: 'X'.repeat(31) }))).toEqual({
      ok: false,
      errores: { [campo]: 'Este dato del vehículo debe tener como máximo 30 caracteres' },
    });
    expect(validarRegistro(campos({ [campo]: '  ' }))).toEqual({
      ok: false,
      errores: { [campo]: 'Completa este dato del vehículo' },
    });
  }
);

it.each([
  ['4 dígitos', '0012'],
  ['6 dígitos', '123456'],
])('acepta PIN de %s', (_caso, valor) => {
  expect(validarRegistro(campos({ pin: valor, confirmacionPin: valor })).ok).toBe(true);
});

it.each([
  ['3 dígitos', '123'],
  ['7 dígitos', '1234567'],
  ['no numérico', '12ab'],
  ['vacío', ''],
  ['con espacios', '1 23'],
])('rechaza PIN %s', (_caso, valor) => {
  expect(validarRegistro(campos({ pin: valor, confirmacionPin: valor }))).toEqual({
    ok: false,
    errores: { pin: 'El PIN debe tener entre 4 y 6 dígitos' },
  });
});

it('rechaza una confirmación de PIN distinta', () => {
  expect(validarRegistro(campos({ pin: '0012', confirmacionPin: '0013' }))).toEqual({
    ok: false,
    errores: { confirmacionPin: 'Las confirmaciones del PIN no coinciden' },
  });
});

it('no compara la confirmación si el PIN no cumple el formato', () => {
  const resultado = validarRegistro(campos({ pin: '12', confirmacionPin: '99' }));
  expect(resultado).toEqual({ ok: false, errores: { pin: 'El PIN debe tener entre 4 y 6 dígitos' } });
});

it.each([
  ['1', 1],
  ['100', 100],
  [' 4 ', 4],
  ['07', 7],
])('acepta capacidad %s y la construye como entero', (valor, esperado) => {
  const resultado = validarRegistro(campos({ capacidadPasajeros: valor }));
  expect(resultado.ok).toBe(true);
  if (!resultado.ok) return;
  expect(resultado.datos.vehiculo.capacidadPasajeros).toBe(esperado);
});

it('rechaza capacidad vacía', () => {
  expect(validarRegistro(campos({ capacidadPasajeros: '   ' }))).toEqual({
    ok: false,
    errores: { capacidadPasajeros: 'Indica la capacidad de pasajeros' },
  });
});

it.each(['4.5', '4,5', 'abc', '4e2', '+4', '-1'])(
  'rechaza capacidad no entera %s',
  (valor) => {
    expect(validarRegistro(campos({ capacidadPasajeros: valor }))).toEqual({
      ok: false,
      errores: { capacidadPasajeros: 'La capacidad debe ser un número entero' },
    });
  }
);

it.each(['0', '101', '999'])('rechaza capacidad fuera de rango %s', (valor) => {
  expect(validarRegistro(campos({ capacidadPasajeros: valor }))).toEqual({
    ok: false,
    errores: { capacidadPasajeros: 'La capacidad debe estar entre 1 y 100' },
  });
});

it('acumula todos los errores por campo de una sola vez', () => {
  const resultado = validarRegistro(
    campos({
      telefono: '',
      nombreCompleto: '',
      cedulaIdentidad: '',
      placa: '',
      marca: '',
      modelo: '',
      color: '',
      pin: '12',
      capacidadPasajeros: '',
    })
  );
  expect(resultado.ok).toBe(false);
  if (resultado.ok) return;
  expect(Object.keys(resultado.errores).sort()).toEqual(
    [
      'telefono',
      'nombreCompleto',
      'cedulaIdentidad',
      'placa',
      'marca',
      'modelo',
      'color',
      'pin',
      'capacidadPasajeros',
    ].sort()
  );
});
