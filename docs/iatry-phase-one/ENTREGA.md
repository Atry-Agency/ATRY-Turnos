# IAtry · primera etapa operativa

Rama `codex/iatry-v3-phase-one-operations`. Base publicada y rollback: `5a5aaa4868366eb51afcb181c6b0cc49d7c0e1ce`. Sin publicación ni cambios en Supabase. No se ejecutaron ensayos reales nuevos.

## Versión local

`http://127.0.0.1:3344/local-assistant` inicia una sesión ficticia normal sobre SQLite temporal. No requiere credenciales reales. Correos deshabilitados; no usa Supabase. Reutiliza React, AppPort, los contratos del servidor existente y el panel premium. Al reiniciar se descartan los registros locales.

Inicio reproducible: `npm run build`, luego `ATRY_PHASE_ONE=1 ATRY_V3_PORT=3344 node scripts/react/iatry-v3-preview.cjs`. El perfil solo es accesible con backend local en loopback. No se puede activar mediante parámetros URL ni preferencias. El paquete público no contiene ese runtime de prueba.

La validación independiente de RPC utiliza `npm run test:iatry-phase-one`: PostgreSQL/PGlite en memoria con las migraciones del repositorio, Auth ficticio y el adaptador cloud original. No son pruebas contra el Supabase desplegado.

## Matriz de esta etapa

Las marcas indican ejecución LOCAL comprobada. No equivalen a habilitación productiva.

| Capacidades | Propietario I/N/P | Encargado I/N/P | Empleado | Evidencia real previa |
|---|---|---|---|---|
| Crear servicio, precio, duración, ocultar | Sí/Sí/Sí | Sí/Sí/Sí | Bloqueado | Casos controlados de propietario/Pelu/Negocio |
| Nombre y descripción; activar servicio | Sí/Sí/Sí | Sí/Sí/Sí | Bloqueado | Falta ensayo real de esos cambios |
| Crear y editar clientes | Sí/Sí/Sí | Sí/Sí/Sí | Bloqueado | Creación y edición de notas; no toda edición de contacto |
| Catálogo, búsqueda e historial; equipo | Sí/Sí/Sí | Sí/Sí/Sí | Bloqueado | Solo propietario/Pelu/Negocio |
| Horarios semanales y pausas | Sí/Sí/Sí | Sí/Sí/Sí | Bloqueado | Falta escritura semanal real |
| Descanso, bloqueo, ausencia, vacaciones | Sí/Sí/Sí | Sí/Sí/Sí | Bloqueado | Un bloqueo horario real, no todos los períodos |
| Consultar horarios y bloqueos | Sí/Sí/Sí | Sí/Sí/Sí | Bloqueado | RPC auditada; falta validación funcional real |
| Indicadores | No/Sí/Sí | No/Sí/Sí | Bloqueado | Solo propietario/Pelu/Negocio |

17 herramientas del catálogo: 10 de escritura y 7 de lectura. Descansos, días libres y vacaciones comparten el contrato `schedule.absence`, no se cuentan como capacidades artificialmente distintas. Individual mantiene un profesional; Negocio cuatro; Pro diez. IAtry no amplía permisos de empleado: el contrato semanal/CRM exige propietario o encargado. La matriz completa del catálogo está en `MATRIZ.json`; las funciones fuera de esta etapa no se habilitan en el perfil local acotado.

## Cambios y pruebas

- Relectura fresca que compara identidad, negocio, campos y asignaciones. Una respuesta positiva con registro ausente, ajeno o valores distintos queda incierta; no se anuncia éxito ni se reintenta automáticamente.
- Horarios semanales: compara todos los tramos efectivos y representa el resultado a partir de la relectura. Mantiene la comprobación de concurrencia y las protecciones de reservas del servidor.
- Nueva consulta de bloqueos mediante `/time-off` → RPC de reglas/catálogo; no consulta reservas ni materializa recurrencias.
- Confirmación individual y un único comando ante doble clic; token consumido y sesión/rol/negocio inválidos denegados. No se añadieron RPC, otro backend ni dependencias.
- Comprobación de interfaz local: crear servicio ficticio, confirmar, persistir y mostrar la ficha solo tras relectura. En viewport 390×844, panel dentro de pantalla, fondo aislado y sin desbordamiento. No es una prueba con un iPhone físico.
- El cliente nuevo solicita correo o teléfono antes de preparar; la corrección del nombre de un servicio no se confunde con el registro que hay que seleccionar.
- Corregidas la interpretación de «lunes» dentro de la semana y la extracción del nombre cuando se solicita editar el nombre de un servicio.
- 114 resultados PostgreSQL por capacidad/rol/plan: 112 correctos y 2 denegaciones esperadas de estadísticas en Individual. Incluye activar un servicio previamente inactivo y ausencias horarias/de día completo/multidía.
- Siete grupos de seguridad de PostgreSQL: seis combinaciones propietario/encargado × plan, más SELECT RLS y escritura directa. Empleado, negocio ajeno, asignación ajena y sobrecupo rechazados por el servidor; EXECUTE privado para authenticated y denegado a anon. No hubo nuevas notificaciones ni trabajos de correo en la base temporal.
- Suite React conserva conversación, personalidad, memoria, permisos productivos, confirmaciones, incertidumbre y aislamiento. No se hacen consultas al interpretar ni envíos externos en las pruebas.

## Evidencia y límites productivos

Se reutilizan `docs/iatry-operations/ESTADO.md`, `docs/iatry-v3/RESULTADO-SERVICIOS-REAL.md` y `docs/iatry-v3/VALIDACION-PROGRESIVA.md`. Siete capacidades cuentan con precedentes reales acotados: services.create/price/duration/hide, customers.create/update y schedule.absence. Su alcance fue propietario de Pelu, plan Negocio y registros/valores expresamente autorizados. No se reutilizaron autorizaciones antiguas para ejecutar nuevos cambios.

El candidato público conserva exactamente cinco lecturas, solo propietario de Pelu, y CERO escrituras. La ampliación general a otros negocios, roles y planes sigue bloqueada: las sesiones reales correspondientes no se probaron. Las lecturas generales tampoco se liberan por pasar pruebas locales.

Antes de activar un piloto de escritura hay que aprobar expresamente capacidades, alcance y campos. Lo primero proponible son las siete capacidades con evidencia previa en su alcance comprobado; no se presenta esa evidencia como validación de cualquier valor, contacto o asignación. Nombre/descripcion, activar, semana y nuevas consultas necesitan su ensayo real específico. Crear/editar contacto puede propagarse a recurrencias coincidentes; requiere homologación independiente de esos casos. El bloqueo real previo fue de una hora: no homologa automáticamente vacaciones multidía.

Reservas, cancelaciones, agenda/dashboard que expanden recurrencias, notificaciones, correos, lista de espera y procesos comerciales permanecen fuera de esta etapa. `schedule.exception` y `waitlist.booked` conservan sus incompatibilidades. Descuentos/promociones no tienen un contrato homologado.

Las RPC actuales de catálogo/clientes/bloqueos no aportan una clave idempotente general de creación. Se evita doble ejecución dentro de la conversación y no hay reintento después de incertidumbre; no se promete deduplicación entre recargas o dispositivos.

## Rollback

Etiqueta local `rollback/pre-iatry-phase-one-2026-10-28` → `5a5aaa4`. Para recuperar tras una publicación futura: GitHub Actions → Publicar interfaz Atry Turnos → Run workflow → `source_ref=rollback/pre-iatry-phase-one-2026-10-28`. Publicar/verificar la etiqueta antes de desplegar; en esta misión no se hizo push. La recuperación no cambia Supabase.

Veredicto: candidato funcional local para esta etapa y base preparada para homologación progresiva. No está homologada la habilitación general de escrituras para todos los negocios. Publicar este candidato tal cual conserva los bloqueos vigentes; una activación operativa necesita la aprobación final del alcance y la evidencia faltante, no una activación masiva.
