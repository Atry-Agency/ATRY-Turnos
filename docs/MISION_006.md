# Misión 006 — identidad, apariencia y operación comercial

**Estado al 16/10/2026: desarrollo y validación local terminados; migraciones 038–039 y publicación remota pendientes de ejecución/verificación.** La versión pública sigue siendo la Misión 005 hasta aplicar primero las migraciones y desplegar la interfaz. Proyecto exclusivo: Supabase ATRY Turnos `djoxdtloqwbrhgtgencc`. No intervenir ATRY Lab.

## Cambios implementados en esta rama

- Identidad Atry con violeta `#4754E6`, cian `#00EFFF` y `#00A5E2`, celeste `#BCDAED` y rosa de alerta `#FF2D55`. Los tokens, foco, radios, espaciados, sombras y movimiento reducido viven en `web/appearance.css`; se conserva el símbolo oficial del repositorio. La alerta emplea tinta oscura para contraste sobre fondo rosa claro.
- La configuración del negocio tiene **Apariencia e identidad** para propietarios: logo, dos colores HEX, tema claro/oscuro, paletas sugeridas, vista previa comparativa, descartar y restaurar. La selección extrema se ajusta al renderizar para mantener contraste AA del botón y el texto; se guarda el HEX elegido. La página pública y el panel comparten la apariencia del negocio. Al cambiar de organización, cerrar sesión o abrir Control Center, se limpia el tema anterior.
- Nuevas columnas aditivas `businesses.secondary_color` y `appearance_mode`, RPC de propietario `atry_save_appearance`, y proyección pública acotada. No se almacena CSS o JavaScript. La API local reproduce el comportamiento. La apariencia no concede acceso ni cambia capacidades de planes.
- Control Center: incidencias administrativas nuevas con sesión reciente, motivo, asignación, prioridad e idempotencia; textos, fechas de Uruguay y vencimiento inclusivo; tamaño de datos en MiB; error y proveedor de correo bajo detalle técnico; lista de incidencias vacía compacta; acciones de emergencia agrupadas; filtros de estado en español; guías de diagnóstico; enlace a la bandeja de incidencias corregido. Las incidencias conservan historial y cierre con resolución.
- Monitor GitHub Actions programado cada cuatro horas para una comprobación HTTP pública sin secretos. Su alcance es la disponibilidad de páginas y recursos consultados, **no** Auth, PostgreSQL, Brevo ni entrega de correo. No se añadió servicio pago.
- `index.html`, manifest y service worker versionados para evitar mezcla de CSS/JS. El servidor local sirve los dos nuevos archivos de apariencia.

## Evidencia local

La suite integrada pasó **129/129, cero fallos y cero omitidas**, incluida la regresión de archivos estáticos. Las pruebas nuevas verifican aislamiento del propietario, lectura por personal, rechazo de datos maliciosos, apariencia pública, contraste de colores extremos, limpieza de tema, idempotencia y auditoría de incidentes, y rutas HTTP locales. La prueba visual detectó que faltaban los archivos nuevos en la lista de recursos permitidos; se corrigió y se añadió regresión.

Chrome headless sobre una base SQLite **ficticia aislada** completó login de propietario, editor a 1280×800 y 390×844, guardado de `#FFFFFF`/`#FF2D55` en tema oscuro, reservas públicas y Control Center. Todas las capturas reportaron ancho del documento igual al viewport, sin desbordamiento horizontal. Capturas reales locales, fuera de Git: `../mision006-validacion/`. El tema del Control Center regresó a Atry después de visitar un negocio personalizado. Estas capturas **no** prueban producción ni Supabase.

## Despliegue seguro pendiente

1. Recuperar acceso autenticado al proyecto **ATRY Turnos**. Comprobar URL y referencia `djoxdtloqwbrhgtgencc`, ledger 007–037, conteos de negocios/usuarios/reservas y RLS. Hacer nueva copia puntual gratuita fuera de Git antes de migrar y registrar alcance/hash. La copia anterior de M005 no sustituye una copia actual.
2. Revisar los SQL 038 y 039 contra las funciones reales del proyecto y aplicar **038 antes de 039**, cada uno en transacción con hash en `private.migration_ledger` según `scripts/prepare-control-migrations.js`. Verificar conteos invariantes, grants de RPC, propietario frente a empleado/tercero y lectura pública sin datos privados. Hacer mutaciones de prueba solo dentro de transacciones revertidas.
3. Publicar por el flujo existente de GitHub después de verificar las RPC remotas y CI; comprobar en Chrome la cuenta real de Atry Agency, negocio real en lectura, escritorio y 390 px. No crear clientes/reservas ficticias en producción. Confirmar el monitor y el coste efectivo dentro de cuotas gratuitas.

No publicar el frontend antes de las RPC: la sección de apariencia y el registro administrativo de incidencia dependen de ellas. Las herramientas de eliminación definitiva siguen deshabilitadas. La copia manual no incluye automáticamente Auth, secretos ni archivos Storage y no demuestra restauración integral.

## Límites y preparación comercial

Los planes pagos y precios actuales permanecen intactos: Individual 790 UYU, Negocio 1.490 UYU, Pro 2.490 UYU. El tratamiento impositivo se presenta como **Pendiente de definir**. La personalización visual se ofrece sin nueva tarifa. El plan Prueba actual conserva sus límites de cinco profesionales y 900 correos/ciclo; se propone revisar a **un profesional, 30 correos operativos y 14 días**, solo para pruebas nuevas y tras evaluar el efecto comercial. No se cambió ninguna suscripción existente. [Brevo documenta 300 envíos diarios en Free](https://help.brevo.com/hc/es/articles/208580669-FAQ-Cu%C3%A1les-son-los-l%C3%ADmites-del-plan-Gratis); esa cifra es compartida y no equivale a cuota disponible verificable por negocio.

Brevo puede autenticar webhooks con Bearer ([documentación](https://developers.brevo.com/docs/secured-webhooks)), pero `atry-mail-events` continúa deshabilitado hasta configurar token, webhook y prueba real. Aceptación del proveedor no se llama entrega confirmada. No hay conciliación bancaria, factura fiscal, eliminación integral, restauración probada, validación de carga a gran escala ni chequeo independiente de todos los componentes. No se contrató ningún servicio.

El veredicto comercial se emitirá tras publicación, prueba remota de permisos y recorrido completo aislado de contratación/reserva. El código local por sí solo **no** demuestra que la versión pública esté lista para vender.
