# Clientes, turnos fijos e identidad del negocio

Estado: implementado y validado localmente y en Supabase ATRY-Turnos (`djoxdtloqwbrhgtgencc`). Migraciones 026 y 027 aplicadas y sus hashes verificados el 15/10/2026. Conexión de Chrome recuperada mediante una pestaña vigente del proyecto; publicación de interfaz en curso.

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

- `npm test`: 86/86 pruebas, sin omisiones. PostgreSQL ejecutado con PGlite y todas las migraciones; además se ejecutó la prueba nativa reproducible descrita debajo.
- Cobertura de recurrencias: bloqueo indefinido, conflictos de profesional y recursos, idempotencia, cancelación individual, cambios atómicos, fin de repetición y aislamiento por negocio/rol.
- Cobertura de CRM: alta y edición, búsqueda de teléfono formateado, duplicados, vinculación de reserva por ID y denegación de operaciones ajenas.
- Cobertura de registro: rubro personalizado después de confirmar correo, finalización idempotente y rechazo de privilegios incluidos en metadatos.
- Navegador local: alta de Cliente Prueba 10, búsqueda por teléfono sin espacios, reserva manual y repetición semanal reutilizando su ficha. Registro: opción personalizada y navegación de pasos. Vista de Clientes revisada a 390 px, sin desborde horizontal.
- Compilación de interfaz Supabase correcta en `dist/qa-026-027` (ignorado).
- SQLite original leído sin cambios: 3 usuarios, 2 negocios, 4 profesionales, 4 servicios, 9 clientes y 9 reservas. Pruebas de navegador en `data/qa-recurring-20261015.sqlite`, independiente.

## Verificación nativa

Se ejecutó en el editor SQL del proyecto correcto la prueba transaccional reproducible `supabase/operations/verify-recurring-crm.sql`. Pasaron alta de contacto, búsqueda normalizada, rechazo de duplicados, creación de seis fechas, idempotencia, bloqueo a diez años, cancelación y reprogramación individuales que liberan solo su horario, aislamiento entre dos negocios, restricciones del empleado y alta con rubro personalizado sin privilegios de metadatos. El rollback dejó cero cuentas y negocios de prueba.

La comprobación inicial de largo plazo construía el timestamp sin agrupar la suma de fecha y hora antes de aplicar AT TIME ZONE. En una sesión UTC consultaba otra hora. Se corrigió la consulta de prueba; no fue necesario modificar la función aplicada.

Auditoría posterior: 1 usuario real, 0 negocios, clientes, reservas y reglas; RLS activo en todas las tablas públicas. Creación anónima y acceso autenticado al generador privado denegados. Cron `atry-turnos-mail` activo cada dos minutos. No se simularon envíos ni se enviaron mensajes desde los fixtures.

Hashes del ledger:

- 026: `f5987caf2af8eefc6e2887e52160bd027ff14892483415c3e1bcc8d3fe251a99`.
- 027: `f6e67347d3f2f025085ea2177f93d39f4fc66c8242c581b0140be35d3925d2a7`.

## Publicación

La rama de trabajo y el PR conservan la implementación. Fusionar y publicar únicamente después de la verificación nativa anterior (completada). Después comprobar que Pages entrega el nuevo registro y los módulos, y que la cuenta real puede iniciar su negocio. La auditoría no creó un negocio comercial ficticio ni requirió conocer la contraseña del usuario.
