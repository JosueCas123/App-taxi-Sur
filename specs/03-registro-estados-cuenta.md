# SPEC 03 — Registro y estados de cuenta

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-10-13
> **Objetivo:** Registrar conductores contra la API real sin crear una sesión implícita y restringir el acceso operativo según el estado de cuenta confirmado.

## Por qué existe esta spec

M01 implementó login, restauración segura, consulta del perfil y navegación inicial por estado. Faltan el registro público, las pantallas de cuenta funcionales y la protección de rutas por estado de aprobación.

Fuentes de requisitos:

- `docs/implementacion-app/modulos/M02-REGISTRO-Y-CUENTA.md`.
- `docs/implementacion-app/01-CONTRATOS-API.md`.
- `docs/implementacion-app/02-ARQUITECTURA.md`.
- Referencias visuales `registro.html`, `cuenta-en-revision.html`, `cuenta-rechazada.html` y `cuenta-suspendida.html` en `docs/implementacion-app/referencias-ui/`.

Los HTML no son contratos ni pruebas de integración. Sus validaciones y simulaciones no se trasladan a la app.

### Dependencias comprobadas

- SPEC 01 existe y aporta rutas, UI, cliente HTTP y TanStack Query.
- SPEC 02 existe con estado `Implementado`. Su evidencia documenta 63 pruebas aprobadas y verificaciones de TypeScript, lint y expo-doctor. Esa evidencia es previa, no una ejecución nueva de esta spec.
- M01 dispone de `obtenerConductor`, sesión segura, caché de perfil y limpieza ante invalidación.
- El guard privado actual comprueba autenticación, pero no bloquea rutas operativas por aprobación.
- Las pantallas de cuenta y de servicio son placeholders. No existen registro, transporte SSE ni recuperación de solicitud activa.
- La validación de M01 contra backend real y dispositivo sigue pendiente.

M02 tiene requisitos cruzados con módulos posteriores: SSE corresponde a M05 y la finalización real corresponde a M07. Por decisión del usuario se prepara la integración, sin adelantar esos módulos. Los criterios integrados permanecen pendientes y no se declarará M02 totalmente cerrado por aprobar únicamente pruebas de política.

## Alcance

**Incluido:**

- Formulario público por secciones: datos personales, PIN y confirmación, vehículo.
- `POST /api/conductores` con los nombres, límites y cuerpo estricto del contrato.
- Confirmación de PIN exclusivamente local, errores por campo y bloqueo de doble envío.
- Conservación de campos no sensibles ante errores mientras el formulario permanezca abierto. Sin borrador persistente ni conservación al abandonar la pantalla.
- Limpieza del PIN y su confirmación tras un intento de envío y al abandonar el registro. No guardar estos valores en logs, almacenamiento o cachés de datos remotos.
- Alta exitosa seguida de retorno al login con teléfono prellenado y PIN vacío. La respuesta de registro nunca autentica al conductor.
- Ante timeout del registro, mostrar: “No pudimos confirmar si tu cuenta se creó. Puedes intentar ingresar con el teléfono y PIN que elegiste”. Ofrecer “Intentar ingresar” hacia el login con el teléfono enviado precargado y el PIN vacío. No reenviar el alta ni intentar autenticar automáticamente.
- Si ese ingreso falla, conservar el error correspondiente de M01 y permitir volver al registro mediante su entrada existente. La persona decide si completa y envía un nuevo registro; un fallo de login no demuestra que el alta anterior no ocurrió. No restaurar el borrador abandonado ni el PIN.
- Ante HTTP 409 del registro, incluido un nuevo intento después de un timeout, mostrar un aviso general: “No se pudo completar el registro por un conflicto con los datos enviados. Si ya tienes una cuenta, puedes intentar ingresar”. Ofrecer “Intentar ingresar” con el teléfono enviado precargado y el PIN vacío. Detectar el conflicto por el estado HTTP tipado, sin interpretar `message`, atribuirlo a un campo ni afirmar que el teléfono está registrado. No reenviar ni autenticar automáticamente.
- Habilitar las entradas a registro desde bienvenida y login.
- Pantallas reales para cuenta pendiente, rechazada y suspendida, con datos del perfil confirmado y actualización manual.
- Cuenta aprobada redirigida al inicio existente, sin implementar jornada ni disponibilidad.
- Actualización del perfil al volver a primer plano, con limpieza de suscripciones y control de peticiones concurrentes.
- Guards centralizados de estado para accesos directos y navegación normal.
- Política pura que preserve el acceso al servicio cuando una futura recuperación de API confirme un servicio en curso del conductor actual. Las cuentas restringidas no podrán iniciar operaciones nuevas.
- Punto de actualización reutilizable por M05 ante eventos SSE. M02 no abre una conexión SSE ni simula eventos en producción.
- Ayuda únicamente con el contacto público ya configurado y salida local mediante `invalidarSesion` de M01.
- Pruebas automatizadas de registro, actualización y restricciones, además de regresión de M01.

**Fuera de alcance:**

- Transporte SSE, reconexión y consulta/reconciliación de solicitud activa de M05.
- Mutación y flujo real de finalizar servicio de M07.
- Jornada, disponibilidad, GPS, ofertas y perfil completo de módulos posteriores.
- Persistencia de borradores de registro.
- Edición de vehículo, autoaprobación o motivos de rechazo/suspensión inventados.
- Cambios de backend, endpoints nuevos, refresh token o logout remoto.
- Cuentas reales de prueba, pruebas contra producción, compilación, publicación o avance automático a otro módulo.
- Mocks o datos ficticios dentro de la app entregable. Se permiten dobles y datos sintéticos únicamente en pruebas automatizadas, como en M01.

## Modelo de datos

Se reutilizan `ConductorDetalleDto`, `obtenerConductor` y `queryKeys.conductor(conductorId)` de M01. No se crea una segunda fuente de verdad para el perfil.

```ts
// src/features/account/registration-schema.ts
type RegistroConductorInput = {
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

type CamposRegistro = Omit<RegistroConductorInput, 'vehiculo'> & {
  confirmacionPin: string;
  placa: string;
  marca: string;
  modelo: string;
  color: string;
  capacidadPasajeros: string;
};

type ErroresRegistro = Partial<Record<keyof CamposRegistro, string>>;
```

La capacidad permanece como texto durante la edición. La validación rechaza vacío, decimales y valores fuera de rango antes de construir un entero para el cuerpo de API. No se usa una conversión que acepte parcialmente entradas inválidas.

| Campo | Regla del contrato |
|---|---|
| `telefono` | Texto recortado de 1–30 caracteres; sin imponer un patrón telefónico adicional |
| `nombreCompleto` | Texto recortado de 1–100 caracteres |
| `cedulaIdentidad` | Texto recortado de 1–50 caracteres |
| `placa`, `marca`, `modelo`, `color` | Cada texto recortado de 1–30 caracteres |
| `pin` | Cadena que cumple `^\d{4,6}$`; conserva ceros iniciales |
| `confirmacionPin` | Igual al PIN; exclusivamente local |
| `capacidadPasajeros` | Entero entre 1 y 100, ambos incluidos |

`validarRegistro` devuelve errores por campo o un `RegistroConductorInput` construido explícitamente. No se envía el formulario mediante propagación de propiedades: el cuerpo excluye confirmación y cualquier dato auxiliar.

```ts
// src/features/account/api.ts
registrarConductor(datos: RegistroConductorInput): Promise<ConductorDetalleDto>;
// POST /api/conductores público; respuesta directa, sin JWT.

// src/navigation/resolve-route.ts
type ServicioConfirmado = {
  id: string;
  conductorAsignadoId: string;
  estado: 'en_servicio';
};
type AccesoOperativo = 'permitido' | 'bloqueado_por_estado' | 'solo_finalizar';
```

`ServicioConfirmado` es una entrada mínima de la política, no un DTO completo nuevo ni un estado persistido. M05 deberá producirla a partir de una respuesta real, vigente y perteneciente al conductor y generación de sesión actuales. No se acepta como prueba un parámetro de ruta, un booleano del formulario ni únicamente `estadoDisponibilidad` del perfil.

La ausencia de esa integración en M02 significa que el servicio no está confirmado; no significa que la API haya confirmado su ausencia. M02 no fabrica un servicio ni ofrece un botón de finalización inoperante.

### Política centralizada

- Servicio confirmado del conductor actual: priorizar `en-servicio`. Si la cuenta está restringida, permitir solo la continuidad/finalización y bloquear nuevas operaciones.
- Sin servicio confirmado: pendiente, rechazado y suspendido permanecen en su pantalla de cuenta.
- Aprobado sin servicio confirmado: acceso al inicio existente, sujeto a los guards de sesión.
- Identidad inconsistente o estado no verificado: no habilitar operación; ofrecer recuperación.

La rama de servicio se prueba con entradas sintéticas en tests. Su conexión a navegación y acciones reales queda pendiente de M05/M07.

## Archivos previstos

**Crear:**

- `src/features/account/api.ts`.
- `src/features/account/registration-schema.ts`.
- `src/features/account/screens/registro.tsx`.
- `src/features/account/screens/estado-cuenta.tsx`.
- `src/features/account/use-refresco-perfil.ts`.
- `src/features/account/__tests__/` para validación, API, pantallas y ciclo de vida.
- `src/app/(auth)/registro.tsx` como entrada de ruta.

**Modificar:**

- `src/app/(auth)/login.tsx` y `src/app/index.tsx` para acceso al registro y retorno al login.
- `src/app/(cuenta)/revision.tsx`, `rechazada.tsx` y `suspendida.tsx` para renderizar estados reales.
- `src/app/(cuenta)/_layout.tsx` y `src/app/(operacion)/_layout.tsx` para montar la política de acceso.
- `src/navigation/resolve-route.ts` y `src/navigation/guard-sesion.tsx` para centralizar decisiones sin redirecciones competidoras.
- `src/features/auth/session-context.tsx` para exponer actualización explícita del perfil con las garantías de sesión existentes.
- Pruebas de M01 afectadas por guards, login y actualización del perfil.

Las vistas compartidas permanecen fuera de `src/app/`. No se duplican DTOs, cliente HTTP ni almacenamiento de sesión.

## Plan de implementación

1. **Confirmar base y contratos.** Revisar el estado del repositorio y ejecutar la suite existente como línea base. Contrastar el contrato con el backend si su código está disponible; documentar cualquier imposibilidad sin inventar reglas. Consultar documentación del SDK Expo 57 instalado y Context7 antes de tocar APIs de Expo/React Native. Mantener dependencias salvo necesidad demostrada.
2. **Validación pura.** Crear tipos y validación del formulario con pruebas de límites, recorte, confirmación, PIN con ceros iniciales y capacidad. El resultado válido construye únicamente el cuerpo autorizado.
3. **Registro público.** Añadir `registrarConductor` mediante el cliente HTTP existente, sin Bearer ni reintentos automáticos. Probar la ruta, cuerpo y respuesta sin JWT. No almacenar el PIN como variable de una mutación retenida en caché.
4. **Formulario nativo.** Crear la vista y ruta de registro con secciones, errores por campo, ocultación del PIN, estado de envío y bloqueo síncrono del doble envío. Conservar datos no sensibles en errores y limpiar valores sensibles. Añadir pruebas de interacción junto con la pantalla.
   Incluir el manejo de HTTP 409 con aviso general y la misma acción “Intentar ingresar” del flujo de timeout. Probar un nuevo intento que devuelve 409 después de un timeout, así como respuestas 409 con distintos mensajes, sin asignar errores a campos a partir de esos textos.
5. **Retorno al acceso.** Conectar bienvenida y login al registro. Tras el alta reemplazar la ruta por login con solo el teléfono recortado como dato de prellenado. Ante timeout, mostrar el aviso de resultado incierto y ofrecer “Intentar ingresar” con el teléfono de la petición enviada, sin navegación ni autenticación automáticas. Asegurar PIN vacío incluso si la navegación reutiliza una pantalla de login existente. No invocar `iniciarSesion` ni guardar un token desde el registro. Probar que, si el login falla, se puede volver al formulario y decidir un nuevo envío manual sin recuperar el borrador anterior.
6. **Actualización de perfil.** Exponer una actualización explícita en sesión que reutilice `obtenerConductor` y la caché existente. Forzar lectura vigente, agrupar solicitudes simultáneas y descartar resultados de otra sesión. Mantener la semántica de M01 para 401, 403/404 y errores de red. Probar concurrencia, errores y limpieza.
7. **Ciclo de vida.** Incorporar `use-refresco-perfil` con actualización manual y al regresar a primer plano. Montarlo una sola vez en el ámbito autenticado correspondiente, no en cada pantalla simultáneamente. Limpiar suscripciones y cancelar peticiones propias al desmontar o invalidar sesión. No usar polling. Dejar la actualización explícita disponible para la futura integración SSE, sin crear un bus simulado.
8. **Estados de cuenta.** Sustituir placeholders con una vista compartida que represente el perfil confirmado. Mostrar actualización, errores recuperables, ayuda configurada y salida local. Redirigir al cambiar de estado sin mostrar una cuenta aprobada por defecto ni inventar motivos.
9. **Restricciones de navegación.** Ampliar la política pura y los guards para impedir que deep links o rutas restauradas eludan el estado de cuenta. Bloquear el render de contenido operativo antes de redirigir. Probar estados restringidos y la futura excepción de servicio confirmado, incluida identidad incorrecta. No exponer acciones ficticias de M07.
10. **Registrar evidencia de entrega.** Actualizar los criterios con resultados observados, archivos modificados y pendientes de integración. Mantener sin marcar los criterios que requieren M05/M07, API real o dispositivo. No cambiar automáticamente de módulo ni publicar.

Cada incremento incluye sus pruebas aplicables y debe dejar el proyecto ejecutable. La verificación final incluye regresión de M01 y los comandos indicados abajo.

## Criterios de aceptación

### Verificables en esta entrega

- [x] La entrada a registro funciona desde bienvenida y login y respeta el guard público existente.
- [x] El formulario aplica exactamente los límites del contrato, recorta textos y preserva ceros iniciales del PIN.
- [x] La capacidad admite los límites 1 y 100 y rechaza vacío, decimales y valores fuera de rango.
- [x] El cuerpo de registro contiene únicamente los campos del contrato; no contiene confirmación ni Bearer.
- [x] Un doble toque produce una sola petición y no hay reintento automático del alta.
- [x] Ante errores se conservan los campos no sensibles mientras el formulario sigue abierto; PIN y confirmación se limpian tras el intento de envío.
- [x] Un timeout muestra el aviso de resultado incierto y la acción “Intentar ingresar”; no se reenvía el registro ni se autentica automáticamente.
- [x] “Intentar ingresar” abre el login con el teléfono de la petición enviada precargado y el PIN vacío, incluso si el login ya estaba montado.
- [x] Si el ingreso posterior falla, se muestra el error de M01 y se permite volver al registro para decidir un nuevo envío manual. No se afirma que la cuenta no existe ni se restaura el borrador abandonado.
- [x] Un HTTP 409 al registrar, también tras un timeout y nuevo envío manual, muestra un aviso general y permite abrir el login con el teléfono enviado precargado y el PIN vacío. No reenvía ni autentica automáticamente.
- [x] El manejo de 409 depende del estado HTTP tipado y funciona con distintos valores de `message`, sin adivinar el campo duplicado ni afirmar que el conflicto corresponde al teléfono.
- [x] Una respuesta exitosa conduce al login con teléfono prellenado y PIN vacío, sin establecer sesión ni persistir el perfil de registro como autenticado.
- [x] La app representa pendiente, rechazado y suspendido desde el perfil real; aprobado conduce al inicio existente.
- [x] La actualización manual y el regreso a primer plano solicitan un perfil vigente y actualizan la navegación.
- [x] No se duplican listeners, no hay intervalos de consulta y las peticiones propias se cancelan al desmontar o invalidar sesión.
- [x] Las respuestas tardías de otra sesión no reemplazan el perfil actual.
- [x] Los errores de autenticación y de red conservan las garantías de M01, sin abrir operación con perfil no verificado.
- [x] Pendiente, rechazado y suspendido sin servicio confirmado no renderizan rutas operativas mediante acceso directo.
- [x] Las pruebas de política preservan únicamente la continuidad del servicio para una cuenta restringida con servicio confirmado del conductor actual; una identidad diferente no habilita la excepción.
- [x] No aparecen acciones para autoaprobarse, editar vehículo o finalizar un servicio inexistente o no integrado.
- [x] No se inventan motivos de rechazo/suspensión ni teléfonos de soporte.
- [x] Las pruebas automatizadas nuevas y la regresión de M01 terminan en verde.
- [x] TypeScript, lint y expo-doctor terminan sin errores de bloqueo.
- [x] No hay PIN en logs, almacenamiento, parámetros de navegación ni caché de datos remotos; no se incorporan secretos del backend.

### Pendientes de integración, no acreditables en M02 aislado

Estos criterios son obligatorios para el cierre integrado. Posponer su ejecución no los convierte en opcionales ni permite sustituirlos por pruebas con datos sintéticos. La comprobación contra API real requiere autorización posterior del entorno y de los datos de prueba; no se ejecuta en esta entrega.

- [ ] M05 conecta los eventos SSE `conectado` y `actualizado` a la recuperación de perfil y solicitud activa, sin inferir aprobación del mensaje SSE.
- [ ] M05 confirma el servicio en curso por API, reconcilia tras reconexión y alimenta la política con identidad y generación de sesión vigentes.
- [ ] M05/M07 verifican que una suspensión durante un servicio muestra el aviso, conserva una acción funcional de finalizar y no habilita otro servicio.
- [ ] Contra un backend real autorizado, `POST /api/conductores` crea una cuenta y devuelve el perfil sin JWT; la app vuelve al login sin sesión, el ingreso explícito obtiene un JWT y `GET /api/conductores/:id` confirma el perfil y su estado real. Registrar entorno, fecha y resultado sin PIN ni token como evidencia obligatoria de integración.
- [ ] En dispositivo se comprueban navegación, teclado, área segura, texto ampliado y objetivos táctiles de al menos 48 dp.

### Comandos de verificación

- `npx jest src/features/account --runInBand`.
- `npx jest src/features/auth --runInBand`.
- `npx jest --runInBand`.
- `npx tsc --noEmit`.
- `npx expo lint`.
- `npx expo-doctor`.
- `git diff --check`.

Las pruebas automatizadas con servidor simulado no certifican integración real ni equivalencia visual en dispositivo. Los comandos se ejecutaron el 2026-10-14; los resultados se registran en “Evidencia de verificación”.

## Decisiones tomadas y descartadas

- **Sí:** preparar integración con M05/M07 sin implementarlos. Decisión confirmada por el usuario; evita ampliar automáticamente M02.
- **Sí:** mantener los campos no sensibles solo en el formulario abierto. Decisión confirmada por el usuario; no introduce persistencia de datos personales.
- **Sí:** pruebas automatizadas por ahora. Decisión confirmada por el usuario; no se crearán cuentas reales ni se afirmará validación de dispositivo.
- **Sí:** la prueba de alta y login contra API real permanece obligatoria para el cierre integrado, aunque su ejecución quede pendiente. Los dobles de prueba solo acreditan la lógica de la app.
- **Sí:** recuperación de timeout mediante “Intentar ingresar”, con teléfono precargado y PIN vacío. Un nuevo registro exige una decisión y envío manual de la persona; nunca se deduce su necesidad únicamente de un fallo de login.
- **Sí:** contrato del backend como autoridad, incluso cuando los límites del HTML difieran.
- **Sí:** validación de confirmación mediante comparación local, sin un booleano adicional que pueda contradecir el contenido del PIN.
- **Sí:** reutilizar perfil y consulta de M01 en vez de duplicarlos en otro store o DTO.
- **Sí:** política de servicio basada en evidencia identificada de API; no un `servicioEnCurso = false` que confunda desconocido con ausencia confirmada.
- **Sí:** salida local mínima con la función ya existente, sin adelantar el módulo completo de perfil ni inventar logout remoto.
- **Sí:** errores por campo para validaciones locales; errores de servidor por campo solo cuando el contrato proporcione una asociación verificable. No analizar mensajes libres para adivinar campos.
- **Sí:** HTTP 409 se presenta como conflicto general con acceso voluntario al login. Esto cubre un alta previa cuya respuesta se perdió sin asumir qué dato provocó el conflicto.
- **No:** botón de finalizar que solo conduzca a un placeholder y se presente como funcionalidad terminada.
- **No:** SSE simulado, autoaprobación, edición de vehículo, motivos inventados ni restricciones telefónicas adicionales.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| M02 parece terminado aunque falten SSE y finalización | Separar aceptación local e integrada; no marcar los criterios cruzados sin evidencia de M05/M07. |
| Registro ejecutado en servidor cuya respuesta se pierde | Explicar resultado incierto y ofrecer “Intentar ingresar” con teléfono precargado y PIN vacío. Si falla, permitir volver al registro sin reenviar automáticamente ni concluir que el alta no ocurrió. No inventar un endpoint público de búsqueda. |
| Refresco de perfil devuelve datos de una sesión anterior | Reutilizar generación de sesión, cancelación y protección de respuestas tardías de M01. |
| Perfil antiguo habilita operación tras un fallo de actualización | Estado de recuperación explícito y bloqueo de nuevas operaciones hasta confirmar el perfil. |
| Duplicación de consultas por varios montajes o foreground | Un único propietario de actualización y agrupación de solicitudes concurrentes. |
| Contexto actual observa una query deshabilitada | La integración debe hacer lectura explícita; invalidar la caché por sí solo no garantiza recuperar el perfil. |
| Teléfono de prellenado forma parte del estado de navegación | Transferir solo el teléfono necesario, nunca PIN, y no registrar parámetros ni persistir un borrador adicional. |

## Lo que **no** está en esta spec

- Implementar M03, M04, M05, M06, M07 o M08 completos.
- Abrir SSE o finalizar servicios reales antes de sus integraciones.
- Modificar reglas del backend o inventar endpoints.
- Crear cuentas reales de prueba sin autorización posterior.
- Persistir PIN o borradores de registro.
- Compilar, publicar o avanzar automáticamente al siguiente módulo.

Los nombres M05 y M07 designan módulos del plan, no specs numeradas que se presupongan existentes.

## Evidencia de verificación

- **Fecha:** 2026-10-14.
- **Entorno:** rama `spec-03-registro-estados-cuenta`, base `382ca81` más cambios locales sin commitear; `app-taxi` 1.0.0; Expo SDK `~57.0.29`, React Native 0.86.3, React 19.2.3; gestor de paquetes npm (`package-lock.json`, sin `bun.lock`).
- **Correcciones aplicadas en esta verificación** (cambio mínimo, sin debilitar pruebas):
  - `src/features/account/__tests__/estado-cuenta.test.tsx`: los 8 tests llamaban `render(...)` síncrono, pero @testing-library/react-native 14.1.0 expone `render` asíncrono; se añadió `await` (los 8 tests fallaban con "`render` function has not been called").
  - `src/features/account/__tests__/estado-cuenta.test.tsx` y `src/features/auth/__tests__/guard-sesion.test.tsx`: los `it.each` con filas multi-columna y `as const` producían un error de TypeScript 6.0.3 con callbacks `async`; se tipó la tabla con un tipo de tupla explícito, conservando la seguridad de tipos.
  - Dependencias: `expo install --fix` alineó `expo`, `expo-constants`, `expo-linking` y `expo-router` a los parches esperados del SDK 57 (`~57.0.29`, `~57.0.22`, `~57.0.13`, `~57.0.27`); tras el ajuste, expo-doctor pasó de 20/21 a 21/21 y toda la verificación se repitió en verde.
- **Comandos ejecutados (npm / npx):**
  - `npx jest src/features/account --runInBand` → 6 suites, 77/77 pruebas en verde.
  - `npx jest src/features/auth --runInBand` → 8 suites, 85/85 pruebas en verde.
  - `npx jest --runInBand` → 15 suites, 175/175 pruebas en verde.
  - `npx tsc --noEmit` → exit 0, sin errores.
  - `npx expo lint` → exit 0, sin errores.
  - `npx expo-doctor` → 21/21 comprobaciones, sin problemas.
  - `git diff --check` → exit 0 (solo avisos de fin de línea LF/CRLF, sin errores de whitespace).
- **Fuentes consultadas:**
  - Context7: se resolvió `/expo/expo` y `/websites/expo_dev_versions`; no existe un corpus específico de SDK 57 en Context7, por lo que se usó `/websites/expo_dev_versions` (documentación oficial de Expo) para `useLocalSearchParams` y `useFocusEffect`.
  - Documentación oficial por webfetch: `https://docs.expo.dev/versions/v57.0.0/` (confirma SDK 57 ↔ React Native 0.86 ↔ React 19.2.3, coincidente con `package.json`).
  - Contratos del proyecto: `docs/implementacion-app/01-CONTRATOS-API.md`, `docs/implementacion-app/modulos/M02-REGISTRO-Y-CUENTA.md`, `docs/implementacion-app/02-ARQUITECTURA.md`.
- **Plataformas:** toda la evidencia automática corresponde a pruebas Jest (entorno Node con jest-expo) y revisión estática del código JavaScript/TypeScript. No se ejecutó en Android ni iOS, y no se dispone de capturas de dispositivo; los criterios que exigen dispositivo o API real se mantienen sin marcar.

| Criterio | Resultado | Plataforma | Evidencia | Pendiente o bloqueo |
| --- | --- | --- | --- | --- |
| La entrada a registro funciona desde bienvenida y login y respeta el guard público existente | Verificado | Jest + revisión estática | `entradas-registro.test.tsx` (bienvenida → `/registro`); `login-pantalla.test.tsx` “el botón de registro navega a /registro”; `src/app/(auth)/_layout.tsx` monta `GuardRutaAuth` sobre el grupo `(auth)` que contiene `/registro`; regresión de guards en verde | Sin dispositivo: el gesto real de navegación no está probado en hardware |
| El formulario aplica exactamente los límites del contrato, recorta textos y preserva ceros iniciales del PIN | Verificado | Jest | `registration-schema.test.ts` (límites 30/100/50/30, recorte, PIN `^\d{4,6}$` con ceros iniciales, sin patrón telefónico adicional) | — |
| La capacidad admite los límites 1 y 100 y rechaza vacío, decimales y valores fuera de rango | Verificado | Jest | `registration-schema.test.ts` (acepta 1 y 100; rechaza vacío, `4.5`, `4,5`, `abc`, `4e2`, `+4`, `-1`, `0`, `101`, `999`) | — |
| El cuerpo de registro contiene únicamente los campos del contrato; no contiene confirmación ni Bearer | Verificado | Jest | `api.test.ts` “POST público … sin Bearer” (headers sin `Authorization`, cuerpo exacto); `registration-schema.test.ts` “el cuerpo válido no incluye confirmación ni campos auxiliares” | — |
| Un doble toque produce una sola petición y no hay reintento automático del alta | Verificado | Jest | `registro-pantalla.test.tsx` “bloquea el doble envio: un solo POST mientras la peticion esta en curso”; `api.test.ts` “sin reintentar automáticamente” (un solo `fetch`) | — |
| Ante errores se conservan los campos no sensibles mientras el formulario sigue abierto; PIN y confirmación se limpian tras el intento de envío | Verificado | Jest | `registro-pantalla.test.tsx` “preserva los campos no sensibles y limpia el PIN tras un error del servidor” | — |
| Un timeout muestra el aviso de resultado incierto y la acción “Intentar ingresar”; no se reenvía el registro ni se autentica automáticamente | Verificado | Jest | `registro-pantalla.test.tsx` “un timeout muestra el aviso de resultado incierto y no navega por si solo” (mensaje exacto del spec, sin `router.replace` ni autenticación) | — |
| “Intentar ingresar” abre el login con el teléfono de la petición enviada precargado y el PIN vacío, incluso si el login ya estaba montado | Verificado | Jest | `registro-pantalla.test.tsx` “"Intentar ingresar" navega al login con el telefono enviado y sin PIN”; `login-pantalla.test.tsx` “prellena el teléfono desde el parámetro y deja el PIN vacío” y “al reutilizar la pantalla con un nuevo teléfono vuelve a vaciar el PIN” (`useFocusEffect` en `src/app/(auth)/login.tsx:33-45`, patrón recomendado en la doc oficial de Expo) | — |
| Si el ingreso posterior falla, se muestra el error de M01 y se permite volver al registro para decidir un nuevo envío manual. No se afirma que la cuenta no existe ni se restaura el borrador abandonado | Verificado | Jest + revisión estática | `login-pantalla.test.tsx` “tras un login fallido se puede volver al registro” (muestra “Teléfono o PIN incorrecto” y enlaza a `/registro`); el formulario de registro no persiste borradores | — |
| Un HTTP 409 al registrar, también tras un timeout y nuevo envío manual, muestra un aviso general y permite abrir el login con el teléfono enviado precargado y el PIN vacío. No reenvía ni autentica automáticamente | Verificado | Jest | `registro-pantalla.test.tsx` it.each de 409 con aviso general + “un nuevo intento tras un timeout puede terminar en 409 sin autenticar” | — |
| El manejo de 409 depende del estado HTTP tipado y funciona con distintos valores de `message`, sin adivinar el campo duplicado ni afirmar que el conflicto corresponde al teléfono | Verificado | Jest | `api.test.ts` “un HTTP 409 produce un CONFLICT tipado por estado, sin interpretar el message”; `registro-pantalla.test.tsx` it.each con tres mensajes distintos, sin atribución a campos | — |
| Una respuesta exitosa conduce al login con teléfono prellenado y PIN vacío, sin establecer sesión ni persistir el perfil de registro como autenticado | Verificado | Jest + revisión estática | `registro-pantalla.test.tsx` “crea la cuenta con el cuerpo exacto, sin confirmacion, y vuelve al login sin sesion”; `src/features/account/screens/registro.tsx` no importa `session-context` ni `SecureStore` ni llama `iniciarSesion` | — |
| La app representa pendiente, rechazado y suspendido desde el perfil real; aprobado conduce al inicio existente | Verificado | Jest | `estado-cuenta.test.tsx` (títulos y datos del perfil real); `guard-sesion.test.tsx` “una cuenta aprobado redirige al inicio” y “un cambio de estado del perfil observado redirige a la nueva pantalla de cuenta” | — |
| La actualización manual y el regreso a primer plano solicitan un perfil vigente y actualizan la navegación | Verificado | Jest | `refresco-perfil.test.tsx` (primer plano actualiza el perfil observado; actualización manual con error recuperable); `session-context.test.tsx` “actualizarPerfil fuerza una lectura vigente” | — |
| No se duplican listeners, no hay intervalos de consulta y las peticiones propias se cancelan al desmontar o invalidar sesión | Verificado | Jest + revisión estática | `refresco-perfil.test.tsx` (único listener, `remove` al desmontar, sin consultas tras desmontar); `session-context` cancela y limpia caché al invalidar; búsqueda estática sin `setInterval` en `src/` | — |
| Las respuestas tardías de otra sesión no reemplazan el perfil actual | Verificado | Jest | `session-context.test.tsx` “una respuesta tardia de actualizarPerfil no reemplaza el perfil tras invalidar la sesion” | — |
| Los errores de autenticación y de red conservan las garantías de M01, sin abrir operación con perfil no verificado | Verificado | Jest | `session-context.test.tsx` (401 invalida; 403/404 incompatible; red conserva sesión); `guard-sesion.test.tsx` (el contenido operativo no se renderiza hasta que la sesión está verificada y aprobada) | — |
| Pendiente, rechazado y suspendido sin servicio confirmado no renderizan rutas operativas mediante acceso directo | Verificado | Jest | `guard-sesion.test.tsx` “acceso directo con %s no renderiza contenido operativo y redirige a su pantalla de cuenta” | — |
| Las pruebas de política preservan únicamente la continuidad del servicio para una cuenta restringida con servicio confirmado del conductor actual; una identidad diferente no habilita la excepción | Verificado | Jest | `src/navigation/__tests__/politica-acceso.test.ts` (`solo_finalizar` solo con servicio propio en estado `en_servicio`; identidad ajena → `bloqueado_por_estado`) | La excepción permanece inyectada como `null` en `guard-sesion.tsx:62` hasta que M05 aporte la fuente real |
| No aparecen acciones para autoaprobarse, editar vehículo o finalizar un servicio inexistente o no integrado | Verificado | Jest + revisión estática | `estado-cuenta.test.tsx` “no ofrece autoaprobación, edición de vehículo ni finalización de servicio” | — |
| No se inventan motivos de rechazo/suspensión ni teléfonos de soporte | Verificado | Jest + revisión estática | `estado-cuenta.tsx` (mensajes sin motivos; ayuda solo con `runtimeConfig.contactoAyuda`); `estado-cuenta.test.tsx` “sin contacto de ayuda configurado no muestra el botón de ayuda” | — |
| Las pruebas automatizadas nuevas y la regresión de M01 terminan en verde | Verificado | Jest | `npx jest --runInBand` → 15 suites, 175/175 pruebas (incluye regresión completa de M01) | — |
| TypeScript, lint y expo-doctor terminan sin errores de bloqueo | Verificado | Node | `npx tsc --noEmit` exit 0; `npx expo lint` exit 0; `npx expo-doctor` 21/21; `git diff --check` exit 0 | — |
| No hay PIN en logs, almacenamiento, parámetros de navegación ni caché de datos remotos; no se incorporan secretos del backend | Verificado | Revisión estática | `api-client.ts:88-131` registra solo ruta/método/status/código (nunca el cuerpo); `token-storage.ts` guarda únicamente el JWT; los parámetros de navegación solo transportan `telefono` (`registro.tsx:127-131,159-162`; `login.tsx:21`); el PIN se limpia del estado del formulario en el envío (`registro.tsx:154`); sin `AsyncStorage` ni credenciales en el código | — |
| M05 conecta los eventos SSE `conectado` y `actualizado` a la recuperación de perfil y solicitud activa, sin inferir aprobación del mensaje SSE | Bloqueado | — | No ejecutado: fuera del alcance de M02 | Requiere implementación e integración de M05 |
| M05 confirma el servicio en curso por API, reconcilia tras reconexión y alimenta la política con identidad y generación de sesión vigentes | Bloqueado | — | No ejecutado: `servicioConfirmado` permanece `null` en `guard-sesion.tsx:62` | Requiere M05; la política pura y sus pruebas ya existen |
| M05/M07 verifican que una suspensión durante un servicio muestra el aviso, conserva una acción funcional de finalizar y no habilita otro servicio | Bloqueado | — | No ejecutado: no hay pantalla de servicio ni finalización en M02 | Requiere M05 y M07 |
| Contra un backend real autorizado, `POST /api/conductores` crea una cuenta y devuelve el perfil sin JWT; la app vuelve al login sin sesión, el ingreso explícito obtiene un JWT y `GET /api/conductores/:id` confirma el perfil y su estado real. Registrar entorno, fecha y resultado sin PIN ni token como evidencia obligatoria de integración | Bloqueado | — | No ejecutado: los dobles de Jest no certifican integración real | Requiere autorización posterior del entorno y datos de prueba |
| En dispositivo se comprueban navegación, teclado, área segura, texto ampliado y objetivos táctiles de al menos 48 dp | Bloqueado | Android / iOS | Sin dispositivo ni capturas; no se dispone de evidencia visual | Ejecutar la app en dispositivo (o emulador) y registrar capturas de registro, estados de cuenta y teclado/área segura |
