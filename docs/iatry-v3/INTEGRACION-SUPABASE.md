# IAtry V3 · integración operativa y experiencia móvil

Actualización: [Primera prueba real completada, 3/3](RESULTADO-SERVICIOS-REAL.md). Solo el servicio de prueba de Pelu fue creado, cambió a precio 1 y quedó oculto con autorización expresa; el ensayo está cerrado y no se habilitaron otras operaciones. El contenido de preparación que sigue conserva su contexto histórico.

Actualización de la auditoría remota: [Servicios reales y autorización del primer ensayo](AUDITORIA-REAL-SERVICIOS.md). Producción sí tiene la restricción de jornadas especiales que falta en el esquema local reconstruido; esa capacidad sigue bloqueada hasta homologación.

26/10/2026 · Rama `codex/iatry-v3-supabase`, creada desde `99b07f5` (`codex/iatry-v3`). Conserva el panel aprobado que dio origen al visual publicado `ffc529e` e incorpora los tres iconos Lucide locales de `63a6790`. No se fusionó ni publicó ninguna rama. Supabase definitivo: `djoxdtloqwbrhgtgencc`.

## Resultado

68 capacidades conservadas. **66 pasan con el adaptador cloud existente y las funciones PostgreSQL del repositorio; 2 están bloqueadas para ese backend**. Las 68 siguen pasando contra SQLite local. No se instaló infraestructura, no hay segundo backend de negocio ni llamadas a proveedores de IA.

Estas pruebas NO homologan producción: PostgreSQL corre en memoria con PGlite y migraciones del repositorio, roles Auth simulados y datos ficticios. Solo el harness aplica ese esquema a memoria; no se ejecutaron migraciones en Supabase. Las consultas privadas usan el adaptador publicado `cloud/api-adapter.mjs` sin modificarlo. La disponibilidad pública se conecta dentro del harness al RPC local, sin invocar una Edge Function remota ni probar su despliegue/antiabuso.

El perfil `supabase-local` existe para inyectar el adaptador en las pruebas de Node; no se selecciona mediante URL ni runtime-config del navegador. El perfil `connected` sigue bloqueando TODAS las operaciones experimentales, incluidas lecturas que puedan materializar recurrencias. No se ha habilitado V3 en producción.

## Correcciones y límites encontrados

- `schedule.exception`: el RPC versionado `atry_save_rule` usa `ON CONFLICT(staff_id,day)` pero el esquema final local carece de una restricción que lo sustente. PostgreSQL devuelve “there is no unique or exclusion constraint matching the ON CONFLICT specification”. Acción excluida del perfil cloud antes de cualquier solicitud; no se modificaron SQL ni reglas de negocio. Falta comprobar específicamente esa restricción en el proyecto desplegado.
- `waitlist.booked`: `atry_update_waitlist` admite `waiting` y `cancelled`, no `booked`. Esto también se confirmó leyendo la definición realmente desplegada en el dashboard. Se bloqueó esa acción en cloud; no se reemplazó por aceptar una oferta ni crear una reserva implícitamente.
- Los otros fallos iniciales del harness eran preparación insuficiente de fichas/contactos ficticios y una suscripción local sin vigencia, no errores de producto. Se corrigieron las fixtures sin relajar validaciones.
- Se mantiene el bloqueo de destrucción, administración global, cambios de permisos, operaciones comerciales y envíos. Subida/recorte de archivos, exportación de datos personales y creación privada de visitas combinadas siguen fuera del catálogo operativo actual: requieren reutilizar sus flujos específicos, no inventar un RPC privado ni saltar consentimiento/protección pública.

## Móvil

A menos de 768 px el panel funciona como una hoja modal: fondo `inert`, capa protectora, bloqueo/restauración del desplazamiento, foco contenido y devolución del control al cerrar/minimizar. Escritorio conserva la columna lateral. La altura sigue `visualViewport`, con áreas seguras y controles de al menos 44 px. Los campos usan 16 px para evitar zoom de foco en iOS; la apertura enfoca Cerrar sin levantar el teclado automáticamente. Minimizar conserva el borrador. Rotar a escritorio retira el bloqueo.

Se conserva el emblema, energía líquida, preferencias y movimiento reducido. Los iconos Lucide usan animaciones finitas al interactuar, sin dependencia adicional.

## Validaciones ejecutadas

- Compilación TypeScript/Vite: correcta (advertencias existentes de directivas `use client` de Motion y script runtime-config).
- Suite React/V2 y 16 grupos de seguridad V3: correcta.
- 68/68 conversaciones completas SQLite: previsualización, confirmación única y resultado del servidor.
- 66/66 capacidades habilitadas PostgreSQL + adaptador cloud; 2 exclusiones comprobadas sin solicitud al servidor.
- 4 comprobaciones adicionales cloud: cruce de negocio, CRM denegado al empleado, agenda propia y permisos EXECUTE de RPC privados. Además se comprobó denegación de SELECT directo anónimo. Estos permisos se comprobaron en PostgreSQL LOCAL.
- 28 pruebas existentes PostgreSQL/adaptador cloud: correctas, incluyendo RLS, contratos, conflictos, recurrencias, visitas y colas sin envíos externos.
- Autorización HTTP local: propietario/encargado/empleado, otro negocio, otro profesional, límites de plan y reservas futuras protegidas.
- Chrome y WebKit: servicio, cliente, reserva, reprogramación, cancelación, vista previa, doble clic, borrador externo y responsive.
- Prueba móvil específica en ambos motores: toque fuera sin navegación, fondo inerte, foco, tamaños 320×568 y 390×400, rotación, minimizar/cerrar y navegación posterior. La reducción de viewport aproxima el espacio del teclado; queda pendiente comprobar teclado nativo y VoiceOver en un teléfono físico.

Servicios, mediana de 5 contextos Chrome alternados: V2 **18.6 ms**, V3 **22.6 ms**; 2 solicitudes de ruta en ambos, ninguna consulta al abrir IAtry, mediana de JavaScript en reposo 0 ms. No es una medición de latencia Supabase ni una comparación con la antigua versión de 12,4 ms bajo otro protocolo.

## Auditoría del proyecto real: alcance exacto

Se consultó exclusivamente el dashboard autenticado del proyecto definitivo. El inventario muestra los RPC usados, con firmas para servicios, clientes, equipo, reglas, agenda, recurrencias, visitas, apariencia, WhatsApp, preferencias y estadísticas. Se comprobó que Servicios tiene RLS habilitado y política SELECT para `authenticated`; “API DISABLED” en tablas no implica que sus RPC estén deshabilitados. Se leyó el código de `atry_update_waitlist` y el inicio de `atry_save_rule`, cerrando el editor sin guardar.

No se ejecutó ninguna función de negocio en Supabase, ni se exportaron datos personales. No se certificaron todavía todos los cuerpos/grants/constraints remotos, la identidad real de empleados, ni el despliegue completo de Edge Functions. `audit-supabase-readonly.sql` prepara consultas puras al catálogo para completar firmas, grants, SECURITY DEFINER/search_path, restricciones y RLS; no fue ejecutado remotamente. No contiene migraciones ni invoca RPC de negocio.

## Prueba local

Desde este checkout:

```sh
npm --prefix frontend/react run build
ATRY_V3_PORT=3324 node scripts/react/iatry-v3-preview.cjs
```

Abrir http://127.0.0.1:3324/local-assistant. Solo SQLite temporal ficticio, sin Supabase ni workers de envío. Abrir IAtry y probar crear servicio, volver/cancelar, confirmar, minimizar y retomar. En celular o emulación comprobar desplazamiento, teclado y controles del fondo. El servidor se limita a loopback: no se expuso el equipo a la red para probar desde otro teléfono.

Para reproducir contratos PostgreSQL: `node scripts/react/iatry-v3-cloud.cjs`. Para SQLite: `node scripts/react/iatry-v3-local.cjs`. Las pruebas de navegador usan el Playwright y motores ya instalados; no generan medios. No ejecutar los runners históricos de integración con credenciales de producción.

## Pendientes reales y autorización necesaria

Antes de permitir escrituras reales, completar la auditoría de catálogo remoto y comprobar qué triggers/cron/Edge generan correos o avisos. Cancelar una reserva también puede producir efectos; que IAtry no envíe mensajes directamente NO neutraliza esos procesos. No apagar envíos ni cambiar configuración productiva sin autorización.

Primer ensayo propuesto, TODAVÍA NO AUTORIZADO NI EJECUTADO: en un negocio que el titular identifique, crear únicamente un servicio `IAtry · Validación controlada 2026-10-26`, 15 minutos, precio 0, sin profesionales asignados, cambiar su precio a 1 y después ocultarlo. No crear clientes, usuarios, reservas ni comunicaciones. El servicio podría aparecer en el catálogo entre creación y ocultación; se debe revisar ese efecto y autorizar expresamente los tres cambios y el registro residual. No borrar físicamente para “limpiar”. No autoriza otras capacidades ni su publicación. Las pruebas de reservas/recurrencias/avisos requieren otro alcance y contactos controlados, después de resolver los envíos.

No se realizaron respaldos nuevos ni restauraciones en esta fase. No asumir recuperabilidad a partir de estas pruebas. Para validar RLS remoto con varios roles hacen falta sesiones de prueba autorizadas, no claves administrativas en el navegador.

**Veredicto:** versión local operativa y móvil mejorada, lista para revisión. Integración con contratos cloud comprobada en PostgreSQL local; aún no homologada para habilitar las operaciones V3 en producción. Mantener el frontend actualmente publicado.

## Archivos modificados

- Presentación: `frontend/react/src/iatry/v2/{Provider,AnimatedPanel}.tsx`, `frontend/react/src/iatry/v3/{OperationalPanel,PanelIcon}.tsx`, `v3/useMobileSheet.ts`, `v3/v3.css` y `web/assets/licenses/lucide.html`.
- Compatibilidad: `frontend/react/src/iatry/v3/{access,contracts,engine,cloud-compatibility}.ts`.
- Validación: `scripts/react/iatry-v3-{cloud,mobile,fixture-answers,local,test-build}.cjs`.
- Documentación: este informe, `docs/iatry-v3/README.md` y `audit-supabase-readonly.sql`.

## Matriz de capacidades

“Pasa” significa contrato PostgreSQL LOCAL con confirmación explícita para mutaciones; no prueba en el proyecto productivo. Las 68 pasan por separado en SQLite.

| Capacidad | PostgreSQL local | RPC utilizados / motivo |
|---|---|---|
| `services.list` | Pasa | `atry_catalog` |
| `services.create` | Pasa | `atry_catalog`, `atry_save_service` |
| `services.price` | Pasa | `atry_catalog`, `atry_save_service` |
| `services.duration` | Pasa | `atry_catalog`, `atry_save_service` |
| `services.details` | Pasa | `atry_catalog`, `atry_save_service` |
| `services.buffers` | Pasa | `atry_catalog`, `atry_save_service` |
| `services.deposit` | Pasa | `atry_catalog`, `atry_save_service` |
| `services.assign` | Pasa | `atry_catalog`, `atry_save_service` |
| `services.publish` | Pasa | `atry_catalog`, `atry_save_service` |
| `services.hide` | Pasa | `atry_catalog`, `atry_save_service` |
| `customers.search` | Pasa | `atry_customers` |
| `customers.history` | Pasa | `atry_customers`, `atry_customer_history` |
| `customers.create` | Pasa | `atry_save_customer` |
| `customers.update` | Pasa | `atry_customers`, `atry_save_customer` |
| `team.list` | Pasa | `atry_catalog` |
| `team.create` | Pasa | `atry_catalog`, `atry_entitlements`, `atry_save_staff` |
| `team.update` | Pasa | `atry_catalog`, `atry_entitlements`, `atry_save_staff` |
| `schedule.read` | Pasa | `atry_catalog`, `atry_rules` |
| `schedule.day` | Pasa | `atry_catalog`, `atry_rules`, `atry_save_week` |
| `schedule.absence` | Pasa | `atry_catalog`, `atry_save_rule` |
| `schedule.holiday` | Pasa | `atry_save_rule` |
| `schedule.exception` | Bloqueada | El RPC de jornadas especiales necesita una restricción SQL que no está disponible en el esquema validado. No se ejecutará esta acción. |
| `resources.create` | Pasa | `atry_save_rule` |
| `resources.update` | Pasa | `atry_rules`, `atry_save_rule` |
| `resources.assign` | Pasa | `atry_catalog`, `atry_rules`, `atry_save_rule` |
| `bookings.list` | Pasa | `atry_catalog`, `atry_bookings` |
| `bookings.create` | Pasa | `atry_catalog`, `atry_public_availability`, `atry_customers`, `atry_create_booking` |
| `bookings.confirmed` | Pasa | `atry_bookings`, `atry_update_booking` |
| `bookings.completed` | Pasa | `atry_bookings`, `atry_update_booking` |
| `bookings.cancelled` | Pasa | `atry_bookings`, `atry_update_booking` |
| `bookings.no_show` | Pasa | `atry_bookings`, `atry_update_booking` |
| `bookings.reschedule` | Pasa | `atry_bookings`, `atry_catalog`, `atry_public_availability`, `atry_update_booking` |
| `waitlist.list` | Pasa | `atry_waitlist` |
| `waitlist.cancelled` | Pasa | `atry_waitlist`, `atry_update_waitlist` |
| `waitlist.booked` | Bloqueada | El RPC solo permite volver a espera o cancelar; marcar atendida requiere el flujo de aceptación de oferta existente. |
| `recurring.list` | Pasa | `atry_recurring` |
| `recurring.create` | Pasa | `atry_catalog`, `atry_customers`, `atry_create_recurring` |
| `recurring.replace` | Pasa | `atry_recurring`, `atry_catalog`, `atry_customers`, `atry_create_recurring` |
| `recurring.end` | Pasa | `atry_recurring`, `atry_end_recurring` |
| `visits.read` | Pasa | `atry_bookings`, `atry_visit` |
| `visits.confirm` | Pasa | `atry_bookings`, `atry_visit`, `atry_visit_command` |
| `visits.cancel` | Pasa | `atry_bookings`, `atry_visit`, `atry_visit_command` |
| `visits.reschedule` | Pasa | `atry_bookings`, `atry_visit_availability`, `atry_visit`, `atry_visit_command` |
| `business.summary` | Pasa | `atry_dashboard` |
| `business.statistics` | Pasa | `atry_statistics` |
| `business.insights` | Pasa | `atry_insights` |
| `business.identity` | Pasa | `atry_business`, `atry_save_business` |
| `business.rules` | Pasa | `atry_business`, `atry_save_business` |
| `appearance.colors` | Pasa | `atry_business`, `atry_save_appearance` |
| `public.info` | Pasa |  |
| `plans.read` | Pasa | `atry_entitlements` |
| `access.read` | Pasa | `atry_access` |
| `communications.read` | Pasa | `atry_whatsapp` |
| `communications.settings` | Pasa | `atry_whatsapp` |
| `communications.preview` | Pasa | `atry_bookings`, `atry_whatsapp` |
| `notifications.read` | Pasa | `atry_mail_jobs` |
| `notifications.preferences` | Pasa | `atry_notification_preferences`, `atry_save_notification_preferences` |
| `notifications.hours` | Pasa | `atry_notification_preferences`, `atry_save_notification_preferences` |
| `communications.template` | Pasa | `atry_whatsapp` |
| `business.multi` | Pasa | `atry_save_business` |
| `business.setup` | Pasa | `atry_save_business` |
| `appearance.variant` | Pasa | `atry_business`, `atry_save_appearance` |
| `appearance.public` | Pasa | `atry_business`, `atry_save_appearance` |
| `appearance.secondary` | Pasa | `atry_business`, `atry_save_appearance` |
| `appearance.save_preset` | Pasa | `atry_business`, `atry_save_appearance` |
| `appearance.apply_preset` | Pasa | `atry_business`, `atry_save_appearance` |
| `business.opportunities` | Pasa | `atry_smartslots` |
| `support.incident` | Pasa | `atry_create_incident` |
