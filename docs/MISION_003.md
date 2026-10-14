# Misión 003 — estado real

14 de octubre de 2026. En curso. El usuario eligió continuar con el repositorio Atry-Agency/ATRY-Turnos y Supabase, y publicar mediante GitHub Pages. Cloudflare quedó pausado: no se creó proyecto Pages ni widget, ni se contrató ningún servicio.

## Infraestructura e implementación

Supabase exclusivo: ATRY-Turnos, referencia djoxdtloqwbrhgtgencc. Migraciones 001–023 aplicadas; los lotes 007–014 y 015–022 tienen hashes privados auditados. RLS habilitado en todas las tablas públicas y privadas. La migración 023 permite el enlace de correo de GitHub Pages y conserva los permisos exclusivos del servidor. ATRY LAB Operaciones y los otros repositorios permanecen intactos.

SDK oficial Supabase Auth con PKCE, confirmación, recuperación, perfil/correo/contraseña y sesiones. Adaptador para los módulos existentes de agenda, reservas, equipo y permisos, invitaciones, clientes, servicios, disponibilidad, recursos, espera, SmartSlots, informes y administración. Realtime autentica el websocket con el JWT y revisa periódicamente el acceso. La sesión revocada no bloquea futuros intentos de login.

atry-public y atry-mail desplegadas. La función pública usa origen autorizado, límites y, en el modo seleccionado, desafío firmado de duración limitada; no requiere proveedor CAPTCHA externo. No prueba que el visitante sea humano. El modo Turnstile queda como opción de código, sin credenciales configuradas. Referencias: https://github.com/paulmillr/noble-hashes y https://supabase.com/docs/guides/functions/examples/cloudflare-turnstile (formato de la IP reenviada por el gateway).

Auth tiene guardada la URL principal de GitHub Pages y nueve retornos exactos de signup/recovery/email_change, en la raíz de GitHub, su ruta de validación y localhost:3301. Registro, recepción del correo, confirmación y retorno a Mi cuenta verificados con la cuenta real autorizada. Recuperación real completada por el usuario: nueva contraseña, cierre global de sesiones e ingreso posterior comprobado en Mi cuenta. Mínimo de contraseña del servidor alineado a 10 caracteres. El worker de Brevo mantiene autenticación de servidor y envíos deshabilitados; faltan credenciales, remitente verificado, SMTP Auth y programación. Nunca se afirma entrega sin verificación.

## Evidencia y límites

Última ejecución completa: 77 pruebas aprobadas, incluyendo sesión revocada, caché aislada y protección del gateway. Las pruebas SQL locales usan PostgreSQL WASM; se distinguen de la validación remota en SUPABASE_VALIDACION.md.

Aprobados contra Supabase remoto: login con JWT real, creación/aislamiento de organizaciones, revocación inmediata, permisos de empleados, concurrencia por profesional y recurso compartido, idempotencia, protección de reservas ante cambios de servicio, reserva pública por RPC de servicio, gestión privada, cancelación repetida, reprogramación, panel/informes/preferencias/auditoría/exportación y Realtime aislado. El navegador creó una reserva real desde GitHub Pages, la reprogramó a las 11:00 y comprobó su cancelación en Supabase. Invitaciones y aceptación idempotente de ofertas de espera también aprobaron en remoto. El recorrido real de la función Edge también aprobó: origen, desafío, concurrencia, idempotencia, gestión privada, reprogramación y cancelación repetida. Se corrigió y comprobó la IP del gateway sin registrar IP en claro.

SQLite y respaldos originales conservados: 3 usuarios, 2 negocios, 4 profesionales, 4 servicios, 9 clientes y 9 reservas originales por ID; integridad correcta. La producción no importó la demo. La segunda ejecución se limpió con autorización puntual: cero perfiles, negocios y reservas de prueba; tres identidades Auth retiradas. Auth conserva únicamente la cuenta real autorizada, con correo confirmado e inicio de sesión registrado. Las credenciales y sus manifiestos permanecen en data/cloud-private, ignorado por Git.

## Publicación y pendientes

https://atry-agency.github.io/ATRY-Turnos/ sirve la aplicación real conectada a Supabase. CLOUD_BACKEND_VALIDATED=1 y CLOUD_INTEGRATION_QA=0. CI y Pages aprobaron el commit 38c2485. La cuenta real se abrió y consultó en la raíz publicada; el acceso a 390 px no desborda horizontalmente. La ruta temporal /validacion/ dejó de formar parte del artefacto.

Auditoría remota final: Auth 1 cuenta, perfiles 1, negocios 0, reservas 0, clientes 0, mail_jobs 0, tablas públicas/privadas sin RLS 0. Ledger 007–023: 17 registros. mail_enabled=false. La cuenta real no tiene negocios ficticios ni se le asignó administración global.

El SMTP propio sigue desactivado. El proveedor de prueba de Supabase entrega solo a miembros del equipo y tiene un cupo reducido; antes de incorporar negocios externos se necesita SMTP propio (https://supabase.com/docs/guides/auth/auth-smtp). La prueba con la cuenta autorizada no certifica altas externas. Brevo continúa sin credenciales ni remitente verificado; faltan validación de envíos y programación del worker. El worker deberá redeplegarse desde el código actual antes de habilitarlo, para incluir la URL de GitHub permitida. No se declara terminada la preparación comercial del correo.

Solo se distribuyen URL y clave pública de Supabase. SQLite y respaldos originales siguen íntegros. Cloudflare permanece pausado por la elección posterior del usuario de trabajar en GitHub y Supabase.
