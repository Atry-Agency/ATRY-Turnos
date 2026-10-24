# Resultados - Etapa 2

## Pruebas ejecutadas

- Regresión original: **241/241** aprobadas, sin omitidas (log: evidence/legacy-regression.txt).
- React/TypeScript: build estricto y **11/11** pruebas adicionales aprobadas.
- Navegador: **13** verificaciones funcionales aprobadas; **0** errores de JavaScript/consola y **0** solicitudes externas.
- HTTP real con SQLite en memoria: **6** verificaciones aprobadas. Precio, duración, seña, buffers y profesionales persisten; duración bloqueada por reservas futuras; negocio ajeno y suscripción vencida denegados por el servidor.
- Controles adicionales: **3/3** de carga lenta, foco/teclado y bfcache aprobados (lifecycle-qa.json).
- Contrato cloud: repositorio probado contra createApiAdapter, un RPC de catálogo compartido para servicios/staff, payload idéntico de `atry_save_service`, propagación de403. Ninguna conexión Supabase real.

Ver detalles en qa.json y http-qa.json; scripts reproducibles bajo scripts/react/.

## Comparación visual

**53 pares / 106 PNG**: listas y formularios de los tres planes a320/390/430/768/1440px; temas Pro oscuro y personalizado a390/768/1440; final del diálogo móvil desplazado para verificar Guardar accesible. Reloj de datos fijo, mismo tema y viewport por par. **44/53 pares idénticos píxel a píxel**.

La mayor diferencia bruta es 52 píxeles en custom/768/dialog; máximo de píxeles con diferencia de canal mayor a4: 13. Se publican conteos brutos y por umbral en pixels.json, sin ocultar diferencias. Inspección de los pares: las diferencias pequeñas se concentran en rasterización de bordes y fondo con backdrop-filter; no cambian medidas, posiciones ni colores CSS. El fondo del modal puede diferir por composición del navegador: legacy reemplaza el shell y React lo conserva. No se modificaron estilos para forzar una captura.

No se encontró desbordamiento horizontal. Los botones de guardar de los11 escenarios móviles están dentro del viewport después de desplazar el modal. Los formularios conservan altura máxima y scroll del diseño original; capturar toda la página incluye contenido bajo el overlay fijo fuera del viewport, comportamiento también presente en legacy.

## Rendimiento medido localmente

Chrome headless1440x960, cinco muestras por variante; una carga de calentamiento por variante y orden alternado JS/React, páginas nuevas con red de loopback. Se compara JavaScript del worktree sin extensión (hooks inactivos) con bundle React de producción. La app sigue cargando los demás scripts legacy. Fecha fija mediante Date, performance.now real. Tiempos de interacción del runner incluyen automatización y espera de DOM. No representan latencia Supabase ni demuestran significancia estadística.

| Medición | JavaScript mediana [mín-máx] | React mediana [mín-máx] |
|---|---|---|
| Carga hasta Servicios listo (ms) | 101.9 [98.0-106.3] | 118.6 [111.4-127.8] |
| Abrir diálogo (ms) | 33.8 [32.4-35.8] | 36.6 [20.1-38.6] |
| Modificar nombre (ms) | 37.4 [34.9-39.2] | 35.9 [34.4-39.6] |
| Guardar y cerrar formulario (ms) | 40.8 [26.9-42.4] | 27.9 [26.7-40.8] |
| Navegar a Clientes (ms) | 12.3 [11.5-12.8] | 13.3 [12.8-13.7] |
| Volver a Servicios (ms) | 18.7 [18.0-27.9] | 19.6 [19.1-20.4] |
| Solicitudes de carga inicial | 45.0 [45.0-45.0] | 47.0 [47.0-47.0] |
| JavaScript cargado inicial (bytes crudos) | 486339.0 [486339.0-486339.0] | 805313.0 [805313.0-805313.0] |
| CPU script del recorrido completo (ms) | 7.3 [7.3-7.4] | 25.0 [24.9-25.6] |
| CPU layout del recorrido completo (ms) | 19.8 [19.6-20.2] | 6.8 [6.6-6.9] |
| CPU estilos del recorrido completo (ms) | 29.5 [29.2-29.9] | 14.6 [14.2-15.1] |
| Heap JS tras8 aperturas/cierres y GC (bytes) | 3081932.0 [3081932.0-3081932.0] | 4215856.0 [4215796.0-4216688.0] |
| Nodos informados por CDP | 3102.0 [3102.0-3102.0] | 1998.0 [1998.0-1998.0] |

Bundle completo de React/DOM/componentes: **317,815 bytes** crudos / **82,160 gzip nivel6**. Puente clásico adicional: 1,159 bytes. Frente a la isla de etapa1, se añaden unos17kB crudos para pantalla, formularios, estado, validación y componentes. Las dependencias siguen idénticas: no se agregó Router, query-cache, biblioteca de formularios, UI ni animaciones.

Guardar en React produce una escritura y dos lecturas de catálogo (servicios y profesionales), compartidas en un RPC al usar cloud. Reutiliza invalidación y caché existentes; no relee negocio/entitlements para rearmar el shell al abrir un diálogo o al guardar. Legacy guarda y recompone el panel. Prefetch y timers heredados siguen activos: por eso los conteos globales pueden incluir consultas no originadas por Servicios. Todas las rutas y tiempos del adaptador aparecen en qa.json.

La mediana de apertura de diálogo debe leerse junto a las otras métricas: el doble render de la etapa1 desapareció, pero React añade descarga y memoria. El heap reportado es memoria JS del renderer después de GC, no RSS total ni prueba formal de ausencia de fugas. CPU script/layout/estilos es el delta CDP del recorrido completo (edición, guardado, ida/vuelta y8 aperturas/cierres), no sólo una llamada React. Los nodos CDP incluyen el documento, no sólo React. La prueba cubre ciclos repetidos y desmontaje, no horas de uso.

## Límites y pendientes

- Supabase/red/DB productivos no medidos. Integración cloud validada mediante su adaptador simulado y regresión PostgreSQL/PGlite original; falta E2E contra staging autorizado antes de publicar.
- Responsive probado en Chrome con viewport móvil, no en iPhone/Android físicos ni Safari/Firefox.
- Shell, router, auth, permisos backend, transporte/cache/realtime y motores visuales todavía son compartidos legacy. Servicios ya no usa sus plantillas, modal, submit ni click handlers heredados.
- El backend de creación de servicios no ofrece idempotencia de POST. Se impiden guardados simultáneos en cliente; si el servidor confirmó y se pierde la respuesta, un reintento manual todavía puede duplicar una creación. Riesgo preexistente, requiere contrato backend separado; no se añadió una clave ficticia ni se modificó el servidor.
- El piloto local está cerrado a demo y no registra SW. app.js?v55 y SWv106 permanecen coherentes dentro del worktree; el puente y bundle no se agregaron a index ni al SW publicado.
- El repositorio queda invalidado al desmontar; cada generación rechaza respuestas anteriores incluso si vuelve la misma cuenta. Una prueba simula cleanup/replay de efectos y verifica que sólo publica el catálogo vigente. La entrada compilada no activa StrictMode.
- Advertencia Nodemailer existente de etapa1 sigue registrada; no se actualizaron dependencias backend.

## Conservación

SHA-256:324 archivos de main y589 de IAtry V1.2 coinciden con las huellas previas. Main limpio, mismo commit9a5a0d6. Rama feature/react-migration. Respaldo local de etapa1: ../respaldo-react-etapa1/fuentes-etapa1.tar.gz. Sin commits, push, merge, publicación, cambios de Supabase ni migraciones remotas.