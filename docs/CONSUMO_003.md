# Consumo y límites — corte Misión 003

Condiciones oficiales consultadas el 14 de octubre de 2026; confirmar otra vez antes del despliegue.

| Servicio | Plan gratuito | Aviso al 70% |
|---|---|---|
| Supabase base | 500 MB por proyecto | 350 MB |
| Supabase egress | 5 GB | 3,5 GB |
| Supabase Auth | 50.000 MAU | 35.000 |
| Supabase Storage | 1 GB | 0,7 GB |
| Edge Functions | 500.000 invocaciones | 350.000 |
| Realtime | 2 millones de mensajes / 200 conexiones máximas | 1,4 millones / 140 |
| Cloudflare Pages Free | 500 builds por mes | 350 |
| Brevo Free | 300 envíos diarios, no acumulables | 210 |

Fuentes: [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Supabase pricing](https://supabase.com/pricing), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Brevo planes](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans).

Supabase permite dos proyectos Free activos en organizaciones donde se es propietario/administrador; la organización inspeccionada muestra uno. Free puede pausar por inactividad de una semana y no incluye backups automáticos. Las cuotas de algunos servicios se comparten por organización: el consumo existente reduce el margen disponible. No se modificó el proyecto anterior.

## Medición local, no garantía cloud

200 reservas nuevas en PostgreSQL WASM local, una conexión: 638.976 bytes de esquema vacío; 204.800 bytes adicionales por fixture de un negocio con usuario, profesional, servicio, horarios y recurso; 958.464 bytes adicionales por 200 reservas (4.792 bytes de media). Incluye cliente nuevo, reserva, bloques de recursos, auditoría, notificación, idempotencia, revisión e índices. Mediana 1,55 ms y p95 2,19 ms en esta máquina. Páginas/indexado hacen que la media varíe con la muestra; no equivale a costo marginal constante en Supabase. No se midió red, Edge, Auth real, Brevo, concurrencia multiconexión o Realtime distribuido. No hay cifra defendible aún de reservas/segundo en producción.

## Escenarios, no capacidad comprobada

La configuración actual suele generar confirmación al cliente, aviso al negocio y recordatorio: 3 correos por reserva con email; cambios/ofertas/recuperación agregan más. Sin cambios, 300/3=100 reservas diarias es un techo aritmético del proveedor, no rendimiento del sistema. El presupuesto conservador del worker es 200 intentos/día (100 de margen para Auth): unos 66 turnos/día a tres correos; aviso interno desde 140 intentos equivale a unos 46 turnos. Los reintentos consumen presupuesto y el margen Auth no garantiza su uso real.

A cinco reservas diarias/negocio, 200/15 da hasta 13 negocios como escenario matemático de correo; a diez, 200/30 da 6. No es una garantía ni recomendación comercial: faltan carga, comportamiento real y monitoreo. Brevo probablemente limite primero en ese escenario; puede cambiar si predominan muchas conexiones Realtime, archivos o consultas/transferencia.

## Supervisión y costos al crecer

RPC administrativa atry_usage_local mide bytes de base y presupuesto local con alerta 70%; no conoce automáticamente cuotas de los proveedores. Para datos completos: Supabase organización → Usage (egress, MAU, Edge, Realtime, Storage) y proyecto → Database/Reports; Cloudflare Pages proyecto → deployments/builds y analytics; Brevo → transactional statistics/quota. Falta integrar alertas automáticas de todos esos paneles. Consultar errores/latencia reales antes de estimar pilotos.

Supabase Pro empieza en US$25/mes con primer proyecto; proyectos adicionales desde US$10/mes, y posibles cargos variables. Egress extra desde US$0,09/GB, base adicional US$0,125/GB, invocaciones extra US$2/millón y mensajes extra US$2,50/millón según billing. Considerar pago por respaldo/continuidad o cercanía a cuotas, no únicamente almacenamiento. Elevar la organización actual afectaría su facturación conjunta: nunca hacerlo sin autorización.

Cloudflare Pages permanece gratis dentro de límites; no se presupuestó Workers ni productos adicionales. Brevo: el precio depende de volumen, región y plan; consultar su cotizador actual antes de elegir, no se verificó una oferta personalizada ni se contrató. No se garantiza una cifra de ampliación sin esa comprobación. GitHub privado usa la cuenta autenticada; comprobar allowance/billing de Actions antes de automatización intensiva.
