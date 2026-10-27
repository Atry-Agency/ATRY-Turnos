# IAtry V3 · entendimiento productivo restringido

27/10/2026. Rama `codex/iatry-v3-understanding`, basada en la publicación `a0e3e79f715988cca22ce87182a24fa1add437cd`. Sin publicación ni escrituras reales nuevas. Los ajustes locales pendientes de la landing se conservan en su otro checkout; este candidato mantiene la landing publicada.

## Qué funcionaría al publicar este candidato

- Interpretar instrucciones acotadas sobre servicios, clientes, horarios, descansos, vacaciones, ausencias, reservas y el resto de tareas identificables del catálogo. Motor determinista reutilizado de los commits experimentales 3a08fe2/5d22558; sin modelos generativos, servicios pagos o nuevas dependencias.
- Separar la frase del usuario, intención, valores explícitos, referencias por confirmar, datos faltantes y autorización. Aclarar horarios AM/PM y ausencia de cliente/profesional sin consultar ni modificar registros. Mostrar un borrador estructurado, nunca un resultado ficticio de servidor.
- Conservar nombre/duración/precio aportados; fechas relativas de Uruguay; planes de hasta tres pasos explícitos; no suponer vuelta de vacaciones ni hora de almuerzo. Rechazar fechas imposibles e importes/duraciones fuera del contrato. No ejecutar instrucciones desconocidas o eliminaciones generales.
- Pedir aclaraciones también en sesiones sin operaciones habilitadas. Elegir una interpretación no concede permisos: toda tarea no homologada conserva botón deshabilitado y una explicación de rol, plan, incompatibilidad o conexión.
- Ejecutar solamente las cinco lecturas verificadas: services.list, team.list, customers.search, customers.history, business.statistics. Solo propietario de Pelu, ID 374cd00d-3e37-497f-9292-9bb959c1ef88, proyecto djoxdtloqwbrhgtgencc. Estadísticas requiere su función de plan. La demo del producto también limita IAtry a esas cinco lecturas ficticias.
- Mantener el panel, emblema, energía, menú, preferencias, guías, borradores ajenos y protección móvil. No se almacena la frase en persistencia; la conversación queda en el motor de sesión y se descarta al cambiar de contexto/cerrar sesión. Cero solicitudes pasivas al abrir o interpretar.

## Qué NO se habilita

Todas las escrituras generales y cancelaciones, reservas/disponibilidad/agenda/dashboard, consultas que materializan recurrencias y Edge Functions no homologadas. Las dos incompatibles siguen bloqueadas: schedule.exception y waitlist.booked. No se activan operaciones por pasar pruebas locales ni por resolver una aclaración.

El catálogo original contiene 68 capacidades (66 compatibles locales, dos incompatibles). El motor experimental añadió dos lecturas (disponibilidad e impacto): 70 entradas en total, 68 compatibles locales; esas dos lecturas nuevas tampoco están autorizadas en producción. No deben anunciarse 68 o 66 operaciones productivas habilitadas.

La evidencia real previa se conserva, sin repetirla: cinco consultas y cinco escrituras controladas (crear/editar/ocultar un servicio; crear/editar una ficha). Esa evidencia no concede un permiso general de escritura.

## Comparación y validación

- Once frases de referencia: mismo resultado que el motor experimental, incluyendo intenciones, datos, referencias, aclaraciones y composición. Nuevos casos cubren «cómo viene mi negocio», horario semanal, fechas imposibles y números fuera de límites.
- 18 combinaciones propietario/encargado/empleado × Individual/Negocio/Pro × Pelu/otro negocio: interpretar/aclarar no hace solicitudes; todas las mutaciones y lecturas materializadoras siguen bloqueadas; sesión vencida o cambiada no mantiene acceso.
- Suite React existente; 19 grupos de seguridad V3; política productiva; descubrimiento; intérprete; nueva prueba de entendimiento sin transporte.
- Chrome/WebKit: 320x568,390x844,1440x960 con política conectada y AppPort ficticio. Tres sugerencias, cinco lecturas, aclaración bloqueada accesible, vista de datos explícitos, cero confirmación de escritura, otros roles/negocios sin acceso a datos. Es simulación de transporte, no una nueva certificación funcional del servidor real.
- Backend SQLite temporal: instrucción de servicio, revisión, confirmación y relectura; planes compuestos, conflicto parcial, ausencia, no cancelación/reintento implícito. Correos deshabilitados.
- PostgreSQL temporal del repositorio y adaptador cloud: once capacidades prioritarias correctas (servicios, clientes, horarios y ausencias), dos incompatibles bloqueadas y cuatro grupos de seguridad. No es el Supabase desplegado ni verifica sus Edge Functions.
- Rendimiento local, cinco contextos alternados: Servicios V3 mediana 19,2 ms, V2 19,0 ms; dos solicitudes de ruta en ambos, cero solicitudes al abrir IAtry y 0 ms de JavaScript en reposo en la muestra. No es latencia de Supabase.

## Auditoría real de solo lectura

Se inspeccionaron catálogos/privilegios/definiciones referenciadas y conteos en transacciones READ ONLY terminadas en ROLLBACK; no se invocaron RPC de negocio. El editor de Supabase conserva un borrador privado de consulta. No se descargaron contactos, tokens o respaldos.

Siete RPC existen con sus firmas: atry_bookings, atry_dashboard, atry_rules, atry_save_customer, atry_save_rule, atry_save_service y atry_save_week. Todos SECURITY DEFINER con search_path vacío; authenticated EXECUTE, anon sin EXECUTE. customers, services, staff_services, time_off, working_hours y schedule_exceptions tienen RLS y sin INSERT/UPDATE/DELETE directos para authenticated.

La delegación confirma autorización privada en servicios/semana/reglas y require_manager → member_role en clientes. atry_bookings delega a bookings_visit_base → expand_recurring; atry_dashboard también expande recurrencias: quedan bloqueados aunque parezcan consultas. Los triggers y rutinas inspeccionados de servicios/cliente/semana/bloqueo no mencionan colas de correo o HTTP; esta inspección textual y de llamadas estáticas no certifica todos los procesos externos/dinámicos del proyecto. El análisis histórico de notificaciones, triggers y cron sigue vigente y las reservas no se habilitan.

## Prueba real siguiente, propuesta NO ejecutada

Destino exclusivo: Pelu, negocio 374cd00d-3e37-497f-9292-9bb959c1ef88. Profesional activo observado: 35c53427-98ad-4f28-b0c1-c5cc5f82ae14.

Propuesta de grupo mínimo: crear UN bloqueo temporal con motivo «IAtry · Descanso controlado 2026-11-16», el 16/11/2026 de 13:00 a 14:00 (Uruguay; 16:00–17:00 UTC), mediante la sesión normal del propietario, adaptador cloud y atry_save_rule(kind=time_off); respuesta de servidor y relectura fresca de /time-off. Conservar el registro, sin borrarlo ni cambiar reservas, semana habitual o suscripción.

Conteo preliminar de solo lectura: profesional activo, cero reservas directas solapadas, cero bloqueos solapados y cero series recurrentes en Pelu. No certifica por sí solo buffers ni disponibilidad final; antes del ensayo se deben releer las condiciones, revisar buffers y detenerse ante cambios/concurrencia. Hace falta autorización explícita de este grupo y un adaptador privado que restrinja negocio/profesional/intervalo/registro, sin habilitar escrituras en el artefacto público. No se habilitó ese adaptador todavía.

Después: comparar semanal/pausas con el estado vigente y preparar un ensayo separado que conserve los demás días, únicamente tras acordar sus valores exactos. Reservas y acciones con colas de correo quedan para otra fase con aislamiento y validación específica. Nunca se desactivan cron/proveedores globales para probar.

## Recuperación y revisión

Rollback preparado localmente: rollback/pre-iatry-understanding-2026-10-27 → a0e3e79f715988cca22ce87182a24fa1add437cd. Si se autoriza publicar: verificar main, subir/verificar la etiqueta antes de desplegar. Recuperar con Actions → Publicar interfaz Atry Turnos → Run workflow → source_ref=rollback/pre-iatry-understanding-2026-10-27. No requiere migraciones ni cambios de Supabase.

Prueba local sin conexión: http://127.0.0.1:3334/?demo=1&plan=2#/app/inicio . IAtry interpreta, muestra bloqueos y ejecuta solo sus cinco lecturas ficticias. Comparación de motor completo aislado: /local-assistant en ese servidor (SQLite en memoria, sin Supabase, capacidades locales; NO equivale a autorización productiva).

Sesión real opcional de lectura: http://127.0.0.1:3335/ . Entrada privada fuera del artefacto público, login normal del propietario; solo cinco lecturas auditadas y cero escrituras. No se automatizó un inicio de sesión ni se trasladaron credenciales. Las pruebas de esta fase sobre sesiones de roles/planes diferentes utilizaron contextos simulados; faltan pruebas reales específicamente autorizadas antes de ampliar permisos.
