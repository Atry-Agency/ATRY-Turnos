# IAtry · primera etapa operativa

Estado vigente y matriz de habilitación: [CIERRE.md](CIERRE.md). Lo que sigue conserva el historial de evidencia y sus alcances originales.

Rama `codex/iatry-v3-phase-one-operations`. Base publicada y rollback: `5a5aaa4868366eb51afcb181c6b0cc49d7c0e1ce`. Sin publicación ni cambios de infraestructura en Supabase. El ensayo real adicional autorizado el 28/10 se detalla al final.

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

## Cierre incremental — 28/10/2026

Se auditó el proyecto real exclusivamente con transacciones `BEGIN READ ONLY`/`ROLLBACK`, consultando `pg_proc`, sin invocar RPC de negocio. Las nueve RPC de esta etapa tienen EXECUTE para authenticated, no para anon y son SECURITY DEFINER. Las huellas normalizadas de sus definiciones coinciden con el repositorio probado; las diferencias de hash sin normalizar eran de espacios/saltos de línea. `CONTRATOS-REALES.json` conserva las huellas, no datos ni credenciales. Esto no certifica todas las dependencias transitivas, triggers, Auth ni una sesión real de cada rol/plan.

La inspección real confirma autorización owner/manager en servicios, reglas y semana; selección del negocio mediante membresía; `search_path` vacío; semana verifica suscripción activa, profesional del negocio, tramos válidos y reservas futuras. Consultar reglas/catálogo no materializa reservas. Estadísticas y funciones de recursos usan las restricciones existentes de características. No se cambiaron esos contratos.

Validación adicional focalizada: `npm run test:iatry-phase-one-contacts` compara nueve huellas y prueba en PostgreSQL temporal la propagación de nombre/correo/teléfono a recurrencias coincidentes, aislamiento del otro negocio, preservación de contactos al editar solo notas, rechazo atómico de contacto duplicado y cero correos/notificaciones. La propagación es un efecto REAL del contrato: una futura habilitación de contactos debe explicarlo en la propuesta y comprobarlo, no presentarlo como una edición sin efectos secundarios. No se habilita todavía.

Se reutilizan los 114 resultados anteriores; no se repitió la batería completa ni auditorías generales. La compilación actual y el test de límites de la primera etapa pasan. El código de producción mantiene cinco lecturas acotadas y cero escrituras; esta consolidación no concede permisos nuevos.

### Brechas concretas

- Propietario/Pelu/Negocio: siete precedentes reales acotados; falta nombre/descripción/activación, semana con descansos y ausencias de día completo/multidía. El nuevo grupo de tres cambios del servicio existente fue autorizado el 28/10; requiere sesión normal en la vista privada antes de ejecutarse.
- Contactos: pendiente ensayo normal real y propuesta/verificación explícita de recurrencias afectadas. La edición de notas ya tiene evidencia real.
- Encargado: falta una sesión real ya existente y autorizada. Empleado: no se concede escritura administrativa; falta comprobar rechazos reales con su propia sesión.
- Individual y Pro: faltan sesiones existentes autorizadas y comprobación real de sus límites/aislamiento. No se crean cuentas ni se cambian planes para obtenerlas.
- Generalización a todos los negocios: bloqueada hasta cerrar esas evidencias. Las nueve RPC coincidentes reducen incertidumbre de contratos, pero no convierten las pruebas locales en homologación general.

### Publicación futura

1. Aprobar el alcance preciso; no basta aprobar el diseño para habilitar operaciones.
2. Verificar `origin/main`, publicar/verificar la etiqueta de rollback ya indicada y ejecutar compilación + control del artefacto (debe declarar exactamente las capacidades autorizadas).
3. Publicar el único candidato mediante el workflow Pages existente. No ejecutar migraciones ni tocar Supabase.
4. Comprobar dominio y consultas autorizadas sin escrituras automáticas adicionales.
5. Ante regresión grave, ejecutar el mismo workflow con `source_ref=rollback/pre-iatry-phase-one-2026-10-28` (SHA `5a5aaa4868366eb51afcb181c6b0cc49d7c0e1ce`). No usar force push ni revertir datos.


### Ensayo real autorizado completado

Propietario de Pelu, plan Negocio; adaptador cloud y motor IAtry desde vista privada local. Servicio ficticio existente `47795a12-8db3-4f13-8028-6038f2f6363f`. Se ejecutaron exactamente tres PATCH: nombre/descripción, activación, ocultación. Las tres RPC respondieron `{id: "47795a12-8db3-4f13-8028-6038f2f6363f"}` y cada cambio se verificó mediante relectura fresca del catálogo. Estado final: «IAtry · Servicio homologado 2026-10-28», descripción «Ensayo controlado de nombre y descripción», activo 0, duración 20, precio 1, seña/buffers 0, profesionales vacíos. Otros servicios comparados sin cambios.

Incidencia previa: el gate temporal rechazó antes de transportar la solicitud porque el editor conserva también los campos sin cambios. Se corrigió solo el gate para admitir esos valores exactos y verificar sus precondiciones. No hubo escritura rechazada en Supabase ni repetición de una escritura incierta. El catálogo confirmó el estado original antes de volver a preparar la operación. La selección de los nombres largos del ensayo pidió elegir explícitamente el servicio; no inventó identificadores.

El ensayo terminó en `done`, se detuvo su servidor y el gate queda denegado por defecto para futuras ejecuciones. No se crearon reservas ni se invocaron rutas de notificaciones/envíos. No se alteraron políticas, funciones, migraciones ni configuración. Nueve capacidades tienen ahora precedentes reales acotados (se añaden services.details y services.publish); no son permisos productivos.

**Matriz actual de habilitación:** propietario y encargado: 16 herramientas locales en Individual y 17 en Negocio/Pro; empleado: 0 en este alcance administrativo. En producción permanecen cinco lecturas solo propietario/Pelu y cero escrituras. Servicios cuenta con los seis precedentes reales; clientes conserva creación/notas, no homologación general de contactos; bloqueos conserva una hora, no homologación de vacaciones; semana y nuevos roles/planes pendientes. La matriz JSON distingue evidencia de habilitación.

Compilación, prueba de límites por rol/plan, nueve huellas RPC, regresiones de contactos y gate finito pasan. El artefacto revisado contiene 119 assets, proyecto correcto, cinco lecturas y cero escrituras; no contiene las vistas privadas del ensayo. Se conserva la evidencia de los 114 casos previos sin repetirlos. No se modificó la interfaz aprobada.
