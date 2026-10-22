# Revisión como propietario — Individual y Negocio

Fecha: 21/10/2026. Entorno local 127.0.0.1:3320. Demos aisladas en memoria. No se modificó producción ni se publicaron cambios. Esta revisión no certifica el entorno online.

## Recorridos comprobados

- Individual: inicio, agenda diaria, búsqueda de disponibilidad, creación manual con nombre y teléfono, apertura del detalle, navegación y lectura de jornada semanal.
- Individual: intento de abrir Equipo por URL; muestra Mi plan y acceso, sin habilitar gestión de equipo.
- Negocio: inicio y resumen semanal, agenda diaria/semanal/mensual, selección de Profesional 2 y actualización de conteos.
- Negocio: edición y guardado de descripción de servicio especializado.
- Negocio: edición de semana con fin anterior al inicio; rechaza el cambio con mensaje específico. Cerrar con cambios pendientes pide confirmación.
- Negocio: apertura de página pública, selección de cejas + depilación, elección de recorrido de 55 minutos con dos profesionales, confirmación ficticia y visualización del enlace privado de gestión.
- Agenda: inspección visual en ancho intermedio (~885 px), escritorio 1440 px y teléfono 390 px. No se verificaron todos los dispositivos ni Safari real.
- Suite existente: 178 aprobadas, 0 fallos. Registro: data/qa-owner-experience-tests.log.

## Fallos confirmados y prioridad

1. **Alta — barra de agenda superpuesta en ancho intermedio.** Fecha/navegación y Buscar horario se pisan. En teléfono se reorganizan, por lo que el problema está en el rango intermedio. Evidencia: docs/screenshots/qa-negocio-toolbar-local.png. Revisar el layout completo por grupos y permitir filas antes de quedarse sin espacio.
2. **Alta para demostraciones — enlace copiado pierde la demo.** La página de configuración muestra una URL sin `?demo=1&plan=2`. `businessUrl()` en web/app.js usa `new URL('./', location.href)`, que elimina la consulta. Los enlaces de navegación sí conservan la demo. Compartir el enlace copiado no abre el ejemplo aislado esperado.
3. **Media, demo — contacto desaparece del detalle.** Se creó Prueba Dueño Individual con teléfono; la reserva aparece, pero su detalle dice Sin contacto registrado. `decorate()` en web/demo.js fuerza customer_email y customer_phone vacíos aunque el contacto se guarda. No prueba pérdida del contacto en el backend real.
4. **Alta para fidelidad de demo — disponibilidad no representa la configuración.** Horarios muestra 09–19 y domingo cerrado, pero `slots()` de web/demo.js genera una franja fija 09–16:30 sin consultar la jornada, ausencias ni asignación de servicios. No presentar esta simulación como validación del motor real. El flujo combinado usa su propio adaptador: no generalizar este hallazgo a ese motor ni a producción.
5. **Media, demo — métricas parcialmente fijas.** El dashboard de web/demo.js devuelve today_count:2 aunque se creen más turnos. Puede hacer que el propietario perciba que el sistema no se actualiza.

## Mejoras como dueño (recomendaciones, no fallos)

- Individual necesita un resumen sencillo de Hoy: próximo horario, pendientes y acceso a agenda. No requiere estadísticas premium. Actualmente muestra solo próximos turnos. Los turnos de hoy ya pasados se omiten correctamente; no es un error de fecha.
- En Individual sobran selectores de Profesional con una sola opción en alta manual/búsqueda. Mostrar el nombre como texto reduce decisiones vacías.
- En Negocio, hacer más evidente el profesional seleccionado y ofrecer un atajo visible para volver a Todo el equipo. El filtro actual funciona y ya tiene una etiqueta para quitarlo.
- La barra de agenda tiene demasiadas herramientas con el mismo peso. Mantener fecha, Hoy, vistas y Crear turno; agrupar densidad/actualizar/acciones menos frecuentes.
- Durante el alta manual la demo muestra momentáneamente Conectando… pese a ser local. Mantener el mensaje de simulación para evitar sensación de fallo de red.
- En la demo, Mi plan muestra $0 con texto Precio de catálogo actual y vencimiento 2098. Sustituir el discurso comercial por Estado simulado/Sin contratación, manteniendo el requisito de no generar costos reales.
- En gestión pública, formatear 2026-10-22 como fecha legible en español y destacar la acción posterior a confirmar: guardar enlace y revisar recorrido.
- La demo abre la página pública en otra pestaña con memoria independiente. Aclararlo al probar: una reserva allí no actualiza la pestaña del panel. Es aislamiento esperado, pero confunde al simular la operación completa.

## Orden recomendado

Primero corregir responsive y fidelidad de la demo (enlace, contactos, jornada, contadores). Luego simplificar la agenda y mejorar el inicio Individual. Después repetir los recorridos con conflictos, reprogramación, cancelación, ausencias y cambios de plan. Estos últimos no se ejecutaron de nuevo en esta sesión; la suite automatizada sí pasó.

## Correcciones locales posteriores

Se corrigieron la distribución de controles de agenda, enlace de demo, contactos, contadores y disponibilidad de demostración (jornada, pausas, excepciones, cierres, ausencias y especialidad), incluida su revalidación al guardar. Se agregaron resumen de hoy y alta rápida en Individual; el único profesional se muestra como texto. La pantalla de planes conserva la tarjeta Negocio destacada y utiliza el violeta del login con contraste legible. La demo no muestra precios ni vencimientos comerciales y no ofrece contratación. Dos pruebas nuevas verifican disponibilidad/contactos y contadores. Suite final: 180 aprobadas, 0 fallos. Inspección visual de agenda en 390, ~885 y 1440 px. Todo continúa local, sin publicación ni migración remota.
