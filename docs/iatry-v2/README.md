# IAtry V2 experimental

Rama: `codex/iatry-v2`. Base publicada: `c1c117196e15490433ae7a827a1524ea1da84f83`.
Desarrollo local: no publicación, cambios de Supabase ni modificaciones de reglas de negocio.

## Probar

Con el servidor local de Vite abierto en el puerto 3321:

- `http://127.0.0.1:3321/?demo=1&plan=2#/app/inicio`
- Pulsar **IAtry → Mostrarme cómo** y comenzar el recorrido de la pantalla.
- Probar Inicio, Agenda, Servicios, Clientes, Configuración y Primeros pasos.
- **Qué puedo observar** muestra hechos del resultado ya cargado. Abrir **Ver evidencia y cálculo**, descartar con **Ya lo vi** y recargar.
- **Preferencias de IAtry** permite pausar movimiento y desactivar sugerencias. La ayuda manual sigue disponible.
- Abrir un formulario durante un recorrido: IAtry se oculta y no guarda nada.
- Comparación con el proveedor V1.2 conservado: agregar `&iatry=v1` antes de `#`.

Para iniciar Vite desde la raíz del repositorio: `npm --prefix frontend/react run dev`.
La demo es ficticia, funciona en el navegador y no conecta con Supabase. No probar escrituras reales para verificar esta entrega.

## Evolución funcional

La ayuda pasa de tarjetas de incorporación a recorridos explícitos que señalan controles registrados por cada componente React. El usuario decide cuándo abrirlos y cuándo actuar; ninguna guía ejecuta guardados, cambia pestañas o crea reservas. Los destinos desaparecidos o deshabilitados tienen una explicación, no un clic automático.

El motor, conocimiento y memoria originales de V1.2 se conservan sin editar en `src/iatry/vendor`. La presentación V1.2 permanece en `LegacyIatryProvider.tsx`. V2 conserva la bienvenida y la detección determinista de servicios activos y amplía la ayuda a seis pantallas, incluso después de completar la incorporación.

Capas separadas:

1. `context.tsx` y los loaders de cada pantalla publican únicamente agregados autorizados ya disponibles. No hay cliente de Supabase ni solicitudes nuevas en IAtry.
2. `v2/contracts.ts`, `evidence.ts` y `knowledge.ts` definen alcance por rol/capacidades, validación de evidencia, reglas, pasos y acciones descriptivas disponibles.
3. `v2/Provider.tsx` coordina referencias reales, sesión, negocio, memoria, diálogos, estados y preferencias.
4. `v2/Presentation.tsx`, `AnimatedPanel.tsx`, `GuideMarker.tsx` y `v2.css` presentan explicaciones, evidencia, controles y posicionamiento.

La memoria se separa por demo/real, usuario, negocio y rol. El proveedor se remonta al cambiar sesión o negocio. Las explicaciones vistas pueden repetirse manualmente; las observaciones se deduplican por evidencia y permiten descartar una versión o una regla. Los valores se guardan localmente, con listas acotadas y tolerancia a almacenamiento bloqueado. No se persisten contactos, filas de reservas ni identificadores de clientes.

El emblema oficial no se modificó. El círculo tiene fondo y halo iridiscentes con la paleta ATRY y reflejos blancos. Las animaciones de atención, orientación, celebración y despedida son finitas; reposo y orientación no mantienen bucles. Movimiento reducido del sistema, preferencia manual, pestaña oculta y posición fuera de pantalla suspenden efectos.

## Datos y límites honestos

- Inicio: reservas de hoy y proporción de cancelaciones de los últimos 30 días si el plan habilita estadísticas.
- Agenda: filas visibles después de filtros y servicio con mayor cantidad de filas sin estados `cancelled` ni `no_show`, agrupado por ID de servicio. Un empate no se presenta como ganador exclusivo.
- Clientes: fichas cargadas con `visits >= 2`, sobre el resultado limitado y eventualmente filtrado. No se presenta como retención ni asistencia confirmada.
- Evolución: la regla exige 14 fechas completas consecutivas y un período anterior no nulo. El resumen actual aporta siete fechas; por eso **no se muestra una tendencia de dos semanas** ni se consulta otra fuente para fabricarla.
- No hay modelos de lenguaje, predicciones, backend conversacional ni envíos. Configuración de notificaciones nunca se interpreta como prueba de entrega.
- La zona horaria utilizada por el producto actual es America/Montevideo; los períodos incompletos se excluyen con ese criterio.

## Herramientas evaluadas

| Herramienta | Decisión | Licencia y compatibilidad |
| --- | --- | --- |
| Motion 14.6.0 | Incorporado para transiciones de entrada/salida con LazyMotion y `m` | MIT; React 18/19; utiliza framer-motion y tslib |
| @floating-ui/react-dom 2.1.9 | Incorporado para marcador contextual con flip/shift y detección de colisión | MIT; React >=16.8; dependencia de Floating UI DOM |
| Driver.js 1.10.2 | No incorporado; no se demostró una mejora sobre referencias React y posicionamiento existentes | MIT; sin dependencias declaradas |
| Reactour 3.8.0 | No incorporado; agregaría otra capa de máscara, popover y utilidades | MIT; compatible con React 19 |
| React Joyride 3.2.0 | No incorporado; superpone otro ciclo de tour y varias dependencias | MIT; compatible con React 19 |
| CopilotKit 1.80.0 | Investigado, no instalado | MIT; compatible con React 18/19; runtime y dependencias conversacionales innecesarios en esta etapa |

Patrones útiles de CopilotKit para una futura conversación: contexto con ciclo de vida del componente, herramientas con esquema y disponibilidad explícita, y separación entre ejecución y representación. V2 prepara esos límites con evidencia agregada y referencias registradas; no agrega un proveedor de IA ni anuncia compatibilidad conversacional implementada.

Referencias oficiales consultadas: [useAgentContext](https://docs.copilotkit.ai/reference/hooks/useAgentContext), [useFrontendTool](https://docs.copilotkit.ai/reference/hooks/useFrontendTool), [Motion y tamaño del bundle](https://motion.dev/docs/react-reduce-bundle-size), [Floating UI autoUpdate](https://floating-ui.com/docs/autoupdate), [Floating UI useFloating](https://floating-ui.com/docs/usefloating). Versiones, licencias MIT, dependencias y rangos React contrastados con los metadatos de npm antes de instalar. La instalación del subproyecto React informó cero vulnerabilidades; no equivale a una auditoría sin hallazgos del servidor heredado.

## Validación reproducible

Desde la raíz:

```sh
npm --prefix frontend/react run build
npm --prefix frontend/react test
node scripts/react/iatry-v2-unit.cjs
node scripts/react/iatry-v2-functional.cjs
node scripts/react/iatry-v2-scope.cjs
node scripts/react/iatry-v2-performance.cjs
```

Las pruebas de navegador requieren Playwright y los navegadores ya disponibles en este entorno. En esta máquina se usa `NODE_PATH=/Users/rodrigobrun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules` y `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/atry-react-browsers`. No requieren instalar servicios ni acceder al proyecto Supabase. Levantan un servidor local efímero y usan datos ficticios en memoria del navegador. No producen imágenes, videos ni PDF.

Las pruebas de dos negocios simulan dos identidades de negocio en el adaptador de demo para verificar memoria y reinicio de contexto. **No constituyen una prueba nueva de RLS ni de autorización del servidor Supabase.**

## Pendientes antes de publicar

Validar la experiencia con Rodrigo y luego autorizar cualquier publicación por separado. Esta entrega verifica el comportamiento local y la separación del contexto cliente; no sustituye una validación con sesiones reales ni una auditoría de las políticas RLS existentes. No se probaron lectores de pantalla físicos ni dispositivos móviles físicos. Las preferencias no se sincronizan entre dispositivos.

## Resultados de esta entrega

- Compilación TypeScript/Vite correcta. Vite advierte sobre directivas `use client` de Motion en una aplicación exclusivamente cliente y sobre el script clásico de configuración; la compilación finaliza sin errores.
- 32 pruebas de React y 10 verificaciones deterministas nuevas: datos permitidos, series inválidas, cálculos, planes, períodos incompletos, memoria aislada/acotada y deduplicación. Las 10 verificaciones están incluidas en el comando habitual de pruebas React.
- Chrome y WebKit: 11 grupos funcionales por motor cubren las seis guías, evidencia, preferencias, descarte persistente, borradores, Escape, foco, movimiento reducido y ausencia de desborde a 320/390/1440 px. Cambiar movimiento durante una guía no vuelve a enfocar ni desplazar el control señalado.
- Propietario y encargado: cambiar de negocio cierra el recorrido y aísla preferencias; cerrar sesión elimina la guía. Empleado: ayuda limitada a Agenda y ninguna consulta de clientes al intentar esa ruta. Individual: sin indicadores avanzados. Celebración comprobada después de guardar un servicio ficticio y cargar el catálogo confirmado.
- Motor, conocimiento, memoria V1.2 y emblema oficial sin cambios; proveedor V1.2 preservado íntegramente salvo el nombre de exportación.

Medición local, Chrome headless sin limitación artificial, cinco contextos nuevos por versión en orden alternado, misma compilación y ayuda cerrada/sugerencias desactivadas:

| Medición | V1.2 conservada | V2 |
| --- | ---: | ---: |
| Navegación Inicio → lista de Servicios, mediana | 6,5 ms | 4,9 ms |
| Script durante 2 s de reposo, mediana | 0 ms | 0 ms |
| Tareas durante 2 s de reposo, mediana | 2,88 ms | 0,87 ms |
| Capas con animaciones infinitas en reposo | 3 | 0 |
| Solicitudes al adaptador de datos del recorrido | 7 | 7 |

La medición espera la lista cargada mediante `requestAnimationFrame`. No representa latencia real de Supabase ni reemplaza mediciones en dispositivos físicos. La diferencia de unos milisegundos fluctúa; lo relevante es que no reaparece la regresión de cientos de milisegundos y no se agregan solicitudes de datos.

Tamaño inicial: se reconstruyó el código publicado `c1c1171` en una carpeta temporal y se comparó el grafo de imports estáticos desde la entrada, incluyendo React compartido y con el mismo toolchain disponible. Original: 120.804 bytes gzip; V2: 123.423 bytes gzip; diferencia: **2.619 bytes gzip**. Excluye pantallas diferidas, scripts de configuración, fuentes y CSS. Presentación/Floating UI y Motion quedan en módulos diferidos de aproximadamente 40,6 KB gzip combinados, descargados al abrir ayuda; la cifra HTTP final depende de la compresión del hosting. No se modificó la publicación para medirlo.

Dependencias nuevas: Motion/framer-motion/motion-dom/motion-utils y los paquetes Floating UI con licencia MIT; tslib 2.8.1 con licencia 0BSD según el lockfile. CopilotKit y bibliotecas de tours no se instalaron.

Correcciones realizadas durante la validación: evitar evidencia antigua durante recargas; agrupar servicios por ID, no por nombre; conservar la confirmación de servicio al abrir ayuda; impedir bucles heredados de animación en V2; mantener el aviso de incorporación con IAtry cerrado; hacer enfocables temporalmente los destinos no interactivos y restaurarlos; no volver a desplazar/enfocar al cambiar movimiento; validar fechas y descartar agregados malformados sin interrumpir la pantalla.
