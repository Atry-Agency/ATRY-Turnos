# Publicación futura y recuperación sin perder datos

Este documento prepara el procedimiento; no autoriza ni ejecuta ninguna acción remota.

## Antes de autorizar el despliegue

1. Comparar el esquema y las RPC efectivos del entorno autorizado con la base de estas migraciones. No aplicar por parecido de nombres.
2. Respaldar datos/esquema y ensayar restauración en una base separada, incluyendo reservas, contactos, recurrencias, auditoría, perfiles y snapshots monetarios.
3. En staging, aplicar la cadena incremental, ejecutar las pruebas diferenciales y homologar Auth, RLS, Edge, Storage, Realtime y comunicaciones con envíos controlados.
4. Archivar el artefacto publicado `002868f` y su configuración, más un artefacto compatible multipaís verificado. No usar etiquetas remotas ni desplegar desde esta misión.
5. Separar la publicación de compatibilidad de la autorización de altas PA. El catálogo comercial PA debe permanecer cerrado.

## Mientras solamente existan datos UY

Las columnas nuevas tienen valores UY y los contratos antiguos `price_uyu` se mantienen. Si falla la homologación, conservar el frontend vigente y no ejecutar migraciones remotas. Si se aplicó compatibilidad en un entorno autorizado, se puede retirar el frontend candidato manteniendo las columnas aditivas; cualquier reversión de funciones debe verificarse allí con el artefacto anterior. No ejecutar un DROP destructivo por rutina.

## Después de existir datos PA

No volver a un cliente que presuponga UYU/Montevideo. Conservar el lector/adaptador compatible, los campos `price_minor`/`currency` y los snapshots. Detener nuevas altas/operaciones PA mediante una revisión compatible autorizada mientras se corrige el fallo; mantener lectura del historial y UY operativos. No cambiar el país de los negocios para intentar recuperar el servicio.

Un rollback a `002868f` por sí solo NO está homologado para datos PA. La restauración completa o una corrección incremental deben prepararse y ensayarse con los datos presentes antes de ejecutarlas. Las migraciones de esta rama están transaccionadas; un fallo en una de ellas revierte esa transacción, sin sustituir una recuperación entre versiones.

## Ensayo realizado el 14/11/2026

`node scripts/international/recovery.cjs` aprobó un respaldo/restauración desechable PGlite anterior, aplicación ordenada de seis migraciones, integridad de columnas originales de 66 tablas (solo revisiones de caché aumentan), reversión transaccional ante fallo deliberado de la sexta y restauración posterior con PA/USD1299. Evidencia en `effective/recovery-evidence.json`.

Esto no acredita restauración nativa de Supabase. Falta un ensayo autorizado con PostgreSQL y recursos del entorno objetivo. No hay snapshot remoto ni etiqueta de rollback publicados en esta misión.

## Procedimiento operativo a homologar antes de autorizar

1. Registrar responsables, hora de corte, esquema/versión/artefacto y objetivos RPO/RTO aceptados. Restringir temporalmente escrituras durante el punto consistente según la ventana autorizada; conservar Uruguay operativo requiere medir los bloqueos, no asumir ausencia de interrupción.
2. Seguir el procedimiento oficial de backup/restore de Supabase apropiado al plan real. Verificar disponibilidad y antigüedad de backups/PITR, dump de esquema/datos/roles aplicable y checksum. No asumir que el script SQLite `scripts/backup.js` respalda Supabase.
3. Respaldar aparte bytes de Storage e inventario de buckets/políticas, configuración/secretos de Edge/Auth/proveedores y artefactos. Guardar secretos fuera de Git. Inventariar contraseñas/roles y otros elementos excluidos por la modalidad real de backup.
4. Restaurar primero en destino aislado autorizado, con correo/workers/redirecciones externos sin efectos reales. Ejecutar comparación de conteos y huellas, snapshots UYU/USD, relaciones, reservas/recurrencias, RLS/ACL y login/Storage. Medir recuperación y documentar discrepancias.
5. Aplicar 001→006 en esa copia, verificar integridad y tiempo/bloqueos con volumen/concurrencia representativos. Simular fallo intermedio y comprobar flags PA falsos e invariantes UY. Solo continuar con aprobación y checks de salida completos.
6. Ante fallo productivo futuro, detener expansión PA mediante controles autorizados, mantener lector compatible y preservar snapshots. Elegir corrección incremental o restauración con reconciliación de escrituras posteriores al backup. Una restauración completa sin reconciliación puede perder reservas nuevas; no ejecutarla automáticamente.

Cerrar flags PA impide altas/operaciones públicas nuevas; no elimina historial ni sustituye un plan para reconciliar reservas ya existentes. Las lecturas privadas actuales y los enlaces privados de comprobantes no deben convertirse en un rollback monetario. El artefacto anterior exclusivamente UY solo es opción mientras no haya datos PA y después de comprobarlo expresamente.
