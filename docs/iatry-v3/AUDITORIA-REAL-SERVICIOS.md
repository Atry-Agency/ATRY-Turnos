# IAtry V3 · Auditoría real de Servicios y primera prueba propuesta

26/10/2026. Proyecto comprobado en el dashboard: `djoxdtloqwbrhgtgencc`, rama de base de datos main/production. Código en `codex/iatry-v3-supabase` (`b807e02` al comenzar). No se cambió la estética, la experiencia móvil, el frontend publicado ni sus configuraciones.

## Alcance y método

Se ejecutaron exclusivamente consultas SELECT al catálogo PostgreSQL y conteos de registros, dentro de `BEGIN READ ONLY` / `ROLLBACK`, mediante el SQL Editor autenticado. Se leyeron definiciones de funciones, sin invocar las funciones de negocio ni procesar las colas. El editor guardó un borrador privado de la consulta; no se guardaron funciones, políticas o migraciones. No se exportaron filas con contactos, credenciales ni contenido de reservas.

Esta auditoría cubre los permisos de los 34 RPC de la matriz anterior y la cadena SQL de Servicios. No certifica funcionalmente las otras capacidades, los proveedores de entrega, todas las Edge Functions ni todas las reglas de negocio.

## Resultados reales

- Los 34 RPC privados esperados existen con sus firmas: `authenticated` tiene EXECUTE y `anon` no. Son SECURITY DEFINER con `search_path` vacío. Esto no sustituye la autorización de rol/negocio dentro de cada función.
- `atry_save_service(bid text, service_id text, payload jsonb)` exige owner o manager mediante `private.member_role`. La identidad requiere un usuario mapeado a Auth, sesión existente y vigente, antigüedad inferior a siete días y ausencia de bloqueo de usuario. La membresía se evalúa para el negocio solicitado.
- La edición exige encontrar el servicio en ese mismo negocio. Las asignaciones verifican que los profesionales pertenezcan al negocio y tienen un trigger adicional de aislamiento.
- `services` y `staff_services` tienen RLS. Las políticas SELECT se aplican a `authenticated` según membresía y visibilidad de profesionales. `anon` carece de lectura. Ni `anon` ni `authenticated` tienen INSERT/UPDATE/DELETE directos sobre esas tablas; tampoco hay concesiones INSERT/UPDATE por columnas. Las escrituras pasan por el RPC.
- `audit_log` no admite lectura ni escritura directa de esos roles; `calendar_revisions` solo permite SELECT a `authenticated` en el ámbito autorizado.
- El servidor exige nombre de 2–100 caracteres, duración de 5–1440 minutos, precio no negativo, activo 0/1, buffers de 0–1440 y seña 0–100. El formulario React aplica límites más estrechos para duración/buffers; los valores propuestos son compatibles con ambos.
- El trigger de suscripción exige acceso activo y período vigente. El de reservas futuras rechaza ocultar o cambiar duración/buffers cuando hay turnos futuros pendientes/confirmados. El cambio de precio no reescribe precios de reservas existentes.
- Cada creación/edición exitosa inserta `service.saved` en `audit_log` y aumenta `calendar_revisions.revision` para ese negocio. El calendario está en Realtime, de modo que puede provocar refrescos de otras sesiones del mismo negocio. Las operaciones son transaccionales y bloquean la fila del negocio mientras guardan.
- No existen triggers adicionales en `audit_log` o `calendar_revisions`, ni reglas de reescritura en las cuatro tablas de la cadena. Los triggers inspeccionados no realizan HTTP, ni encolan correos o WhatsApp.
- Existe un cron activo cada dos minutos relacionado con correo. Su comando no referencia Servicios, `service.saved`, auditoría o revisión de calendario, ni HTTP directamente. La función de ingestión real expande recurrencias, vence ofertas de espera y prepara invitaciones/recordatorios de reservas. No consume `service.saved`. No se ejecutó manualmente esa función ni se modificó el cron. No puede afirmarse que toda la infraestructura deje de enviar otros avisos durante una prueba: hay procesos previos ajenos al servicio de prueba.
- La proyección pública incluye servicios activos aunque no tengan profesionales asignados. Por ello el servicio de prueba **podría aparecer temporalmente en el catálogo público** entre su creación y ocultación. Sin profesionales asignados no se preparará una disponibilidad para él; no se realizarán reservas públicas durante este ensayo.
- No se encontró otro servicio llamado `IAtry · Validación controlada 2026-10-26` en ninguno de los dos negocios.

## Diferencia con PostgreSQL local

El esquema remoto SÍ contiene `UNIQUE(staff_id, day)` en `schedule_exceptions`. El fallo anterior corresponde al esquema local reconstruido; no está probado que el mismo fallo exista en producción. Se conserva el bloqueo de `schedule.exception` hasta comparar/homologar su contrato completo. `waitlist.booked` también sigue bloqueada: el RPC remoto admite únicamente `waiting` y `cancelled`. No se habilitó ninguna de las demás operaciones V3 conectadas.

## Destino de prueba: pendiente de confirmación humana

Solo existen estos dos negocios en el proyecto inspeccionado:

| Negocio | ID | Estado observado | Elegibilidad técnica |
|---|---|---|---|
| Pelu | `374cd00d-3e37-497f-9292-9bb959c1ef88` | Negocio activo, período pago vigente, propietario existente; 1 servicio, 1 profesional, 2 reservas, 2 clientes, 0 recurrencias y 6 trabajos de correo previos | Puede guardar servicios sin cambiar configuración |
| Agust | `f7c37f87-9582-4e01-939b-99fafe7aa4a6` | Pendiente, sin período vigente; 0 servicios, reservas y clientes | El servidor debe rechazar el guardado; no se habilitará ni modificará su suscripción |

La base no aporta un indicador que certifique que Pelu es ficticio. No se infiere esa condición por el nombre o el volumen de datos. **Se propone Pelu únicamente si el titular confirma que es un negocio ficticio de ATRY y que sus registros también son de prueba.** Si no lo es, no existe un destino elegible confirmado para cumplir este ensayo sin afectar otro negocio o cambiar habilitaciones. No se crearán negocios para resolverlo sin otra autorización.

## Autorización exacta solicitada, todavía no concedida

Destino condicionado: Pelu, ID `374cd00d-3e37-497f-9292-9bb959c1ef88`, proyecto `djoxdtloqwbrhgtgencc`. Sesión normal de su propietario; URL y clave pública, sin claves administrativas en el navegador.

1. Desde IAtry crear UN servicio: nombre `IAtry · Validación controlada 2026-10-26`; descripción `Prueba controlada de IAtry; sin atención al público`; duración 15 minutos; precio 0 UYU; seña 0%; buffers 0; sin profesionales ni recursos asignados. El contrato crea el servicio activo (`active=1`). Su ID lo genera Supabase y se registrará después de la respuesta; no se inventará por anticipado.
2. Desde IAtry modificar exclusivamente el precio de ESE nuevo servicio de 0 a 1 UYU, conservando todos sus demás campos y sin asignarle profesionales.
3. Desde IAtry ocultar exclusivamente ESE servicio (`active=0`). No eliminarlo físicamente. Al finalizar quedará un registro oculto, precio 1 UYU y duración 15 minutos.

Efectos esperados: un nuevo registro en `services`, tres nuevos eventos `service.saved` asociados a ese ID y tres incrementos de la revisión del calendario de Pelu (de 5 a 8 si no hay cambios concurrentes). No se crearán enlaces `staff_services`; los contratos de edición pueden ejecutar DELETE sobre las asignaciones vacías de ese servicio nuevo, sin afectar enlaces existentes. No se crearán clientes, usuarios, reservas, negocios, recursos, consentimientos ni mensajes. Los seis trabajos de correo existentes no se modificarán ni procesarán desde la prueba.

La autorización debe incluir la habilitación **solo local y temporal** de `services.create`, `services.price`, `services.hide` y las lecturas estrictamente necesarias del catálogo, para ese negocio, esa sesión y ese único servicio. El resto seguirá bloqueado. Esta preparación no ha habilitado conexiones operativas reales; no hay una bandera pública que las active actualmente. La selección del negocio nunca se tomará de la frase libre del usuario.

## Ejecución y criterios, después de recibir autorización

- Revalidar proyecto, identidad, membresía y estado del negocio. Si aparece el nombre de prueba existente o cambian las condiciones, detenerse sin modificarlo.
- Mantener el panel premium/móvil actual; preguntas, vista previa y confirmación explícita para cada uno de los tres cambios. Ejecutar a través del adaptador cloud y RPC existentes, sin un segundo backend ni SQL de escritura desde el editor.
- Fijar el ID devuelto al crear. La edición y ocultación solo pueden actuar sobre ese ID dentro del negocio aprobado. No usar el servicio previamente existente de Pelu.
- Después de cada confirmación: comprobar respuesta del RPC, releer el catálogo con caché invalidada y mostrar en IAtry los valores realmente recuperados. Verificar también la ficha/lista de Servicios y persistencia tras recarga; el resumen de los datos solicitados por sí solo no prueba persistencia.
- Comprobar un único guardado por confirmación y que ninguna solicitud vaya a otro proyecto o negocio. No repetir automáticamente una creación tras un resultado de red incierto.
- Verificar en lectura el registro final y los eventos/revisión atribuibles al nuevo servicio. Cualquier cambio concurrente se informará, sin adjudicárselo automáticamente a IAtry.
- Detener la prueba ante un error de permisos, un ID inesperado, una lectura discrepante o un efecto no previsto. Si se crea el servicio y falla un paso posterior, informar exactamente qué quedó; no ampliar el alcance ni borrar registros improvisadamente.

## Estado al cerrar esta preparación

Auditoría de Servicios completada en lectura. Prueba real NO ejecutada; ninguna creación, edición u ocultación ha sido validada todavía en Supabase mediante IAtry. Falta confirmar que Pelu es ficticio, autorizar el alcance anterior y disponer de una sesión normal en la vista experimental. Hasta entonces todas las operaciones V3 conectadas permanecen bloqueadas. Preparados para ese primer ensayo condicionado; aún no para ampliar las operaciones o publicar V3 completo.
