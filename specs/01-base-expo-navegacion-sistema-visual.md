# SPEC 01 — Base Expo, navegación y sistema visual

> **Estado:** Approved
> **Depende de:** Ninguna
> **Fecha:** 2026-10-10
> **Objetivo:** Preparar el proyecto Expo existente con Expo Router, rutas, tokens y componentes UI nativos, cliente HTTP y configuración de entorno, sin reproducir la lógica simulada de los HTML.

## Por qué existe esta spec

El repositorio solo contiene la plantilla por defecto de Expo (`App.tsx`, `index.ts`) y no hay carpeta `src/`. Todas las pantallas del plan (M01–M09) necesitan una base común: enrutado, sistema visual y acceso a la API. M00 entrega esa base y nada más.

Origen de los requisitos: `docs/implementacion-app/modulos/M00-BASE-EXPO.md`, `docs/implementacion-app/01-CONTRATOS-API.md` y `docs/implementacion-app/02-ARQUITECTURA.md`. Los HTML de `docs/implementacion-app/referencias-ui/` se usan solo como referencia visual.

## Alcance

**Incluido:**

- Configurar Expo Router sobre el proyecto existente con `src/app/` como directorio de rutas y entrada `expo-router/entry`.
- Rutas públicas, de cuenta, operativas y `sin-conexion` según `02-ARQUITECTURA.md`; `index.tsx` con bienvenida real y el resto como stubs/placeholders navegables.
- Gate de restauración de sesión: `SessionProvider` esqueleto con estado `restaurando` para que la pantalla inicial no muestre nada privado antes de terminar.
- Tokens y componentes nativos reutilizables: `Screen`, `Button`, `TextField`, `StateBadge`, `Card`, `ErrorBanner`, `ConfirmDialog`, `LoadingState`.
- `src/lib/api-client.ts` (URL configurable, `Bearer`, timeout/cancelación, errores tipados) y `src/lib/api-errors.ts`.
- `src/lib/query-client.ts` con `QueryClient` y claves de caché por conductor; mutaciones sin reintento automático.
- `src/config/runtime.ts` que centraliza `EXPO_PUBLIC_API_URL` (la app siempre consume la API real).
- `.env.example` versionado con `EXPO_PUBLIC_API_URL` (placeholder, sin credenciales).
- Verificación con `tsc --noEmit`, `expo lint` y `expo-doctor`.

**Fuera de alcance (módulos siguientes):**

- Mocks, fixtures y adaptadores con datos falsos: la app siempre consume la API real.
- Login, identidad, JWT y `SecureStore` → M01.
- Registro y estados de cuenta → M02.
- Jornada y disponibilidad → M03.
- Permisos y envío de ubicación → M04.
- SSE y recuperación operativa → M05.
- Ofertas y servicio → M06/M07.
- Perfil y salida → M08.
- Mensajería de conectividad, accesibilidad y limpieza final → M09/M10.
- Suite de pruebas automatizadas (jest-expo) y pruebas manuales en dispositivo → M09/M10.

## Modelo de datos

No se introducen DTOs del backend en M00. Se introducen estructuras propias de base:

```ts
// src/theme/tokens.ts
export const colors = {
  navy: '#111e2f', navy2: '#203146', yellow: '#f6c343',
  ink: '#172538', muted: '#627187', line: '#e1e7ef', bg: '#f5f7fa',
  green: '#168160', blue: '#2864b9', amber: '#865c08', red: '#bb4350',
} as const;
export const radius = 20;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const minTouchTarget = 48;
```

```ts
// src/config/runtime.ts
export type RuntimeConfig = {
  apiUrl: string | null;   // EXPO_PUBLIC_API_URL; null si no está definida
};
```

```ts
// src/lib/api-errors.ts
export type ApiErrorCode =
  | 'RED' | 'TIMEOUT' | 'SIN_CONFIGURACION'
  | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND'
  | 'CONFLICT' | 'SERVER' | 'BAD_REQUEST' | 'DESCONOCIDO';
export type ApiError = { code: ApiErrorCode; status?: number; backendCode?: string; message: string };
```

```ts
// src/lib/query-client.ts (claves de caché)
export const queryKeys = {
  conductor: (id: string) => ['conductor', id] as const,
  solicitudActiva: (conductorId: string) => ['solicitudActiva', conductorId] as const,
  solicitud: (id: string) => ['solicitud', id] as const,
  configuracion: () => ['configuracion'] as const,
};
```

Convenciones: `Jornada`/`Disponibilidad`/`estadoCuenta` se añaden en M01–M03; M00 solo declara el estado de sesión (`restaurando` | `autenticado` | `no_autenticado`) como esqueleto. `conductorId` y los UUID vienen del backend (JWT y respuestas); no se inventan identificadores.

## Plan de implementación

1. **Dependencias.** `npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants @tanstack/react-query`; fijar `"main": "expo-router/entry"` en `package.json`; retirar `App.tsx`/`index.ts` de plantilla conservando las inicializaciones necesarias. Verificación: `npx expo start` levanta sin error de entrada.
2. **Layout raíz.** Crear `src/app/_layout.tsx` con `Stack`, `SafeAreaProvider`, `QueryClientProvider` y `SessionProvider`. Verificación: `expo start` renderiza un layout sin errores.
3. **Gate de arranque.** Crear `src/features/auth/session-context.tsx` (estado `restaurando`, restauración stub) y `src/app/index.tsx` (bienvenida real; espera el gate; botón que navega a `/login`). Verificación: no aparece contenido privado antes de terminar el gate.
4. **Rutas placeholder.** Crear `src/app/(auth)/login.tsx`, `(cuenta)/revision.tsx|rechazada.tsx|suspendida.tsx`, `(operacion)/inicio.tsx|ubicacion.tsx|ubicacion-desactualizada.tsx|solicitud-entrante.tsx|solicitud-expirada.tsx|en-servicio.tsx|servicio-finalizado.tsx|perfil.tsx` y `sin-conexion.tsx` como stubs con `Screen` + `LoadingState`/texto. Verificación: navegación directa a cada ruta no rompe.
5. **Tokens y UI.** Crear `src/theme/tokens.ts` y `src/ui/` con los ocho componentes, respetando safe area, `KeyboardAvoidingView`, escalado de texto y objetivos táctiles ≥48 dp. Verificación: `tsc` sin errores.
6. **Cliente HTTP y caché.** Crear `src/lib/api-errors.ts`, `src/lib/api-client.ts` (timeout/`AbortController`, `Bearer`, parseo de `{error:{code,message}}`) y `src/lib/query-client.ts` (lecturas con reintento limitado; mutaciones sin reintento). Verificación: `tsc` sin errores.
7. **Configuración de entorno.** Crear `src/config/runtime.ts` (lee `EXPO_PUBLIC_API_URL`), `.env.example` (`EXPO_PUBLIC_API_URL=`, sin credenciales) y `.env` local. `api-client` lanza `SIN_CONFIGURACION` si la URL no está definida. Verificación: sin URL la app no dispara peticiones y el error es explícito.
8. **Verificación final.** Ejecutar `npx tsc --noEmit`, `npx expo lint` y `npx expo-doctor`; revisar que no haya `service_role`, `JWT_SECRET`, token n8n ni mocks/fixtures en el código entregable. No compilar ni publicar.

## Criterios de aceptación

- [x] `npx tsc --noEmit` termina sin errores.
- [x] `npx expo lint` y `npx expo-doctor` terminan sin errores de bloqueo.
- [ ] `npx expo start` permite navegar de bienvenida a login sin errores y sin mostrar pantalla privada antes del gate.
- [ ] Los componentes respetan área segura, teclado, texto ampliado y objetivos táctiles de al menos 48 dp como decisión de diseño.
- [ ] `EXPO_PUBLIC_API_URL` apunta al backend real del sistema accesible desde el dispositivo; todas las pantallas consultarán y mutarán datos por esa API. El entorno de pruebas es explícito y no hay mocks, fixtures ni adaptadores con datos falsos.
- [x] El paquete no contiene credenciales del backend, `JWT_SECRET`, token de n8n ni clave `service_role`.
- [x] El `QueryClient` define claves separadas por conductor y no reintenta mutaciones operativas.
- [x] Ninguna pantalla usa un WebView con el HTML de referencia.

## Decisiones tomadas y descartadas

- **Sí:** Expo Router con rutas en `src/app/`. Es el estándar del repo (`AGENTS.md`) y de `02-ARQUITECTURA.md`.
- **Sí:** bienvenida real; login y demás pantallas como stubs/placeholders. M00 entrega navegación, no lógica de módulos posteriores.
- **Sí:** `SessionProvider` esqueleto con estado `restaurando`, sin `SecureStore`. La restauración real es M01.
- **Sí:** `StyleSheet` + tokens; se descarta NativeWind en M00.
- **No:** mocks, fixtures ni adaptadores con datos falsos. La app siempre consume la API real desde `EXPO_PUBLIC_API_URL`.
- **Sí:** URL desde `EXPO_PUBLIC_API_URL` con error claro (`SIN_CONFIGURACION`) si falta; el valor real se configura en `.env` local (no versionado).
- **Sí:** verificación de M00 con `tsc`, `expo lint` y `expo-doctor`; se descarta añadir jest-expo ahora.
- **No:** implementar login/JWT/SSE/GPS ahora. Van en sus módulos.
- **No:** jest-expo/RNTL en M00; se añade en M09/M10.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Versiones incompatibles con SDK 57 (`expo install` puede resolver otra) | Instalar siempre con `expo install` y validar con `expo-doctor`. |
| `@types/react-native` ^0.72.8 desactualizado en `devDependencies` | Evaluar su retirada/alineación durante el paso 1; `tsc` es la verificación. |
| Dependencia de `main: expo-router/entry` rompe el arranque | Confirmar con la doc oficial de Expo Router del SDK instalado antes de cambiar la entrada. |
| `localhost` no resuelve en teléfono físico ni desde el emulador Android sin ajuste | Emulador Android usa `10.0.2.2`; dispositivo físico usa la IP LAN del PC; documentarlo en `.env.example`. |

## Lo que **no** está en esta spec

- Login, identidad y sesión segura (M01).
- Registro y estados de cuenta (M02).
- Jornada, disponibilidad, ubicación, SSE, ofertas, servicio, perfil (M03–M08).
- Conectividad global, accesibilidad y pruebas en dispositivo (M09–M10).
- Push, background, mapas, pagos.

Cada uno, si procede, va en su propia spec.

## Evidencia de verificación

**Fecha:** 2026-10-12 · **Rama:** `spec-01-base-expo-navegacion-sistema-visual` (cambios locales sin commitear) · **App:** 1.0.0 · **Expo:** SDK 57 (`expo@57.0.28`, `expo-router@57.0.26`).

**Fuentes consultadas:** spec completo; `AGENTS.md`; `package.json`; `git status`/`git diff` (todo el M00 staged, sin commitear); documentación oficial Expo vía Context7 (`/websites/expo_dev_versions`): `expo-system-ui` (`setBackgroundColorAsync` cambia el color de fondo de la vista raíz; se recomienda en el archivo raíz), `expo-navigation-bar` config plugin (`style`, `enforceContrast`), plugin `expo-system-ui` en `app.json` para `backgroundColor`. Context7 confirmó las APIs usadas en la corrección visual previa.

**Corrección aplicada durante esta verificación:** se retiró el import sin uso de `StatusBar` en `src/app/index.tsx` (warning `@typescript-eslint/no-unused-vars`); `expo lint` queda en 0 problemas. No se alteró comportamiento ni alcance.

**Comandos ejecutados (2026-10-12):**

| Comando | Resultado |
| --- | --- |
| `npx tsc --noEmit` | exit 0, sin errores |
| `npx expo lint` | exit 0, 0 errores, 0 warnings |
| `npx expo-doctor` | 21/21 checks passed |
| `rg` criptográficos/mocks en `src/`, `app.json`, `.env.example` | sin coincidencias de credenciales ni mocks/fixtures |

| Criterio | Resultado | Plataforma | Evidencia | Pendiente o bloqueo |
| --- | --- | --- | --- | --- |
| `npx tsc --noEmit` sin errores | Verificado | Node (tooling) | Ejecutado 2026-10-12, exit 0 | — |
| `expo lint` y `expo-doctor` sin errores de bloqueo | Verificado | Node (tooling) | `expo lint` exit 0 (0 problemas tras retirar import sin uso en `src/app/index.tsx`); `expo-doctor` 21/21 | — |
| `expo start` navega bienvenida→login sin error y sin pantalla privada antes del gate | Bloqueado | Android/iOS (runtime) | Estático: `src/app/index.tsx` muestra `LoadingState` mientras `status==='restaurando'` y solo renderiza bienvenida en `no_autenticado`; `src/app/(auth)/login.tsx` existe; `_layout.tsx` monta `SessionProvider`. No se ejecutó `expo start` ni dispositivo/emulador; sin capturas | Ejecutar `npx expo start`, abrir en emulador/dispositivo, navegar bienvenida→login y verificar el gate en runtime; aportar captura o registro |
| Componentes respetan área segura, teclado, texto ampliado y táctiles ≥48 dp | Bloqueado | Android/iOS (runtime) | Estático: `Screen` usa `SafeAreaView` + `KeyboardAvoidingView`; `Button`/`TextField` con `minHeight: minTouchTarget` (48); botones bienvenida `minHeight: 54`. Sin prueba con fuente ampliada ni en dispositivo | Probar en dispositivo con tamaño de texto grande y teclado abierto; verificar targets y layout en runtime; aportar captura |
| `EXPO_PUBLIC_API_URL` apunta al backend real accesible; sin mocks/fixtures | Bloqueado | Android/iOS (runtime) | Estático: `src/config/runtime.ts` lee `EXPO_PUBLIC_API_URL`; `.env.example` documenta placeholder sin credenciales; `api-client.ts` lanza `SIN_CONFIGURACION` si falta; sin mocks/fixtures/adaptadores en `src/` (rg). `.env` local (`http://localhost:3001`, no versionado) no es accesible desde emulador Android (10.0.2.2) ni dispositivo físico (IP LAN) sin ajuste | Ajustar `.env` al host correspondiente, levantar backend y verificar desde el dispositivo que la API responde; confirmar que ninguna pantalla consume datos falsos |
| Paquete sin credenciales, `JWT_SECRET`, token n8n ni `service_role` | Verificado | — | `rg` sobre `src/`, `app.json`, `.env.example` sin coincidencias (solo prosa en `docs/`); `.env` está en `.gitignore` y no está staged | — |
| `QueryClient` con claves por conductor y sin reintento de mutaciones | Verificado | — | `src/lib/query-client.ts`: `queryKeys.conductor(id)`/`solicitudActiva(conductorId)`; `mutations.retry: 0` | — |
| Ninguna pantalla usa WebView con el HTML de referencia | Verificado | — | `rg` sin `WebView` ni `react-native-webview` en `src/` ni en `package.json` | — |
