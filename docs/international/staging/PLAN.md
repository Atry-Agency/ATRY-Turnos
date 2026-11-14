# Plan de homologación Supabase autorizado

**Preparado, no ejecutado.** No hay proyecto ni credenciales autorizados para esta misión. No crear proyectos, usuarios, membresías ni envíos por ejecutar este documento. Identificar un staging aislado, su responsable y el alcance de escrituras/canales antes de intervenir. Nunca utilizar `djoxdtloqwbrhgtgencc` para este ensayo.

## Acceso mínimo y fases

1. Aprobación del proyecto/ref, plazo, esquema esperado y lecturas permitidas. Dos propietarios de prueba con negocios separados; perfiles Individual/Negocio/Pro y encargado/empleado ya autorizados, sin alterar suscripciones productivas. No usar service_role para simular una sesión de usuario.
2. `authorization.example.json` es una plantilla cerrada (`authorized:false`). El ejecutor `staging-readonly.cjs` sin argumentos hace solo dry-run, sin leer credenciales ni red. Para ejecución posterior requiere manifiesto absoluto expresamente aprobado, vencimiento dentro de 24h, ref no productivo, identidades esperadas y sesiones autenticadas del mismo issuer. Las claves/tokens se suministrarán por entorno, nunca en archivos/versionado/logs.
3. Primera ejecución limitada: GET Auth usuario verificado, catálogo propio, denegación de catálogo ajeno y SELECT RLS directo filtrado por negocio prohibido. Esto **no completa** el resto de la matriz ni autoriza escrituras. No llama dashboard/agenda que pudieran materializar recurrencias.
4. Autorizar separadamente registros, valores, tiempos, estado final y posibles efectos de cada ensayo operativo/remoto. Email sink y claves CAPTCHA de prueba; workers aislados del sistema productivo. No basta con correos ficticios si un proveedor intenta entregarlos.

## Matriz requerida

| Área | Ensayo y criterio de aceptación | Evidencia a conservar sin secretos |
|---|---|---|
| Esquema | `regional-preflight.sql` de solo lectura, diff con manifiesto, extensiones, triggers y ACL efectivos; staging equivalente al destino | Hash/versión y diferencias revisadas, no exportar datos personales |
| Auth | Registro normal verificado, login/logout, recuperación, token vencido/revocado, cambio de negocio sin retener contexto ni listeners | IDs ficticios y códigos de respuesta; ningún token |
| Roles y planes | Owners UY/PA y planes1/4/10; Individual sin estadísticas; manager solo contratos permitidos; empleado sin administración. Alteración de bid/staff/service/claims no concede acceso | Resultado por RPC/rol/plan y checks del servidor |
| RLS/RPC | SELECT directo y RPC con sesión normal; ambos sentidos de aislamiento; anon/inactivo/membresía ajena; alias privados no ejecutables | Respuestas filtradas y políticas/ACL comparadas |
| Storage | Buckets realmente usados, upload/read/delete autorizado por separado, rechazo de rutas de otro negocio, tipo/tamaño, URL privada/pública según contrato. Probar bytes restaurados | Hash del archivo ficticio y matriz de acceso; no URLs privadas firmadas |
| Realtime | Dos suscripciones paralelas: evento propio visible y ajeno ausente; logout y cambio de espacio desconectan contexto; header regional no rompe evaluación de políticas | IDs/eventos ficticios y ausencia de filtraciones |
| Edge/CORS | Origen staging admitido; origen ajeno rechazado; OPTIONS, `x-client-info`, límites, firma/proof/Turnstile válido e inválido con claves de prueba. Ninguna RPC de escritura antes de CAPTCHA | Requests depurados y códigos; sin CAPTCHA secrets |
| Reservas | En paralelo contra PostgreSQL nativo: mismo slot, idempotencia/replay, payload distinto con misma clave, timeout tras commit, relectura y no duplicación; crear/reprogramar/estados/visitas combinadas/recurrencias según contrato | IDs exclusivos autorizados, snapshots y conteos antes/después |
| Regional | Al mismo UTC, UY/PA conservan día/hora local; medianoche y año, ausencias completas/multidía, cambio de negocio IAtry; USD12,99 y extremos exactos, UYU histórico intacto | Valores RPC/propuesta/servidor/relectura coincidentes |
| Recordatorios/correo | Workers y colas dedicadas, proveedor en canal de prueba o sink autorizado, tiempos locales, deduplicación/reintentos sin delivery a personas reales | Cola e intentos/entrega al sink. No homologar Brevo con un mock |
| WhatsApp/calendarios | Links manuales +598/+507/número internacional; ICS y Google con zona/horario/ubicación correctos. No enviar mensajes ni prometer sync automática | Parseo de URL/archivo; apertura externa solo autorizada |
| Compatibilidad | Frontend anterior/base anterior; nuevo/anterior UY; anterior/nueva UY; nuevo/nueva ambos; Edge antiguo sin PA; registro PA cerrado por defecto | Versión exacta de cada artefacto y flags |
| Recuperación | Copia nativa desechable, seis migraciones, fallo controlado, restauración anterior y posterior con PA; Storage y config complementarios | Integridad, tiempos, RPO/RTO y responsable |
| Responsive | Chrome/WebKit320/390/430 y desktop, ambos temas donde corresponda, motion normal/reducido, teclado/touch, labels/foco/overflow | Informe local más verificación en dispositivo físico |

## Bloqueos de salida

Si hay fuga, ampliación de rol, reinterpretación de moneda, doble reserva, incompatibilidad UY o restauración no demostrada, no abrir PA ni migrar producción. Parar workers/entrada solo dentro del entorno y alcance autorizado. Conservar datos/evidencia; no usar down destructivo. Ver `../ROLLBACK.md`.

## Procedimiento operativo preparado

Ver EJECUCION.md (proyecto/costos/47+6 migraciones), CONFIGURACION.md (variables y servicios), CASOS.md (fixtures y casos reales pendientes) y RECUPERACION.md (por plan). `prepare-staging.cjs` genera el paquete offline reproducible, sin credenciales ni ejecución remota.
