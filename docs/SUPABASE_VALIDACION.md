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

La primera prueba de dos cuentas y negocios se limpió con autorización. La segunda ejecución todavía conserva 3 identidades, 2 negocios y 10 reservas exclusivamente temporales. Hay un snapshot privado y una limpieza preparada que comprueba IDs, marca de ejecución, pertenencias, contactos de documentación, ausencia de entregas externas y datos ajenos. Se ensayó la transacción con ROLLBACK: todos los datos permanecieron. La eliminación definitiva requiere su confirmación puntual en el navegador.

Datos, contraseñas, credenciales y enlaces de prueba se mantienen exclusivamente en data/cloud-private, ignorado por Git. No se publican capturas ni claves de servidor. SQLite y respaldos originales conservados e integridad verificada.

GitHub main contiene el avance; CI y despliegue aprobaron. La raíz mantiene la demostración. /ATRY-Turnos/validacion/ conecta a Supabase real con un aviso permanente de prueba. Auth permite los retornos exactos de la aplicación y de esta ruta de validación; no se habilitaron dominios ajenos.

Pendiente: confirmar correo y recuperación de punta a punta con el destinatario autorizado, limpiar fixtures y activar la publicación principal. Brevo, remitente, SMTP Auth, programación y recibos externos siguen pendientes; no se enviaron mensajes externos ni se certifica todavía la preparación comercial completa.
