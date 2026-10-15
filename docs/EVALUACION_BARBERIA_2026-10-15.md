# Evaluación exigente: dueño de barbería

15 de octubre de 2026. Evaluación funcional y visual, con correcciones de interfaz.

## Alcance real

Los recorridos de esta ronda se hicieron desde navegador con una base SQLite **aislada**, `data/qa-barberia-20261015.sqlite`, en el puerto 3312. No se modificó el SQLite original ni se crearon negocios o reservas ficticias en Supabase. El envío de correo estuvo apagado en este entorno. La sesión productiva estaba cerrada tras el cambio de contraseña; esta ronda no sustituye ni repite la validación remota de Supabase documentada anteriormente.

Se revisaron las vistas de inicio, agenda, servicios, equipo, disponibilidad, clientes, espera, estadísticas, notificaciones, accesos y reserva pública. Se verificó la presentación a 390 px y en escritorio a 1280 px. No se certifica cada combinación de dispositivo, lector de pantalla o navegador.

## Resultados

| Recorrido | Resultado |
| --- | --- |
| Cambiar nombre, categoría y descripción | Guardado y reflejado en el negocio; corregido el selector que conservaba el nombre anterior. |
| Servicio de corte y barba, 45 minutos, $850 y 10 minutos de limpieza | Creado y disponible para asignación y reserva. |
| Agregar profesional y modificar su semana | Guardado; se explicó en el alta la jornada inicial automática. |
| Reserva manual sin contacto | Rechazada con aviso; aceptada al completar teléfono. |
| Reprogramar de 14:00 a 15:00 | Cambio persistido y visible en agenda. |
| Reserva pública como cliente | Confirmada; generó enlace privado de gestión. |
| Cancelar y volver sin cancelar | Ventana propia verificada; volver conserva el turno y confirmar cambia el estado. |
| Completar turno futuro | Se detectó falta de advertencia; agregada y comprobada la opción de volver sin modificarlo. |
| Reintentos simultáneos con igual clave | Mismo ID, sin duplicado. Comprobación adicional por API local. |
| Segundo turno para el mismo profesional/hora | Rechazado con conflicto. |
| Turno dentro del tiempo de limpieza | Rechazado con conflicto. |
| Reserva fuera de jornada | Rechazada. |
| Menú móvil | Apertura, cierre al tocar fuera y navegación comprobados. |
| Casilleros de asignación | Corregidas etiquetas; cada profesional tiene su propio nombre accesible. |
| Suite automatizada | 81 pruebas aprobadas; incluye permisos, concurrencia, recursos, espera, Auth, PostgreSQL local y correo con adaptadores de prueba. No son 81 recorridos manuales ni 81 pruebas contra producción. |

## Cambios realizados

- SmartSlots pasa a **Horarios disponibles**. Insights pasa a **Resumen del negocio**. Roles y estados de incidencias se muestran en español.
- Iconos SVG consistentes, con trazos redondeados y respuestas al interactuar: menú que se transforma, flechas, actualización y confirmación de copia. Se conserva la preferencia de movimiento reducido.
- Corregido el botón Actualizar que desbordaba en móvil y las filas apretadas de usuarios y accesos.
- Confirmaciones dentro de la aplicación, con foco y navegación por teclado; sin depender de los diálogos JavaScript del navegador. La herramienta de navegador se bloqueó con los diálogos anteriores; se retomó en otra pestaña y se verificó la nueva implementación.
- Textos de correo actualizados: dependen de la configuración del negocio y no prometen una entrega automática. Eliminadas referencias técnicas innecesarias al backend en los recorridos de usuario.

## Devolución como propietario

**Valoración subjetiva: 7/10.** La base sirve para un piloto acompañado: permite operar turnos, equipo y servicios y protege los conflictos básicos. La identidad visual es coherente y la legibilidad móvil mejoró. Aún requiere pulido antes de venderlo como una solución autoservicio completa.

Prioridades pendientes:

1. **Corrección de errores de operación.** No existe una acción visible para deshacer un turno completado o cancelado por error. La advertencia reduce el riesgo, pero no sustituye un flujo de rectificación con auditoría.
2. **Agenda de trabajo más rápida.** Una vista por horas y profesionales facilitaría ver huecos, atrasos y jornadas completas. Las tarjetas actuales requieren más desplazamiento; la reprogramación usa formulario.
3. **Alta guiada más segura.** Los profesionales arrancan con horario de lunes a sábado, 09:00–18:00. Ahora se informa, pero sería preferible exigir revisión antes de compartir reservas.
4. **Aprovechar las sugerencias sin repetir elecciones.** Los botones de Horarios disponibles abren el flujo general de reservas y no conservan servicio, profesional y horario sugeridos.
5. **Ficha de cliente más completa.** La interfaz permite notas e historial, pero no ofrece edición directa de nombre, teléfono y correo como esperaría el propietario de una peluquería.
6. **Seguimiento operativo del correo.** Falta sincronizar recibos de entrega del proveedor; aceptación y entrega siguen siendo estados distintos. Pagos y WhatsApp siguen deshabilitados.

Las métricas explican sus límites: valor de servicios no equivale a cobros; la ocupación no reconstruye toda la disponibilidad histórica. No deben usarse como contabilidad.

Antes de incorporar varios negocios: recorrer el alta y la operación con un propietario real en Supabase, resolver las rectificaciones y acompañar al primer piloto. Ninguna de estas pruebas permite garantizar ausencia total de fallos.
