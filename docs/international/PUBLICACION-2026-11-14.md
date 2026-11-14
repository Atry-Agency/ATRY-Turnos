# Publicación regional — 14/11/2026

## Estado comprobado

- Destino único: Supabase `djoxdtloqwbrhgtgencc`, PostgreSQL 17.11.0.003. No se creó otro proyecto.
- El titular autorizó expresamente continuar sin respaldo. No se generó ni se declara un backup restaurable.
- Las 180 funciones de la base anterior coinciden por huella con producción. Se conservaron las dos funciones adicionales, el ledger privado y el color predeterminado existente.
- Se corrigió el backfill de importes para negocios vencidos: se bloquean las tablas dentro de la transacción, se suspende solo su trigger de suscripción durante el backfill y se restablece antes del commit. Las pruebas incluyen rollback por fallo. Ninguna conexión concurrente observa el trigger deshabilitado.
- Aplicadas y verificadas por separado las seis migraciones; las huellas de las columnas originales de 21 tablas permanecieron idénticas después de cada paso. No se crearon reservas de prueba ni se alteraron suscripciones.
- Historial Supabase: `20261114200519` foundation, `20261114200607` snapshots, `20261114200615` consumers, `20261114200625` whatsapp, `20261114200633` public_commercial, `20261114200812` release_guards. Estos identificadores se corresponden con los seis archivos locales regionales; el historial anterior está en el ledger existente. No ejecutar nuevamente la cadena antigua ni usar `db push --include-all`.
- Edge `atry-public` versión 9 desplegada. Conserva el modo JWT previo, validación de origen, protección antiabuso y CAPTCHA. La versión 8 permanece local para recuperación del código.
- Consultas públicas UY correctas tras migrar; cero discrepancias en importes. Sin nuevos avisos del asesor de seguridad frente al estado anterior.
- 270 pruebas Node aprobadas, compilación y suite React aprobadas; PostgreSQL regional, adaptador/IAtry, compatibilidad anterior UY y pruebas efectivas ACL/RLS aprobadas. Auditoría npm: cero vulnerabilidades de producción.
- Revisión responsive local: 320/390/430/1440, sin desbordamientos y precio USD12.99 al cambiar a Panamá. No equivale a ensayos operativos remotos de Panamá.

## Recuperación de interfaz

Etiqueta remota verificada: `rollback/pre-multicountry-2026-11-14` → `002868f8aa356d6765bf6db9a9cbb527781b5f8c`.
Conservar el esquema aditivo al revertir el frontend; no ejecutar down migrations destructivas. Cerrar los indicadores PA antes de regresar a un frontend anterior. No se promete recuperación de datos sin respaldo.

## Activación

La contratación paga PA continúa bloqueada; su catálogo es una propuesta sin aprobación comercial. No se cambian precios ni contratos UY, herramientas o roles de IAtry.
Pendiente publicar el frontend y abrir los indicadores regionales. La revisión automática rechazó la activación de variables de registro PA por alcance; se solicitó confirmación específica del titular. No se ejecutó esa acción rechazada.
