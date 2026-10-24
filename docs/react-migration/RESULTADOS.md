# Resultados de la primera etapa

## Verificación

- 241/241 pruebas originales aprobadas (SQLite/HTTP temporal y PGlite; 0 omitidas); log completo evidence/legacy-tests.txt.
- 2/2 unitarias adicionales: escapar contenido de negocio no confiable, conservar acciones/atributos y variantes oculto/publicado, seña y descripción alternativa.
- TypeScript estricto y bundle Vite aprobados. npm audit del paquete React: 0 vulnerabilidades durante instalación. Dependencias originales: 1 moderada en nodemailer10.1.0, avisos addressparser [GHSA-8c8m-p3m8-cjg8](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8), [GHSA-m943-m63m-w62w](https://github.com/advisories/GHSA-m943-m63m-w62w), [GHSA-85x2-q946-cp5h](https://github.com/advisories/GHSA-85x2-q946-cp5h). No se actualizó el backend como efecto secundario.
- Chrome: editar/guardar, ocultar/publicar, diálogo/Escape y 3 ciclos Clientes/Servicios sin doble raíz. 0 errores JavaScript y 0 peticiones externas en la ejecución final.
- API experimental rechaza POST con403; HTML exige demo=1; sin ATRY_CLOUD ni registros de service worker. Fecha de fixtures fija24/10/2026; performance.now real.
- Capturas: 3 planes x 5 anchos (320/390/430/768/1440), más tema Pro personalizado = 16 pares / 32 imágenes. Mismos datos y dimensiones. Los cambios en los tests quedan en memoria.

Coincidencias exactas: 13/16 pares. Máxima diferencia: 21 píxeles por captura (detalles de bordes/rasterización en móvil, sin desplazamiento de contenido). Ver pixel-comparison.json; no se aplica tolerancia oculta.

## Rendimiento local medido

Chrome headless de escritorio 1440x960, Node22.18, loopback, caché de navegador nueva por página; 5 muestras por variante en orden JS y después React. Servidor Vite sirve archivos estáticos y bundle React compilado con NODE_ENV production; NO son tiempos del dev bundle ni de Supabase. Tiempo de carga: performance.now desde navegación hasta tarjetas y fuentes listas. Interacciones: reloj del runner alrededor de acción y selector visible, incluyen automatización; se usan como línea base reproducible, no microbenchmark de CPU. Sin inferencia estadística de mejora.

| Medición | JavaScript mediana [mín-máx], ms | React mediana [mín-máx], ms |
|---|---|---|
| Carga hasta tarjetas listas (navegador) | 102.8 [98.2-133.8] | 119.3 [114.8-130.8] |
| Abrir diálogo | 35.8 [19.9-50.0] | 75.3 [43.8-85.4] |
| Navegar a Clientes | 20.6 [12.2-22.7] | 21.8 [20.3-22.0] |
| Renderizar Agenda | 50.4 [46.3-55.1] | 47.4 [46.4-48.3] |
| Seleccionar servicio público | 46.2 [41.9-47.5] | 50.6 [38.3-52.3] |
| Seleccionar profesional público | 31.0 [30.0-31.4] | 31.2 [30.0-43.6] |
| Disponibilidad del adaptador demo | 0.7 [0.7-0.8] | 0.9 [0.6-0.9] |

javascript: solicitudes de recursos del navegador por muestra: [49, 49, 49, 49, 49]; llamadas efectivas al adaptador demo durante interacciones (después de carga inicial): [14, 14, 14, 14, 14]. Las lecturas están detalladas por ruta/método/tiempo en qa.json; los hits de caché no se cuentan como nuevas llamadas al adaptador.

react: solicitudes de recursos del navegador por muestra: [50, 50, 50, 50, 50]; llamadas efectivas al adaptador demo durante interacciones (después de carga inicial): [14, 14, 14, 14, 14]. Las lecturas están detalladas por ruta/método/tiempo en qa.json; los hits de caché no se cuentan como nuevas llamadas al adaptador.

Bundle React adicional: 300,564 bytes crudos / 76,700 bytes gzip; incluye React/DOM y piloto, minificado. Scripts clásicos de index: 485,651 bytes crudos / 159,891 gzip sumando cada archivo. CSS de index: 246,397 bytes crudos. Estos tamaños excluyen fuentes/logo y cloud bundle de publicación; no son una comparación de app totalmente migrada. El piloto conserva todos los scripts legacy y agrega React: coste transitorio real.

## Diagnóstico y límites

La costura del piloto ejecuta primero el render legacy y luego monta React; al abrir diálogos se recompone el panel y se remonta la isla. Eso agrega trabajo y puede elevar el tiempo de diálogo. Antes de ampliar React, sustituir la costura por una ruta con dueño único. No optimizar escondiendo esta duplicación en las mediciones.

Observaciones de código: renderApp refresca negocio y entitlements en paralelo antes de cargar vista; Servicios lee servicios/staff en paralelo. Agenda lee bookings/staff y después scheduling, con posibles lecturas adicionales de horas/time-off si falta el catálogo; esto puede generar rondas secuenciales cuando no hay caché. Cliente público consulta disponibilidad al cambiar selección. Son candidatos a instrumentación, no causas productivas demostradas.

Supabase no fue contactado: tiempo de respuesta de red/RPC/DB productivo **no medido**. La disponibilidad demo es CPU local, no latencia de Supabase. No se alteraron consultas, índices, RLS, autenticación o políticas. Para localizar las esperas publicadas hace falta entorno staging con fixtures, Network/ResourceTiming del transporte y timings de RPC, separando caché, cola, red y render. No usar service role ni medir creando reservas productivas.

La suite original cubre permisos, tenant, reservas, correo, PostgreSQL y contratos; la validación de navegador de esta etapa cubre la isla, navegación, temas y responsive. No se ejecutó todavía un E2E React de todas las pantallas porque siguen en JS. La matriz y puertas exigen esas pruebas al migrar cada flujo. Ninguna pantalla completa ni todo el producto se declara migrado por compilar.

## Conservación y siguiente paso

SHA-256 de los271 archivos de IAtry coincide con el respaldo; main continúa limpio. Git diff de archivos rastreados del worktree React está vacío: sólo se agregaron frontend/react, scripts/react y docs/react-migration (más PDF local). Archivos guardados, sin commit/push/merge. React se detiene aquí para revisión de la base. Antes de una segunda etapa: aprobar costura/propuesta, crear fachada de contratos y elegir una pantalla completa de bajo riesgo.
