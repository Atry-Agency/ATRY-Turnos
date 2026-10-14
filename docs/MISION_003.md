# Misión 003 — estado de implementación, corte de avance

Fecha: 14 de octubre de 2026. Esta misión todavía está en curso. La aplicación local conserva el backend Node/SQLite 1.2.0; **no está migrada ni publicada**. Este documento distingue código probado de servicios habilitados.

## GitHub

Repositorio privado creado y primer código subido: https://github.com/Atry-Agency/ATRY-Turnos. GitHub identifica Atry-Agency como cuenta de usuario, no organización. Se mantiene el namespace solicitado. Inspección previa confirmó que el repositorio no existía. No se tocó otro repositorio. .gitignore excluye data, bases, EML, secretos, configuraciones locales, temporales y capturas históricas; las capturas quedan disponibles localmente. Workflow de verificación preparado.

## Supabase

Sesión de Chrome autenticada. La organización LABORATORIO DE ATRY muestra plan Free y un proyecto ATRY LAB Operaciones. Se inspeccionó únicamente la lista/cupo: **ese proyecto no fue modificado**. El formulario de un proyecto independiente ATRY-Turnos quedó preparado con RLS automático y exposición automática de tablas desactivada. Falta que el usuario cree/guarde la contraseña y complete el formulario; la política del control de navegador requiere intervención del usuario para crear credenciales.

No se dispone todavía de referencia del proyecto nuevo ni de conexión autorizada para aplicar migraciones. No se afirma que exista producción limpia: **todavía no hay una base de producción creada/verificada**.

## Código implementado y probado

Seis migraciones PostgreSQL: modelo sin credenciales heredadas/semillas, RLS y permisos explícitos, integridad multinegocio, exclusión GiST de rangos para profesionales/recursos, RPC transaccionales de reservas manuales/reprogramación/cancelación con idempotencia, cuota/worker de correo y tabla de revisiones para Realtime sin contactos. Tabla de usuarios conserva ID de aplicación y agrega correspondencia explícita a auth.users. Las altas no heredan una cuenta existente por coincidir el email.

Pruebas ejecutadas con PGlite (PostgreSQL WASM local), no con una instancia Supabase remota. Verifican tablas vacías y RLS, permisos entre negocios/empleados, escrituras directas denegadas, reserva/recursos/idempotencia/cambios, permisos de worker, presupuesto y confirmación del proveedor. Falta prueba nativa multiconexión y la integración completa de servicios Supabase.

Transportador HTTP Brevo implementado y probado con respuestas controladas: requiere messageId para registrar aceptación, maneja 429 y bloquea destinatarios de documentación. No se enviaron mensajes externos. Edge Function de worker preparada, desactivada por defecto; invocable solo con la credencial de servicio del servidor y presupuesto transaccional de 200 intentos/día, reservando margen para Auth dentro de los 300 del proveedor. No está desplegada ni programada; falta integrar ingestión, preferencias, plantillas/recordatorios/caducidad y recibos/webhooks con la paridad del worker actual.

Build Pages preparado con rechazo de claves privilegiadas y bloqueo si no se ha validado el backend/adaptador completo. Archivo de configuración Pages y rutas SPA preparados. No hay despliegue ni URL pages.dev. No se configuró una cuenta Cloudflare ni Brevo. No se compraron servicios.

## Migración segura de información

Respaldo consistente previo a cambios: data/backup-1791951345056.sqlite. También se conservan los respaldos de misiones anteriores. export-migration.js requiere lista explícita de negocios reales, rechaza la demo, conserva IDs/relaciones y produce manifiesto con conteos/checksum dentro de data (ignorado por Git). No exporta hashes de contraseña, sesiones, recuperación, correo, invitaciones o respuestas con tokens. Las ofertas pendientes requieren reemisión. No se ejecutó una importación remota ni se afirma integridad tras una migración inexistente.

Antes del corte: crear identidades Supabase con verificación/restablecimiento, vincular de forma controlada auth_user_id a cada ID legado, validar pertenencias/empleados, importar en transacción a base nueva, comparar conteos/IDs/relaciones/reservas y ensayar reversión. No copiar scrypt a Supabase Auth ni trasladar sesiones existentes. Los enlaces privados anteriores requieren estrategia y validación explícita antes del corte.

## Demo normalizada

Seed y pruebas utilizan Negocio Prueba 1, Usuario Prueba 1, Administrador Prueba, Empleado 1–3, Servicio 1–4 y Cliente 1–9, slug negocio-prueba-1 y correos example.com. Los IDs internos se conservan. normalize-demo.js solo cambia la demo antigua si coincide propietario/nombre/slug/contraseña conocida; profesionales, servicios y clientes también deben coincidir con datos seed conocidos. Los registros inciertos quedan intactos. Se marcaron registros demo y se omiten envíos pendientes de esa demo. No se eliminaron reservas ni historial.

Comprobación de base actual respecto al respaldo Misión 002: 3 usuarios, 2 negocios, 4 profesionales, 4 servicios, 9 clientes y 9 reservas originales conservados por ID; integrity_check ok. No se renombró el segundo negocio ni usuarios legítimos/no identificados. Seed prohíbe producción; inicio bloquea cuentas demo conocidas. Producción debe comenzar nueva y sin importar la demo.

## Pruebas y límites

42 pruebas aprobadas, 0 fallidas: se mantienen las 32 y se agregan 10 para PostgreSQL, migración, Brevo y configuración. Medición de 200 reservas en docs/measurements/postgres-local.json; interpretación en CONSUMO_003.md. No es una prueba de carga cloud. Falta validar Auth, Realtime remoto, scheduler, RLS con JWT reales, errores/red y recorridos completos móvil/escritorio contra la arquitectura nueva.

## Trabajo pendiente para terminar A–I

Crear proyecto independiente; aplicar/lintar migraciones y pruebas contra Supabase; completar RPC de cuentas/membresías/invitaciones, CRUD de reglas con rollback, reservas públicas protegidas/gestión privada/espera/SmartSlots, Insights y administración; adaptar todas las llamadas de frontend y Auth; comprobar recuperación/migración y sesiones; integrar Realtime y notificaciones completas; configurar Brevo/remitente/SMTP Auth/scheduler; habilitar Cloudflare Git solo para este repositorio y desplegar pruebas después de equivalencia; verificar cuotas externas y carga real. Las operaciones SQL actuales **no sustituyen aún la API completa** y no deben activarse como backend comercial.

Riesgos que impiden vender: migración/cutover incompletos, integraciones externas no configuradas ni probadas, ausencia de concurrencia remota/carga, recuperación operativa y retención pendientes. La incidencia anunciada por Supabase podría afectar aprovisionamiento. No se presenta ninguna integración simulada como real.
