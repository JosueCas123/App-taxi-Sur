# M00 — Base Expo, navegación y sistema visual

**Estado:** por implementar en React Native. **Dependencias:** Ninguna.

## Objetivo

Preparar el proyecto existente para implementar las pantallas nativas sin reproducir la lógica simulada de los HTML.

## Pantallas de referencia

- [bienvenida.html](../referencias-ui/bienvenida.html)
- [sistema-diseno.html](../referencias-ui/sistema-diseno.html)

Los HTML son referencias visuales con simulaciones, no componentes nativos ni pruebas de integración.

## Contratos

Sin endpoints; prepara el cliente HTTP compartido.

Consultar cuerpos y respuestas en [01-CONTRATOS-API.md](../01-CONTRATOS-API.md).

## Tareas

1. Trabajar en app-taxi/app-taxi. Revisar las instrucciones del repositorio, package.json y lockfile antes de cambiar dependencias. Mantener el SDK instalado salvo incompatibilidad demostrada.
2. Configurar Expo Router en el proyecto existente; decidir la entrada según la documentación oficial y conservar las inicializaciones necesarias de index.ts. Instalar paquetes compatibles con el SDK mediante expo install y comprobar expo-doctor.
3. Crear rutas públicas, de cuenta y operativas según 02-ARQUITECTURA.md. La pantalla inicial debe esperar a que termine la restauración de sesión, sin mostrar brevemente una pantalla privada.
4. Implementar tokens y componentes nativos reutilizables: Screen, Button, TextField, StateBadge, Card, ErrorBanner, ConfirmDialog y LoadingState. Usar azul #111e2f y amarillo #f6c343 del prototipo TaxiSur.
5. Centralizar EXPO_PUBLIC_API_URL, fetch con timeout/cancelación y errores tipados; preparar QueryClient y claves de caché separadas por conductor. No reintentar automáticamente mutaciones operativas.
6. Crear .env.example con EXPO_PUBLIC_API_URL apuntando a la URL configurada para el backend real del sistema, sin credenciales. La app siempre consume esa API; no incluir mocks, fixtures ni adaptadores con datos falsos.

## Archivos propuestos

- `src/app/_layout.tsx`
- `src/app/index.tsx`
- `src/ui/*`
- `src/theme/tokens.ts`
- `src/lib/api-client.ts`
- `src/lib/query-client.ts`
- `src/config/runtime.ts`
- `.env.example`

Las rutas son una propuesta de organización; adaptar si el repositorio ya tiene convenciones.

## Criterios de aceptación

- [ ] La app arranca en Android y navega entre bienvenida y login sin errores de TypeScript.
- [ ] Los componentes respetan área segura, teclado, texto ampliado y objetivos táctiles de al menos 48 dp como decisión de diseño.
- [ ] El paquete no contiene credenciales del backend, token de n8n ni clave service_role.
- [ ] EXPO_PUBLIC_API_URL apunta al backend real del sistema accesible desde el dispositivo; todas las pantallas consultan y mutan datos por esa API.

## Decisiones y límites

Stack propuesto: Expo Router, TanStack Query, expo-secure-store y expo-location. Usar StyleSheet y tokens al inicio; NativeWind es opcional. El proyecto inspeccionado declara Expo ~57.0.25, React 19.2.3 y React Native 0.86.3: son versiones observadas, no una garantía de compatibilidad. Revisar también @types/react-native antiguo. Ver referencias oficiales en 07-FUENTES.md.

## Prompt para comenzar

> Implementa únicamente M00 — Base Expo, navegación y sistema visual en la app TaxiSur existente. Lee este archivo, 01-CONTRATOS-API.md y 02-ARQUITECTURA.md; comprueba que sus dependencias estén listas. Usa las referencias HTML solo como diseño, conserva las reglas de negocio del backend y no inventes endpoints. Implementa las tareas, verifica los criterios aplicables y entrega un resumen de archivos modificados, pruebas ejecutadas y pendientes. No avances automáticamente al módulo siguiente ni publiques la app.
