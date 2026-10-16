# Misión 004 — contratación y capacidades comerciales

Implementación del 15/10/2026. Proyecto autorizado: **ATRY-Turnos**, referencia `djoxdtloqwbrhgtgencc`. ATRY LAB Operaciones queda fuera de este trabajo.

## Catálogo comercial

| Plan | Precio mensual propuesto | Profesionales activos | Correos operativos por ciclo |
| --- | ---: | ---: | ---: |
| ATRY Individual | $790 UYU | 1 | 0 |
| ATRY Negocio | $1.490 UYU | 4 | 300 |
| ATRY Pro | $2.490 UYU | 10 | 900 |

**Impuestos pendientes de confirmación.** La interfaz identifica los precios como propuestos. El operador puede confirmar impuestos incluidos/excluidos desde administración; no se deduce un tratamiento fiscal automáticamente.

Individual conserva agenda, servicios, horarios, reserva pública, CRM/historial, configuración, cancelaciones, reprogramaciones y enlace privado. Negocio agrega equipo/accesos, recurrencias, lista de espera, estadísticas básicas y correo operativo. Pro agrega SmartSlots, recursos, Insights, exportaciones, ofertas automáticas de espera y prioridad de soporte. La prioridad es una clasificación comercial, sin promesa automática de un tiempo de respuesta.

El catálogo persistente `plans` guarda precio, límite de profesionales, cuota y un objeto `features`. `config/commercial-plans.json` sirve como semilla de instalación; las decisiones en ejecución se consultan en la base y las ediciones administrativas persisten. Los campos históricos smartslots/resources/reports se conservan por compatibilidad.

## Registro y solicitud

El registro y la confirmación de correo conservan su implementación existente. Tras crear o identificar el negocio, los propietarios pendientes sin solicitud ven la selección de plan. No se crean negocios duplicados para contratar o mejorar.

`plan_requests` registra el plan solicitado, precio vigente al solicitar, teléfono internacional validado, código aleatorio, autor, fecha e idempotencia. Existe como máximo una solicitud abierta por negocio. Una solicitud repetida con la misma clave conserva su ID; la misma clave con otros datos falla. El plan efectivo no cambia al solicitar otro.

La solicitud tiene estados pendiente de contacto, pendiente de pago, pendiente de verificación, aprobada y cancelada. El estado de pago es independiente: sin verificar, verificado o cortesía. La suscripción conserva vigencia, suspensión, cancelación y vencimiento calculado por fecha. Las transiciones de solicitudes se auditan en `plan_request_events`; las habilitaciones siguen en `subscription_events` y la auditoría existente.

## WhatsApp

El contacto inicial confirmado es **59893802328**, guardado en configuración central y editable por el administrador. No se incrusta un número personal en las pantallas.

Antes de abrir `wa.me` el propietario debe aceptar compartir el nombre del negocio, plan, precio y código. El mensaje se codifica con `encodeURIComponent`. La solicitud ya existe en la base; abrir WhatsApp no la crea, no acredita un pago y no registra un envío como realizado. Hay copia del mensaje, recuperación posterior en Mi plan y cancelación de solicitudes abiertas.

No hay WhatsApp automático, integración bancaria ni procesamiento de pagos.

## Habilitación administrativa

1. Entrar en Administración Atry. Revisar solicitudes nuevas, negocio, código, contacto y plan solicitado.
2. Registrar pendiente de pago o pendiente de verificación según corresponda. Ninguno acredita una transferencia.
3. Verificar la transferencia fuera de la aplicación. Usar **Verificar y habilitar**.
4. Elegir plan efectivo, comienzo y vencimiento; registrar importe y referencia. Si no hay importe, explicar la cortesía.
5. Revisar capacidad global de correo antes de aceptar otro cliente. Guardar la decisión.

La habilitación y la aprobación de la solicitud ocurren en la misma transacción. Se mantienen idempotencia, historial anterior/posterior y autor. Las referencias nuevas no se pueden reutilizar entre negocios; las referencias históricas ya existentes se conservan. No se recalculan pagos ni prorrateos.

La renovación amplía el período sin reiniciar la cuota mensual. Suspender o cancelar el acceso no borra datos ni cancela reservas. Las cuentas conservan seguridad, suscripción y las operaciones permitidas de cierre/cancelación.

## Mejoras y reducciones

El negocio puede solicitar cualquier plan desde Mi plan. Conserva su plan actual hasta que Atry apruebe el cambio. Las revisiones de calendario notifican los cambios; la interfaz consulta nuevas capacidades, con actualización adicional cada cinco segundos en pantallas activas. Los formularios con cambios pendientes conservan el borrador y avisan de la actualización; el backend aplica la restricción inmediatamente.

Para bajar de plan con exceso de profesionales, Atry debe seleccionar cuáles seguirán activos. Si un profesional excluido tiene reservas futuras pendientes o confirmadas, la reducción se rechaza: hay que reasignarlas antes o conservar ese profesional. El resto de las fichas se desactiva sin eliminarse. Se preservan reservas, clientes, historial y reglas existentes.

Las recurrencias dejan de materializar nuevas fechas sin la capacidad contratada; las reservas ya materializadas siguen existiendo. Las ofertas automáticas requieren Pro. Negocio conserva la lista de espera sin generar esas ofertas.

## Seguridad comercial

Las capacidades devueltas por `/entitlements` y `atry_entitlements` controlan menús, rutas y acciones. Los módulos no contratados se omiten de la navegación. Una ruta manipulada no concede acceso.

La API local valida capacidades, rol y organización. PostgreSQL valida RPC, RLS restrictiva y triggers de módulos/límites. Las funciones con SECURITY DEFINER conservan sus verificaciones y search_path explícito. Los métodos administrativos requieren administrador real; ser administrador de plataforma no concede CRM ajeno. Individual puede consultar y editar su horario sin contratar recursos compartidos.

## Cuotas y correo

- El ciclo mensual se ancla al comienzo de la habilitación; los negocios anteriores usan su fecha de creación como referencia inicial. Las renovaciones no reinician contadores.
- `business_mail_usage` diferencia aceptados y reservados. `mail_reservations` vincula cada reserva de capacidad con su trabajo de correo.
- El reclamo reserva capacidad antes de entregar el trabajo al sender. Los bloqueos y actualizaciones condicionales evitan superar la cuota concurrentemente.
- Una aceptación consume una sola unidad. Un rechazo definitivo libera la reserva. Un resultado incierto conserva capacidad y requiere conciliación; no se reenvía ciegamente.
- Al agotar el ciclo, el trabajo queda visible como `quota_exhausted`, con revisión prevista al siguiente ciclo. Antes de enviarlo se vuelven a validar vigencia y contenido, de modo que un recordatorio vencido se omite.
- Individual no envía correo operativo; las confirmaciones en pantalla y el enlace privado continúan. Autenticación/seguridad quedan fuera de la cuota comercial.
- Las preferencias siguen aplicándose. Los mensajes aceptados por Brevo no se presentan como entregados al destinatario.
- El límite global inicial del worker es 200 intentos diarios, con 30 reservados para seguridad. La configuración debe corresponder al contrato real con el proveedor. Aumentarla en Atry no compra capacidad en Brevo.
- El panel advierte cuando los cupos comprometidos superan una capacidad mensual conservadora de 28 días. El consumo externo del proveedor y los envíos de Auth por SMTP deben vigilarse también en Brevo: esta aplicación no recibe automáticamente toda la actividad de otras aplicaciones que compartan la cuenta.

## Migraciones y conservación

029 agrega catálogo, configuración privada, solicitudes/eventos, capacidades/RLS/triggers, activación integrada y contadores. 030 integra reservas y conciliación de cuota con el worker y mantiene presupuesto global. 031 conserva el ancla de facturación al renovar y la expone al panel administrativo. 032 permite administrar exportación e Insights de forma independiente, conservando el indicador heredado de informes.

Antes de migrar se guardó un respaldo lógico privado local de 38 tablas de aplicación y 104 funciones en `data/backups/pre-mission004.json`, ignorado por Git y con permisos 0600. Incluye los datos de aplicación y funciones; no es un respaldo completo de todos los componentes de Supabase, Auth, Storage o Vault. Las migraciones se ensayaron dentro de una transacción con rollback antes de aplicar.

La aplicación de 029–032 conservó 2 negocios, 2 reservas y 4 usuarios; cero usuarios de prueba persistentes y cero tablas públicas/privadas sin RLS. No se editaron sus planes efectivos, períodos comerciales ni reservas al instalar el catálogo.

## Validación

- 109 pruebas automatizadas: la suite completa de 108 aprobó y la comprobación adicional de capacidades independientes también aprobó. Suite existente conservada; fixtures demo ajustados a Pro para seguir cubriendo todos los módulos. Los casos de reducción ahora prueban su selección explícita.
- Nuevos casos SQLite/API y PostgreSQL/PGlite: solicitudes, idempotencia, aislamiento, permisos comerciales, acceso directo a RPC, límites de profesionales, mejoras sin privilegios anticipados, reducción sin borrado, cuotas reservadas, conciliación idempotente, concurrencia de workers, cancelación/restablecimiento y renovación sin reiniciar ciclo.
- `supabase/operations/verify-commercial.sql`: prueba nativa ejecutada contra Supabase ATRY-Turnos; termina en rollback y no invoca proveedores de correo. Resultado: `MISION_004_NATIVE_OK_ROLLED_BACK`.
- Navegador local real: selección, teléfono, solicitud persistente, aprobación por cortesía de prueba, administración y navegación adaptada. Pantalla móvil de 390 px sin desborde horizontal.
- Compilación del frontend cloud comprobada con configuración de validación, sin claves privilegiadas.

## Antes de comercializar

Confirmar impuestos y capacidad contratada en Brevo, revisar el teléfono comercial en administración y coordinar las verificaciones de transferencias reales. Los precios se mantienen como propuestos hasta esa confirmación. No hay pruebas de pagos reales, envíos automáticos de WhatsApp ni cobros recurrentes.
