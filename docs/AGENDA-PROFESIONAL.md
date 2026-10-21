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

## Capa operativa de la agenda

- La barra concentra fechas, vistas, filtros, actualización y densidad. Los filtros se despliegan a pedido; sus etiquetas permiten retirarlos individualmente.
- Densidad Compacta/Cómoda: escala uniforme de minutos, sin alterar duraciones ni superposiciones. Preferencia temporal de la sesión.
- El detalle se monta sobre la agenda sin volver a consultar sus datos ni reconstruir sus columnas; a la derecha en escritorio y desde abajo en teléfono. Cerrar conserva el contexto y devuelve el foco al turno. Reprogramación y cambios de estado siguen usando las operaciones existentes.
- Atender hoy muestra los turnos pendientes y confirmados que coinciden con el horario actual y los próximos del día, respetando los filtros y permisos existentes. Conserva todos los simultáneos. No cambia estados por el mero paso del tiempo. Se actualiza cada minuto y permite volver al período anterior.
- Atajos H, N, 1/2/3 y / únicamente dentro de Agenda, fuera de formularios y diálogos. No disparan cambios de estado ni operaciones destructivas.
- Validación adicional: 156 pruebas; 36 combinaciones de vistas/planes/tamaños desde navegador (320, 393, 768 y 1440 px), filtros individuales, ambas densidades, detalle móvil/escritorio y paso a reprogramación sin duplicar ventanas. Pruebas exclusivamente en demos en memoria, sin escrituras en producción.

## Selección de equipo y creación contextual

- Negocio/Pro incorporan fichas con iniciales, nombre y cantidad de turnos del período. Individual y empleados no muestran controles de equipo.
- El resumen por estado filtra el calendario sin descartar sus reservas originales. Las etiquetas permiten retirar cada filtro.
- Crear desde un hueco o desde el encabezado conserva el profesional seleccionado. El formulario existente incorpora contexto de fecha/hora y búsqueda explícita de clientes por nombre, teléfono o correo, únicamente para los roles con acceso al CRM. La búsqueda no crea contactos; seleccionar envía su identificador por la operación existente y conserva su ficha. Los contactos sin teléfono ni correo se señalan para completar su ficha antes de reservar.
- La tecla Enter dentro del buscador solo busca contactos. Las solicitudes tardías se descartan al cerrar la ventana o cambiar de negocio. Los datos del cliente y los identificadores se escapan antes de renderizar.
- Las tarjetas ajustan la jerarquía y reconocen turnos fijos con un símbolo de repetición cuando la reserva trae recurring_id. Las acciones sobre series conservan su implementación original.
- Validación: 158 pruebas aprobadas, 36 combinaciones de plan/vista/tamaño sin desbordes; selección de profesional, precarga desde un hueco, búsqueda, selección/cambio de cliente y guardado comprobados en demostración aislada.

## Navegación útil y consulta de horarios

- La agenda abre en la hora actual dentro de jornada, en el último turno de hoy si la jornada terminó o en el primer turno para otras fechas. Un botón permite repetir el salto; las actualizaciones normales conservan el desplazamiento.
- Buscar horario consulta el endpoint público de disponibilidad ya utilizado por la página de reservas, con servicio, fecha y profesional. No deduce disponibilidad localmente ni guarda reservas. Cada opción abre el formulario existente precargado; el servidor revalida al guardar. Fallos de consulta muestran un error, sin inventar opciones. Cambiar filtros invalida los resultados pendientes.
- Las demos usan únicamente su adaptador en memoria. En producción se aplican las reglas de disponibilidad y protección del endpoint existente, sin nuevos permisos ni API.
- En teléfono, Día y Semana muestran un profesional a la vez con selector propio, sin comprimir el equipo. El encabezado mantiene accesible Crear turno al desplazarse.
- El historial se consulta a pedido desde el detalle, solo para roles con acceso al CRM. Admite la respuesta de PostgreSQL (lista) y la local (objeto). Los conteos se limitan explícitamente a las reservas consultadas, hasta 100; no se presentan como totales de toda la vida del cliente.
- Validación adicional: 161 pruebas, 36 combinaciones plan/vista/tamaño sin desborde de página ni múltiples columnas en móvil, precarga desde disponibilidad e historial en detalle comprobados en demo aislada.

## Reserva conectada y reprogramación comparada

- El formulario de reserva permite consultar otro horario conservando cliente, contacto, servicio, notas y vínculo con su ficha. Volver sin elegir una opción recupera el borrador; elegir un horario reemplaza fecha/hora/profesional, conservando el resto. Borrador exclusivamente en memoria.
- Reprogramar muestra horario actual y propuesta juntos. Se pueden consultar alternativas del mismo servicio y regresar al formulario antes de guardar mediante el PATCH existente. La búsqueda pública conserva ocupado el turno original: ofrece alternativas conservadoras, sin prometer disponibilidad para mover parcialmente sobre su propio intervalo.
- El personal solo consulta y propone su profesional vinculado. No cambia la autorización del backend ni las reglas de disponibilidad.
- En móvil, Más opciones agrupa visualmente actualización, densidad y salto al horario útil. Los controles permanecen accesibles a pedido.
- Validación: 162 pruebas, recorrido de reserva con cliente/notas conservados y reprogramación completa en demo en memoria; comparación y controles secundarios comprobados en móvil.
