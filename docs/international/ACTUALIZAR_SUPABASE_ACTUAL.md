# Actualizar el Supabase actual — plan breve

Destino único: `djoxdtloqwbrhgtgencc`. Uruguay y Panamá convivirán en la misma base. No crear otro proyecto, otra base remota ni staging. Ninguna aplicación de migraciones, backup remoto, push o despliegue realizado en esta preparación.

## Qué está preparado y qué falta comprobar de verdad

- Se conservan las seis migraciones y sus SHA-256 revisados. La evidencia local ya demuestra conservación de columnas originales en 66 tablas (excepto revisiones de caché esperadas), importes UYU sin reinterpretar y recuperación ante fallo. No se repite esa auditoría.
- Panamá queda cerrado desde 001: `pa_registration_enabled=false`, `pa_public_enabled=false`; contratación pagada también bloqueada. No abrirlo al instalar compatibilidad.
- Los snapshots remotos disponibles son anteriores y parciales (por ejemplo nueve RPC del 28/10). No certifican el esquema productivo completo de hoy.
- No hay conexión SQL autorizada/configurada accesible en esta carpeta. No se usaron scripts heredados con service_role: algunos hacen llamadas de escritura de prueba o Auth admin y no sirven para esta revisión.
- Falta obtener el esquema actual mediante SELECT y confirmar la copia recuperable del proyecto. Hasta eso, **no dar autorización de ejecución ni declarar producción compatible**.

## Un solo acceso inicial necesario

Supabase Dashboard → seleccionar **ATRY Turnos** (`djoxdtloqwbrhgtgencc`) → SQL Editor → ejecutar `supabase/operations/regional-production-readiness.sql` y exportar su único resultado JSON/CSV. Compartir ese archivo local permite comparar funciones, columnas, restricciones, triggers, RLS, GRANT y montos agregados sin claves ni filas personales. La consulta es READ ONLY, no llama RPC que creen recurrencias ni hace pruebas de escritura. Timeout 10s y espera de locks 2s; si expira, no aumentar límites automáticamente.

Si se facilita un acceso SQL normal autorizado en lugar del resultado, se puede ejecutar la misma consulta sin controlar ventanas. Nunca enviar contraseña/token por el chat. Revisar en el mismo Dashboard → Database → Backups la copia más reciente y si permite restaurar **este mismo proyecto**; comunicar fecha/hora y modalidad, sin secretos. Eso no restaura ni cambia el plan.

## Compatibilidad e integridad

Comparar el resultado real con la reconstrucción baseline del repositorio. Toda divergencia de funciones/ACL/políticas/constraints se revisa antes de modificar la base; no sobrescribir diferencias desconocidas. Comprobar todos los negocios UY actuales, price_uyu entero/no negativo, dependencias y volumen. No ejecutar las 47 migraciones antiguas ni crear tablas de ejemplo en producción.

Al autorizar la actualización, registrar conteos y huellas de los datos existentes en un punto consistente y releerlos después. Verificar price_minor=price_uyu×100, currency UYU y misma identidad/fechas/estado/contactos en las columnas antiguas. La comparación agregada preliminar no demuestra por sí sola conservación de cada registro; las huellas completas o el backup coherente y comparación posterior son obligatorios en la ventana de ejecución. Mantener ambos flags PA falsos.

## Respaldo y recuperación en el mismo proyecto

1. Confirmar plan y modalidad real de backups del Dashboard. Pro/Team/Enterprise tienen backups gestionados; Free exige exportación manual. No contratar PITR ni cambiar de plan sin autorización.
2. Crear una copia lógica reciente de esquema/datos/roles/historial en almacenamiento privado fuera de Git, por CLI/pg_dump con conexión existente autorizada; revisar componentes incluidos, tamaño y checksum, sin imprimir secretos. Preparar también la conservación de Storage (los backups de BD no guardan sus bytes), configuración Auth/Edge/Realtime y secretos existentes, sin modificarlos.
3. No llamar “respaldo creado” a un listado o un archivo sin validar. Confirmar que es legible, íntegro y que el proyecto tiene una vía de restauración compatible. No se ha hecho una restauración nativa de producción ni se la promete. No probar restaurando sobre datos reales. Si no puede garantizarse una recuperación aceptable sin otro entorno, dejar explícito el riesgo y no migrar hasta resolverlo; no ocultarlo ni volver a proponer recursos remotos.
4. Las migraciones son aditivas, pero ALTER/backfill toman locks. Acordar una ventana breve y el mecanismo real de contención de nuevas escrituras; una pausa visual del frontend no detiene APIs ni workers. Si no se puede conseguir un punto consistente, medir y resolver antes. No deshabilitar permisos/servicios globales por esta preparación.
5. Con Panamá cerrado, preferir corrección incremental o conservar esquema aditivo si un cliente falla. Cada migración revierte su propia transacción al fallar, no las seis juntas. Si falla una, inspeccionar estado/historial; no reintentar a ciegas ni ejecutar DROP.
6. Restaurar el backup del **mismo proyecto** es último recurso, con indisponibilidad y reconciliación de reservas/escrituras posteriores. Debe contar con alcance y autorización explícitos: no está incluido automáticamente en autorizar las seis migraciones. No prometer pérdida cero ni restauración instantánea.

## Aplicación futura, solo con autorización

Antes de ejecutar: identidad del proyecto, backup comprobado, diferencias del esquema resueltas, ventana acordada y frontend UY compatible. Enumerar como pendientes **únicamente**001–005 del13/11 y001 del14/11 según manifiesto. Si el historial SQL difiere del CLI, reconciliar evidencia antes: no usar repair/include-all para forzar que coincida.

Aplicar esas seis en orden con los timeouts revisados, nunca migraciones anteriores; verificar cada resultado real y después integridad, ACL/RLS, límites y flags PA cerrados. No crear reservas/usuarios de ensayo. No cambiar frontend/Edge, hacer push ni publicar hasta autorización propia; base nueva + frontend UY actual debe seguir funcionando y se verifica con lecturas.

## Qué autorizar exactamente después de completar lectura y backup

«Autorizo aplicar exclusivamente las seis migraciones regionales revisadas al proyecto Supabase djoxdtloqwbrhgtgencc, con el respaldo identificado y la ventana acordada. Conservar Uruguay, mantener registro/publicación/contratación Panamá bloqueados y verificar mediante lecturas, sin escrituras operativas de prueba. No autorizo nuevos proyectos, cambios de planes, push, despliegues ni apertura de Panamá. Si hay discrepancias, falla el respaldo o falla una migración, detenerse y conservar la evidencia.»

Esa autorización no debe solicitarse como si todo estuviera verificado hoy: **faltan lectura actual y backup real**. Se entregará el hash del paquete y la identificación de la copia antes de ejecutar.

Fuente de recuperación: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups), consultada 14/11/2026. Restaurar reemplaza el estado y puede perder cambios posteriores; los objetos Storage requieren conservación separada.
