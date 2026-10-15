# Publicación en GitHub Pages

Destino seleccionado por el usuario: https://atry-agency.github.io/ATRY-Turnos/ . El repositorio sigue siendo Atry-Agency/ATRY-Turnos, rama main. Cloudflare queda pausado; no se creó un proyecto Pages, widget ni servicio pago allí.

El workflow compila únicamente la interfaz y el adaptador Supabase. Mientras CLOUD_BACKEND_VALIDATED no sea 1, publica una demostración sin solicitudes operativas. La activación se completó después de comprobar Auth, recuperación, reservas públicas y limpieza de fixtures. Estado actual: CLOUD_BACKEND_VALIDATED=1 y CLOUD_INTEGRATION_QA=0; aplicación real en la raíz, sin ruta temporal de QA.

La configuración del navegador contiene únicamente la URL y clave pública del proyecto. No se publican SQLite, respaldos, archivos de correo, claves de servidor, manifiestos privados ni contraseñas. Variables del repositorio: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY y CLOUD_BACKEND_VALIDATED. PUBLIC_TURNSTILE_SITE_KEY es opcional para instalaciones que seleccionen ese proveedor; la configuración elegida usa el control integrado en Supabase.

Supabase Auth debe volver a la ruta /ATRY-Turnos/ y permitir los retornos exactos de signup, recovery y email_change. Las URL locales de prueba están limitadas al puerto 3301. Los enlaces de negocio/gestión y recursos de la interfaz respetan el subdirectorio del repositorio.

atry-public valida origen, tamaño del cuerpo, permisos de la operación y límites por IP/operación. El modo integrado añade un desafío firmado y de duración limitada, vinculado a solicitud, acción y negocio, resuelto en un worker del navegador. Eleva el costo de automatización y conserva idempotencia; no equivale a verificar que el visitante sea humano. Referencia de la implementación SHA-256: https://github.com/paulmillr/noble-hashes . Turnstile sigue como opción de código, sin claves configuradas ni cuenta creada para esta instalación.

El correo usa SMTP personalizado y API de Brevo, con remitente verificado y programación privada cada dos minutos. Se comprobó entrega real de recuperación y del mensaje integral de verificación. Aceptación y entrega se distinguen; los recibos aún no se sincronizan automáticamente. Ver CORREO_SUPABASE.md para límites, seguridad y operación. La aplicación local original y sus respaldos se conservan.
