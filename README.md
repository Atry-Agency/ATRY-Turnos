# Atry Turnos — versión 1.2.0

Node.js 22.13+: ejecutar `npm install`, luego `npm start`.
Abrir http://localhost:3300/?v=3#/app/agenda.

Demo negocio: usuario1@example.com / AtryDemo2026!
Demo administración: admin.prueba@example.com / AtryAdmin2026!
Las cuentas demo impiden iniciar en producción.

JavaScript/HTML/CSS, Node.js, SQLite WAL y Nodemailer 10.1.0. Se conserva la base data/atry-turnos.sqlite y la identidad Atry.

Misión 002 incorpora cuentas sin negocio, varios espacios, invitaciones/roles/sesiones, agenda diaria/semanal/mensual y SSE, descansos/excepciones/cierres/recursos, idempotencia, correo local/SMTP, Insights, planes y diagnóstico.

Ejecutar `npm test` (32 pruebas aisladas), `npm audit --omit=dev`, `npm run backup -- data/backup-nuevo.sqlite` y `node scripts/verify-data.js data/backup-mision002.sqlite`. No borrar data/.

Las variables de .env.example se configuran en el entorno: no se carga .env automáticamente. El worker corre dentro del servidor; para separarlo, configurar MAIL_WORKER=0 y ejecutar `npm run mail-worker` con la misma base y configuración.

[Informe Misión 002](docs/MISION_002.md), [correo](docs/NOTIFICACIONES.md), [preparación PostgreSQL](docs/POSTGRESQL.md), [API](docs/API.md) y [producción](docs/PRODUCCION.md).

Correo local genera archivos EML reales sin entrega externa. SMTP requiere configurar un proveedor. Sin pagos, WhatsApp ni publicación. Zona horaria America/Montevideo.
