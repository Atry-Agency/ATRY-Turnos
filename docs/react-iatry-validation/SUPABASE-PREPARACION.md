# Supabase: auditoría y preparación del entorno aislado

Fecha: 25/10/2026. Rama experimental: `codex/react-iatry-consolidation`.
Estado: preparación local; ejecución remota detenida a la espera de proyecto y autorización explícita del titular.

## Hallazgos de configuración

- `lmdranjpocslqubqhrvb` es PRODUCTIVO y permanece excluido. No se accedió a su base, usuarios, políticas ni configuración. No se usaron claves administrativas ni se realizaron solicitudes a sus APIs.
- `frontend/react/public/runtime-config.js` utiliza `backend: 'local'`. No acredita una conexión React/Supabase real.
- No hay variables Supabase/de aislamiento en el proceso ni archivos `.env` o `.env.local` en raíz o frontend React. No se abrieron archivos privados de credenciales históricos ni se reutilizaron secretos.
- `supabase/config.toml` es configuración de desarrollo local: PostgreSQL 17, Auth con confirmación de correo, redirects a localhost:3300. No describe el estado remoto ni el preview actual de React en 3321.
- Hay 46 archivos de migraciones versionadas. Deben revisarse y aplicarse ordenadamente solo al proyecto nuevo, comprobando ledger, extensiones, grants, RLS, RPC y Storage. No usar los SQL tail ni regeneradores como sustituto automático de las migraciones.
- Scripts históricos de conexión/probes y documentación apuntan también a `djoxdtloqwbrhgtgencc`. No se asume que sea aislado: su documentación menciona publicación y correo real. `serve-cloud-verification.js` sirve además el frontend histórico. Ninguno se ejecutó para esta tarea.
- El paquete local de React admite configuración Supabase pública mediante `scripts/build-pages.js` y `scripts/react/package.cjs`. Para QA se usará una carpeta local separada y `verificationOnly`, sin despliegue ni `CLOUD_BACKEND_VALIDATED=1`. Solo clave pública en el navegador; claves administrativas exclusivamente en el proceso de preparación/test.
- El harness `scripts/react-iatry/isolated-config.cjs` deniega la referencia productiva, exige URL/ref explícitas, credenciales exclusivas y reconocimiento de escrituras ficticias. No carga `.env` automáticamente. Antes de crear fixtures, el runner verifica marcador y ausencia de negocios ajenos al prefijo QA.
- El marcador es una declaración humana, no prueba que correo, cron o servicios de terceros estén realmente apagados. Habrá que comprobarlo antes de admitir escrituras de prueba.

## Recurso necesario y permiso pendiente

Se necesita un proyecto Supabase NUEVO y vacío, por ejemplo `ATRY React IAtry QA`, independiente de producción. Preferir organización Free que tenga cupo. Supabase documenta dos proyectos gratuitos activos; confirmar que el dashboard indique Free sin coste antes de crear. No crear proyectos adicionales dentro de una organización de pago suponiendo que serán gratis. Si no hay cupo, detenerse y decidir con el titular; no pausar proyectos existentes ni contratar recursos.

No conectar GitHub, no importar datos/respaldos de producción, no configurar SMTP, pagos, WhatsApp ni webhooks externos. No copiar secretos de producción. El titular crea el proyecto y comunica inicialmente SOLO su URL/ref, junto con autorización explícita para preparar esquema, Auth, Storage, función pública y fixtures ficticios en ese destino. No publicar credenciales en el chat.

## Preparación posterior a la autorización

1. Validar URL/ref diferentes de producción y reconocer explícitamente el proyecto como desechable. Comprobar plan Free en el dashboard. No se necesitan credenciales de producción ni un token global de administración de la cuenta.
2. Configurar localmente las claves exclusivas del proyecto nuevo en `data/react-iatry-private/isolated.env` (ignorado por Git por estar bajo `data/`). No hacer logs ni adjuntar ese archivo. El runner no lo carga: se pasará su contenido únicamente al proceso autorizado mediante un cargador local revisado. No ejecutar `source` sobre un archivo de procedencia no revisada.
3. Revisar/aplicar las 46 migraciones al destino nuevo mediante conexión explícita, sin enlace a producción ni comandos push/reset implícitos. Registrar versiones aplicadas. Las migraciones se revisarán antes de su ejecución; este documento no equivale a que ya hayan pasado en Supabase alojado.
4. Verificar RLS de tablas, privilegios de funciones SECURITY DEFINER y sus search_path; bucket privado `staff-photos`, límite/tipo de archivo y políticas de objetos. Usar cuentas autenticadas/anon para los asserts de seguridad. Admin solo aprovisiona fixtures y estados de plan de QA; nunca representa al usuario en una prueba de autorización.
5. Mantener `private.runtime_settings.mail_enabled=false`, sin cron ni Edge de correo activa y sin credenciales de proveedores. No desplegar `atry-mail` ni `atry-mail-events`. Revisar configuración efectiva, no solo flags del test. Sin teléfonos/contactos reales; cuentas `example.test`.
6. Auth: habilitar email/password y redirects locales exactos del servidor QA elegido. Para registro sin envío real, desactivar confirmación de email SOLO en QA, con autorización, y declarar que confirmación/recuperación por correo no quedarán comprobadas. Mantener ese pendiente visible. Si se requiere validarlas, se necesitará un capturador de correo aislado autorizado; no usar SMTP productivo.
7. Para reserva pública usar la función `atry-public` y protección real compatible con el origen local. Revisar su handler y configurar sus secretos únicamente del proyecto QA; nunca eludir protección en código productivo. No registrar Turnstile ni otros recursos externos sin autorización adicional. Probar también rechazos de origen/token/usuario. No contar una RPC directa como prueba completa de reserva pública desde React.
8. Crear marcador `atry_test_environment` a partir del SQL preparado, insertar la referencia QA y atestaciones SOLO después de verificar las condiciones. La clave admin QA se usa en servidor/test, nunca en runtime-config ni bundles.
9. Generar paquete React QA local con URL y clave pública aisladas. Desactivar demo y verificar que ninguna API esté simulada. Permitir solo destinos QA/autorizados; denegar producción en el runner del navegador. Sin grabaciones ni capturas. Conservar la importación sincrónica de Servicios y medir navegación + tiempos de red por separado.
10. Fixtures identificados por ejecución: negocios para Individual/Negocio/Pro, dos propietarios independientes, encargado y empleado; también usuario sin membresía y sesión revocada. Guardar IDs de ejecución sin contraseñas/JWT. No truncar ni limpiar globalmente; definir limpieza limitada a los IDs de QA al cerrar, con autorización.

Variables necesarias en el proceso de prueba (valores SOLO del proyecto nuevo):

```
TEST_SUPABASE_URL=https://REF-QA.supabase.co
TEST_SUPABASE_PROJECT_REF=REF-QA
TEST_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
TEST_SUPABASE_ADMIN_KEY=CLAVE_PRIVILEGIADA_QA
ATRY_ISOLATED_SUPABASE_ACK=I_CONFIRM_THIS_PROJECT_IS_DISPOSABLE
ATRY_ALLOW_FIXTURE_WRITES=1
ATRY_TEST_WORKERS_DISABLED=1
```

Para aplicar esquema se necesitará además un medio autorizado de ejecutar SQL contra QA: dashboard autenticado o credencial de conexión exclusiva de QA guardada privadamente. Las claves API por sí solas no sustituyen una conexión SQL para aplicar migraciones.

## Cobertura existente y ampliación requerida

El harness actual está preparado pero NO ejecutado en Supabase real. Prueba por SDK/RPC cuentas autoconfirmadas, dos negocios, algunas denegaciones de RLS/RPC, roles, catálogo, cliente, conflicto de dos reservas, foto privada y límites Individual/Pro. No equivale a validación integral desde React.

Ampliación tras preparar el destino:

- Registro real desde React, login/logout, negocio nuevo/edición y cambios de negocio/sesión. Verificar que logout no deje datos o permisos anteriores. Sin fingir un registro mediante admin.createUser.
- Los tres planes y límites del servidor, no solo ocultación de botones. CRUD de servicios según contrato: si no existe borrado físico, declarar la semántica real de ocultar/archivar y comprobar reservas previas; no introducir borrado para satisfacer un nombre.
- Profesionales, asignaciones, horario semanal, descansos, ausencias; disponibilidad resultante. Reservas públicas por Edge y manuales por sesión, conflictos, idempotencia, cancelación y reprogramación.
- Clientes/historial y apariencia persistidos al recargar. Storage privado, público autorizado, MIME/tamaño/ruta y accesos cruzados.
- RLS y RPC por negocio, propietario/encargado/empleado/anon/sin membresía; IDs ajenos manipulados, escritura directa, revocación y concurrencia. Probar lecturas y escrituras, no solo conteos vacíos.
- Notificaciones y sus estados sin proveedor de envío: no afirmar entrega a partir de una configuración. La entrega real de correo/WhatsApp sigue excluida.
- IAtry con sesiones/negocios reales: contexto autorizado, destinos según rol, memoria separada, preferencias, transición confirmada de servicio, ausencia de datos previos tras cambio de negocio/logout, no interferencia en formularios y ninguna lectura propia adicional innecesaria. Comparar solicitudes del mismo flujo con/sin asistencia.
- Rendimiento enfocado: navegación a Servicios sin fallback de 300 ms, CPU/red separadas, estabilidad de ciclos y errores de consola. No extrapolar los 4,6 ms del demo a red real.

## Estado y veredicto de esta fase

No se ejecutaron pruebas contra Supabase real. Se revisaron archivos/configuración local y documentación oficial pública; se pueden ejecutar guardas unitarias sin red. No se encontraron aún defectos remotos demostrados; sí brechas de cobertura y configuración descritas arriba. No es posible certificar reemplazo de la versión original hasta completar la validación aislada y corregir los fallos que arroje.

Archivos de esta fase: este procedimiento y el resultado de guardas locales `evidence/supabase-preparation-guards.txt`. Código de producto, producción, main y documentos visuales sin modificaciones.

Fuentes oficiales consultadas:
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/billing-faq
- https://supabase.com/docs/guides/platform/free-project-pausing
