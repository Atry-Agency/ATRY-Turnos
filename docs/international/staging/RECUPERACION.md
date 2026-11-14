# Respaldo y recuperación: ruta según plan real

No se consultó el plan de la organización, no hay backup hosted creado y no se ejecutaron estos comandos. El ensayo PGlite ya aprobado no sustituye esta fase. No copiar producción para construir staging.

## Elección sin contratar extras por defecto

| Plan que confirme el titular | Respaldo disponible / ensayo requerido |
|---|---|
| Free | No suponer backups automáticos descargables ni PITR. Exportación lógica manual, copia fuera del proyecto y restauración medida obligatorias. Tiene límites de tamaño/pausa; sirve para funcionalidad, no equivalencia de rendimiento |
| Pro | Revisar en Database → Backups las copias diarias realmente disponibles (documentación:7 días). Ensayar restauración y tiempos; no asumir PITR incluido |
| Team/otro | Confirmar retención y prestaciones en el panel/contrato. No inferirlas de la configuración del repositorio |
| PITR opcional | No activarlo sin aprobación de costo (tarifa pública desde US$100/mes para7 días, además del resto). La migración no lo requiere como dependencia; requiere recuperación demostrada |

Se propone exportación lógica en todos los casos y restauración en un **segundo receptor desechable autorizado**, preferentemente Supabase del mismo tipo. Esto puede consumir un segundo cupo Free o cómputo adicional desde US$10/mes en organización pagada; revisar checkout. Alternativa: PostgreSQL/Supabase local nativo para practicar dump/restore, dejando pendiente la certificación hosted. Nunca restaurar sobre el único staging que contiene la evidencia ni sobre producción.

## Procedimiento preparado

1. Registrar fuente/receptor por ref exacto, versiónPG/extensiones, fecha, filas, servicios activos y flags. Detener solo escrituras de ensayo para un punto consistente, no operaciones productivas. Estados: A=baselineUY, B=regional cerrado, C=regionalcondatos PA. Mantener tres copias independientes con checksum y acceso restringido.
2. Tomar dump de roles/esquema/datos mediante CLI oficial, después de comprobar herramientas/versión y destino. Ejemplo de referencia con ref staging explícito (autenticación privada de CLI/DB, sin contraseñas en el historial):

```sh
supabase db dump --remote="$ATRY_STAGING_REF" --role-only -f roles.sql
supabase db dump --remote="$ATRY_STAGING_REF" -f schema.sql
supabase db dump --remote="$ATRY_STAGING_REF" --data-only --use-copy -f data.sql
supabase db dump --remote="$ATRY_STAGING_REF" --schema supabase_migrations -f history_schema.sql
supabase db dump --remote="$ATRY_STAGING_REF" --schema supabase_migrations --data-only --use-copy -f history_data.sql
```

Antes de utilizar estas salidas para recuperar, revisar lo incluido/excluido por esa versión de CLI: Auth (usuarios y credenciales), cambios propios sobre esquemas gestionados, políticasStorage y dependencias. No confundir exit0 con backupcompleto. Si hay esquemas administrados que el dump no incluye, seguir el procedimiento oficial específico de ese componente y conservarlo aparte. No editar silenciosamente errores de owner/grants de restauración.

3. Copiar aparte los **bytes** de objetos Storage ficticios por API autorizada, con path/tamaño/hash y visibilidad; el dump contiene metadatos, no las imágenes. Registrar configuración Auth/SMTP/redirects, Edge/versiones, Realtime/publicación, secretos de ensayo y cron. Secretos fuera de Git. Si hubiera Vault/columnas cifradas, el dump no contiene la clave raíz: la recuperación requiere un procedimiento adicional autorizado según Supabase. No copiar claves raíz ni secretos productivos.
4. Preparar receptor vacío compatible autorizado. Restaurar roles/esquema/datos e historial por el procedimiento oficial, usando conexión privada y ON_ERROR_STOP/una transacción cuando corresponda. En el ejemplo oficial la carga de datos usa session_replication_role=replica para evitar disparar triggers; **solo** sesión de restauración privilegiada al receptor, nunca sesiones de ensayo ni cambios permanentes de seguridad. No proporcionar un comando de restauración directo sin antes revisar el dump real y las dependencias del receptor.
5. Restablecer publicaciones Realtime y configuración externa, subir bytes Storage y verificar huellas. Probar login/refresh con una identidad de ensayo restaurada; si las sesiones/issuer no son transferibles al receptor, volver a autenticar normalmente y documentar ese límite, sin fabricar JWT. Mantener correo/cron apagados antes de acceder a datos restaurados.
6. Comparar conteos y claves, snapshots price_uyu/price_minor/currency, reservas y recursos/recurrencias, contactos, auditoría, las 34 políticas esperadas y ACL. No usar el número 34 como único criterio: comparar expresiones y permisos. Confirmar hash de Storage, dos sockets Realtime y denegación entre propietarios.
7. Sobre copia A aplicar las seis migraciones y medir duración/locks/WAL y carga. Falla deliberada solo en un receptor desechable autorizado; comprobar atomicidad de cada archivo y que un fallo 006 no abra PA. No modificar archivos revisados para aplicar a un entorno compartido.
8. Restaurar C con PA USD 12,99 y visita USD 26,00, conservar históricos UYU. No ejecutar DROP de columnas ni restaurar un frontend únicamente UY. Elegir lector compatible/corrección incremental y reconciliar cualquier escritura posterior al backup. Registrar RPO (pérdida medida),RTO (tiempo medido) y responsable; no inventar objetivos cumplidos.

## Fuentes oficiales

[Backups Supabase](https://supabase.com/docs/guides/platform/backups), [procedimiento CLI y recursos complementarios](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [precios](https://supabase.com/pricing). Consultadas 14/11/2026. La disponibilidad real del proyecto debe comprobarse una vez autorizado; no se contrató un plan ni PITR.
