# Corrección de navegación a Servicios

25/10/2026. Rama: `codex/react-iatry-consolidation`. Base: `705932a`. Solo entorno local con datos ficticios. Sin publicación, cambios en producción, capturas, videos ni nuevos PDF.

## Causa demostrada

`FeatureHost.tsx` importaba `ServicesScreen` mediante `React.lazy`, dentro de un `Suspense` compartido. En una primera visita el import suspendía el render, se mostraba el fallback y la política de React retrasaba el commit del contenido resuelto unos 300 ms. No era una consulta lenta, el coste de IAtry ni un render de 300 ms.

Evidencia de la primera muestra previa:

- Fallback insertado a los 2,9 ms.
- Chunk de Servicios descargado a los 3,5 ms; repositorio a los 3,8 ms.
- Temporizadores de 295 y 294 ms registrados en la traza de Chrome.
- Pantalla de Servicios montada a los 303,4 ms; catálogo a los 306,5 ms.
- Las lecturas del catálogo demo tardaron 0,3 y 0 ms.
- Ninguna tarea individual de la traza consumió 300 ms. La implementación instalada de React confirma `globalMostRecentFallbackTime + 300 - now()` para este camino de retry.

Después, Servicios se monta a los 2,9 ms y el catálogo a los 5,1 ms en la primera muestra. No aparece el fallback ni esos temporizadores. Se preservaron perfiles de CPU y trazas de timeline antes/después, sin categoría de screenshots.

## Corrección

Importación estática de `ServicesScreen` en `FeatureHost.tsx`. Servicios es un destino principal y queda disponible con el shell. Se mantienen el `Suspense` para las otras pantallas y overlays, la carga y validación del catálogo, guardados, permisos, protección de borradores y hooks de IAtry. No se alteraron JSX de Servicios, estilos, reglas de negocio ni consultas.

Coste explícito: bundle principal de 152,08 a 162,79 kB sin comprimir; de 47,93 a 51,06 kB gzip (+3,13 kB gzip). El chunk separado de Servicios deja de descargarse en la primera navegación. No se midió un efecto aislado en arranque con redes lentas; no se afirma que ese coste sea cero.

## Medición comparable

Chrome headless instalado, viewport 1440x960, sin throttling, service worker bloqueado, mismo servidor efímero y fixture. 7 contextos nuevos por runtime, orden alternado. El cronómetro comienza al asignar el hash desde Inicio y termina al observar el título Servicios y la lista `.grid3`, igual que en la medición original. Se incluyen las primeras muestras con profiling; el criterio es idéntico antes/después. Datos demo locales, no latencia de Supabase. Valores en ms, mediana.

| Métrica | Antes | Después |
| --- | ---: | ---: |
| Navegación React + IAtry | 313,8 | 4,6 |
| Navegación JavaScript original, control | 6,8 | 6,6 |
| CPU total de tareas durante navegación React | 46,5 | 8,1 |
| CPU de script durante navegación React | 11,4 | 3,9 |
| Layout durante navegación React | 5,3 | 0,9 |

La entrega anterior había medido 311,1 ms React frente a 12,4 ms original, con 5 muestras. La nueva tanda reproduce la demora de React y mantiene al original como control contemporáneo. La reducción respecto de la nueva línea base es 98,5%; respecto del valor publicado, también 98,5%. El rango de las muestras React posteriores fue 3,5-15,5 ms; las diferencias pequeñas dentro de ese rango dependen de los frames y la carga local. No se presenta como SLA ni como garantía de ser más rápido que el original en todo equipo.

Muestras React previas: 316,7; 314,3; 312,2; 318,3; 308,5; 313,8; 311,2.
Muestras React posteriores: 6,9; 15,5; 4,1; 15,5; 3,9; 3,5; 4,6.

## Validación enfocada

Build y TypeScript aprobados. 7 comprobaciones aprobadas por motor en Chromium y WebKit (14 en total):

1. Guía IAtry navega a Servicios y apunta al botón real.
2. Creación, ocultación durante modal y celebración tras guardado confirmado.
3. Edición y actualización del catálogo.
4. Ocultar/publicar y confirmación.
5. Cancelación de salida conserva borrador; descarte explícito permite navegar.
6. Tres ciclos Inicio/Servicios sin listas duplicadas.
7. Manager conserva gestión; staff se redirige a Agenda.

Sin errores JavaScript en el recorrido principal. Una ejecución inicial del nuevo test se interrumpió por buscar `Cancelar` en vez del nombre real `Volver`; se corrigió el test, sin modificar el producto, y se completó la ejecución en ambos motores. No se repitieron suites globales ni matrices visuales.

## Archivos

Producto: `frontend/react/src/app/FeatureHost.tsx` (único archivo de producto modificado).
Instrumentación: `scripts/react/iatry-services-profile.cjs`, `scripts/react/iatry-services-functional.cjs`.
Informe: este documento.
Evidencias: `evidence/services-navigation/` (before/after JSON, CPU profiles, timeline traces, resultado funcional y build).

Reproducir después de `npm --prefix frontend/react run build`:

```sh
NODE_PATH=/Users/rodrigobrun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node scripts/react/iatry-services-profile.cjs after
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/atry-react-browsers NODE_PATH=/Users/rodrigobrun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node scripts/react/iatry-services-functional.cjs
```

El perfilador verifica para la fase `after` una mediana inferior a 100 ms y ausencia de fallback de Suspense en las muestras React. Los resultados previos se mantienen separados. Los JSON/trazas se pueden inspeccionar con herramientas de profiling de Chrome; no contienen datos de clientes reales.
