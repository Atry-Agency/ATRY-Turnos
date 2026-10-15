# Pulido de interfaz · 15/10/2026

- Acceso vigente: indicador compacto y desplegable con plan y vencimiento. Cierra al pulsar fuera o Escape. El enlace lleva directamente a Compartir y suscripción. Los estados pendientes, vencidos y suspendidos conservan su aviso visible.
- Móvil: menú cerrado oculto y sin sombra lateral; se conservan apertura, cierre y fondo para cerrar al tocar fuera.
- Identidad: selector de logo con vista previa, nombre del archivo y validación previa de tipo/tamaño. Color con muestra, código y paleta de sugerencias; mantiene el selector nativo accesible.
- Reserva: confirmación y gestión con una tarjeta común, servicio, profesional, fecha, hora de Uruguay y precio en cian. El valor no se presenta como pago recibido. El enlace privado queda detrás de un desplegable y puede copiarse. La confirmación vuelve al principio de la pantalla.
- Administración: contadores que filtran, búsqueda y estados, tarjetas de negocios, accesos a habilitación y tres secciones: Negocios, Planes y Operación. Continúan disponibles capacidades de planes, mensajes, errores, auditoría e incidencias.
- Ingreso y registro: composición navy con tipografía liviana, frase Tu oficio / Tu estilo / Tu espacio, logo animado con anillos y respeto a movimiento reducido. Se quita Volver al inicio en el acceso que ya funciona como inicio. Los iconos de rubro tienen trazos livianos y color.

Validación: 88 pruebas automatizadas aprobadas, compilación web correcta y recorridos reales en navegador contra SQLite aislado. Se verificaron ingreso, Configuración, guardado del color, estado desplegable, menú móvil sin sombra/desbordamiento, reserva pública confirmada y formulario de reprogramación. Revisión visual de ingreso, configuración, administrador y recibo. SQLite original conserva sus 3 usuarios, 2 negocios, 4 profesionales, 4 servicios, 9 clientes y 9 reservas. Sin cambios de esquema, permisos ni datos de Supabase.
