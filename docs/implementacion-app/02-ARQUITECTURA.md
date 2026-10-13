# Arquitectura de implementación propuesta

## Separación de responsabilidades

El backend es autoridad para cuenta, jornada, disponibilidad, asignación y vencimiento. La app muestra y solicita acciones. TanStack Query administra datos del servidor; un contexto pequeño administra la sesión; un coordinador resuelve recuperación/navegación. No duplicar estados remotos en varios stores persistidos.

```text
app-taxi/app-taxi/
  src/app/_layout.tsx
  src/app/index.tsx
  src/app/(auth)/login.tsx, registro.tsx, recuperar-pin.tsx
  src/app/(cuenta)/revision.tsx, rechazada.tsx, suspendida.tsx
  src/app/(operacion)/inicio.tsx, ubicacion.tsx, ubicacion-desactualizada.tsx
  src/app/(operacion)/solicitud-entrante.tsx, solicitud-expirada.tsx
  src/app/(operacion)/en-servicio.tsx, servicio-finalizado.tsx, perfil.tsx
  src/app/sin-conexion.tsx
  src/features/auth/, account/, shift/, location/, events/
  src/features/requests/, service/, profile/, connectivity/
  src/lib/api-client.ts, api-errors.ts, query-client.ts
  src/navigation/resolve-route.ts
  src/theme/tokens.ts
  src/ui/
```

Los nombres agrupados en una línea representan archivos independientes. index.tsx cubre bienvenida y decisión inicial. La estructura no exige mover módulos existentes si el repositorio adopta otra convención.

## Arranque y prioridades

1. Restaurar sesión; si no hay token válido mostrar bienvenida/login. Si está expirado, pedir login, sin cerrar jornada ficticiamente.
2. Obtener perfil. Si falla por red mostrar recuperación, no una cuenta aprobada por defecto.
3. Abrir SSE y consultar solicitud-activa; repetir reconciliación al recibir conectado para cubrir cambios durante la apertura.
4. Si hay en_servicio, permitir completar el servicio; una cuenta suspendida muestra advertencia y bloquea nuevas operaciones.
5. Sin servicio, cuenta pendiente/rechazada/suspendida muestra su pantalla y acciones limitadas.
6. Cuenta aprobada con oferta vigente muestra solicitud entrante. Si la oferta ya venció, desactivar respuesta y reconciliar.
7. Sin solicitud activa mostrar inicio; GPS y disponibilidad se resuelven con datos vigentes.

Los deep links deben pasar por los mismos guards. Si llega un estado inconsistente, deshabilitar acciones y recuperar; no corregirlo escribiendo directamente a la base.

## Caché y concurrencia

Claves sugeridas: [conductor,id], [solicitudActiva,conductorId], [solicitud,id], [configuracion]. Incluir identidad y generación de sesión en la invalidación; cancelar peticiones al salir. No persistir el detalle del pasajero por defecto. Tratar eventos SSE como invalidaciones, no como una copia completa de la entidad.

Agrupar eventos mientras hay una reconciliación en curso y ejecutar otra si llegó un cambio durante la lectura. No dejar que una respuesta lenta de una sesión previa sobrescriba la actual. Evitar caché antigua al volver de background.

## Servicios compartidos

- api-client: URL, Bearer, abort/timeout, JSON, errores HTTP tipados; lecturas con reintento limitado y mutaciones sin reintento automático.
- session: token seguro, identidad, estado restaurando/autenticado/no autenticado; exp local solo como ayuda de UX.
- sse-transport: conexión autenticada, parseo de eventos, reconexión y cierre; validar soporte real de headers en Android antes de elegir implementación.
- location: permiso, captura, frescura y envío; no reenvío de muestras offline viejas.
- resolve-route: estado confirmado → pantalla; nunca usar solo un booleano isApproved para bloquear un servicio que debe poder finalizarse.

## Decisiones de alcance

Ubicación y recepción iniciales con app en primer plano. Segundo plano, push y entrega con pantalla bloqueada requieren diseño y pruebas adicionales; SSE no es push. La interfaz debe explicar la pérdida de conexión operativa al regresar, sin prometer servicios de fondo no implementados.

Los datos públicos de configuración de compilación pueden contener URL de API y contacto de soporte autorizado. Nunca claves de Supabase, JWT_SECRET, token n8n ni PIN. No usar el HTML dentro de un WebView para simular que ya se implementó la app nativa.
