# Candidato operativo · evolución determinista de IAtry

Base visual y descubrimiento: `b1b21d7`. Versión pública que se conserva como recuperación: `58e7c992340c7955f63bae9441de2f40842cdd05`. Sin publicación, migraciones, cambios de permisos ni escrituras reales nuevas.

## Qué está implementado

- Catálogo lingüístico extensible separado de capacidades, autorización, transporte y presentación. Reconoce sinónimos y expresiones como «agregame», «bloqueame», «no trabajo», «faltó al turno», fechas relativas y horarios.
- Extrae nombre, precio y duración de servicios; contactos explícitos; nombres de registros como referencias y fechas de Uruguay. Propone datos en los campos existentes: no salta preguntas ni confirmaciones. Las referencias solo se resuelven contra opciones autorizadas; si hay varias coincidencias pide elegir y muestra identificadores parciales para distinguirlas.
- Resuelve hoy/mañana/pasado mañana, días de la semana y próxima semana. No supone hora de almuerzo ni fecha de regreso de vacaciones. Pregunta AM/PM para «de una a dos» o «hasta las ocho». Las propuestas de día completo se explican y revisan antes de confirmar.
- Distingue ausencia de cliente y ausencia de profesional. Descanso, almuerzo y vacaciones usan el bloqueo temporal existente; horarios especiales conservan la capacidad existente y su bloqueo para Supabase.
- Planes compuestos de hasta tres acciones explícitas. Consulta primero las reservas afectadas antes de proponer vacaciones cuando se piden ambas cosas. No agrega cancelaciones. Cada paso se prepara por separado; cada escritura exige su vista previa y confirmación. Ante error o resultado incierto se detiene y conserva completados/pendientes. No reejecuta pasos completados ni hace compensaciones implícitas.
- Estado del plan en el motor de sesión: sobrevive a la actualización del panel y se elimina al abandonar/cambiar el contexto. No guarda instrucciones ni datos personales en almacenamiento persistente.
- Servicios y clientes, reservas y bloqueos temporales verifican el guardado con lectura posterior en los entornos habilitados. El resultado distingue espera, verificación, confirmación y resultado incierto. Una relectura fallida después de guardar, incluso por sesión vencida, no se anuncia como fallo sin efectos ni como éxito confirmado.
- Todas las capacidades anteriores siguen en el buscador/explorador autorizado. Se conservaron las tres sugerencias inmediatas, preferencias, guías, borradores, emblema, energía, colores y hoja móvil protegida.

La demo pública del producto muestra solo las cinco consultas; las escrituras del asistente tampoco se habilitan allí. Los formularios manuales de la demo conservan su simulación. El catálogo operativo completo se prueba en el backend local aislado.

Se agregaron dos consultas que reutilizan contratos existentes: buscar disponibilidad (`bookings.availability`) y listar reservas afectadas por un período de hasta 31 días (`bookings.affected`). No se agregó ninguna función de backend. El catálogo tiene 70 tareas: las 68 anteriores más esas dos; 68 pasan con PostgreSQL del repositorio y dos permanecen bloqueadas.

## Alcance real y bloqueos

- Las cinco lecturas ya verificadas y publicadas siguen siendo el único alcance operativo habilitado en conexión real: catálogo de servicios, profesionales, búsqueda de clientes, historial e indicadores. Solo propietario de Pelu, plan Negocio y proyecto `djoxdtloqwbrhgtgencc`.
- La evidencia anterior de cinco escrituras controladas se conserva: tres operaciones sobre un servicio y dos sobre una ficha de prueba. No habilita escrituras generales. No se repitieron ni se amplió aquella autorización.
- Las dos incompatibles siguen bloqueadas para cloud: `schedule.exception` (homologar diferencia de esquema local/real) y `waitlist.booked` (transición no admitida por el RPC directo).
- Las otras operaciones no homologadas siguen bloqueadas, incluidas las dos consultas nuevas. Consultar reservas o dashboard puede materializar recurrencias. Crear/cambiar reservas puede preparar correos y ofertas: no se desactivaron procesos productivos ni se intentaron pruebas reales de esas acciones.
- Compatibilidad local no equivale a validación real de roles, planes, concurrencia ni Edge Functions desplegadas. Se necesitan sesiones y escenarios autorizados antes de ampliar el piloto.

## Validación

Pruebas de los ejemplos solicitados, cinco preguntas publicadas, fechas de Uruguay, referencias, nombres ambiguos, órdenes desconocidas/destructivas, permisos y ausencia de ejecución durante interpretación. Recorridos de Chrome y WebKit contra SQLite temporal: creación de servicio por instrucción con confirmación y relectura; plan de vacaciones y reservas afectadas tanto exitoso como con conflicto simulado; completados/errores conservados y ninguna cancelación implícita. Regresión funcional de clientes, servicios, reservas, reprogramaciones, cancelaciones y borradores. PostgreSQL temporal: 68 correctas, dos bloqueadas y cuatro grupos de seguridad. Pruebas integradas: 32 React, 10 grupos V2 y 19 de seguridad V3.

Las pruebas no enviaron correos/WhatsApp ni accedieron a producción. La única lectura real de esta fase fue contrastar los planes comerciales. No se generaron capturas, videos ni PDF.

## Cómo probar

En el servidor local con SQLite temporal, abrir `/local-assistant`, abrir IAtry y escribir una instrucción; presionar la flecha para interpretarla. Ejemplos: «Mañana descanso de una a dos», «Agregame un servicio de barba de 20 minutos a $400», «Subí el precio del corte a $650» o «Bloqueame las vacaciones y mostrame las reservas afectadas». Elegir aclaraciones, preparar cada paso, revisar y confirmar. Son datos locales desechables, sin Supabase.

## Límites y publicación

El intérprete tiene un vocabulario acotado; no es un modelo generativo ni comprensión ilimitada. Las variantes no reconocidas piden aclaración o una tarea concreta. Las órdenes compuestas con ambigüedades múltiples pueden necesitar descomponerse. No hay transacciones distribuidas entre pasos ni rollback automático de acciones confirmadas.

Puede evaluarse publicar descubrimiento e interpretación manteniendo exclusivamente las cinco lecturas del piloto. No se recomienda anunciar ni habilitar la operación completa en negocios reales antes de homologar escrituras, efectos de correo, otros roles/planes y verificación final en dispositivo físico. La publicación requiere autorización nueva. Recuperación: workflow Pages con `source_ref=58e7c992340c7955f63bae9441de2f40842cdd05`.

Rendimiento local de esta evolución: Servicios V3 mediana 20,7 ms frente a V2 23,9 ms, cinco contextos alternados por versión; dos consultas de ruta en ambas y cero consultas adicionales al abrir IAtry. JavaScript en reposo: mediana 0 ms. No es latencia de Supabase. La demostración pública no expone las escrituras experimentales; la aplicación de pruebas local sí conserva el catálogo completo.

La consulta de reservas afectadas incluye el margen de días y los tiempos de preparación/posteriores para no omitir un turno que cruza medianoche o cuyo buffer entra en el período. El servidor conserva la comprobación definitiva de conflictos. Las órdenes desconocidas ofrecen hasta tres alternativas realmente autorizadas, sin simular comprensión.
