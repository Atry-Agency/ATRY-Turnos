# Misión 002 — informe de entrega

14 de octubre de 2026, versión 1.2.0. Núcleo de las fases A–G integrado y verificado localmente; las ampliaciones pendientes se declaran explícitamente.

## 1. Funciones nuevas

A: cuentas sin negocio, varios espacios y selector, perfil, contraseña, listado/revocación de sesiones. Invitaciones de 48 horas y uso único para cuenta nueva o existente, roles y revocación inmediata; protección del último propietario. Empleados operan las reservas de su profesional vinculado.

B: cola persistente, worker integrado o separado, correo HTML/texto Atry, archivos EML locales y SMTP. Preferencias, recordatorios, avisos al negocio, reintentos y estados. Tokens vencidos/revocados y recordatorios desactualizados se omiten.

C: agenda día/semana/mes completo de 42 celdas, navegación, filtros, búsqueda, detalle rápido y SSE entre sesiones. Formularios abiertos conservan sus campos y anuncian cambios pendientes. Respuestas antiguas no sobrescriben otra ruta o negocio.

D: descansos, excepciones por fecha, feriados/cierres y recursos compartidos exclusivos. Motor con preparación/limpieza. Reglas que invalidan reservas futuras se revierten; recursos se asignan transaccionalmente.

E: reprogramación pública con horarios reales, conservación de contacto al explorar disponibilidad, idempotencia de reservas/ofertas y cancelación repetida segura. SmartSlots sigue basado en reglas. El worker vence ofertas de espera.

F: Insights desde reservas, estados, servicios, recurrencia, demanda y series diarias/semanales/mensuales. Valores de servicios separados de cobros. Planes con límites/funciones aplicados en backend, diagnóstico, incidencias sencillas y auditoría administrativa.

## 2. Funciones preservadas

Acceso, configuración inicial, servicios/equipo, horarios/ausencias, clientes/historial, reservas manuales/públicas, enlaces privados, SmartSlots, espera, exportación, administración y preparación PWA. Paleta azul/cian, logos originales, navegación y componentes de Misión 001 conservados.

Verificación contra backup-mision002.sqlite: todos los IDs originales conservados (3 usuarios, 2 negocios, 4 profesionales, 4 servicios, 9 clientes, 9 reservas). Integridad SQLite: ok. Sigue disponible el respaldo Misión 001. Restauración ensayada en una copia separada. Pruebas en bases aisladas.

## 3. Cambios técnicos

SPA JavaScript, API Node.js y SQLite WAL conservados. Migración aditiva versión 2: invitaciones, preferencias/cola, reglas, recursos, idempotencia, planes, errores e incidencias. Módulos de cuentas, comunicaciones, worker, SSE, disponibilidad y operaciones; features.js y management.js en frontend. Índices, triggers de recursos, transacciones y caché PWA v3.

Nodemailer 10.1.0 fijado en lockfile; licencia suministrada en docs/licenses/nodemailer-LICENSE.txt. PostgreSQL se documenta como opción futura, sin migración.

## 4. Pruebas

npm test: 32 aprobadas, 0 fallidas, incluidas las 13 anteriores. Cobertura: aislamiento multiempresa, cuentas/invitaciones/roles/sesiones, persistencia, reservas/solapamientos/cancelación/reprogramación/ofertas, reglas y rollback, recursos concurrentes, idempotencia, correo EML, SMTP con servidor TCP de ensayo, preferencias/caducidad/escape, reintentos, dos workers, SSE/revocación, planes, estadísticas e incidencias.

npm audit --omit=dev: 0 vulnerabilidades reportadas. Sintaxis JavaScript revisada. Integridad y conservación de IDs verificadas. No es prueba de carga ni auditoría externa.

## 5. Verificación visual

Escritorio: agenda y mes de 42 celdas, accesos, disponibilidad, correo y administración. Dos pestañas y base aislada: reserva nueva apareció en otra sesión; reprogramación conservó el texto de un formulario abierto y mostró aviso. Correo EML local generado. Administración mostró proveedor real e integridad.

Móvil 390 × 844: agenda sin desbordamiento horizontal. Capturas en docs/screenshots/. Verificación manual en navegador; falta suite automatizada completa y dispositivos físicos.

## 6. Seguridad

Tokens de invitación con hash, vencimiento, uso único y revocación; cuenta existente debe coincidir con email invitado. Cambio de contraseña revoca sesiones; cambio de email exige contraseña actual. Pertenencia/roles y recursos del mismo negocio controlados. SSE revalida acceso y no expone contactos. Planes validados en backend. HTML escapado y SMTP con TLS obligatorio en producción. Errores registrados como códigos seguros. Avisos al negocio no incluyen token privado del cliente. Carpeta de correo no se publica.

## 7. Correcciones

Duplicados por reintentos, avisos repetidos de reprogramación sin cambio, pérdida de rol al guardar negocio, refrescos que sobrescribían formularios, carreras al cambiar ruta, reglas que invalidaban turnos, recordatorios desactualizados y descripción obsoleta del proveedor. Activos/service worker versionados.

## 8. Pendientes

Entrega SMTP externa y rebotes, WhatsApp, Mercado Pago/suscripciones, verificación genérica de email/MFA, retención de correo/tokens/idempotencia, recursos de mayor capacidad o alternativos, espera por preferencias/todos los huecos, arrastre en calendario, múltiples zonas, mesa de ayuda completa, navegador automatizado y dispositivos físicos.

Ocupación: jornada actual menos descansos/cierres frente a duración reservada en últimos 30 días. No descuenta ausencias por fecha ni reconstruye horarios históricos; metodología visible. Valores de servicios completados/futuros no acreditan cobros; pagos verificados ausentes.

## 9. Riesgos de producción

SQLite de una instancia, límite de intentos en memoria y SSE mediante consulta periódica; faltan carga y coordinación multiinstancia. EML y enlaces privados requieren protección/retención. Caída tras aceptación SMTP antes de confirmar estado puede duplicar entrega: no se garantiza exactamente una vez fuera del sistema. Faltan dominio/SPF/DKIM/DMARC, rebotes, monitoreo, privacidad y recuperación operativa. API SQLite de Node experimental. Cuentas demo bloquean producción.

## 10. Siguiente misión

Consolidar operación/seguridad: proveedor SMTP real y rebotes, verificación email/MFA, retención/restauración, navegador/carga, auditoría de permisos y ocupación con historial. Después abordar cobros verificables con webhooks e idempotencia en misión específica. No se publicó, no se modificaron otros proyectos ni se eliminaron datos originales.
