> ENSAYO SUSPENDIDO por el usuario el 27/10/2026. Ninguna de las cinco escrituras fue ejecutada. Se conserva este procedimiento únicamente como referencia histórica; la autorización temporal está cerrada en el código y no debe reutilizarse.

# Propuesta: un ciclo de reserva, sin envíos reales

Preparado localmente y autorizado expresamente el 27/10/2026. Aún pendiente de ejecución. Proyecto `djoxdtloqwbrhgtgencc`, Pelu `374cd00d-3e37-497f-9292-9bb959c1ef88`, sesión normal del propietario.

## Cinco escrituras propuestas

1. Crear la fila de preferencias de Pelu (hoy no existe; se aplican valores por defecto), conservando confirmaciones, cancelaciones, reprogramaciones, recordatorios y lista de espera en 1, anticipación en 24 horas, y poniendo solo `business_alerts=0` durante el ensayo.
2. Crear una reserva manual el 17/11/2026 de 13:00 a 13:30 de Uruguay, con Rodrigo (`35c53427-98ad-4f28-b0c1-c5cc5f82ae14`), Corte de pelo (`1fe6557f-1067-4818-9f05-b1d93ebfbce1`, $500, 30 minutos), y la ficha ficticia ya aprobada (`6efabc66-3afc-4a6c-ad16-cf3d2341ac6b`, correo `.invalid`, sin teléfono). Notas: `IAtry · Reserva controlada 2026-10-27`. El precio es un registro; no se procesa ningún cobro.
3. Reprogramar únicamente esa reserva a las 14:00–14:30 del mismo día, conservando servicio, profesional, cliente y precio.
4. Cancelar esa misma reserva y conservarla como registro cancelado.
5. Restaurar `business_alerts=1`, sin cambiar las otras preferencias. La fila explícita de preferencias quedará creada con los mismos valores efectivos originales.

## Efectos y controles

Las reservas generan auditoría, revisión de calendario y registros internos de notificaciones/correo. El procesador real tiene el filtro de dominios reservados `.invalid`; sus trabajos deben quedar omitidos, sin entrega ni intento al proveedor. Las alertas al correo real del negocio deben estar apagadas y verificadas antes de reservar. No se abre WhatsApp y el contacto no tiene teléfono. No se modifica el correo del negocio ni se toca la configuración global de envíos.

La auditoría READ ONLY confirmó: alertas del negocio activas, correo del negocio no reservado, cero solicitudes de espera activas, cero recurrencias y cero recordatorios mutables de reservas futuras. El guard comprueba nuevamente los dos horarios, ausencia de recurrencias/lista de espera, precio/duración/asignación/contacto, preferencias y relecturas. Una condición distinta aborta el ensayo. Antes de las escrituras de preferencias se repite también la auditoría de recordatorios para evitar que esa RPC reprograme trabajos de otra reserva.

Ante fallo, las únicas recuperaciones permitidas son cancelar la reserva de este ensayo (si existe y conserva sus datos aprobados) y restaurar los avisos de Pelu. No hay reintento automático de creación. No se modifican las dos reservas existentes ni los demás negocios. No se publican cambios.

## Preparación y evidencia local

- Adaptador cloud y RPC existentes: seis contratos relacionados pasan en PostgreSQL temporal, más cuatro verificaciones de seguridad.
- Guard finito: cinco escrituras simuladas y relecturas; cierre/repetición/sesión/valores/espera/recurrencias comprobados; restauración tras fallo antes de crear comprobada; sin red.
- Vista privada `iatry-reservation-validation.tsx` preparada y compilada; concesión en `false`. No forma parte del artefacto público.
