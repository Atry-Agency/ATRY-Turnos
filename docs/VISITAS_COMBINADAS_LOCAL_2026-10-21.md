# Visitas combinadas · implementación local

No publicada. No se aplicaron migraciones ni cambios en Supabase. La SQLite original y respaldos quedan fuera de esta ejecución; el servidor 3320 utiliza data/qa-theme-studio.sqlite.

## Alcance

El propietario puede habilitar varios servicios desde Configuración → Reglas de reserva. Se conserva el flujo de un solo servicio cuando está deshabilitado. Demos habilitadas en memoria, sin pagos, consumo comercial ni envíos; Negocio y Pro incluyen tres servicios especializados de ejemplo.

El cliente selecciona hasta seis servicios distintos y ordena su atención. La duración total máxima es ocho horas, dentro del mismo día en Uruguay. Se busca un equipo válido para cada comienzo: el motor asigna profesionales cualificados y disponibles y muestra el recorrido entero. No enumera todas las permutaciones de equipos para una misma hora. No se ofrece atención simultánea ni pausas entre servicios. Preparación, limpieza o recursos compartidos pueden hacer imposible una combinación seguida; la interfaz lo explica.

## Consistencia

Se reutiliza checkSlot para jornadas, descansos, feriados, ausencias, turnos fijos, preparación y recursos. Las colisiones internas del recorrido también se comprueban. El comienzo respeta la cuadrícula; los tramos interiores pueden comenzar fuera de ella para respetar duraciones como 35 minutos. El recorrido se vuelve a validar al confirmar, junto con precios y duración. No basta con modificar el cuerpo de la solicitud ni reutilizar una cotización vieja.

La creación es transaccional: una visita enlaza reservas reales por profesional, sin reservas parciales. Las solicitudes repetidas con la misma clave devuelven el resultado previo; reutilizar la clave con datos distintos se rechaza. La confirmación genera un único aviso agregado en la cola, cuya entrega depende del proveedor existente. No se habilitaron envíos en QA.

También se detecta si el cliente ya tiene otro turno superpuesto. Una respuesta de red incierta conserva el cuerpo y la clave de la solicitud para reintentar sin cambiar los datos.

## Gestión

Un enlace privado consulta, cancela o reprograma toda la visita. La reprogramación conserva los servicios y el orden, admite otro equipo disponible, libera/asigna dentro de una única transacción y conserva la visita original si falla. El cliente respeta el plazo de cambios. Si algún tramo terminó, los cambios completos desde el cliente se bloquean.

El propietario/encargado ve Gestionar visita completa en la agenda. La aprobación pendiente es conjunta; cada profesional puede completar su propio tramo. El negocio puede cancelar únicamente los tramos pendientes si otros ya se completaron, conservando ese historial. No se reprograman automáticamente tramos que ya terminaron. Las operaciones administrativas quedan auditadas. Los empleados no obtienen acceso al CRM ni a todas las visitas.

Las respuestas privadas públicas omiten notas internas, hashes y referencias de clientes. Las rutas administrativas requieren pertenencia al negocio. La eliminación existente del negocio utiliza su recorrido de dependencias, incluyendo los nuevos enlaces.

## Validación

Batería completa: 178 pruebas aprobadas. Ocho pruebas nuevas de visitas: profesionales distintos, continuidad, precio, recursos y preparación, horarios interiores, duplicados, atomicidad, solicitudes simultáneas HTTP, idempotencia, privacidad, aislamiento, reprogramación, cancelación, aprobación y conservación de servicios completados. La creación, reprogramación y consulta se comprobaron también desde navegador en la demo; se revisa móvil y escritorio.

## Pendiente antes de publicar

Implementar y probar las tablas/RPC equivalentes en PostgreSQL, bloqueo concurrente y exclusiones, RLS/roles, adaptador cloud, pasarela pública/protección y cola Brevo agregada. Esta versión no debe publicarse como funcionalidad cloud terminada. No se migró ni se probó esta característica contra Supabase remoto.
