# Procedimiento de staging aislado

Preparado el 14/11/2026. **Nada remoto ejecutado ni autorizado por este documento.** No sustituye el plan `PLAN.md`; lo concreta. Rama `codex/multicountry-uy-pa`. No releer credenciales productivas, clonar producción, usar ramas con datos productivos ni configurar el workflow Pages actual.

## 0. Decisión y acción manual mínima

Cuando el titular autorice crear el entorno: Supabase Dashboard → organización elegida → **New project** → nombre `ATRY Turnos · Staging UY PA`, contraseña exclusiva guardada en gestor, región apropiada (preferentemente equivalente a producción, confirmada por el titular), y revisar el costo antes de Create. Proyecto completo independiente; no branch/restore del productivo. No comprar dominio, PITR, IPv4 ni aumentar cómputo para comenzar.

Después informar solo **project ref, plan contratado y región**, nunca la contraseña ni claves en el chat. Eso permite preparar la autorización específica de instalación/ensayos. Crear el proyecto no autoriza migrar, desplegar Edge, configurar SMTP ni insertar fixtures.

Costo orientativo oficial consultado el 14/11: Free US$0 si hay cupo (dos proyectos activos, límites y pausa); Pro desde US$25/mes por organización, proyectos adicionales desde US$10/mes, más consumos/adicionales. Si ya existe Pro, no asumir cómputo extra incluido. Revisar el precio final de la organización antes de aceptar. El plan real de la cuenta **no se consultó** en esta misión. Free sirve para funcionalidad y exportación manual; no acredita backups automáticos/PITR ni equivalencia de rendimiento con producción. Véase RECUPERACION.md.

## 1. Paquete offline y herramientas

`node scripts/international/prepare-staging.cjs` genera un directorio temporal nuevo. No consulta entorno, credenciales ni red. Incluye:

- `baseline/supabase/migrations`: las 47 migraciones anteriores a regionalización, sin datos de producción.
- `candidate/supabase/migrations`: esas 47 más las seis revisadas, idénticas byte a byte.
- Funciones Edge originales, config de repositorio, comprobaciones SQL, guía y manifiesto SHA-256. No incluye `.temp`, enlaces CLI existentes, usuarios ni seeds.

Herramientas necesarias para la ejecución posterior: CLI Supabase y Docker cuando lo requiera el dump; cliente PostgreSQL compatible con la versión del destino. No estaban disponibles `supabase`/`psql` en PATH durante la preparación y no se instalaron. Antes de ejecutar: fijar versión CLI, conservar `--version`/`--help`; las opciones siguientes corresponden a la referencia oficial consultada. Si no existen en esa versión, detenerse y adaptar el procedimiento, no eliminar verificaciones.

## 2. Autorización y configuración inicial

Exigir alcance explícito: ref distinto de `djoxdtloqwbrhgtgencc`, plan/región/versión PG, roles del operador, origen staging, costo permitido, fases de migración y registros ficticios que pueden crearse. Configurar Auth/Edge/Storage según CONFIGURACION.md solo cuando esté autorizado. No ejecutar `config push` con el config local: contiene URLs localhost y no es una descripción aprobada del proyecto hosted.

No enlazar esta carpeta de trabajo al proyecto productivo ni usar el enlace CLI actual. Los comandos preparados usan directorios nuevos y **ref explícito**. Antes de cualquier conexión comprobar el ref en el Dashboard y manifiesto de autorización. Una sesión privilegiada sirve solo para instalar infraestructura autorizada, no para simular permisos de usuarios.

## 3. Instalar base anterior en staging vacío

Tras autorización, desde una terminal privada con CLI autenticada por el titular; `PKG` es la ruta generada y `ATRY_STAGING_REF` el ref aprobado. Estas variables son solo rutas/identificadores; no poner contraseñas en comandos ni logs.

```sh
supabase --workdir "$PKG/baseline" db push --remote="$ATRY_STAGING_REF" --dry-run --skip-vault
# Revisar que enumere exclusivamente las 47 migraciones baseline y el destino correcto.
supabase --workdir "$PKG/baseline" db push --remote="$ATRY_STAGING_REF" --skip-vault
supabase --workdir "$PKG/baseline" migration list --remote="$ATRY_STAGING_REF"
```

No usar `--include-all`, `migration repair`, reset remoto ni marcar versiones como ejecutadas para superar discrepancias. Si el proyecto no está vacío, no continuar: inspeccionar historial y explicar diferencias. Si una migración falla, comprobar qué transacción terminó y el estado real antes de reintentar. Conservar el error sin contraseñas.

En esta base anterior: crear por Auth normal los usuarios ficticios autorizados; verificación de correo real por SMTP de ensayo, completar registro mediante flujo existente. Bootstrap de **un administrador staging** requiere autorización de un UPDATE limitado a su usuario verificado, sin cuentas productivas ni metadatos que se autoconcedan privilegios. Usar luego panel/RPC administrativos normales para cortesías y vínculos de ensayo; no inventar planes ni modificar catálogo. Preparar primero UY y datos históricos UYU; respaldar estado A.

## 4. Aplicar las seis regionales

```sh
supabase --workdir "$PKG/candidate" db push --remote="$ATRY_STAGING_REF" --dry-run --skip-vault
```

La salida debe enumerar **solo** las siguientes pendientes, en este orden:

1. `202611130001_regional_foundation.sql`
2. `202611130002_regional_snapshots.sql`
3. `202611130003_regional_consumers.sql`
4. `202611130004_regional_whatsapp.sql`
5. `202611130005_regional_public_commercial.sql`
6. `202611140001_regional_release_guards.sql`

Comparar SHA-256 contra manifest.json y el manifiesto revisado de la rama. Guardar conteos/huellas de datos ficticios y permisos previos. Con respaldo probado y autorización vigente:

```sh
supabase --workdir "$PKG/candidate" db push --remote="$ATRY_STAGING_REF" --skip-vault
supabase --workdir "$PKG/candidate" migration list --remote="$ATRY_STAGING_REF"
```

Cada archivo controla su propia transacción; no implica atomicidad de los seis juntos. Hay lock_timeout2s/statement_timeout30s: medir tiempos/locks y detenerse si no cumple; no elevarlos a ciegas. No aplicar el paquete completo al proyecto productivo.

En conexión SQL staging aprobada ejecutar `checks/regional-preflight.sql` antes/después y `checks/regional-staging-check.sql` después. Ambos son de solo lectura. Exigir flags PA falsos, perfiles correctos, centavos exactos, permisos idénticos salvo diferencias aprobadas y sin pérdida de hechos UY. Un aumento de revisiones de caché es esperado; otras diferencias de datos requieren explicación.

## 5. Edge/frontend y ensayo regional

Después de autorizar expresamente despliegues **solo de staging**, instalar las tres Edge Functions de `candidate/supabase/functions`; revisar JWT según CONFIGURACION.md. Generar artefactos frontend en carpetas nuevas con URL/clave pública staging exclusivamente. Para ensayos usar el empaquetador existente con `{verificationOnly:true}`: mantiene el aviso de integración y la conexión real, sin acreditar homologación ni habilitar el build PA. La configuración de runtime posterior para altas PA solo procede con otra autorización y flags del servidor comprobados. Nunca ejecutar el workflow productivo ni usar variables GitHub existentes. Un artefacto `verificationOnly` sirve para inspección, no para declarar homologación; no falsificar `CLOUD_BACKEND_VALIDATED=1` para saltar su bloqueo.

Mantener PA cerrado al principio. Para ensayar PA se requiere autorización específica para abrir flags **solo en staging**, crear los negocios ficticios y cerrar nuevamente al terminar. La apertura técnica no incorpora el catálogo comercial PA. Ejecutar CASOS.md con sesiones normales. Conservar estado B (base regional, PA cerrado) y C (datos PA, contrato compatible) para recuperación.

## 6. Evidencia y salida

Por caso: versión frontend/Edge/BD, ref, rol/plan/negocio, solicitud depurada, respuesta, lectura posterior y efectos de cola/Storage/Realtime. No JWT, enlaces privados, secretos o datos productivos en Git. No marcar aprobado lo simulado/local o no ejecutado. Al terminar cerrar flags de ensayo, pausar workers y registrar el resultado. Producción continúa pendiente de otra autorización.

Fuentes: [CLI](https://supabase.com/docs/reference/cli/supabase-db-push), [precios](https://supabase.com/pricing), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Precios sujetos al checkout real; no se contrató nada.

## Estado de esta preparación

El generador offline y las regresiones de bloqueo pasaron 3/3 pruebas enfocadas. El SQL de verificación nuevo está preparado, no ejecutado contra Supabase ni certificado por un parser nativo en esta misión. No se repitieron las suites funcionales ya cerradas porque no se modificó producto, migraciones ni permisos. No hay un nuevo despliegue, proyecto, usuario, token o backup remoto.
