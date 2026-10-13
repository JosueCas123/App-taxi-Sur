# Coordinación con backend y despliegue

Estos puntos no vuelven a declarar ausentes los endpoints ya implementados. Son condiciones para validar el flujo completo.

| Punto | Responsable | Validación de cierre |
|---|---|---|
| SSE debe cerrar/revalidar sesión al expirar JWT o invalidarse identidad | Backend | Abrir stream, vencer/revocar identidad y comprobar cese de entrega; reconectar exige credenciales válidas |
| Observar estado/errores asíncronos de la suscripción Supabase | Backend / operación | Una falla upstream queda visible; conectado HTTP no se presenta como Realtime saludable |
| Migraciones de cierreJornadaSolicitado y puntoRecogidaTexto | Despliegue | Verificar aplicadas en la base conectada, no solo presentes en carpeta |
| Publicación Realtime de public.conductores y credenciales de servidor | Despliegue | La asignación llega al stream correcto sin exponer service_role en la app |
| ROADMAP menciona rol en JWT; firma actual no lo añade | Documentación | Corregir descripción; app usa conductorId y perfil |
| Oferta de 60 s depende de reloj local para presentación | App / backend | Probar desfase; el servidor rechaza tarde. Si hace falta precisión garantizada, acordar referencia de hora explícita como mejora |

No ejecutar migraciones ni cambios de producción como parte de la creación de pantallas. Conservar las mejoras opcionales separadas del contrato actual: JWT en registro, refresh, push, background y un reloj servidor explícito no se presuponen implementados.

La revisión detallada está incluida en referencias/REVISION-ENDPOINTS.md. Los fallos del entorno al ejecutar tests en aquella auditoría no son evidencia de aprobación ni de defectos de negocio.
