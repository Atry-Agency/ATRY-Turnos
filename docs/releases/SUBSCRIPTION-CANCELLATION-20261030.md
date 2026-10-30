# Baja ordinaria al vencimiento — 30/10/2026

Base de publicación: 66a5891. Esta rama excluye todos los cambios editoriales y las páginas legales locales.

## Cambio
La acción existente `cancel` en la RPC administrativa registra un evento de baja al fin de período y su auditoría, sin modificar fila de negocio, plan, fechas, vigencia, profesionales, reservas ni contactos. Mantiene la autorización de administrador, autenticación reciente, bloqueo transaccional y clave idempotente existentes. Rechaza campos de cambio de plan/fecha y cobros en esa acción. La suspensión inmediata es `suspend`, independiente. El vencimiento no requiere cron: `private.subscription_live` ya exige que la fecha final sea posterior al momento actual. No se crean renovaciones ni cobros automáticos. Renovar manualmente sigue siendo una decisión explícita; un evento de baja anterior no impide una renovación posterior solicitada.

Se utiliza el historial existente (`subscription_events`) con `after_state.cancel_at_period_end`; no se agregan tablas, columnas, RPC, permisos, servicios ni tareas programadas. No se reactivan suscripciones canceladas históricamente. La interfaz distingue sus eventos antiguos de la nueva baja al vencimiento.

## Validación
PostgreSQL aislado y adaptador cloud: Individual/Negocio/Pro; propietario, encargado, empleado y cuenta ajena no pueden utilizar RPC administrativa; administrador reciente sí, sesión antigua no. Conservación de registros ficticios de clientes, servicios y reservas; cero nuevos correos por baja; repetición de clave no duplica; otra carga con misma clave rechazada; plan/fecha no cambian; suspensión sigue bloqueada; baja sobre vencido no reactiva; renovación manual restablece vigencia. Límite del día final de Uruguay: antes de las 03:00 UTC habilitado, a las 03:00 UTC vencido. ACL, SECURITY DEFINER y search_path se conservan. Migración/reversión ensayadas y restauración exacta de huella.

Las pruebas reales de publicación son exclusivamente lecturas de definiciones, permisos y artefactos: no se cancela/renueva/suspende ningún negocio para probar.

## Aplicación y recuperación
`node scripts/prepare-cancellation-migration.js` prepara transacción acotada y rollback en /private/tmp. Antes de aplicar se verifica el proyecto en el editor autorizado y las huellas de función de producción. La migración se detiene si la definición no coincide con una de las dos bases revisadas (repositorio y producción). No ejecutar sobre otro proyecto.

Rollback frontend: etiqueta `rollback/subscription-cancellation-20261030` al commit 66a5891, por el workflow Pages y source_ref. Rollback SQL: transacción preparada desde `supabase/operations/rollback-subscription-cancellation.sql`, con guardas que rechazan cambios posteriores y restauran exactamente la huella anterior. Solo un administrador autorizado puede ejecutarlo. El rollback de código no revierte automáticamente la base.

Los eventos de baja nuevos permanecen como auditoría si se revierte el código; no se deben reinterpretar ni ejecutar retroactivamente como suspensiones. No hay datos borrados que recuperar por esta migración.

## Legal
Las páginas legales siguen fuera de esta publicación. Su explicación local debe indicar baja al vencimiento implementada, sin afirmar baja automática/autoservicio: la solicitud se recibe por el canal comercial y la registra ATRY. Permanecen pendientes domicilio/fiscalidad, reembolsos y suspensiones anticipadas, bases jurídicas/menores/sensibles, proveedores y transferencias, conservación, derechos e incidentes y aceptación versionada.

## Resultado previo al despliegue

- 262/262 pruebas generales aprobadas; suite React y regresiones de IAtry aprobadas; 9 regresiones comerciales PostgreSQL y 10 de administración/recibos aprobadas; dos escenarios integrales nuevos de baja y rollback aprobados. La primera ejecución general fue bloqueada en puertos loopback por el sandbox; la ejecución habilitada de servidores ficticios terminó sin fallos.
- npm audit --omit=dev: 0 vulnerabilidades.
- Rollback remoto verificado: `rollback/subscription-cancellation-20261030` → `66a5891dcdea95a412bb5f30742d3d069ad9bf9f`.
- Migración 202610300001 aplicada en el proyecto autorizado. Huella interna anterior d82bb568298876d9ed3504e5be723093; posterior 6befca5447acf2144bfdd5682819c8ec. Envoltorio público sin cambios: 998c10b32e38f3f92182a85eaa5d78aa. Función interna SECURITY DEFINER conservada, sin ejecución directa para anon/authenticated. La comprobación fue de definiciones y permisos; no se ejecutó una baja de prueba en ningún negocio real.
