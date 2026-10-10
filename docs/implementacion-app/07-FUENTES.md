# Fuentes y decisiones técnicas

## Fuentes del proyecto

- docs/ESPECIFICACION_driver-app.md: alcance y pantallas. Algunas secciones son anteriores a la API actual.
- docs/REGLAS_DE_NEGOCIO.md: elegibilidad, privacidad operativa, jornada y finalización.
- docs/ROADMAP_ENDPOINTS.md y código backend/src: contratos actuales comprobados el 10/10/2026.
- app-taxi/app-taxi/package.json y App.tsx: estado inicial y versiones declaradas.
- Prototipo TaxiSur-conductor-prototipo-UI: referencias visuales incluidas en este paquete.

## Documentación oficial consultada

- [Expo Router: instalación en proyecto existente](https://docs.expo.dev/router/installation/). Instalar dependencias compatibles y configurar la entrada; no regenerar todo el proyecto sin necesidad.
- [Expo Location, SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/location/). Permisos y distinción entre primer/segundo plano; probar las capacidades de fondo en una compilación de desarrollo apropiada.
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/). Almacenamiento seguro del token; elegir la versión compatible con el SDK instalado.
- [TanStack Query para React Native](https://tanstack.com/query/latest/docs/framework/react/react-native). Integración con cambios de conectividad y foco de la app.

Consulta: 10/10/2026. No se fija una versión nueva de paquetes auxiliares ni se prescribe un cliente SSE sin probarlo con Authorization en el entorno nativo existente. Las decisiones de estructura, UX y aceptación de este paquete son propuestas de implementación basadas en el proyecto, no requisitos extraídos literalmente de esas bibliotecas.
