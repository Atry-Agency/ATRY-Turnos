# Panel premium e IAtry administrativo — candidato local

Base: ba82c3c. Rama: codex/admin-premium-assistant. No publicado.

## Presentación

- Se conservan los ajustes de rubros ya aprobados, el icono de manicura original y el margen del campo de otro rubro.
- Agenda: zona horaria completa fuera de la columna de horas, usando la zona real del negocio.
- Inicio e indicadores: resumen 2 × 2 en móvil, sin modificar cifras, planes o filtros.
- Clientes y servicios: títulos más contenidos, avatar circular, teléfono con su icono, botones cortos con nombres accesibles originales. Los buffers cero dejan de ocupar una fila; siguen en el editor.
- Profesional: color compacto y etiqueta consistente, sin cambiar el valor ni las reglas.
- Reserva pública: identidad compacta en móvil, conservando nombre, logo, descripción, rubro y ubicación. La confirmación premium no se modifica.
- Primeros pasos y configuración: menos altura y navegación móvil desplazable; información extensa de comunicación y recurrencias desplegable, sin eliminar advertencias.
- IAtry del negocio: menú secundario en la cabecera, iconos de servicios e indicadores apropiados. Confirmaciones, comprensión regional y política operativa intactas.
- Administración: misma jerarquía ATRY, controles de 44 px, tablas convertidas a fichas móviles, filtros y estados legibles, skeleton de sección. Se corrigió el título de Correos que desbordaba en 320 px.

## IAtry administrador: alcance implementado

El asistente solo se renderiza con identidad administrativa y sesión existente. No usa APIs pagas, credenciales privilegiadas, un segundo backend ni RPC nuevas.

1. Consulta el resumen que el panel ya cargó. No inventa conteos ausentes ni consulta el CRM privado de los negocios.
2. Orienta a negocios, usuarios, comercial, correos, soporte, diagnósticos, almacenamiento, auditoría y configuración.
3. Resuelve nombres, identificadores y ordinales exclusivamente sobre la lista autorizada actual. Un registro ambiguo exige selección.
4. Prepara el acceso a suscripciones, diagnóstico del negocio, bloqueo/desbloqueo de cuentas, revocación de sesiones, seguimiento e incidencias. Suscripciones se abren primero desde una ficha actualizada.
5. La propuesta identifica el registro y el alcance. Requiere una aceptación visual antes de abrir el formulario existente. Este paso no escribe.
6. La ejecución se realiza en los formularios administrativos existentes, con sus campos, motivos, confirmaciones, reautenticación, revisión concurrente e idempotencia. El asistente no tiene método de escritura ni interpreta «confirmo» como autorización técnica.
7. Las propuestas quedan invalidadas si cambia la sección o la respuesta cargada. La conversación se conserva solo en memoria de la pestaña, por usuario y versión de sesión; no se guarda en localStorage ni en Supabase.
8. El emblema oficial reutilizado tiene movimiento interior discreto, más atento ante una propuesta, con movimiento reducido respetado. No hay celebración de un éxito supuesto.

### Límites explícitos

Esto es un asistente administrativo guiado conectado a los formularios operativos, no ejecución libre de todas las tareas por chat. No completa automáticamente períodos, importes ni motivos no proporcionados. Limpiezas, eliminación, anonimización y reenvíos no se ejecutan desde el asistente: requieren la revisión manual de sus secciones existentes. La edición global de planes y configuración mantiene sus controles actuales.

No se amplía ningún rol o plan. Los propietarios mantienen 16/17/17 herramientas, edición IAtry de clientes solo en notas y todos los bloqueos anteriores. El administrador de plataforma no obtiene acceso global a las agendas o contactos privados mediante este asistente.

## Evidencia

- Compilación TypeScript/Vite.
- 270 pruebas Node/PostgreSQL locales aprobadas.
- 32 pruebas React base y suites encadenadas de IAtry, permisos y presentación aprobadas.
- 43 comprobaciones nuevas del asistente: identidad, referencias, ambigüedad, contexto, confirmación textual no ejecutable, invalidación y ausencia de transporte.
- Chrome y WebKit, 320/390/430/1440: diez secciones administrativas; propuestas, selección, apertura de formularios y confirmación visual, sin escrituras ni tráfico externo.
- Prueba HTTP administrativa existente con SQLite desechable: conflicto de revisión rechazado, pausa reversible, suspensión/restablecimiento con confirmación y conservación de reservas/período, configuración persistida únicamente en la base ficticia.
- Chrome y WebKit, 320/390/430/1440: diez pantallas del negocio, controles táctiles, modales claros/oscuros, viewport con teclado simulado, borradores y validación. Ocho envíos de formulario UY/PA interceptados, cero registros guardados.
- Revisión visual adicional de KPI, agenda, clientes, servicios, turnos fijos, onboarding, menú IAtry y reserva pública compacta.
- Auditoría del artefacto: siete lecturas y diez escrituras productivas del negocio, sin cambios de autorización y cero solicitudes Supabase.

Estas pruebas no equivalen a homologación remota de todas las acciones administrativas. No se usaron sesiones reales, no se escribió en Supabase ni se cambiaron RLS, contratos, suscripciones, usuarios o negocios reales.

## Revisión local

- Negocio: http://127.0.0.1:3360/?demo=1&plan=2#/app/inicio
- Administrador: http://127.0.0.1:3361/__admin-preview

La segunda dirección abre una sesión de prueba de la base SQLite en memoria creada por `scripts/react/admin-assistant-preview.cjs`. Solo escucha en loopback. Los datos se descartan al reiniciar. El servidor y sus credenciales ficticias no se incluyen en el artefacto público.

No se hizo push ni despliegue. La publicación queda pendiente de revisión y autorización.
