# Agenda profesional de ATRY Turnos

La agenda conserva las consultas y las operaciones de reservas existentes. No incorpora migraciones, permisos nuevos ni proveedores de calendario. Las demostraciones siguen usando su adaptador en memoria.

## Etapas implementadas

1. Separación de la geometría del calendario: zona horaria del negocio, intervalos, recorte de fechas, superposiciones, jornadas, excepciones, descansos y ausencias.
2. Día con columnas por profesional y altura proporcional. Semana con siete días y cuadrícula horaria. Mes con recuentos y apertura de cada día.
3. Interacciones con los formularios actuales: detalle, crear desde una celda, reprogramar y cambiar estados. El servidor conserva la decisión sobre disponibilidad, recursos y permisos. Un espacio visual sin reservas no garantiza disponibilidad para cualquier servicio.
4. Adaptación para teléfono: semana con selector diario, desplazamiento horizontal contenido para equipos y mes resumido. Encabezado y eje horario permanecen visibles al desplazar la cuadrícula.

## Planes y permisos

- Individual: no muestra filtros de equipo o recursos. Conserva las reservas históricas de profesionales desactivados si existieran después de un cambio de plan.
- Negocio: permite filtrar los profesionales habilitados y consultar el historial de quienes tienen turnos en el período.
- Pro: agrega el filtro «Recurso del servicio», según las asignaciones ya existentes. El filtro no representa la disponibilidad independiente de un recurso; esa validación sigue en el servidor al reservar.
- Empleado: solo presenta su agenda y no consulta las reglas privadas del equipo. Sin acceso a esas reglas, no inventa jornadas ni habilita nuevos permisos.

## Representación visual

La banda lateral y el fondo suave de cada turno se derivan de su servicio. Su color permanece estable al cambiar el estado. Los cinco estados reales (pendiente, confirmado, completado, cancelado y no asistió) conservan texto e indicadores propios; completado incorpora una marca de verificación y cancelado un borde discontinuo. Las reservas cortas muestran la información que cabe sin distorsionar su duración; la etiqueta accesible, el título y el detalle conservan toda la información.

Las zonas rayadas se obtienen de las jornadas y bloqueos existentes. No se muestran como disponibilidad confirmada. Los huecos abren el formulario existente precargado; no crean una reserva sin confirmación del usuario.

## Validación

- Pruebas de geometría, simultaneidad, medianoche, jornadas partidas, descansos, ausencias, excepciones y cierres.
- Render de las tres vistas para los tres planes y aislamiento del rol empleado.
- 36 combinaciones comprobadas desde navegador: Individual/Negocio/Pro × Día/Semana/Mes × 320/393/768/1440 px, sin desborde horizontal de página.
- Recorrido de creación, reprogramación y completado exclusivamente en una demostración en memoria; comprobación de salto Mes → Día, filtros y búsqueda.
- La batería existente sigue comprobando las reglas reales de reserva, concurrencia, permisos, PostgreSQL y aislamiento entre negocios.
