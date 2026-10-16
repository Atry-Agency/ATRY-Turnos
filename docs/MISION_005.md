# Misión 005 — ATRY Control Center

Estado de entrega: backend desplegado y validado remotamente el 16/10/2026; interfaz pendiente de publicación en este corte. Proyecto único: ATRY Turnos, `djoxdtloqwbrhgtgencc`. ATRY LAB Operaciones queda excluido.

## Implementado y probado localmente; backend verificado en producción

- Navegación de diez áreas con rutas `#/admin/<sección>` y ficha `#/admin/negocios/<id>`. Carga independiente por sección; errores recuperables. Arranque tras cargar todos los módulos para evitar la carrera que mostraba la interfaz anterior.
- Inicio con estados de suscripción coherentes (incluido programado), vencimientos a siete días, solicitudes, incidencias y estados de correo. Evidencia y fecha de consulta. Bandeja de pendientes/fallos priorizada; no se infiere salud por ausencia de reportes.
- Negocios paginados en servidor, búsqueda por identidad/contactos/propietarios/código de solicitud, plan, estado, orden y ventanas de 7/15/30 días. Búsqueda global incorpora usuarios en una consulta independiente. Filtros guardados por usuario en sessionStorage.
- Ficha comercial sin CRM: propietarios, contacto, profesionales, cantidad de reservas, cuota aceptada/reservada y ciclo. Reutilización de activación, renovación, prueba, suspensión, restablecimiento, cancelación y downgrade existentes. Confirmación específica antes de guardar.
- Pausas independientes por negocio: reservas públicas o todas las nuevas reservas; correo operativo por negocio y plataforma. Motivo, revisión, evento y clave idempotente. No cancelan reservas existentes; los turnos fijos ya acordados continúan materializándose y una pausa total impide crear series nuevas. La base de datos bloquea inserciones y la página pública informa que no admite reservas. El worker deja pendientes los operativos pausados y mantiene elegibles los esenciales.
- Usuarios: correo confirmado cuando Auth lo informa, sesiones vigentes y membresías. Bloqueo de identidad de aplicación, revocación de sesiones, retiro de membresía y desbloqueo. Último administrador y propietario protegidos. Nunca devuelve contraseñas, JWT ni refresh tokens. El bloqueo es de la aplicación y no cambia credenciales de Supabase Auth.
- Comercial: bandeja paginada, estados, enlace WhatsApp sin confirmación ficticia de recepción, notas, responsable y próximo contacto. Registro separado de comprobación manual de cobro. Finanzas por fechas: importes declarados, verificados por operador, cortesías y estimación mensual vigente; sin banco ni facturación fiscal. No se inventan deudas.
- Planes: capacidades de estadísticas, insights y exportación separadas; validaciones numéricas locales/cloud alineadas. Formularios envían revisión esperada y rechazan edición obsoleta. Se conserva la firma de las API anteriores; clientes heredados que omitan revisión no reciben la garantía de comparación de versión. El Control Center siempre envía revisión.
- Correo: metadatos paginados sin destinatario/cuerpo, presupuesto y heartbeat del worker; cancelación de pendientes no esenciales y reintento de fallos expresamente rechazados por el proveedor. Desconocidos y trabajos en procesamiento no admiten estas acciones. Las cancelaciones no se reactivan al cambiar preferencias.
- Soporte esencial independiente del plan: asunto, descripción y categoría. Bandeja por severidad, prioridad Pro y antigüedad; resolución obligatoria al cerrar desde el Control Center, autor, fecha y revisión. Historial y ficha enlazados. No se prometen SLA. Los clientes heredados de incidencias mantienen su API anterior; su cierre simple no se transforma retroactivamente en evidencia de reparación.
- Auditoría unificada de eventos nuevos, suscripciones e historial de plataforma; filtros de fecha, actor, entidad y negocio, antes/después cuando existe información y exportación CSV de la página con protección frente a fórmulas.
- Almacenamiento: tamaño de base PostgreSQL medido y conteos por categoría; Storage sin medición disponible se informa como desconocido. Retención manual de contenido de correo terminal configurable y sin valor inicial: nada se limpia hasta que el titular defina días y confirme. Se limpian lotes de hasta 100 destinatarios/asuntos/cuerpos de entregados, rebotados u omitidos antiguos. Se conservan filas, estados, claves de deduplicación, cuotas, proveedor y auditoría. No se atribuye liberación física inmediata.
- Solicitudes de baja/anonimización con vista previa de dependencias principales. Registro del procedimiento; **ejecución definitiva de cuentas/negocios deshabilitada**.
- Autenticación reciente (AMR de contraseña/OTP/WebAuthn/TOTP de los últimos diez minutos) para comandos sensibles y las transacciones públicas de planes/configuración/suscripción. Sesiones locales verificadas por token concreto. Confirmaciones, motivo y límites de nuevas operaciones administrativas.

## Preparado pero deshabilitado

**Recibos Brevo:** función `atry-mail-events`, token Bearer de al menos 32 caracteres, límite de lote y tamaño, RPC solo service_role; deduplicación, orden temporal y reconciliación por ID del proveedor. No almacena email, IP ni cuerpo recibido. El gateway JWT se desactiva solo para este nuevo endpoint porque Brevo usa su propio token; los endpoints existentes mantienen sus protecciones. `BREVO_EVENTS_ENABLED` debe permanecer sin configurar hasta provisionar `BREVO_EVENTS_TOKEN`, registrar webhook y hacer una prueba autorizada. No se afirma entrega real por pasar tests con respuestas simuladas del proveedor.

**Monitoreo independiente:** workflow manual `control-monitor.yml` reutiliza GitHub Actions y consulta recursos estáticos e identidad del proyecto. No usa clave privilegiada ni crea reservas. No está programado ni se ejecutó en producción. Auth/DB/Brevo quedan desconocidos, no verdes. Puede habilitarse una frecuencia después de revisar cuotas y alertas; no se añadió servicio externo.

## No implementado / limitaciones explícitas

- Eliminación definitiva o anonimización integral coordinada entre Auth, PostgreSQL y Storage. Hace falta política de conservación, inventario completo de archivos y entorno Supabase de staging con esas dependencias reales. PGlite prueba SQL aislado; no sustituye ese ensayo de recuperación.
- Envío administrativo directo de recuperación/verificación desde servidor. Se mantiene recuperación autoservicio; no se crea un botón que simule envío.
- Transferencia de propiedad con aceptación; MFA de plataforma provisionado; roles administrativos especializados; detector de anomalías; reconciliación bancaria; facturación fiscal; deuda contable; cambios de plan programados; CSV financiero masivo.
- Monitorización independiente continua, chequeo de estado Brevo en vivo, diagnóstico completo de Realtime/Edge/Auth, consulta de cron remoto y costos por negocio. Los componentes sin evidencia actual muestran estado desconocido.
- Consumo global SMTP de Auth en Brevo; capacidad comercial comprometida no equivale al consumo del proveedor.
- Respaldos automáticos nuevos, inventario verificado de backups remotos, ensayo de restauración integral y restauración de producción desde el panel. Se informa desconocido; ningún archivo antiguo se presenta como respaldo vigente.
- Historial antiguo de planes puede no tener antes/después ni motivo. No se inventan esos datos.
- La vista previa de baja cuenta dependencias principales; no certifica aún un inventario completo de todos los archivos/objetos o de obligaciones de conservación.

## Pruebas y evidencia

Suite completa: **124 pruebas pasaron, cero fallos y cero omitidas**, después de integrar SQL, AMR, conservación, recibos y pruebas de pausas. Los cambios posteriores de interfaz se verifican adicionalmente con sintaxis y navegador.

Pruebas nuevas: roles, sesión reciente, bloqueo, último administrador/propietario, paginación y privacidad, revisión obsoleta, idempotencia, estados programado/suspendido, pausa pública/manual y reanudación sin borrar reservas, correo esencial durante pausa, desconocidos no reintentables, soporte sin plan pago, cierre con resolución, limpieza terminal sin borrar dedupe/cuotas, recibos duplicados/fuera de orden y token ausente.

Navegador integrado, base de QA en `/private/tmp/atry-control-005-qa.sqlite`: ingreso, dashboard, listado, ficha, pausa y restablecimiento reales sobre negocio ficticio; nueve reservas conservadas. Se detectaron y corrigieron una carrera de arranque y una colisión entre atributos de formularios y el manejador general de clics.

Móvil 390×844: ancho del documento 390 px, sin overflow horizontal; modal de pausa de 595 px dentro de 844 px. Capturas en la carpeta de entrega `mision005-validacion`, fuera del código productivo. Son del entorno local, no de producción.

## Migraciones y orden de despliegue

Aplicadas en remoto el 16/10/2026 (hashes registrados en `private.migration_ledger`):

1. `202610150033_control_center.sql`: tablas privadas, consultas/acciones, permisos y guardas.
2. `202610150034_control_integration.sql`: historia existente, configuración, CAS, cuotas y sesión reciente.
3. `202610160035_control_operations.sql`: retención manual, soporte esencial, diagnósticos y pausas públicas.
4. `202610160036_delivery_receipts.sql`: recibos opcionales y permisos de servicio.

Realizado antes de aplicar: identidad del proyecto, ledger 007–032, hashes coincidentes, RLS y copia manual fuera de Git. Ensayo PGlite de 44 tablas y 112 filas sin alterar conteos; Auth simulado, no ensayo integral de recuperación. No usar negocios reales como fixtures. Aplicar cada migración en transacción y guardar SHA-256 en el ledger existente con el mecanismo del proyecto. Después desplegar `atry-mail` con telemetría y, solo si se habilita el webhook, `atry-mail-events`; después publicar frontend. Validar lecturas autenticadas y escritorio/móvil, sin enviar mensajes o suspender negocios reales para probar.

No se debe mezclar la nueva interfaz con una base que aún no tenga estas RPC. La verificación SQL remota pasó: 12 secciones, permisos anónimos/privados, idempotencia, revisión obsoleta, autenticación reciente y rechazo de usuario de negocio; todas las mutaciones de prueba se revirtieron.

## Retención, respaldos y costos

El número de días de limpieza es una decisión de política del titular, no un plazo legal calculado por la aplicación. Antes de usarla debe revisar finalidad y conservación conforme a la [guía oficial de protección de datos de Uruguay](https://www.gub.uy/unidad-reguladora-control-datos-personales/comunicacion/publicaciones/guia-general-proteccion-datos-personales-uruguay). Reservas, clientes y registros comerciales no reciben eliminación automática.

La documentación de [respaldos de Supabase](https://supabase.com/docs/guides/platform/backups) distingue base de datos de archivos Storage y recomienda exportaciones propias para proyectos gratuitos. El panel no presume disponibilidad de backup descargable ni cobertura de objetos Storage. No se contrató ningún servicio.

Brevo documenta [autenticación Bearer para webhooks](https://developers.brevo.com/docs/secured-webhooks). Activarlos incrementa invocaciones Edge y registros almacenados; revisar las cuotas de Supabase/Brevo y GitHub Actions antes de programar tareas. No se realizaron compras ni cambios de plan.

## Criterios de aceptación: estado real

| Caso | Resultado de esta entrega | Pendiente |
|---|---|---|
| Pagó y no tiene acceso | Solicitud, historial, comprobación manual y habilitación reutilizados; pruebas aisladas | Validación remota y publicación |
| Empleado no ingresa | Cuenta, confirmación, bloqueo, sesiones y membresías | Envío administrativo seguro de instrucciones; se conserva autoservicio |
| Recordatorios no llegan | Cola, cuota por ficha, presupuesto, heartbeat y errores | Evidencia actual de producción; activar recibos opcionales |
| Detener nuevas reservas | Pausa pública/total y reanudación comprobadas sin borrar compromisos existentes | Aplicar migraciones y validar remoto |
| Solicitud de eliminación | Vista previa y solicitud auditada | Ejecución integral bloqueada hasta política y ensayo de dependencias reales |
| Liberar almacenamiento | Retención manual y redacción de contenido terminal conservando claves y cuotas | Definir política del titular; no se garantiza reducción física inmediata |
| Problema general | Evidencia de consulta DB, errores, estado desconocido donde falta monitoreo y procedimiento | Monitor continuo y comprobaciones reales de todos los proveedores |
| Cien negocios | Consultas y listados paginados, filtros y carga por sección | Ensayo de carga con datos representativos y lectura de recursos remotos |

## Copia manual y verificación remota — 16/10/2026

Copia puntual privada fuera del repositorio (`../respaldo-manual-005`), JSON con permisos 0600 y directorio 0700. Incluye 53 tablas, 121 funciones y metadatos; 2 negocios, 4 usuarios, 2 reservas y cero objetos Storage. SHA-256: `bcc798bd9733fcd7e2bebfdc06f8e25c670eccbe625fe672726e16cfa533ed78`. Excluye Vault, sesiones/refresh tokens, configuración de proveedores/plataforma y archivos Storage. No se implementó un sistema de respaldos ni se contrataron servicios.

Herramientas reproducibles: `manual-control-snapshot.sql`, `validate-control-snapshot.js`, `prepare-control-migrations.js`, `verify-control.sql`. Los archivos con datos y código previo del worker permanecen fuera de GitHub. Prueba remota usa roles y sesiones simuladas dentro de transacción, no sustituye la comprobación de login en navegador. Los conteos productivos se conservaron en las cuatro migraciones; pausa global sigue desactivada y retención permanece sin configurar.
