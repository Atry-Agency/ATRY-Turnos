# Configuración concreta del entorno

Todos los valores son del nuevo staging. `environment.example` documenta nombres, no contiene credenciales y no debe cargarse entero como secretos. No copiar los valores del entorno productivo.

| Componente | Configuración y ubicación | Criterio |
|---|---|---|
| Proyecto/API | Dashboard → Project Settings/Connect: ref, PG, región y URL. API expone solo public; no private, vault, net | Identidad del destino distinta del productivo; conservar resultado sin secretos |
| Frontend | PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY publishable, PUBLIC_TURNSTILE_SITE_KEY. CLOUD_BACKEND_VALIDATED/REGIONAL_BACKEND_VALIDATED/PA_RELEASE_APPROVED cerrados inicialmente | Runtime separado; no service_role/DB password en browser; header regional1 |
| Auth | Authentication → URL Configuration: Site URL igual al origen staging; Redirect URLs exactas de los artefactos anterior/nuevo, sin comodines globales. Email confirmations activadas | Registro verificado y recuperación por flujo normal; PKCE. El config.toml local no configura hosted |
| Auth SMTP | Authentication → Email/SMTP: cuenta de ensayo separada o proveedor con inbox de prueba controlado y permiso de envío | El proveedor integrado limita destinatarios y envíos; no basta @example.invalid para verificar correo real. No copiar SMTP de producción |
| CAPTCHA Auth | Revisar si está activado en el proyecto destino y si el frontend envía captchaToken en Auth; no suponer que PUBLIC_TURNSTILE configura GoTrue | Este frontend no aporta captchaToken a signUp: habilitar el CAPTCHA de Auth exige integración específica antes del ensayo correspondiente, sin desactivarlo si es requisito del destino |
| atry-public | Edge secrets PUBLIC_URL=origen staging, PUBLIC_ABUSE_PROTECTION=turnstile, TURNSTILE_SECRET_KEY exclusivo. SUPABASE_URL y SERVICE_ROLE_KEY del runtime staging | verify_jwt=false es deliberado: protección propia CORS/CAPTCHA/proof/rate. POST body, no bearer links en query |
| atry-mail | MAIL_DELIVERY_ENABLED=0 inicial; MAIL_INVOKE_KEY exclusivo cuando se autorice; BREVO_API_KEY/SENDER_EMAIL/SENDER_VERIFIED ausentes o cerrados | verify_jwt=true y secreto de invocación exacto. Un secreto opaco arbitrario no cumple por sí solo verify_jwt: el token de invocación debe ser compatible con el gateway del proyecto; verificar ambas capas antes de programar el worker. Probar ambas capas sin desactivarlas; distinguir rechazo JWT de rechazo interno |
| atry-mail-events | BREVO_EVENTS_ENABLED=0 inicial; BREVO_EVENTS_TOKEN exclusivo y ≥32 caracteres solo tras autorizar webhook de prueba | verify_jwt=false, autenticación propia bearer. No reutilizar webhook ni secret productivos |
| Storage | Las migraciones crean bucket privado staff-photos, webp ≤65536 bytes, políticas de lectura/escritura y fences restrictivas | No crear un bucket público alternativo. Lectura anónima solo foto marcada pública según RPC y personal activo |
| Realtime | Database → Replication/Realtime: supabase_realtime incluye calendar_revisions | No publicar reservas/contactos completos; eventos solo de revisiones autorizadas. Verificar dos sockets con JWT reales y logout |
| Correo SQL | private.runtime_settings mail_enabled=false por defecto; atry_configure_delivery tras autorización | Worker deshabilitado; no crear cron/pg_net/vault ni replicar job productivo automáticamente |
| Planes/PA | Flags privados pa_registration_enabled=false y pa_public_enabled=false; catálogo pagado PA vacío | Solo abrir staging con alcance aprobado. Sin renovar/cobrar PA ni alterar catálogo UY |

## Origen staging y limitación encontrada

El gateway público permite el origen exacto de PUBLIC_URL; no admite comodines. Los contratos de correo `atry_configure_delivery` y mail-worker aceptan `https://<nombre>.pages.dev` o la URL GitHub histórica. Por eso se propone un sitio **staging separado** pages.dev si después se autoriza crearlo, sin dominio propio ni reemplazar el hosting existente. Otra opción es servir el frontend local para Auth/RPC/gateway público y dejar correo operativo pendiente: localhost no satisface el contrato de correo. No introducir un hostname de producción para superar el rechazo. Crear alojamiento también requiere autorización; comprobar el plan/costo antes.

## Turnstile

Las claves dummy son útiles para widget y errores, pero el gateway comprueba hostname, action y cdata. Cloudflare indica probar esas comprobaciones con un widget/secret real dedicado al hostname staging. No modificar el servidor para aceptar tokens dummy como evidencia de seguridad. El widget staging se crea solo después de autorización, sin añadir producción ni dominios comodín. Probar expiración/replay, hostname ajeno y cambio de idempotency_key. Fuente: [Cloudflare testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## Correo: tres niveles que no deben confundirse

1. Cola/RPC/fechas: con delivery deshabilitado, verificar snapshots, ingestión y deduplicación en staging; esto no homologa Brevo.
2. Auth SMTP: buzones reales exclusivamente de ensayo, confirmaciones/recuperación permitidas y receptor controlado. No usar cuentas de clientes.
3. API Brevo: el worker actual llama directamente Brevo y **no incluye** X-Sib-Sandbox. Brevo ofrece sandbox `drop`, pero no es una variable ya conectada a este código. Por ahora delivery queda apagado. Para ensayar proveedor sin entrega se necesitaría una adaptación aislada/revisada o un ensayo separado de API; no acreditaría entrega. Para ciclo completo delivered, autorización de envío a un buzón de prueba y clave/remitente dedicados, lista exacta de destinatarios e inventario de cola antes de cada invocación. Sin destinatarios ajenos ni cron automático. Véase [Brevo sandbox](https://developers.brevo.com/docs/using-sandbox-mode).

El SMTP y API de Brevo son credenciales distintas; los costos/cuotas del proveedor de ensayo deben verificarse antes de habilitarlo. No se solicitó ni contrató otro servicio. No registrar aceptación del proveedor como entrega; timeout implica resultado incierto y requiere reconciliación.
