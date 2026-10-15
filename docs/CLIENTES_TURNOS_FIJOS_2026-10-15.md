# Clientes, turnos fijos e identidad del negocio

Estado: implementado y validado localmente. Las migraciones 026 y 027 **todavía no se aplicaron en Supabase** y esta versión **no se publicó**. El control de la pestaña de Chrome no responde; actualizar la página no recuperó la conexión. No confundir las pruebas locales con una verificación en producción.

## Recorridos disponibles

- Clientes: buscar por nombre, correo o teléfono; la búsqueda telefónica ignora espacios y guiones. Alta manual con un contacto válido, edición de ficha, notas, consentimiento e historial. Las tarjetas se adaptan al ancho disponible.
- Asignar turno desde una ficha: precarga el contacto y envía su ID. El servidor comprueba que pertenece al negocio y que el contacto sigue vigente. Reservar no sobrescribe implícitamente la ficha.
- Crear turno fijo desde Clientes o Turnos fijos: una, dos o cuatro semanas, con fecha final opcional. Cambiar una repetición conserva el historial; terminarla libera sus fechas pendientes. Una cancelación o reprogramación individual conserva las siguientes fechas.
- La regla de repetición bloquea disponibilidad incluso más allá de las reservas materializadas. Se generan inicialmente 42 días; Agenda y el proceso de recordatorios completan las fechas necesarias. Los cambios de disponibilidad posteriores pueden generar una advertencia que debe resolver el negocio. No se promete una reserva confirmada cuando la materialización falla.
- Alta de negocio por pasos: opciones de rubro y texto libre. El rubro se conserva en los metadatos de registro y se aplica después de confirmar el correo. Los metadatos no otorgan roles. Menú y tarjetas de servicios usan iconos según rubro y nombre del servicio, con alternativa genérica. Animaciones respetan la preferencia de movimiento reducido.

## Contactos y límites

Correo y teléfono que coinciden con fichas distintas producen un error; no se fusionan personas automáticamente. Los teléfonos se comparan por sus dígitos; no se infiere automáticamente la equivalencia entre prefijos internacionales y locales. La lista devuelve como máximo 100 coincidencias: una búsqueda más específica permite encontrar otros contactos.

Los turnos ya creados en Supabase conservan sus datos de contacto originales; modificar una ficha no reenvía notificaciones anteriores. Las futuras fechas de una repetición que todavía no se generaron usan el contacto actualizado. No hay envío masivo de confirmaciones al crear una repetición.

## Evidencia

- `npm test`: 86/86 pruebas, sin omisiones. PostgreSQL ejecutado con PGlite y todas las migraciones, no contra Supabase remoto en esta entrega.
- Cobertura de recurrencias: bloqueo indefinido, conflictos de profesional y recursos, idempotencia, cancelación individual, cambios atómicos, fin de repetición y aislamiento por negocio/rol.
- Cobertura de CRM: alta y edición, búsqueda de teléfono formateado, duplicados, vinculación de reserva por ID y denegación de operaciones ajenas.
- Cobertura de registro: rubro personalizado después de confirmar correo, finalización idempotente y rechazo de privilegios incluidos en metadatos.
- Navegador local: alta de Cliente Prueba 10, búsqueda por teléfono sin espacios, reserva manual y repetición semanal reutilizando su ficha. Registro: opción personalizada y navegación de pasos. Vista de Clientes revisada a 390 px, sin desborde horizontal.
- Compilación de interfaz Supabase correcta en `dist/qa-026-027` (ignorado).
- SQLite original leído sin cambios: 3 usuarios, 2 negocios, 4 profesionales, 4 servicios, 9 clientes y 9 reservas. Pruebas de navegador en `data/qa-recurring-20261015.sqlite`, independiente.

## Publicación pendiente

1. Recuperar el control de Chrome de Atry. Usar únicamente el proyecto `djoxdtloqwbrhgtgencc`.
2. Ejecutar `node scripts/prepare-recurring-migration.js`. Genera los lotes transaccionales `tmp/recurring-migration.sql` y `tmp/identity-migration.sql`, sin semillas. Cada lote verifica la migración anterior y registra SHA-256. La autorización explícita de 026 ya está registrada.
3. Aplicar 026, verificar resultado, luego 027; esta última conserva las firmas y permisos existentes, sin nuevos GRANT. Comprobar ledger, RLS y permisos en Supabase y ejecutar pruebas con rollback.
4. Publicar la interfaz después de validar el backend remoto. No enviar esta versión a `main` antes: el despliegue de Pages se ejecuta automáticamente al modificar archivos web/cloud.
5. Verificar recorridos reales y cron de recordatorios; no dejar usuarios ni negocios ficticios en producción.
