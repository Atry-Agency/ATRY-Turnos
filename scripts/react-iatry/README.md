# Validación Supabase aislada — preparada, no ejecutada

El proyecto `lmdranjpocslqubqhrvb` fue confirmado por el usuario como productivo: queda bloqueado en código para este harness. La revisión del enlace no dispuso de una sesión autenticada del dashboard. No se ejecutó SQL ni se leyó o modificó su contenido.

`node scripts/react-iatry/supabase-integration.cjs` no carga archivos `.env`. Sin variables de prueba produce un resultado `blocked` y cero solicitudes de red. No reutiliza `PUBLIC_SUPABASE_URL`, `SUPABASE_URL` ni sus claves.

Para una ejecución futura hace falta un proyecto NUEVO y desechable con el esquema de ATRY, workers/correo/pagos apagados y únicamente negocios con prefijo `qa-react-iatry-`. Un responsable debe preparar el marcador de `isolated-environment-marker.sql` con su referencia real. Este SQL no se ejecuta automáticamente ni modifica migraciones del producto.

Variables específicas, sin valores reales en el repositorio:

```
TEST_SUPABASE_URL=https://REFERENCIA-AISLADA.supabase.co
TEST_SUPABASE_PROJECT_REF=REFERENCIA-AISLADA
TEST_SUPABASE_PUBLISHABLE_KEY=CLAVE_PUBLICA_DEL_PROYECTO_AISLADO
TEST_SUPABASE_ADMIN_KEY=CLAVE_ADMIN_DEL_PROYECTO_AISLADO
ATRY_ISOLATED_SUPABASE_ACK=I_CONFIRM_THIS_PROJECT_IS_DISPOSABLE
ATRY_ALLOW_FIXTURE_WRITES=1
ATRY_TEST_WORKERS_DISABLED=1
```

El harness comprueba el marcador antes de escribir, crea cuentas `example.test` autoconfirmadas sin enviar correo, usa sesiones reales y prueba dos negocios, RLS, roles, catálogo, clientes, disponibilidad, concurrencia de reservas, Storage privado, límites por plan y lectura de WhatsApp manual. No abre WhatsApp ni envía mensajes. Las claves y contraseñas no se escriben en los resultados. Los fixtures se conservan identificados para inspección: no hay truncación ni limpieza global automática.

**Estado actual:** únicamente se ejecutaron las guardas locales. Los escenarios remotos están preparados y revisados contra los contratos SQL, pero no se declaran aprobados. Tampoco cubren el CAPTCHA de escritura pública real, correo entregado ni pagos; esos servicios están expresamente deshabilitados.
