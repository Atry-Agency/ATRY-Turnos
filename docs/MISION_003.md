# Misión 003 — estado real

14 de octubre de 2026. En curso. El usuario eligió continuar con el repositorio Atry-Agency/ATRY-Turnos y Supabase, y publicar mediante GitHub Pages. Cloudflare quedó pausado: no se creó proyecto Pages ni widget, ni se contrató ningún servicio.

## Infraestructura e implementación

Supabase exclusivo: ATRY-Turnos, referencia djoxdtloqwbrhgtgencc. Migraciones 001–022 aplicadas; los lotes 007–014 y 015–022 tienen hashes privados auditados. RLS habilitado en todas las tablas públicas y privadas. La migración 023, que permite el enlace de correo de GitHub Pages, está preparada en código y todavía no aplicada. ATRY LAB Operaciones y los otros repositorios permanecen intactos.

SDK oficial Supabase Auth con PKCE, confirmación, recuperación, perfil/correo/contraseña y sesiones. Adaptador para los módulos existentes de agenda, reservas, equipo y permisos, invitaciones, clientes, servicios, disponibilidad, recursos, espera, SmartSlots, informes y administración. Realtime autentica el websocket con el JWT y revisa periódicamente el acceso. La sesión revocada no bloquea futuros intentos de login.

atry-public y atry-mail desplegadas. La función pública usa origen autorizado, límites y, en el modo seleccionado, desafío firmado de duración limitada; no requiere proveedor CAPTCHA externo. No prueba que el visitante sea humano. El modo Turnstile queda como opción de código, sin credenciales configuradas. Referencias: https://github.com/paulmillr/noble-hashes y https://supabase.com/docs/guides/functions/examples/cloudflare-turnstile (formato de la IP reenviada por el gateway).

Auth tiene guardada la URL principal de GitHub Pages y los seis retornos exactos autorizados de signup/recovery/email_change, en GitHub y localhost:3301. Falta verificar recepción y recorridos reales del correo. El worker de Brevo mantiene autenticación de servidor y envíos deshabilitados; faltan credenciales, remitente verificado, SMTP Auth y programación. Nunca se afirma entrega sin verificación.

## Evidencia y límites

Última ejecución completa: 77 pruebas aprobadas, incluyendo sesión revocada, caché aislada y protección del gateway. Las pruebas SQL locales usan PostgreSQL WASM; se distinguen de la validación remota en SUPABASE_VALIDACION.md.

Aprobados contra Supabase remoto: login con JWT real, creación/aislamiento de organizaciones, revocación inmediata, permisos de empleados, concurrencia por profesional y recurso compartido, idempotencia, protección de reservas ante cambios de servicio, reserva pública por RPC de servicio, gestión privada, cancelación repetida, reprogramación, panel/informes/preferencias/auditoría/exportación y Realtime aislado. El navegador creó una reserva real de prueba. El recorrido real de la función Edge también aprobó: origen, desafío, concurrencia, idempotencia, gestión privada, reprogramación y cancelación repetida. Se corrigió y comprobó la IP del gateway sin registrar IP en claro.

SQLite y respaldos originales conservados: 3 usuarios, 2 negocios, 4 profesionales, 4 servicios, 9 clientes y 9 reservas originales por ID; integridad correcta. La producción no importó la demo. Los fixtures temporales de la segunda ejecución remota siguen pendientes de limpieza autorizada. Las credenciales y sus manifiestos permanecen en data/cloud-private, ignorado por Git.

## Publicación y pendientes

https://atry-agency.github.io/ATRY-Turnos/ mantiene la demostración sin operaciones. El nuevo workflow puede compilar el adaptador Supabase, el worker de protección y los recursos bajo /ATRY-Turnos/. CLOUD_BACKEND_VALIDATED sigue en 0 hasta finalizar la validación. Solo se distribuyen URL y clave pública; nunca claves de servidor ni datos locales.

Para terminar: completar pruebas Edge/navegador, confirmar correo y recuperación, cerrar las comprobaciones de invitaciones/espera, limpiar fixtures, aplicar 023 y preparar el correo externo real, verificar CI y activar la publicación conectada. Todavía no se declara listo para uso comercial ni se presentan integraciones pendientes como exitosas.

La ruta /ATRY-Turnos/validacion/ está preparada para el recorrido del navegador con Supabase real, identificada como validación con datos temporales. La raíz mantiene el bloqueo de demostración. Esta ruta de QA se retira al activar producción y limpiar los fixtures.
