# Notificaciones — Misión 002

mail_jobs persiste contenido, destinatario, deduplicación, estado, intentos y próxima ejecución. Ingiere notificaciones/outbox y agenda recordatorios; respeta preferencias. Reprogramar invalida recordatorios anteriores y se omiten enlaces vencidos/revocados.

Configurar variables de .env.example en entorno, no se carga .env automáticamente:

- MAIL_PROVIDER: local, smtp o disabled. Desarrollo usa local y producción disabled por defecto.
- MAIL_LOCAL_DIR: data/mail por defecto; proveedor local prohibido en producción.
- MAIL_WORKER=0: desactiva worker incorporado; ejecutar npm run mail-worker con misma base/configuración.
- MAIL_INTERVAL_MS: intervalo incorporado, 5000 por defecto.
- PUBLIC_URL: URL correcta para enlaces absolutos.
- MAIL_FROM y SMTP_HOST: obligatorios para SMTP.
- SMTP_PORT: 587 por defecto; SMTP_SECURE=1 para TLS inicial, normalmente 465.
- SMTP_USER/SMTP_PASSWORD: autenticación del proveedor.
- SMTP_REQUIRE_TLS: requerido salvo 0 en desarrollo; producción siempre exige TLS y valida certificados.

Estados: queued pendiente, sending reclamado, retry reintento, failed cinco intentos agotados, skipped omitido, stored_local archivo EML generado, smtp_accepted aceptado por SMTP. Aceptación no acredita entrega o lectura.

Reclamación transaccional con concesión de 60 segundos; hasta 20 trabajos/ciclo; reintentos exponenciales desde 30 segundos y máximo una hora. Disabled conserva pendientes. Dos workers probados para evitar reclamaciones simultáneas.

Deduplicación interna no garantiza exactamente una vez externamente: caída después de aceptar SMTP y antes de registrar estado puede duplicar entrega. Message-ID estable no obliga al receptor a deduplicar. Archivo local determinista por trabajo.

Vista local restringida a destinatario o negocio autorizado; recuperación solo al destinatario. No se sirve la carpeta estáticamente. Faltan retención/limpieza y políticas de almacenamiento para producción. No guardar secretos en repositorio.

Pruebas: EML real, preferencias, recordatorios, caducidad, escape, reintentos, dos workers, disabled y SMTP TCP de ensayo. No se enviaron correos externos. Faltan SPF/DKIM/DMARC y rebotes/webhooks.

Nodemailer 10.1.0, licencia suministrada en docs/licenses/. Documentación oficial: https://nodemailer.com/smtp y https://nodemailer.com/message.
