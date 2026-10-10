# M08 — Perfil, ayuda y cierre de sesión

**Estado:** por implementar en React Native. **Dependencias:** M01–M07.

## Objetivo

Mostrar los datos autorizados y separar el cierre de sesión del fin de jornada.

## Pantallas de referencia

- [perfil.html](../referencias-ui/perfil.html)
- [recuperar-pin.html](../referencias-ui/recuperar-pin.html)

Los HTML son referencias visuales con simulaciones, no componentes nativos ni pruebas de integración.

## Contratos

GET /api/conductores/:id; GET /api/configuracion (opcional, autenticado); PATCH /api/conductores/:id/jornada para cierre operativo cuando proceda.

Consultar cuerpos y respuestas en [01-CONTRATOS-API.md](../01-CONTRATOS-API.md).

## Tareas

1. Presentar nombre, CI, teléfono, estados y vehículo en modo solo lectura. Si vehiculo es null, mostrar ausencia de datos sin inventarlos.
2. Para ayuda autenticada usar telefonoCentroAtencion si está disponible en configuración. Manejar null; no confundir ese teléfono con el del pasajero.
3. Como decisión UX, el botón normal de salir debe advertir si hay jornada o servicio pendiente. Sin servicio, ofrecer finalizar jornada y salir después de confirmarlo.
4. Si existe oferta, resolverla/reconciliar antes del cierre operativo. Si existe servicio, ofrecer permanecer y terminarlo; no ejecutar finalizar servicio desde logout.
5. Ofrecer una salida local explícita para retirar credenciales incluso offline, con aviso de que no cierra la jornada ni termina el servicio en servidor. Una expiración de sesión tampoco cambia esos estados.
6. En cualquier salida local detener SSE y GPS, cancelar consultas, eliminar token y caché privada. En siguiente login recuperar el estado operativo pendiente.

## Archivos propuestos

- `src/features/profile/screens/ProfileScreen.tsx`
- `src/features/profile/use-support-contact.ts`
- `src/features/auth/sign-out.ts`

Las rutas son una propuesta de organización; adaptar si el repositorio ya tiene convenciones.

## Criterios de aceptación

- [ ] No hay edición de datos ni llamadas a endpoints administrativos.
- [ ] Cerrar sesión no envía finalizar servicio.
- [ ] Salida local offline elimina datos sensibles y explica la jornada pendiente.
- [ ] Al entrar con otra cuenta no se muestran datos del conductor anterior.
- [ ] El contacto ausente no produce enlace inválido.

## Decisiones y límites

La política de salida operativa es una propuesta UX del plan, no una restricción nueva del backend. No hay endpoint de logout que revoque JWT actualmente.

## Prompt para comenzar

> Implementa únicamente M08 — Perfil, ayuda y cierre de sesión en la app TaxiSur existente. Lee este archivo, 01-CONTRATOS-API.md y 02-ARQUITECTURA.md; comprueba que sus dependencias estén listas. Usa las referencias HTML solo como diseño, conserva las reglas de negocio del backend y no inventes endpoints. Implementa las tareas, verifica los criterios aplicables y entrega un resumen de archivos modificados, pruebas ejecutadas y pendientes. No avances automáticamente al módulo siguiente ni publiques la app.
