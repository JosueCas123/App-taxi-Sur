# M01 — Login, identidad y sesión segura

**Estado:** por implementar en React Native. **Dependencias:** M00.

## Objetivo

Autenticar con teléfono y PIN, restaurar la sesión y resolver correctamente la identidad del conductor.

## Pantallas de referencia

- [login.html](../referencias-ui/login.html)
- [recuperar-pin.html](../referencias-ui/recuperar-pin.html)

Los HTML son referencias visuales con simulaciones, no componentes nativos ni pruebas de integración.

## Contratos

POST /api/auth/conductor/login; GET /api/conductores/:id.

Consultar cuerpos y respuestas en [01-CONTRATOS-API.md](../01-CONTRATOS-API.md).

## Tareas

1. Implementar teléfono y PIN con teclado apropiado, ocultación del PIN, validación y bloqueo de doble envío. Mantener como texto el PIN para preservar ceros iniciales.
2. Enviar {telefono,pin}; guardar solo el JWT en SecureStore y mantener la sesión en memoria. No guardar PIN en logs, caché ni almacenamiento.
3. Obtener conductorId del claim del JWT y consultar el perfil. sub identifica al usuario y NO sirve como ID del conductor. Si falta conductorId, mostrar una sesión incompatible y solicitar nuevo login; no adivinar un ID.
4. Restaurar el token al iniciar; validar exp localmente para UX y confirmar la identidad con la API. Decodificar un JWT en el cliente no reemplaza la verificación del servidor.
5. Diferenciar 401 de timeout/sin red. Ante 401 invalidar sesión, cancelar consultas, cerrar SSE y limpiar cachés privadas; permitir volver a entrar y recuperar el servicio activo.
6. Recuperar PIN abre ayuda para contactar a administración. Usar un contacto público configurado para la app; GET /api/configuracion requiere autenticación. Si no hay contacto configurado, no inventar un número.

## Archivos propuestos

- `src/features/auth/api.ts`
- `src/features/auth/session.ts`
- `src/features/auth/token-storage.ts`
- `src/features/auth/screens/*`
- `src/app/(auth)/*`

Las rutas son una propuesta de organización; adaptar si el repositorio ya tiene convenciones.

## Criterios de aceptación

- [ ] Login correcto conduce al flujo de cuenta, no directamente a disponible.
- [ ] Error de credenciales muestra un mensaje genérico sin revelar si el teléfono existe.
- [ ] Reinicio restaura una sesión válida; un token vencido solicita login.
- [ ] Un timeout conserva la distinción de estado incierto y no borra una sesión válida.
- [ ] La ayuda no llama al endpoint administrativo de resetear PIN.

## Decisiones y límites

No existe endpoint de refresh ni logout en el contrato actual. Al expirar la sesión se requiere autenticación otra vez. El claim rol mencionado en el ROADMAP no está incluido en la firma actual: no depender de él.

## Prompt para comenzar

> Implementa únicamente M01 — Login, identidad y sesión segura en la app TaxiSur existente. Lee este archivo, 01-CONTRATOS-API.md y 02-ARQUITECTURA.md; comprueba que sus dependencias estén listas. Usa las referencias HTML solo como diseño, conserva las reglas de negocio del backend y no inventes endpoints. Implementa las tareas, verifica los criterios aplicables y entrega un resumen de archivos modificados, pruebas ejecutadas y pendientes. No avances automáticamente al módulo siguiente ni publiques la app.
