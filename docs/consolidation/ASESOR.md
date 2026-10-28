# Asesor de planes: contrato de integración

`advisePlan(input)` es una función pura, sin consultas, almacenamiento ni decisiones de permisos. `PlanAdvice` presenta su resultado y enlaza a `#/app/suscripcion`; no solicita cambios, abre WhatsApp ni inicia cobros.

## Fuentes reales

- `subscription/contracts.ts`: `Plan` y `SubscriptionData`.
- Pantalla existente: GET `/subscription`, que obtiene catálogo comercial, entitlements y tratamiento impositivo; el adaptador existente llama a `atry_subscription`.
- Capacidades: `subscription/model.ts::commercialLabels`. No se utiliza `/admin/commercial` ni permisos administrativos.
- Límites obtenidos del contrato, nunca fijados en el motor. Los valores 1/4/10 aparecen únicamente en fixtures de pruebas que reproducen el catálogo actual. Precios siempre del catálogo recibido; si no existen, no se muestran.

## Integración por la raíz

1. Detectar una necesidad concreta ya interpretada: `{kind:'staff',additional:n}` o `{kind:'staff',desiredTotal:n}` o `{kind:'feature',key}`. No inferir necesidades comerciales desde saludos o texto social.
2. Distinguir el impedimento: `plan`, `role`, `homologation` o `unknown`. Un bloqueo productivo de IAtry es `homologation`; no se vende un cambio de plan para sortearlo.
3. Para recomendación comercial, usar solo datos actuales del negocio/sesión vigentes. Consumir `/subscription` bajo demanda mediante el adaptador autorizado existente; si no está autorizado para el perfil, no consultar ni recomendar. Esta función no amplía whitelist ni permisos.
4. Entregar `entitlements:{code,staff_count,staff_limit,features,access_enabled}`, `plans`, `role`, `taxStatus`. Descartar la respuesta si cambió la sesión o negocio mientras se cargaba; no conservar ofertas entre negocios.
5. Renderizar `PlanAdvice` como ficha independiente únicamente cuando haya una necesidad concreta. No consultarlo durante interacciones sociales.

La recomendación selecciona el primer nivel superior del catálogo Individual → Negocio → Pro que satisface la necesidad. Si ya está cubierta, falta información o ningún plan cubre la solicitud, no inventa una mejora. Un acceso vencido/suspendido dirige a revisar el estado, no a comprar un plan mayor. Solo el propietario recibe una recomendación comercial; otros perfiles reciben orientación sobre permisos.

No cambia las 17 herramientas homologadas ni habilita IAtry para Individual/Pro: la disponibilidad funcional continúa gobernada por la política productiva actual, aunque una prestación del producto exista en esos planes.

## Validación

`node scripts/react/iatry-plan-advisor-test.cjs`: capacidades 1/4/10, elección mínima aun con catálogo desordenado, prestaciones reales, permisos, falta de homologación, acceso inactivo, datos incompletos, precios ausentes y valores recibidos. Sin Supabase, escrituras ni servicios externos. No se ejecutó build React en este frente.

`detectPlanNeed(source)` normaliza tildes, mayúsculas y puntuación. Reconoce incorporación con cantidad explícita y prestaciones del vocabulario comercial. No interpreta saludos, negaciones, cantidades totales ambiguas, plural sin cantidad ni múltiples necesidades como una recomendación única. Devuelve undefined para que continúe el motor existente. No toma decisiones de permisos.

`staff_count` está confirmado en `202610150029_commercial.sql`: cuenta exclusivamente profesionales activos del negocio. No existe supuesto `staff_used` en este contrato.

Ejemplo seguro: «Quiero agregar otro profesional» + entitlements Negocio con staff_count4 y staff_limit4 + bloqueo real `plan` → sugerir el plan superior mínimo del catálogo recibido y dirigir a comparar. Si la herramienta IAtry está sin homologar, explicar eso por separado: esta recomendación de capacidad del producto no habilita aquella operación.

Ordinal explícito: «agregar el quinto profesional» devuelve `desiredTotal:5`, nunca cinco incorporaciones. Dar ambos campos es ambiguo y se rechaza.
