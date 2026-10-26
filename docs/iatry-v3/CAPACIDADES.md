# Inventario y matriz de IAtry V3

Auditoría de código realizada antes de conectar las operaciones: pantallas React, contratos tipados, transporte `scopedApi`, adaptador `cloud/api-adapter.mjs`, validadores inertes de dominio y rutas del backend local. No es una nueva inspección en vivo de Supabase ni una prueba de sus políticas RLS. Fecha: 2026-10-26.

## Capacidades implementadas

Cada fila ejecutable corresponde a una conversación y una operación del contrato existente, no a abrir una pantalla. «Verificada local» significa principio a fin contra el backend existente con SQLite temporal, proveedor de correo deshabilitado y confirmación explícita para escrituras. Las lecturas solo se consultan al solicitarlas.

| ID | Capacidad | Tipo | Roles | Plan/capacidad | Resultado |
| --- | --- | --- | --- | --- | --- |
| services.list | Consultar servicios | Lectura | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| services.create | Crear un servicio | Creación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| services.price | Cambiar precio de un servicio | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| services.duration | Cambiar duración de un servicio | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| services.details | Editar nombre y descripción de un servicio | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| services.buffers | Cambiar preparación y tiempo posterior | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| services.deposit | Cambiar seña estimada de un servicio | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| services.assign | Asignar profesionales a un servicio | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| services.publish | Publicar un servicio | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| services.hide | Ocultar un servicio | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| customers.search | Buscar clientes | Lectura | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| customers.history | Consultar historial de un cliente | Lectura | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| customers.create | Crear ficha de cliente | Creación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| customers.update | Actualizar ficha de cliente | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| team.list | Consultar profesionales | Lectura | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| team.create | Incorporar un profesional | Creación | Propietario, Encargado | team | Verificada local |
| team.update | Actualizar un profesional | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| schedule.read | Consultar horarios de un profesional | Lectura | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| schedule.day | Cambiar un día de atención y sus pausas | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| schedule.absence | Registrar ausencia o bloqueo | Creación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| schedule.holiday | Cerrar el negocio una fecha | Creación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| schedule.exception | Preparar una jornada especial | Creación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| resources.create | Agregar sala o equipo | Creación | Propietario, Encargado | resources | Verificada local |
| resources.update | Modificar recurso | Modificación | Propietario, Encargado | resources | Verificada local |
| resources.assign | Asignar recursos a un servicio | Modificación | Propietario, Encargado | resources | Verificada local |
| bookings.list | Consultar turnos por día y profesional | Lectura | Propietario, Encargado, Empleado | Permisos y acceso actuales | Verificada local |
| bookings.create | Crear un turno | Creación | Propietario, Encargado, Empleado | Permisos y acceso actuales | Verificada local |
| bookings.confirmed | Confirmar un turno | Modificación | Propietario, Encargado, Empleado | Permisos y acceso actuales | Verificada local |
| bookings.completed | Completar un turno | Modificación | Propietario, Encargado, Empleado | Permisos y acceso actuales | Verificada local |
| bookings.cancelled | Cancelar un turno | Cancelación | Propietario, Encargado, Empleado | Permisos y acceso actuales | Verificada local |
| bookings.no_show | Marcar ausencia de un cliente | Modificación | Propietario, Encargado, Empleado | Permisos y acceso actuales | Verificada local |
| bookings.reschedule | Reprogramar un turno | Modificación | Propietario, Encargado, Empleado | Permisos y acceso actuales | Verificada local |
| waitlist.list | Consultar lista de espera | Lectura | Propietario, Encargado | waitlist | Verificada local |
| waitlist.cancelled | Cancelar solicitud de espera | Modificación | Propietario, Encargado | waitlist | Verificada local |
| waitlist.booked | Marcar solicitud de espera atendida | Modificación | Propietario, Encargado | waitlist | Verificada local |
| recurring.list | Consultar turnos recurrentes | Lectura | Propietario, Encargado | recurring | Verificada local |
| recurring.create | Crear un turno recurrente | Creación | Propietario, Encargado | recurring | Verificada local |
| recurring.replace | Cambiar una repetición | Modificación | Propietario, Encargado | recurring | Verificada local |
| recurring.end | Terminar una repetición | Cancelación | Propietario, Encargado | recurring | Verificada local |
| visits.read | Consultar una visita completa | Lectura | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| visits.confirm | Confirmar una visita completa | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| visits.cancel | Cancelar servicios pendientes de una visita | Cancelación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| visits.reschedule | Reprogramar una visita completa | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| business.summary | Consultar resumen del negocio | Lectura | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| business.statistics | Consultar indicadores de 30 días | Lectura | Propietario, Encargado | statistics | Verificada local |
| business.insights | Consultar actividad y servicios más solicitados | Lectura | Propietario, Encargado | advanced | Verificada local |
| business.identity | Actualizar datos del negocio | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| business.rules | Modificar una regla de reservas | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| appearance.colors | Preparar colores y modo visual | Modificación | Propietario | Permisos y acceso actuales | Verificada local |
| public.info | Consultar enlace y configuración pública | Lectura | Propietario, Encargado, Empleado | Permisos y acceso actuales | Verificada local |
| plans.read | Consultar plan y límites | Lectura | Propietario, Encargado, Empleado | Permisos y acceso actuales | Verificada local |
| access.read | Consultar integrantes y roles | Lectura | Propietario | access | Verificada local |
| communications.read | Consultar configuración de WhatsApp | Lectura | Propietario, Encargado, Empleado | Permisos y acceso actuales | Verificada local |
| communications.settings | Ajustar teléfono de WhatsApp del negocio | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| communications.preview | Preparar un texto de WhatsApp sin enviarlo | Lectura | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| notifications.read | Consultar estados de notificaciones | Lectura | Propietario, Encargado | operational_mail | Verificada local |
| notifications.preferences | Preparar una preferencia de notificaciones | Modificación | Propietario, Encargado | operational_mail | Verificada local |
| notifications.hours | Ajustar anticipación de recordatorios | Modificación | Propietario, Encargado | operational_mail | Verificada local |
| communications.template | Preparar una plantilla de WhatsApp | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| business.multi | Configurar visitas con varios servicios | Modificación | Propietario | Permisos y acceso actuales | Verificada local |
| business.setup | Marcar primeros pasos revisados | Modificación | Propietario, Encargado | Permisos y acceso actuales | Verificada local |
| appearance.variant | Ajustar tipografía y estilo avanzado | Modificación | Propietario | pro | Verificada local |
| appearance.public | Preparar diseño de la página pública | Modificación | Propietario | negocio | Verificada local |
| appearance.secondary | Cambiar color secundario | Modificación | Propietario | negocio | Verificada local |
| appearance.save_preset | Guardar el estilo actual como preset | Modificación | Propietario | pro | Verificada local |
| appearance.apply_preset | Aplicar un preset guardado | Modificación | Propietario | pro | Verificada local |
| business.opportunities | Consultar oportunidades de agenda | Lectura | Propietario, Encargado | smartslots | Verificada local |
| support.incident | Registrar una incidencia interna | Creación | Propietario, Encargado | advanced | Verificada local |

## Trazabilidad por área

Las rutas siguientes son las del frontend HTTP. En Supabase se traducen a las funciones indicadas por el adaptador existente, sin añadir RPC ni modificar su implementación.

| Área | Operaciones y contratos existentes auditados | Fuente React y RPC |
| --- | --- | --- |
| Servicios | GET/POST /services; PATCH /services/:id. Crear, editar datos/precios/duración/seña/tiempos, publicar/ocultar y asignar profesionales. | services/{ServicesScreen,repository,form}.ts(x) · atry_catalog / atry_save_service |
| Equipo | GET/POST /staff; PATCH /staff/:id; fotografía mediante el repositorio de fotos. Datos y asignaciones ejecutables; Storage/recorte pendiente. | team/{TeamScreen,StaffEditor,photos}.ts(x) · atry_catalog / atry_save_staff |
| Horarios | GET /scheduling, /time-off, /staff/:id/hours; PUT /staff/:id/hours; POST /breaks, /exceptions, /holidays, /resources, /time-off; PATCH recursos; PUT /services/:id/resources. Las pausas se preparan como separación entre tramos en la operación semanal existente. DELETE de reglas no automatizado. | scheduling/{ScheduleScreen,WeeklyEditor,RuleEditor,model}.ts(x) · atry_rules / atry_save_week / atry_save_rule |
| Clientes | GET /customers?q, /customers/:id/history; POST /customers; PATCH /customers/:id. Fichas, búsqueda y reservas del historial. Exportación y consentimiento de comunicación requieren sus controles específicos. | customers/{CustomersScreen,CustomerProfile,contracts}.ts(x) · atry_customers / atry_save_customer / atry_customer_history |
| Agenda | GET /bookings?date&days, disponibilidad pública por catálogo autorizado; POST /bookings; PATCH /bookings/:id. Crear, consultar, confirmar, completar, reprogramar, cancelar y marcar ausencia. Visitas y turnos recurrentes no se descomponen en reservas independientes. | agenda/{AgendaScreen,BookingDetail,PrivateVisit,Reschedule,TimeFinder}.tsx y bookings/ManualBooking.tsx · atry_bookings / atry_create_booking / atry_update_booking / atry_visit / atry_visit_availability / atry_visit_command |
| Turnos fijos | GET/POST /recurring; POST /recurring/:id/end. Crear, reemplazar desde fecha y terminar, con historial e idempotencia existentes. | recurring/{RecurringEditor,EndRecurring,model}.ts(x) · atry_recurring / atry_create_recurring / atry_end_recurring |
| Lista de espera | GET /waitlist; PATCH /waitlist/:id. Consultar, cancelar solicitud o marcar atendida una oferta; no se confunde oferta con reserva. La inscripción pública depende de aceptación de condiciones y protección de esa página. | waitlist/WaitlistScreen.tsx · atry_waitlist / atry_update_waitlist |
| Inicio y estadísticas | GET /dashboard, /statistics, /insights, /smartslots?date. Indicadores, evolución con datos completos, servicios solicitados y oportunidades. Las consultas de agenda/resumen pueden materializar recurrencias según el contrato existente; por eso las pruebas no se ejecutaron contra Supabase. | dashboard/DashboardScreen.tsx y statistics/{BasicStatistics,InsightsScreen}.tsx · atry_dashboard / atry_statistics / atry_insights / atry_smartslots |
| Configuración | GET/PATCH raíz del negocio. Identidad, reglas de reserva, visitas múltiples y primeros pasos. Sin cambiar slug, plan o propietario. | settings/SettingsScreen.tsx y onboarding/OnboardingScreen.tsx · atry_business / atry_save_business |
| Apariencia e identidad | PATCH /appearance con revisión vigente y validación del plan. Colores/modo, variantes avanzadas y diseño público. Guardar y aplicar presets Pro también están implementados; borrar presets y preparar archivos conservan sus editores. | settings/{ThemeStudio,LogoEditor}.tsx y domain/theme.ts · atry_save_appearance |
| Página pública | GET /api/public/:slug y /availability; POST /book, /visits, /waitlist y gestión mediante token. Reserva pública/visitas requieren protección y condiciones del flujo público: pendientes de automatización; no se omiten captcha, cotización o aceptación. | public/{PublicBooking,SingleBooking,VisitBooking,ManageBooking,ManageVisit}.tsx · Edge atry-public y atry_save_appearance |
| Comunicaciones | GET/PUT /whatsapp; contexto y plantillas; acciones manuales, consentimiento y posposición mediante contratos propios. GET /mail-jobs y GET/PUT /notification-preferences. Configuración/lectura/borrador sin enviar: implementados. Abrir, marcar enviado y reintentar: excluidos en esta fase. | communications/*.tsx y notifications/NotificationsScreen.tsx · atry_whatsapp / atry_notification_preferences / atry_save_notification_preferences / atry_mail_jobs |
| Planes y permisos | GET /entitlements, /subscription, /members, /invitations; POST /plan-requests, invitaciones y miembros; PATCH miembros/solicitudes; DELETE accesos. Consulta implementada; cambios comerciales y de permisos excluidos. | subscription/*.tsx y access/*.tsx · atry_entitlements / atry_subscription / atry_access |
| Ayuda y soporte | GET/POST /incidents; POST /support. Registro interno de incidencia implementado para Pro. Enviar soporte externo no se automatiza. | statistics/InsightsScreen.tsx y app/SupportScreen.tsx · atry_incidents / atry_create_incident / atry_report_support |

## Pendientes y exclusiones explícitas

| Área | Operación | Estado y razón |
| --- | --- | --- |
| Comercial | Contrataciones, pagos, cambios de plan y habilitaciones | Excluido: requiere autorización comercial específica. |
| Accesos | Invitar, revocar o cambiar roles; administración global | Excluido: cambia permisos o puede generar comunicaciones reales. |
| Eliminación | Borrar reglas, profesionales, fichas, usuarios o negocios | Excluido: no se automatizan eliminaciones irreversibles. |
| Archivos | Subir y recortar fotografías o logotipos | Pendiente: integrar selección de archivo, recorte y validación de Storage sin duplicar el editor existente. |
| Visitas combinadas | Crear una visita con varios servicios desde el asistente | Pendiente: solo existe creación pública protegida por aceptación/captcha; no se inventa una creación privada. Consulta, confirmación, cancelación y reprogramación privada sí están implementadas. |
| Exportación | Descargar CSV de reservas | Pendiente: confirmación y descarga de datos personales en el centro de asistencia. |
| Identidad avanzada | Borrar presets o recortar archivos | Eliminar un estilo guardado o preparar un archivo conserva sus controles específicos; guardar y aplicar presets sí está implementado. |
| Envíos | Abrir WhatsApp, registrar enviado, reintentar correos o enviar avisos | Excluido de esta fase: no se realizan envíos reales. |
| Cuenta | Registro, contraseñas, sesiones, creación de organizaciones | Fuera de la automatización del negocio: requiere sus controles de identidad específicos. |
| Estadísticas | Comparar libremente períodos elegidos por el usuario | Pendiente de un contrato de períodos arbitrarios. Solo se muestran períodos definidos por los endpoints actuales y comparaciones deterministas con series completas ya cargadas. |

## Salvaguardas

- No hay operación DELETE ni rutas administrativas, de cuentas, de miembros o comerciales en el ejecutor.
- Ninguna frase ejecuta automáticamente: se elige una intención, se validan respuestas y se confirma un plan con token de un solo uso.
- Roles, capacidades del plan, estado de acceso y contexto se verifican al seleccionar y al ejecutar; el servidor conserva su autorización y reglas.
- Cada escritura usa `scopedApi` con el negocio de la sesión. La preparación recibe solo una interfaz de lectura; el ejecutor se mantiene separado.
- La ejecución y las consultas operativas quedan bloqueadas si el adaptador está conectado a Supabase. Esta rama se valida exclusivamente en demo/backend local. La ayuda pasiva conserva los agregados ya cargados por React.
- No se registran ni persisten conversaciones, fichas o credenciales. Los valores permanecen en memoria de la operación y se descartan al cambiar contexto o cancelar.
- Un request ya enviado no puede deshacerse al cambiar una sesión; su respuesta tardía se descarta. Durante su ejecución se bloquea la navegación ordinaria y el cambio de negocio.
- Los errores de conexión quedan como resultado incierto, sin éxito ni reintento automático. Una cancelación posterior del panel no revierte una escritura que pudo llegar al servidor.
- Se conservan los borradores de las pantallas: las escrituras de IAtry no empiezan ni se confirman mientras haya cambios ajenos sin guardar.
