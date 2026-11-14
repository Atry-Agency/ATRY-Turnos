# Uruguay + Panamá — candidato local integrado

Rama: `codex/multicountry-uy-pa`. Base publicada utilizada: `002868f`.
No se hizo push, merge, despliegue ni acceso de escritura a Supabase. Las escrituras de las pruebas usan exclusivamente bases temporales PGlite/SQLite. PGlite ejecuta PostgreSQL real compilado a WASM; no sustituye la homologación posterior del entorno Supabase/Edge.

## Implementación consolidada

- Perfil por negocio: UY / America/Montevideo / UYU / es-UY; PA / America/Panama / USD / es-PA. Tupla validada por PostgreSQL e inmutable tras creación. No hay país global mutable en React.
- Importes: `price_uyu` mantiene su significado histórico. `price_minor` y `currency` son snapshots explícitos en servicios y reservas. USD 12,99 se guarda como 1299 centavos; las RPC rechazan usar `price_uyu` como USD. Formularios, IAtry, listas, estadísticas y CSV consumen el contrato explícito. El formato monetario evita división binaria para reconstruir los centavos.
- Disponibilidad, creación/reprogramación, visitas combinadas, recurrencias, días completos, ausencias multidía, calendario y ciclos comerciales utilizan la zona IANA del negocio. Las restricciones originales de reservas (por ejemplo, jornadas y conflictos) se conservan.
- Visitas: importes de cada servicio y total exacto, moneda y perfil regional en propuestas, comprobantes y huellas de consistencia. Se conservan tokens privados e idempotencia existentes.
- Estadísticas y exportación: agregados en unidades menores con moneda explícita, sin convertir históricos UYU. Exportación CSV exacta, conservación de las columnas UTC y columnas adicionales de fecha/hora local y zona IANA; defensa existente contra fórmulas.
- Comunicaciones: WhatsApp manual usa el prefijo del negocio cuando falta configuración (+598/+507) y respeta números explícitos de otros países. No se reescriben contactos almacenados. Correos conservan la cola y sus filtros; fechas de alertas y expansión de recordatorios usan los contratos existentes. No se ejecutó entrega a proveedores.
- React: perfil propagado por contratos autenticados/públicos; agenda, reserva manual, página pública, reprogramación, visitas, recibos, Google/Apple Calendar, clientes, horarios y suscripción. La agenda reinicia su fecha local al alternar negocios.
- IAtry: interpretación, correcciones, propuestas, validación decimal, preguntas, confirmación y relectura con contexto regional. Un cambio de negocio invalida el motor anterior y sus referencias. Se mantienen las 17 herramientas y bloqueos vigentes; no se habilitan reservas ni nuevas operaciones del asistente.
- Altas normales y negocios adicionales: selector UY/PA, país transmitido en los metadatos de registro y creación atómica por la RPC existente. PA no hereda una ciudad uruguaya. El adaptador exige `regional_contract=1` antes de crear/finalizar un alta PA contra Supabase; rechaza backends antiguos antes de escribir. El servidor SQLite heredado sigue siendo UY y rechaza PA de forma explícita, sin reinterpretarlo ni crear cuentas. La vista multipaís usa el adaptador cloud y PostgreSQL temporal, no SQLite.
- Contratación: UY conserva catálogo y precios. PA devuelve catálogo vacío y `catalog_available=false`; no ofrece precios UYU, recomendaciones de contratación ni solicitudes. Activación/renovación pagada PA se rechaza en servidor. Pruebas técnicas en bases locales y modo trial continúan funcionando.

## Migraciones preparadas (no aplicadas remotamente)

1. `202611130001_regional_foundation.sql`: perfil, restricciones, puente monetario, snapshots y definiciones temporales efectivas.
2. `202611130002_regional_snapshots.sql`: visitas, respuestas públicas/privadas y exportaciones.
3. `202611130003_regional_consumers.sql`: agregados monetarios y alta regional, incluida finalización del registro verificado.
4. `202611130004_regional_whatsapp.sql`: prefijo predeterminado contextual sin modificar configuraciones existentes.
5. `202611130005_regional_public_commercial.sql`: contexto de ofertas, prestaciones y ausencia de catálogo comercial PA.
6. `202611140001_regional_release_guards.sql`: cierre público PA por defecto, protocolo de clientes compatibles y revocaciones internas. Las banderas cerradas ya se crean en 001; el alta está protegida desde 003.

`effective/candidate-functions.sql` reconstruye 187 definiciones finales desde la cadena local; `candidate-manifest.json` contiene sus migraciones y SHA-256. Las 43 tablas públicas conservan RLS. Los únicos literales Montevideo restantes en funciones son la rama explícita UY de creación y la configuración global heredada sin negocio; los consumidores operativos usan el perfil del negocio.

## Verificaciones

Ver `VERIFICACION.md`. Compilación, suite React, 267 pruebas generales, PostgreSQL regional, adaptador–IAtry y Chrome/WebKit aprobados. Las pruebas de navegador usan un gateway y CAPTCHA simulados dentro de un arnés local; no certifican la configuración real de Turnstile, CORS, correo ni Supabase desplegados.

Vista local: `ATRY_REGIONAL_PORT=3355 node scripts/international/preview.cjs` (127.0.0.1:3355). Contiene Uruguay y Panamá en el selector de espacio activo, con un único propietario ficticio. La interfaz usa las RPC locales mediante el adaptador cloud original. No necesita credenciales reales; la base desaparece al cerrar el proceso. No incluye un nuevo backend de producto ni se incorpora al despliegue.

## Estado y límites reales

Listo para una homologación integral posterior en un entorno Supabase autorizado; no se declara listo para desplegar directamente en producción. Falta contrastar el esquema efectivo remoto con estas migraciones, homologar Edge/Auth/Storage/Realtime y proveedores en el entorno de destino, comprobar respaldo/restauración y autorizar la migración/publicación. El diseño responsive se verificó en Chrome/WebKit con emulación móvil, no en un iPhone físico.

Precios de suscripción, medios de cobro, fiscalidad y condiciones comerciales de Panamá siguen pendientes; su contratación permanece bloqueada. No se inventaron condiciones legales.

La estrategia de compatibilidad y recuperación está en `ROLLBACK.md`. No se debe eliminar `price_minor`, convertir USD a `price_uyu` ni regresar a un cliente exclusivamente uruguayo después de crear datos PA.

## Cierre de auditoría y landing

Ver `AUDITORIA_FINAL.md`: políticas efectivas y ACL conservados, compatibilidad UY, protecciones PA cerradas por defecto, recuperación desechable y límites de staging. No hay aprobación productiva ni restauración remota certificada.

La landing permite elegir país sin cambiar el negocio. UY conserva790/1490/2490; PA10/19/29 es propuesta local, no catálogo contratado. La preferencia manual prevalece sobre una pista de infraestructura opcional; GitHub Pages hoy no la provee. No se agregó geolocalización externa.

## Preparación de staging (sin ejecución remota)

El procedimiento exacto está en staging/EJECUCION.md, con configuración y casos por servicio y recuperación por plan real pendiente de confirmar. `prepare-staging.cjs` genera una copia offline con 47 migraciones baseline y 6 regionales verificadas por hash; pruebas de preparación/bloqueo 3/3 aprobadas. No se crearon recursos ni usaron credenciales.

## Decisión vigente: actualización del proyecto actual

Por instrucción posterior, el destino es únicamente el Supabase actual djoxdtloqwbrhgtgencc; no crear staging ni otro proyecto/base remota. Ver ACTUALIZAR_SUPABASE_ACTUAL.md y operations/regional-production-readiness.sql. Falta lectura del esquema actual y respaldo real comprobado; los planes de staging anteriores quedan como documentación histórica, no como una acción autorizada o requisito de nuevos recursos. Panamá permanece cerrado.
