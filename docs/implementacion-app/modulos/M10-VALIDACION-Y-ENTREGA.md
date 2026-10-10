# M10 — Integración, pruebas y compilación de prueba

**Estado:** por implementar en React Native. **Dependencias:** M00–M09 y condiciones de backend comprobadas.

## Objetivo

Demostrar que las pantallas nativas funcionan con el backend y entregar una compilación reproducible.

## Pantallas de referencia

- Todas las pantallas de la matriz.

Los HTML son referencias visuales con simulaciones, no componentes nativos ni pruebas de integración.

## Contratos

Todos los contratos de 01-CONTRATOS-API.md; el backend real configurado para la app.

Consultar cuerpos y respuestas en [01-CONTRATOS-API.md](../01-CONTRATOS-API.md).

## Tareas

1. Ejecutar TypeScript y lint con scripts disponibles; registrar comandos y resultados. Añadir pruebas focalizadas de guards, contador, reconciliación y limpieza de sesión.
2. Probar el recorrido completo con las cuentas autorizadas y el backend real configurado: alta, aprobación administrativa, login, jornada, GPS, disponible, asignación, aceptar, finalizar y cierre.
3. Usar la matriz 06-PRUEBAS-DE-ACEPTACION.md y anotar resultado real/evidencia por caso. No marcar aprobadas pruebas no ejecutadas.
4. Verificar SSE end-to-end, migraciones y publicación de conductores. La integración de la app debe probarse contra el backend real configurado y conectado con el sistema; una respuesta simulada no acredita que Supabase esté configurado.
5. Probar Android físico: permisos, retorno de ajustes, cierre/reapertura, pantalla bloqueada, red intermitente y vencimiento de sesión. Si iOS forma parte de la entrega, repetir allí y registrar lo pendiente.
6. Generar una compilación ejecutable con configuración documentada. Entregar guía de instalación, versión del backend conectado y limitaciones de foreground.

## Archivos propuestos

- `tests/*`
- `docs/validacion-app.md`
- `docs/instalacion-app.md`
- `Configuración de compilación acorde al proyecto`

Las rutas son una propuesta de organización; adaptar si el repositorio ya tiene convenciones.

## Criterios de aceptación

- [ ] Cada una de las 16 pantallas tiene ruta nativa, datos reales o un estado vacío/pendiente explícito.
- [ ] El flujo crítico y los casos negativos tienen evidencia en dispositivo.
- [ ] Los pendientes de SSE se resuelven o se documentan como impedimento para certificar la operación.
- [ ] No se atribuye capacidad de segundo plano o push a una implementación foreground.
- [ ] La entrega identifica commit/versión y resultados; no contiene claves privadas.

## Decisiones y límites

Este paquete define trabajo por implementar. La auditoría anterior aprobó tsc del backend, pero no pudo completar su suite por restricciones del entorno. No reutilizar ese resultado como evidencia de la app.

## Prompt para comenzar

> Implementa únicamente M10 — Integración, pruebas y compilación de prueba en la app TaxiSur existente. Lee este archivo, 01-CONTRATOS-API.md y 02-ARQUITECTURA.md; comprueba que sus dependencias estén listas. Usa las referencias HTML solo como diseño, conserva las reglas de negocio del backend y no inventes endpoints. Implementa las tareas, verifica los criterios aplicables y entrega un resumen de archivos modificados, pruebas ejecutadas y pendientes. No avances automáticamente al módulo siguiente ni publiques la app.
