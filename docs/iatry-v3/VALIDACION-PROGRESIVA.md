# IAtry V3 · candidato operativo restringido

26/10/2026. Rama `codex/iatry-v3-supabase`. Sin publicación ni cambios de infraestructura. Diseño aprobado conservado; no se modificaron colores, emblema, animaciones ni distribución.

## Verificado realmente

Sesión normal del propietario de Pelu, plan Negocio, proyecto `djoxdtloqwbrhgtgencc`; adaptador cloud y RPC existentes. No se utilizaron claves administrativas en el frontend.

- Tres operaciones anteriores: crear servicio, cambiar su precio y ocultarlo. Alcance exacto y resultados en `RESULTADO-SERVICIOS-REAL.md`.
- Cinco conversaciones de lectura: `services.list`, `team.list`, `customers.search`, `customers.history`, `business.statistics`. Las cinco finalizaron en `done`, con seis solicitudes de IAtry y cero escrituras. Identidad, negocio y habilitaciones se consultaron por separado para abrir la sesión del ensayo.
- Dos nuevas operaciones autorizadas explícitamente: `customers.create` y `customers.update`, exclusivamente sobre la ficha de prueba `f55d39fa-486c-4b17-ba50-cec5860b1d60`. RPC `atry_save_customer` devolvió la ficha correcta en ambas operaciones; una nueva lectura autenticada confirmó cada resultado. Solo se cambiaron las notas en la segunda operación. Marketing desactivado y teléfono vacío. La consulta independiente del SQL Editor confirmó `customer.created` y `customer.updated`, y las notas finales «Creación y edición verificadas por IAtry».
- Conteos independientes antes → después: clientes 2 → 3; reservas 2 → 2; notificaciones 2 → 2; trabajos de correo 6 → 6; recurrencias que coinciden con la nueva ficha 0 → 0. El exportador del ensayo comparó las otras fichas antes/después y no detectó cambios. El ensayo quedó en `done` y el servidor temporal fue detenido.

La evidencia de diez capacidades no equivale a habilitación general: las cinco escrituras se probaron con datos, campos y registros estrictamente autorizados. No se habilitan para operar sobre cualquier registro.

## Auditoría real y riesgos

- RLS habilitado en clientes, reservas, servicios, profesionales y membresías. `authenticated` no tiene INSERT/UPDATE/DELETE directo sobre esas tablas.
- Las nueve RPC revisadas de catálogo, clientes, reservas, estadísticas y habilitaciones permiten EXECUTE a `authenticated`, no a `anon`; usan SECURITY DEFINER con `search_path` vacío. La autorización efectiva depende de sus verificaciones internas, también revisadas.
- Clientes/historial requieren propietario o encargado y filtran por negocio. Las reservas limitan al empleado a su profesional. Los otros roles todavía no se probaron con sesiones reales independientes.
- Planes reales: Individual 1 profesional sin estadísticas/equipo; Negocio 4, estadísticas y recurrencias; Pro 10, estadísticas avanzadas, recursos y ofertas automáticas. Sus límites se probaron localmente; no se alteraron planes reales para simularlos.
- **`atry_bookings` y `atry_dashboard` llaman `expand_recurring`.** Una operación de consulta puede escribir. Permanecen fuera de las lecturas permitidas del candidato.
- Crear reservas inserta notificaciones; actualizar estado/horario puede crearlas; `ingest_notification` puede encolar correo al cliente y alertas al negocio. Cancelar puede preparar ofertas de lista de espera. Un correo ficticio del cliente no basta para garantizar ausencia de envíos al negocio. No se probaron esas escrituras ni se desactivó ningún proceso global.
- Actualizar clientes propaga los contactos a recurrencias coincidentes. La ficha nueva autorizada no tiene coincidencias. Cambiar notas funciona, pero no homologa todas las posibles ediciones de contacto.
- `schedule.exception` sigue bloqueada: hay diferencia entre esquema local y real que requiere homologación. `waitlist.booked` sigue bloqueada: el RPC no admite esa transición directa.

## Correcciones e integración

- Motor V3 conectado al mismo AppPort/adaptador cloud; no se agregaron RPC ni cambios de reglas de negocio.
- Política compilada por capacidad, propietario y Pelu. Desconocidos, otros roles/negocios y todas las escrituras quedan denegados. Los parámetros URL y las preferencias no pueden ampliar permisos. Consultas públicas/Edge y lecturas que materializan recurrencias están bloqueadas también en el transporte del asistente.
- Límites de contacto y búsqueda de clientes alineados con Supabase: búsqueda 80 caracteres; nombre 100, correo 150, teléfono 35 y notas 700; exige correo válido o teléfono con dígitos.
- Respuestas con `business_id` ajeno se rechazan también dentro de catálogos anidados. Una escritura sin respuesta verificable queda incierta, sin anuncio de éxito ni reintento.
- Se conservan borradores, vista previa, confirmación explícita, invalidación de sesión/rol/negocio, memoria, guías y bloqueo móvil del fondo.
- El artefacto incorpora una declaración de alcance verificable. La compilación rechaza la inclusión de los ejecutores privados de ensayos reales.

## Alcance publicable y pendientes

Candidato inicial: cinco lecturas, únicamente propietario de Pelu, más ayuda contextual. Ninguna escritura nueva queda habilitada en una conexión normal. 66 capacidades compatibles con PostgreSQL del repositorio; diez tienen evidencia real acotada y 56 compatibles siguen sin validación real. Las otras dos están bloqueadas. El detalle por capacidad, rol, plan y evidencia está en `CAPACIDADES-VALIDACION-REAL.json`.

No recomiendo publicar las 66 operaciones. Antes de ampliar: homologar los demás campos de servicios/clientes; definir una prueba de reservas sin correo saliente, con autorización específica del mecanismo y registros involucrados; probar encargado/empleado con sesiones existentes autorizadas; verificar los tres planes sin modificar comercialmente negocios actuales. No se afirma validación en Safari de un iPhone físico.

## Recuperación y prueba local

Versión publicada a conservar: `1d48879164ee7059cd08171f5b124f5c36c8e44c`. El workflow Pages existente admite `source_ref`: indicar ese SHA recupera la versión visual publicada sin cambiar Supabase. Se prepara además una etiqueta local `rollback/pre-iatry-v3-operational-2026-10-26`; no se publica hasta autorización.

Para probar el candidato local: compilar y empaquetar con URL y clave pública del proyecto, fuera del repositorio; `npm --prefix frontend/react run dev` conserva la demo local. No ejecutar los servidores `*-customer-validation-preview` ni `*-service-validation-preview` para repetir escrituras: son ensayos cerrados, no una habilitación productiva. El candidato queda pendiente de aprobación; no se actualizó `main` ni se enviaron commits.

## Verificación final del candidato

- TypeScript y compilación Vite correctos; 32 pruebas React, 10 grupos V2 y 18 grupos de seguridad V3 correctos.
- PostgreSQL temporal con migraciones del repositorio y adaptador cloud: 66 recorridos correctos, dos bloqueados y cuatro grupos de aislamiento/autorización. Esto no representa ejecución remota.
- Servidor local: encargado/empleado, negocio ajeno, límite de profesionales y protección de reservas futuras correctos.
- Chrome y WebKit locales: flujos de servicio, cliente, reserva/reprogramación/cancelación, prevención de doble ejecución, borradores y aislamiento móvil correctos. Cero solicitudes a producción desde esas pruebas.
- Rendimiento local, cinco contextos alternados por versión, sin limitación artificial: Servicios mediana V3 22,1 ms frente a V2 25,6 ms; dos consultas de ruta en ambas; abrir IAtry no agregó consultas; mediana de JavaScript en reposo 0 ms. No es una medición de latencia de Supabase.
- Artefacto restringido: cinco lecturas, cero escrituras habilitadas, proyecto definitivo, sin ejecutores privados, fixtures de ensayo ni claves privadas. La comprobación del artefacto no hace solicitudes a Supabase.
- `origin/main` confirmado sin cambios en `1d48879`. Publicación pendiente de aprobación expresa.
