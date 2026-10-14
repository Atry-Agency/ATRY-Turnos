# Validación real de Supabase

Proyecto exclusivo: ATRY-Turnos, djoxdtloqwbrhgtgencc. ATRY LAB Operaciones no se modificó. Migraciones 001–023 aplicadas. Los hashes de 007–022 coinciden con el código revisado; 023 se registró al aplicar el ajuste de enlaces GitHub manteniendo el correo deshabilitado. No hay tablas públicas/privadas sin RLS.

## Resultados remotos

- Auth emite JWT reales; los metadatos no conceden administración. Cada organización queda aislada mediante RLS/RPC. La revocación de sesión bloquea inmediatamente el JWT previo y conserva el acceso de las otras cuentas.
- Profesionales, servicios, horarios, asignaciones y roles funcionan. El empleado no accede a CRM ni a agenda ajena. Cambios de duración/activación protegen reservas existentes.
- Solicitudes simultáneas producen una sola reserva por profesional o recurso compartido. Reintentar la misma solicitud conserva su ID.
- Reserva pública y gestión privada, cancelación repetida y reprogramación aprobadas mediante la función Edge real. Se verificó que la respuesta de conflicto pertenece al horario, usando claves nuevas en cada intento de la prueba.
- Origen y desafío firmado comprobados; los saltos internos variables del proxy no se usan como identidad del cliente. La prueba de regresión cubre el cambio de proxy y el rechazo de otra IP.
- Panel, Insights, preferencias, auditoría, notificaciones y exportación consultados con JWT reales. Realtime recibe las revisiones del propio negocio y ninguna de la otra organización.
- Invitación: rechazo de otra cuenta, correo verificado correcto, uso único y pérdida de acceso después de revocarla. Lista de espera: una cancelación genera oferta y su aceptación conserva idempotencia.
- El navegador creó una reserva manual local conectada a Supabase y una reserva pública desde GitHub Pages con el worker de protección, conservando los datos al cambiar fecha y horario. La reserva pública se reprogramó a las 11:00 y se canceló desde el navegador, verificando ambos resultados.

## Datos y publicación

Las dos ejecuciones temporales se limpiaron con autorización. La segunda terminó con cero perfiles, negocios y reservas de prueba, retirando después sus tres identidades Auth mediante comprobación de marca de ejecución. Auth conserva una sola cuenta real autorizada, con correo confirmado e inicio de sesión registrado. El registro y el retorno del correo a Mi cuenta fueron verificados en Chrome de Atry. Supabase registró el envío de recuperación. El usuario completó la nueva contraseña y volvió a ingresar; el navegador mostró Mi cuenta con una sesión nueva y las anteriores cerradas.

Datos, contraseñas, credenciales y enlaces de prueba se mantienen exclusivamente en data/cloud-private, ignorado por Git. No se publican capturas ni claves de servidor. SQLite y respaldos originales conservados e integridad verificada.

GitHub main contiene el avance; CI y despliegue aprobaron. La raíz publica la aplicación conectada real, verificada con la sesión autorizada. La ruta temporal /ATRY-Turnos/validacion/ se retiró del artefacto. Auth permite los retornos exactos de la aplicación y de esta ruta de validación; no se habilitaron dominios ajenos.

La publicación principal está activada. Pendiente: completar la integración de correo externo. Brevo, remitente, SMTP Auth, programación y recibos externos siguen pendientes; no se enviaron notificaciones de reservas por Brevo ni se certifica todavía la preparación comercial completa.

Auditoría final remota: Auth 1, perfiles 1, negocios 0, reservas 0, clientes 0, mail_jobs 0, tablas sin RLS 0, ledger 007–023 con 17 registros, correo de reservas deshabilitado. CI y despliegue 38c2485 aprobados. Acceso móvil publicado: viewport y contenido de 390 px, sin desborde horizontal.
