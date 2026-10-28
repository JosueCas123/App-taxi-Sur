import type { Href } from 'expo-router';

import type { ConductorDetalleDto } from '../features/auth/api';
import type { SolicitudDetalleDto } from '../features/requests/api';

// Entrada mínima de la política. M05 deberá producirla a partir de una
// respuesta real, vigente y del conductor y generación de sesión actuales.
export type ServicioConfirmado = {
  id: string;
  conductorAsignadoId: string;
  estado: 'en_servicio';
};

export type AccesoOperativo = 'permitido' | 'bloqueado_por_estado' | 'solo_finalizar';

export function rutaInicialPorEstado(estado: ConductorDetalleDto['estado']): Href {
  switch (estado) {
    case 'pendiente':
      return '/(cuenta)/revision';
    case 'rechazado':
      return '/(cuenta)/rechazada';
    case 'suspendido':
      return '/(cuenta)/suspendida';
    case 'aprobado':
      return '/(operacion)/inicio';
  }
}

// Pathname visible en la URL (expo-router omite los grupos) por estado de cuenta.
export function pathnameCuentaPorEstado(
  estado: Exclude<ConductorDetalleDto['estado'], 'aprobado'>
): string {
  switch (estado) {
    case 'pendiente':
      return '/revision';
    case 'rechazado':
      return '/rechazada';
    case 'suspendido':
      return '/suspendida';
  }
}

// Política centralizada de acceso operativo. Un servicio confirmado solo cuenta
// cuando pertenece al conductor actual; una identidad diferente no habilita la
// excepción de continuidad. Estado ausente o no verificado no habilita operación.
export function evaluarAccesoOperativo(
  estadoCuenta: ConductorDetalleDto['estado'] | null | undefined,
  conductorId: string | null,
  servicio: ServicioConfirmado | null,
  continuidadFinalizacion = false
): AccesoOperativo {
  if (!estadoCuenta || !conductorId) {
    return 'bloqueado_por_estado';
  }

  const servicioConfirmado =
    servicio !== null &&
    servicio.estado === 'en_servicio' &&
    servicio.conductorAsignadoId === conductorId;

  if (estadoCuenta === 'aprobado') {
    return 'permitido';
  }

  // Cuentas restringidas: solo continuidad/finalización con servicio confirmado
  // propio o con un servicio en verificación/éxito pendiente de mostrar.
  return servicioConfirmado || continuidadFinalizacion
    ? 'solo_finalizar'
    : 'bloqueado_por_estado';
}

// Estado operativo ya reconciliado con datos reales del conductor autenticado.
export type EstadoOperativoConfirmado = {
  conductor: ConductorDetalleDto;
  solicitudActiva: SolicitudDetalleDto | null;
};

// Mejor-esfuerzo local: `expiraEn` null se considera vigente; con plazo, solo si
// `expiraEn` es posterior a `ahoraServidorMs`. Orienta a qué pantalla navegar;
// no cambia lo que el backend aceptará. Una fecha no parseable cuenta como vencida.
export function ofertaVigente(
  solicitud: SolicitudDetalleDto,
  ahoraServidorMs: number
): boolean {
  if (solicitud.expiraEn === null) {
    return true;
  }
  const expiraMs = Date.parse(solicitud.expiraEn);
  return !Number.isNaN(expiraMs) && expiraMs > ahoraServidorMs;
}

// Decide la ruta operativa a partir del estado reconciliado. Se invoca **solo**
// cuando la reconciliación inicial completó (nunca con datos incompletos).
// Toda oferta/servicio valida `conductorAsignadoId === conductor.id` antes de
// navegar: una solicitud no asignada al conductor autenticado se ignora.
// `ahoraServidorMs` (por defecto, el reloj local) orienta la vigencia local de
// la oferta; `ofertaDescartadaId` trata como ausente la oferta vencida que el
// conductor ya descartó, evitando el bucle solicitud-expirada → inicio.
export type OpcionesFinalizacion = {
  servicioFinalizadoId?: string | null;
  servicioEnVerificacionId?: string | null;
};

export function resolverRutaOperativa(
  estado: EstadoOperativoConfirmado,
  ahoraServidorMs: number = Date.now(),
  ofertaDescartadaId: string | null = null,
  finalizacion?: OpcionesFinalizacion
): Href {
  const { conductor, solicitudActiva } = estado;
  const servicioFinalizadoId = finalizacion?.servicioFinalizadoId ?? null;
  const servicioEnVerificacionId = finalizacion?.servicioEnVerificacionId ?? null;

  const esPropia =
    solicitudActiva !== null && solicitudActiva.conductorAsignadoId === conductor.id;

  // Verificación pendiente: mantiene al conductor en el servicio aunque
  // `solicitud-activa` ya sea null, para que el guard no lo expulse.
  if (servicioEnVerificacionId !== null) {
    return '/(operacion)/en-servicio';
  }

  // Servicio propio en curso: continuidad aunque la cuenta esté restringida.
  // El mismo servicio ya confirmado como finalizado se trata como ausente.
  if (
    esPropia &&
    solicitudActiva.estado === 'en_servicio' &&
    solicitudActiva.id !== servicioFinalizadoId
  ) {
    return '/(operacion)/en-servicio';
  }

  // Oferta propia esperando respuesta: solo navega si la asignación coincide.
  if (
    conductor.estado === 'aprobado' &&
    esPropia &&
    solicitudActiva.estado === 'esperando_respuesta'
  ) {
    // Oferta ya descartada por el conductor: se trata como ausente.
    if (ofertaDescartadaId !== null && solicitudActiva.id === ofertaDescartadaId) {
      return '/(operacion)/inicio';
    }
    return ofertaVigente(solicitudActiva, ahoraServidorMs)
      ? '/(operacion)/solicitud-entrante'
      : '/(operacion)/solicitud-expirada';
  }

  // Éxito confirmado: gana sobre la ruta de una cuenta restringida.
  if (servicioFinalizadoId !== null) {
    return '/(operacion)/servicio-finalizado';
  }

  if (conductor.estado !== 'aprobado') {
    return rutaInicialPorEstado(conductor.estado);
  }

  return '/(operacion)/inicio';
}

// Ruta neutra del grupo operativo: destino por defecto cuando no hay oferta ni
// servicio que fuerce otra pantalla. Sirve de referencia para decidir si el
// conductor puede recorrer libremente las pestañas.
export const RUTA_OPERATIVA_NEUTRA: Href = '/(operacion)/inicio';

// Pathnames visibles de las pestañas operativas. Con la ruta resuelta en el
// neutro, el conductor puede moverse entre ellas sin que el guard lo devuelva.
export const RUTAS_TAB_OPERATIVA: readonly string[] = ['/inicio', '/ubicacion', '/perfil'];

export function esRutaTabOperativa(pathname: string): boolean {
  return RUTAS_TAB_OPERATIVA.includes(pathname);
}

// expo-router omite los grupos de la URL: '/(operacion)/inicio' → '/inicio'.
// Permite comparar la ruta resuelta con el pathname visible.
export function pathnameDeRuta(href: Href): string {
  const limpio = String(href)
    .replace(/\([^)]*\)/g, '')
    .replace(/\/{2,}/g, '/');
  return limpio.startsWith('/') ? limpio : `/${limpio}`;
}
