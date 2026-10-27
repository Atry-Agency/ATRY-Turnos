# IAtry V3: candidato operativo y presentación compartida

27 de octubre de 2026. Rama local `codex/iatry-v3-operations`. No publicado.

## Límites efectivos

El frontend normal conserva cinco lecturas para el propietario de Pelu y ninguna escritura. El motor entiende otras solicitudes y permite aclararlas; eso no concede permisos de ejecución. Las dos incompatibilidades siguen bloqueadas. No se modificaron esquema, RPC, RLS, usuarios ni configuración de Supabase.

El ensayo privado de loopback permite exclusivamente el grupo autorizado el 27 de octubre: crear un servicio de 15 minutos a $0, cambiarlo a $1, cambiar su duración a 20 minutos, ocultarlo; crear una ficha ficticia y editar sus notas. Valores exactos y orden fijados en el gate privado. No hay acceso a reservas, funciones públicas ni Edge Functions. Cada operación requiere confirmación, respuesta y relectura. El gate detiene el ensayo ante incertidumbre y rechaza repeticiones. Nunca se incluye en el artefacto público.

Antes del ensayo, una transacción READ ONLY confirmó: cero servicios y clientes con los identificadores del nuevo ensayo; cero recurrencias con su correo; dos reservas y dos notificaciones existentes. La sesión normal del propietario debe estar iniciada en la vista privada. El primer grupo autorizado se completó: seis respuestas exitosas y seis relecturas desde la sesión normal, el adaptador cloud y las RPC existentes. El servicio `47795a12-8db3-4f13-8028-6038f2f6363f` quedó oculto, a $1 y con duración de 20 minutos, sin profesionales. La ficha `6efabc66-3afc-4a6c-ad16-cf3d2341ac6b` conserva el correo ficticio autorizado, teléfono vacío y marketing desactivado; sus notas quedaron actualizadas. El gate en memoria terminó cerrado y el código de la vista privada vuelve a denegar nuevas escrituras por defecto. La auditoría posterior READ ONLY confirmó dos reservas y dos notificaciones (sin incremento), cero trabajos de correo creados desde el inicio del ensayo y cero recurrencias. Cada relectura comprobó además que los otros registros del catálogo afectado permanecieran idénticos. Hubo un fallo transitorio de lectura de opciones antes de escribir; tras repetir solo esa lectura se completó el flujo, sin reintentar escrituras.

El segundo grupo autorizado también se completó: un único bloqueo `8c6e0de2-fb71-4175-ab30-cd17007822c9`, para el profesional aprobado, el 16/11/2026 de 13:00 a 14:00 de Uruguay. Se comprobó previamente ausencia de conflictos incluyendo buffers y recurrencias. La miniagenda pasó de propuesta a período verificado después de la relectura real. No se habilitan otros bloqueos. La comprobación posterior confirmó dos reservas, dos notificaciones y cero trabajos de correo nuevos desde el inicio del grupo anterior.

## Presentación

`OperationCard`, `OperationPreview` y `ConfirmationReply` son componentes compartidos entre landing y aplicación. No consultan datos ni ejecutan acciones. El motor les entrega los hechos autorizados. Las propuestas diferencian servicios, clientes, reservas y períodos de agenda. Las fichas finales se construyen a partir de la relectura, sin rellenar campos faltantes con los ejemplos de la landing.

La esfera oficial y su control de movimiento ya eran compartidos. El éxito visual de una escritura exige `confirmed_readback`; una respuesta HTTP por sí sola no lo activa. Se conservan el panel, el bloqueo del fondo móvil, foco, preferencias y animaciones aprobadas. Esta es una integración inicial de los componentes, no la homologación completa de todas las representaciones ni operaciones.

## Evidencia local de esta fase

- Compilación TypeScript/Vite correcta.
- Suite React y seguridad: correcta, sin tráfico real.
- Gate finito: seis escrituras simuladas localmente con relecturas; valores distintos, repetición y cambio de sesión rechazados.
- Chrome/WebKit: descubrimiento, consultas simuladas y permisos en móvil/escritorio correctos.
- Chrome/WebKit móvil: aislamiento táctil, foco, alturas compactas, rotación, minimizar, cierre y navegación correctos. Se corrigió una carrera del test: ahora espera el cambio asíncrono de `aria-modal` al rotar.
- PostgreSQL local con adaptador cloud: 12 capacidades priorizadas pasan; dos incompatibles bloqueadas; cuatro verificaciones de seguridad pasan. Esto NO es validación de Supabase real.

## Pendientes

Otros descansos, ausencias y reservas requieren autorización específica adicional. Las reservas tienen efectos potenciales en notificaciones, correo y lista de espera; no se ensayan hasta garantizar destinatarios ficticios y el contrato de efectos. Se aisló la causa de horarios especiales: con `#variable_conflict use_variable`, `ON CONFLICT(staff_id,day)` entra en conflicto con la variable PL/pgSQL `day` y falla con SQLSTATE 42P10 aunque exista la restricción única. En PostgreSQL temporal, sustituir solo ese destino por `ON CONFLICT ON CONSTRAINT schedule_exceptions_staff_id_day_key` hace pasar la operación. No se cambió la función real ni se habilitó la capacidad; cualquier arreglo de RPC productivo requiere autorización aparte. La lista de espera no admite marcar `booked` con su RPC de edición: necesita el flujo real de aceptación de oferta. Descuentos/promociones quedan pendientes de un contrato existente comprobado.

## Comparación con la landing y siguiente habilitación

La landing conserva datos ficticios y sus transiciones de demostración. La aplicación comparte los componentes de ficha, intervalo y confirmación; sus estados proceden del motor y sus valores finales de Supabase. No copia datos comerciales ficticios hacia el negocio real. Las conversaciones operativas siguen preguntando y confirmando los campos necesarios; no se presentan como una transcripción libre de un modelo generativo.

Para ampliar la habilitación: (1) cerrar cada grupo con evidencia de respuesta y relectura; (2) homologar sus casos límite y concurrencia, roles y planes; (3) definir una lista de capacidades y campos permitidos para el piloto del propietario de Pelu; (4) aprobar ese candidato de publicación; (5) ampliar a otros negocios solo tras validar sus sesiones y aislamiento. No hay una activación masiva de 66 capacidades. El próximo grupo de reservas requiere confirmar en la función real el bloqueo de destinatarios `.invalid` y la ausencia de solicitudes de espera que puedan generar ofertas; no se cambia ninguna configuración global.

La prueba local de Servicios dio mediana V3 26,3 ms frente a V2 18,8 ms, dos solicitudes de ruta en ambos casos y cero consultas adicionales al abrir IAtry. Es una medición SQLite/Chrome local, no una medida de latencia de Supabase.

## Recuperación

La versión publicada se conserva en `a0e3e79f715988cca22ce87182a24fa1add437cd`, con etiqueta local `rollback/pre-iatry-understanding-2026-10-27`. El workflow existente permite `source_ref` con ese SHA para reconstruir y publicar la versión anterior. No se ha solicitado ni ejecutado publicación de este candidato.

## Cierre de la etapa — 27/10/2026

Por solicitud del usuario se suspendieron los ensayos reales de reservas. El único intento se detuvo en la comprobación previa de disponibilidad: la Edge Function rechazó el origen localhost antes de escribir. La lectura posterior confirmó cero filas de preferencias creadas y cero reservas del ensayo. No se ejecutó ninguna de las cinco escrituras propuestas. La ventana temporal se cerró y la entrada privada de reservas vuelve a `authorized=false`. No se requieren operaciones compensatorias. No continuar estos ensayos sin una nueva misión autorizada.

El candidato consolida `33b7371` y los cambios posteriores: verificación de preferencias, protección del ensayo de reservas, respuestas basadas en relectura y ajuste de fechas/representaciones compartidas. Estos contratos experimentales permanecen fuera del artefacto público. Las cinco consultas productivas siguen restringidas al propietario de Pelu. Todas las escrituras productivas permanecen bloqueadas, incluso las siete capacidades con un caso real controlado exitoso. Interpretar, preguntar y preparar información no concede autorización para ejecutar.

Publicable como evolución conversacional y visual restringida; no como activación general de operaciones V3. La publicación requiere confirmación final del usuario. El rollback sigue siendo el SHA y la etiqueta indicados arriba.

Validación final del cierre: TypeScript/Vite y suite React completas; interpretación y conversaciones con SQLite local en Chrome/WebKit; descubrimiento restringido, roles denegados y ausencia de solicitudes en reposo; protección táctil y foco móvil; landing compartida en 320/390/1440 px con movimiento reducido. Todas correctas. El empaquetado público pasó su control: cinco lecturas, cero escrituras, proyecto correcto, sin módulos privados ni credenciales privadas y sin solicitudes a Supabase durante la comprobación. No se repitieron ensayos reales.
