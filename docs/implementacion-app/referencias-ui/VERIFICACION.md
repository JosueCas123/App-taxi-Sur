# Verificación de la entrega

Prototipo visual TaxiSur Conductores. Verificación realizada con Chrome,
abriendo directamente los archivos mediante file://.

- 16 pantallas de la app, cada una en un HTML independiente.
- 20 archivos HTML en total: 16 pantallas, catálogo, índice auxiliar,
  sistema de diseño y guía para Expo.
- Sin desbordamiento horizontal en anchos de 320 y 390 px.
- Revisión visual de acceso, registro, jornada, solicitud y servicio,
  además de la composición de escritorio a 1440 px.
- Controles de jornada y disponibilidad visibles a 390 × 844 px.
- Login con error genérico y registro con validación de coincidencia del PIN.
- PIN de registro no persistido; perfil de solo lectura.
- Aprobación externa y bloqueo de operación para cuentas pendientes/suspendidas.
- Jornada sin permiso permitida; disponibilidad sin permiso bloqueada.
- Contador persistente al recargar, rechazo, expiración y aceptación tardía.
- Aceptación con destino opcional.
- Finalización con confirmación y cierre de jornada después del servicio.
- Pérdida de conexión durante servicio, bloqueo de confirmación y recuperación.
- Ubicación vencida y actualización con reactivación consciente de disponibilidad.
- Verificación de todos los enlaces y recursos locales.
- Sin errores de JavaScript en los recorridos probados.

Estas comprobaciones validan el prototipo HTML. La integración con API,
autenticación real, GPS, Realtime y pruebas nativas en Android/iOS siguen
perteneciendo a la implementación de la aplicación descrita en guia-expo.html.
