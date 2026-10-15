# Correo operativo de Atry Turnos

Proyecto exclusivo: ATRY-Turnos (`djoxdtloqwbrhgtgencc`). Cuenta Brevo Atry Agency, plan gratuito. No se contrató dominio ni plan de pago.

## Configuración y pruebas reales

- Supabase Auth usa el SMTP personalizado de Brevo, puerto 587 y nombre Atry Turnos. El remitente de la cuenta está verificado. Brevo registró la entrega del correo real de recuperación autorizado.
- `atry-mail` mantiene verificación JWT del gateway y exige el token exacto de invocación del servidor. Una llamada anónima respondió 401; la llamada de servicio respondió 200.
- La clave API de Brevo está en los secretos de las funciones, junto con el remitente verificado. No se incluye en la web ni en GitHub.
- La ejecución privada usa `MAIL_INVOKE_KEY`; el acceso interno a PostgreSQL usa la credencial de servicio del runtime. Separarlos evita depender de que la credencial heredada del panel y la del runtime tengan idéntico formato.
- El job `atry-turnos-mail` está activo cada dos minutos. La credencial existente de invocación está cifrada en Vault y no aparece en el comando del job.
- La prueba integral recorrió SQL → pg_net → Edge Function → Brevo. El trabajo `system:deployment-verification:20261014` se procesó en un intento, obtuvo un ID de proveedor y la API de eventos de Brevo confirmó `delivered` para el destinatario autorizado. Es un registro de comprobación del sistema, sin negocio, cliente ni reserva ficticios.
- La migración 024 descarta mensajes de estados y horarios superados por cambios posteriores. La 025 muestra el proveedor configurado en el diagnóstico administrativo. Ambas conservan los permisos existentes.

## Límites y seguridad

La aplicación limita su cola a 200 intentos diarios. El plan de Brevo mostrado durante la configuración incluye 300 emails al día, compartidos entre SMTP y API. Auth conserva sus propios límites de solicitudes. Agotar el cupo del proveedor puede diferir mensajes; la aplicación no lo presenta como entrega.

Brevo adapta el remitente de Gmail a un dominio técnico `brevosend.com`. La entrega de las pruebas quedó comprobada. Para una identidad de dominio propia se necesitará autenticar un dominio controlado por Atry; no se compró ninguno.

`provider_accepted` significa aceptación del proveedor. La interfaz lo distingue de `delivered` y de `delivery_unknown`. Los recibos de entrega aún no se sincronizan automáticamente a la base; la entrega de esta prueba se comprobó contra la API del proveedor. No debe marcarse una entrega a partir de una respuesta HTTP de aceptación solamente.

Los esquemas `net`, `vault` y `private` devolvieron 406/PGRST106 al intentar acceder con la clave pública por la Data API. Vault y la función privada de invocación deniegan a los roles de la aplicación. Los objetos administrados de pg_net pertenecen a `supabase_admin` y mantienen grants heredados; los REVOKE del rol postgres pueden no modificarlos. Su aislamiento depende además de que `net` siga fuera de la Data API y los roles anon/authenticated sigan NOLOGIN. No debe exponerse ese esquema ni crear RPC que permitan consultar libremente sus tablas.

Referencias: [programación de funciones](https://supabase.com/docs/guides/functions/schedule-functions), [permisos administrados de pg_net](https://supabase.com/docs/guides/database/extensions/pg_net#permissions), [eventos de Brevo](https://developers.brevo.com/reference/get-email-event-report).

## Respaldo y operación

Por autorización del titular, la clave API de Brevo y la credencial existente del servidor tienen respaldos cifrados con Windows DPAPI en `data/cloud-private`, ignorado por Git. Su descifrado requiere el usuario Windows actual. La clave SMTP se generó y guardó en Supabase Auth antes de pedir el respaldo local: no existe una copia local recuperable. Las contraseñas personales introducidas por el titular nunca se registraron. El PDF de credenciales solicitado para más adelante no se ha generado.

Para pausar los envíos, deshabilitar `MAIL_DELIVERY_ENABLED` en los secretos y llamar como operador a `atry_configure_delivery` con `enabled=false`. El job puede mantenerse: la función privada no invoca el worker cuando el correo está deshabilitado.

Las claves de Brevo se configuraron con vencimiento de un año; Brevo también advierte que pueden caducar tras 90 días de inactividad. Revisar su vigencia antes de una reactivación y rotarlas desde los paneles si corresponde.
