# Homologación final local — Uruguay y Panamá

14 de noviembre de 2026 · Rama `codex/multicountry-uy-pa` · base `002868f`.

**Resultado: candidato preparado para homologación de staging; no aprobado para producción.** No se accedió a infraestructura remota ni se utilizaron credenciales. No se modificaron datos productivos ni se hicieron push, merge o despliegues. Las sesiones de prueba son fixtures locales, no usuarios reales de Supabase.

## Hallazgos por gravedad

| Gravedad | Hallazgo y estado | Evidencia / condición de cierre |
|---|---|---|
| Alta, corregida localmente | Instalar soporte regional podía permitir altas o reservas públicas PA antes de autorizar su lanzamiento. | Banderas privadas de registro y acceso público PA, ambas falsas desde la primera migración. Verificación de servidor y UI; el fallo de la sexta migración no abre altas. |
| Alta, pendiente externa | La base reconstruida proviene de las migraciones del repositorio, no de una introspección autorizada del proyecto productivo. Auth, PostgREST, Edge, Storage y Realtime reales no se homologan con PGlite. | Comparación del esquema efectivo y ejecución del plan de staging autorizado. No publicar por inferencia a partir de las pruebas locales. |
| Alta, pendiente operativa | ALTER/backfill adquieren bloqueos. El tamaño y la concurrencia reales no están medidos; tampoco existe evidencia de restauración nativa del entorno de destino. | Medir bloqueos, WAL y duración en copia representativa; acordar ventana/presupuesto operativo y probar respaldo completo. Si no cumple, rediseñar la aplicación por fases antes de producción. |
| Media, corregida localmente | Un cliente anterior podía interpretar datos PA como UYU/Montevideo. | Lecturas de negocio/catálogo PA exigen el marcador de protocolo; gateway comprueba clientes públicos antiguos. UY conserva compatibilidad. El marcador no autentica ni otorga permisos. No es un cortafuegos de versión para cada RPC privada: no introducir datos PA hasta completar toda la actualización. |
| Media, corregida localmente | La nueva función trigger heredaba EXECUTE público por defecto. | REVOKE explícito. Se comprobaron las siete funciones/alias añadidos: ninguna ejecutable directamente por clientes. |
| Media, pendiente comercial | Precios, fiscalidad y contratación PA sin aprobación. | US$10/19/29 solo se presentan en localhost como propuesta. Fuera de local se ocultan los importes. Catálogo y solicitudes de contratación PA siguen bloqueados en backend. |
| Baja, limitación conocida | La infraestructura activa de publicación es GitHub Pages estático; no ofrece el país de Cloudflare al JavaScript de la landing. | Sin consulta IP ni servicios añadidos. Hay punto de entrada para una pista de país inyectada por infraestructura futura; hoy predomina selección manual y UY por defecto. |

## Cambios y pruebas de seguridad

Se reconstruyó el esquema anterior y el candidato completo. Las **34 políticas efectivas public/storage**, GRANT de tablas/esquemas y ACL de funciones existentes permanecen iguales. Las 43 tablas públicas mantienen RLS. Se compararon expresiones USING/WITH CHECK, roles y comandos; no se tomó el mero indicador RLS como prueba de aislamiento.

Se verificaron SECURITY DEFINER con search_path vacío, revocación de alias internos, acceso entre dos propietarios, empleado/anon, modificación de flags privados, sesión inconsistente y suplantación de memberships mediante pg_temp. Estos ataques fueron rechazados. La matriz local UY/PA × Individual/Negocio/Pro conserva límites 1/4/10 e Individual sin estadísticas. No se ampliaron herramientas/permisos productivos de IAtry ni se homologaron nuevos roles remotamente.

El gateway conserva comprobaciones de origen, prueba antiautomatización, límite y cuerpo antes de cualquier escritura. La nueva comprobación de compatibilidad en POST ocurre después de validar la prueba, sin convertirla en una vía para omitir CAPTCHA. Una regresión del fixture de proof se adaptó al protocolo actual; el caso de clientes antiguos se prueba separadamente.

## Integridad monetaria y funcional

`price_uyu` conserva su significado. UY se amplía en centavos explícitos; PA guarda USD en entero `price_minor` y mantiene el legado UYU en cero. No hay conversión de divisas. Se verificaron USD12,99, propuestas/correcciones, snapshot histórico tras editar servicio, visita combinada USD26,00, CSV y estadísticas con moneda. Fechas y horarios se resuelven por negocio (America/Montevideo / America/Panama), incluyendo cambio de espacio, medianoche, recurrencias, ausencias, reprogramación, conflictos e idempotencia.

En la restauración local, las columnas originales de **66 tablas** conservaron sus datos. Única variación esperada: incremento de revisiones de caché de calendario por los backfills; no pérdida de registros. Pasaron restauración anterior, aplicación incremental, fallo transaccional y restauración de una copia que ya contiene centavos PA. **Es una prueba de archivo de clúster PGlite, no de pg_dump/PITR/Supabase ni de capacidad operativa de recuperación.**

## Compatibilidad y orden de despliegue

Se requieren ahora **seis migraciones**, las cinco regionales más `202611140001_regional_release_guards.sql`; orden exacto y SHA-256 en `effective/candidate-manifest.json`.

1. Preparación autorizada: inspección de esquema, backup y restauración, medir carga/bloqueos, homologar staging. Conservar artefactos/configuración anterior y compatible, sin secretos en el repositorio.
2. Primera publicación de compatibilidad UY con registro/publicación PA cerrados. El frontend nuevo funciona con la base UY anterior: comprobado con el adaptador real y propuesta/confirmación/relectura locales. No mostrar altas PA con un backend antiguo.
3. Migraciones 001→006 en la ventana aprobada, con flags PA falsos y sin exposición de datos PA. Las llamadas UY del contrato anterior funcionan con base nueva y conservan ACL; esa prueba de RPC no sustituye ensayar el artefacto frontend anterior completo en staging. No intercalar apertura regional durante una aplicación parcial.
4. Publicar Edge y frontend regionales verificados. El SDK incorpora `x-client-info: atry-turnos-regional/1`, estándar ya contemplado por CORS; debe comprobarse en staging real. Conservar PA cerrado hasta verificar las versiones de toda la flota/servicios y eliminar cachés obsoletas según el mecanismo real.
5. Solo otra autorización puede abrir `pa_registration_enabled`, después `pa_public_enabled`. Las banderas no habilitan precios ni catálogo pagado. Build PA exige simultáneamente `PUBLIC_PA_REGISTRATION_ENABLED`, `REGIONAL_BACKEND_VALIDATED` y `PA_RELEASE_APPROVED`; no se configuró ninguna variable remota.
6. Contratación PA requiere catálogo aprobado, fiscalidad/condiciones resueltas y validación propia; queda fuera de esta autorización.

Cada transacción tiene lock_timeout 2s y statement_timeout 30s: limitan espera y duración de sentencias, no garantizan actualización sin interrupción. No reintentar ciegamente después de una respuesta incierta: inspeccionar historial/esquema/locks antes de decidir.

## Landing comercial

Catálogos separados por país; precios UY derivan del catálogo actual sin modificarlo. Selector compacto que actualiza en React sin recargar. Preferencia manual funcional en almacenamiento local, independiente del negocio autenticado; prevalece sobre la pista aproximada opcional. Si almacenamiento está bloqueado, funciona durante la visita. No se añadió rastreo ni se deduce el país por idioma.

En local: UY790/1490/2490 y propuesta PA10/19/29. En host no local: PA muestra Próximamente sin importes ni contratación; demos se identifican como Uruguay. No cambia el país de negocios registrados, ni sus datos, permisos o planes.

## Checklist de autorización futura

- [ ] Comparación remota autorizada de esquema, RPC, RLS/ACL, extensiones y versiones contra el manifiesto.
- [ ] Backup de base + Storage + inventario de Auth/Edge/configuración; restauración separada demostrada y RPO/RTO aceptados.
- [ ] Ensayo nativo con volumen/concurrencia: bloqueos, tiempos, restauración, integridad e idempotencia.
- [ ] Matriz de staging real completada con usuarios/roles/planes y canales de prueba expresamente autorizados.
- [ ] UY con frontend/base/Edge en versiones mixtas, permisos y contratos comprobados; PA cerrado.
- [ ] Artefacto y variables por entorno revisados; rollback compatible preservado; ninguna clave ni fixture en distribución.
- [ ] Aprobación explícita de migraciones y publicación, separada de habilitación pública/comercial PA.
- [ ] Para PA comercial: aprobación de precios, impuestos, condiciones y catálogo; aún pendiente.

## Fuentes oficiales y límites

- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y [funciones](https://supabase.com/docs/guides/database/functions): aislamiento depende de políticas/roles y exposición de funciones, no solo de activar RLS.
- [Supabase: backups](https://supabase.com/docs/guides/platform/backups) y [backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore): preparar restauración de base y recursos asociados por separado; un backup de base no conserva los bytes de Storage. Revisar límites del plan y credenciales/roles/configuraciones no incluidas antes de elegir un procedimiento.
- [Cloudflare: geolocalización IP](https://developers.cloudflare.com/network/ip-geolocation/): pista aproximada dependiente de infraestructura; no incorporada como servicio a este candidato.

Resultados reproducibles en `VERIFICACION.md`, recuperación en `ROLLBACK.md`, matriz externa en `staging/PLAN.md`. El candidato no incluye certificación de seguridad absoluta, de legalidad ni de infraestructura remota.

La inspección visual local de la sección de planes confirmó composición/legibilidad en móvil390 y escritorio1440. Las capturas de QA temporales no forman parte del artefacto. El paquete de verificación local dejó PA cerrado y excluyó scripts, migraciones, autorizaciones y documentación de auditoría; usó claves públicas ficticias, sin conexión remota. Los archivos `_headers` preparados por el empaquetador no prueban que GitHub Pages aplique esas cabeceras: verificar las respuestas del hosting autorizado antes de atribuirle esas protecciones.
