export type RegistroConductorInput = {
  telefono: string;
  pin: string;
  nombreCompleto: string;
  cedulaIdentidad: string;
  vehiculo: {
    placa: string;
    marca: string;
    modelo: string;
    color: string;
    capacidadPasajeros: number;
  };
};

export type CamposRegistro = Omit<RegistroConductorInput, 'vehiculo'> & {
  confirmacionPin: string;
  placa: string;
  marca: string;
  modelo: string;
  color: string;
  capacidadPasajeros: string;
};

export type ErroresRegistro = Partial<Record<keyof CamposRegistro, string>>;

export type ResultadoValidacion =
  | { ok: true; datos: RegistroConductorInput }
  | { ok: false; errores: ErroresRegistro };

const MAX_TELEFONO = 30;
const MAX_NOMBRE = 100;
const MAX_CEDULA = 50;
const MAX_VEHICULO = 30;
const PATRON_PIN = /^\d{4,6}$/;
const PATRON_ENTERO = /^\d+$/;
const CAPACIDAD_MIN = 1;
const CAPACIDAD_MAX = 100;

const MENSAJES = {
  telefonoVacio: 'Escribe tu número de teléfono',
  telefonoLargo: `El teléfono debe tener como máximo ${MAX_TELEFONO} caracteres`,
  nombreVacio: 'Escribe tu nombre completo',
  nombreLargo: `El nombre completo debe tener como máximo ${MAX_NOMBRE} caracteres`,
  cedulaVacia: 'Escribe tu cédula de identidad',
  cedulaLarga: `La cédula de identidad debe tener como máximo ${MAX_CEDULA} caracteres`,
  vehiVacio: 'Completa este dato del vehículo',
  vehiLargo: `Este dato del vehículo debe tener como máximo ${MAX_VEHICULO} caracteres`,
  pin: 'El PIN debe tener entre 4 y 6 dígitos',
  confirmacion: 'Las confirmaciones del PIN no coinciden',
  capacidadVacia: 'Indica la capacidad de pasajeros',
  capacidadEntero: 'La capacidad debe ser un número entero',
  capacidadRango: `La capacidad debe estar entre ${CAPACIDAD_MIN} y ${CAPACIDAD_MAX}`,
} as const;

function validarTexto(
  valor: string,
  maximo: number,
  mensajeVacio: string,
  mensajeLargo: string
): string | null {
  const recortado = valor.trim();
  if (recortado.length === 0) return mensajeVacio;
  if (recortado.length > maximo) return mensajeLargo;
  return null;
}

function convertirCapacidad(valor: string): { error?: string; numero?: number } {
  const recortado = valor.trim();
  if (recortado.length === 0) return { error: MENSAJES.capacidadVacia };
  if (!PATRON_ENTERO.test(recortado)) return { error: MENSAJES.capacidadEntero };
  const numero = Number(recortado);
  if (numero < CAPACIDAD_MIN || numero > CAPACIDAD_MAX) return { error: MENSAJES.capacidadRango };
  return { numero };
}

export function validarRegistro(campos: CamposRegistro): ResultadoValidacion {
  const errores: ErroresRegistro = {};

  const errorTelefono = validarTexto(
    campos.telefono,
    MAX_TELEFONO,
    MENSAJES.telefonoVacio,
    MENSAJES.telefonoLargo
  );
  if (errorTelefono) errores.telefono = errorTelefono;

  const errorNombre = validarTexto(
    campos.nombreCompleto,
    MAX_NOMBRE,
    MENSAJES.nombreVacio,
    MENSAJES.nombreLargo
  );
  if (errorNombre) errores.nombreCompleto = errorNombre;

  const errorCedula = validarTexto(
    campos.cedulaIdentidad,
    MAX_CEDULA,
    MENSAJES.cedulaVacia,
    MENSAJES.cedulaLarga
  );
  if (errorCedula) errores.cedulaIdentidad = errorCedula;

  const errorPlaca = validarTexto(campos.placa, MAX_VEHICULO, MENSAJES.vehiVacio, MENSAJES.vehiLargo);
  if (errorPlaca) errores.placa = errorPlaca;

  const errorMarca = validarTexto(campos.marca, MAX_VEHICULO, MENSAJES.vehiVacio, MENSAJES.vehiLargo);
  if (errorMarca) errores.marca = errorMarca;

  const errorModelo = validarTexto(campos.modelo, MAX_VEHICULO, MENSAJES.vehiVacio, MENSAJES.vehiLargo);
  if (errorModelo) errores.modelo = errorModelo;

  const errorColor = validarTexto(campos.color, MAX_VEHICULO, MENSAJES.vehiVacio, MENSAJES.vehiLargo);
  if (errorColor) errores.color = errorColor;

  const pinValido = PATRON_PIN.test(campos.pin);
  if (!pinValido) {
    errores.pin = MENSAJES.pin;
  } else if (campos.confirmacionPin !== campos.pin) {
    errores.confirmacionPin = MENSAJES.confirmacion;
  }

  const capacidad = convertirCapacidad(campos.capacidadPasajeros);
  if (capacidad.error) errores.capacidadPasajeros = capacidad.error;

  if (Object.keys(errores).length > 0) {
    return { ok: false, errores };
  }

  return {
    ok: true,
    datos: {
      telefono: campos.telefono.trim(),
      pin: campos.pin,
      nombreCompleto: campos.nombreCompleto.trim(),
      cedulaIdentidad: campos.cedulaIdentidad.trim(),
      vehiculo: {
        placa: campos.placa.trim(),
        marca: campos.marca.trim(),
        modelo: campos.modelo.trim(),
        color: campos.color.trim(),
        capacidadPasajeros: capacidad.numero!,
      },
    },
  };
}
