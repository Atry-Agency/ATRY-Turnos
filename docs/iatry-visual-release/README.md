# Candidato de publicación exclusivamente visual · 2026-10-26

Pendiente de confirmación final del usuario. No se ejecutó push, modificación de main ni despliegue. Rama `codex/iatry-visual-release`, creada directamente desde `c1c117196e15490433ae7a827a1524ea1da84f83` (main publicado). El desarrollo completo de V3 se conserva separado en `codex/iatry-v3`.

## Incluye y excluye

Panel derecho aprobado, reserva de espacio en escritorio amplio, panel inferior móvil, minimizar/cerrar, saludo/búsqueda y hasta tres sugerencias de ayuda existente. Emblema oficial intacto, corrientes iridiscentes, reflejo nacarado, transiciones CSS, pausa manual, movimiento reducido y suspensión fuera de vista/pestaña oculta. Sin dependencias nuevas.

Las sugerencias **orientan hacia los controles existentes**: «Crear un servicio» no ejecuta una creación. Guardar continúa siendo una acción del formulario ordinario publicado. La ayuda usa el mismo proveedor de decisiones, conocimiento, memoria, objetivos, pasos y controles de V1.2. Se conserva el acceso de propietario/encargado; no se habilitan funciones nuevas al empleado. Los modos operativos, preguntas, planes, confirmaciones y ejecutores V3 no se incluyen.

No existen directorios `src/iatry/v2` ni `src/iatry/v3` en esta rama. El plugin `iatry-visual-only-release-guard` revisa los módulos de **todos** los chunks, incluidos los diferidos, contra una lista cerrada. Rechaza motores/catálogos experimentales e importaciones no aprobadas. Emite `iatry-visual-audit.js` en el artefacto, con revisión y lista real de módulos. El `release-check.cjs` existente del workflow ahora verifica también esa evidencia y busca firmas de la interfaz operativa en todos los JS publicados. La suite de guardas prueba rechazos, incluido un indicador de ejecución falsificado.

Los archivos de pruebas, fixtures, evidencias, respaldos, scripts y documentación quedan fuera del artefacto público. La demo de producto preexistente se conserva.

## Verificaciones realizadas

- TypeScript, compilación y 32 pruebas React: correctos. Guardas de exclusión: correctas.
- Artefacto productivo construido con la **misma configuración pública** publicada; comprobado el proyecto `djoxdtloqwbrhgtgencc`, clave publicable y rutas hash. Valores de configuración no incluidos en este informe ni logs.
- El dominio público `atryturnos.com` responde 200. No se modifican dominio, workflow, variables de GitHub, configuración de Supabase ni permisos del servidor.
- Chrome y WebKit sobre el artefacto empaquetado, con demo ficticia y toda solicitud externa bloqueada: recorrido inicial y objetivos reales; creación/edición/publicación/ocultación manual de servicio; celebración solo tras respuesta; protección de borradores; navegación; propietario/encargado/empleado; búsqueda sin ejecución; minimizar/retomar; Escape/foco; pausa y movimiento reducido.
- Responsive de 320, 390, 768, 1440 y 1920 px. Sin desbordamiento horizontal. Ocultación durante modales ordinarios y conservación del estado minimizado al cerrarlos.
- Los archivos de aplicación, pantallas, repositorios, servicios, contratos, transporte, servidor, adaptador cloud y motor/conocimiento/memoria V1.2 son idénticos a la revisión base. Los cambios se limitan a presentación de IAtry, guardas de compilación/artefacto y sus pruebas/documentación.
- No se hicieron solicitudes a Supabase ni escrituras productivas. Estas pruebas verifican la publicación visual; no homologan la automatización V3 ni vuelven a certificar RLS.

## Rendimiento

Mismo toolchain y configuración pública, Chrome sin throttling, demo local sin red externa. Cinco contextos nuevos por variante, orden alternado; medición con performance.now/rAF hasta lista/formulario renderizado. Las cifras son medianas y no representan latencia de Supabase.

| Medición | Publicado c1c1171 | Candidato visual |
| --- | ---: | ---: |
| Navegar a Servicios | 3,7 ms | 8,2 ms |
| JavaScript de esa navegación | 3,302 ms | 3,902 ms |
| Layout de esa navegación | 0,748 ms | 0,994 ms |
| Abrir ayuda | 6,6 ms | 10,7 ms |
| Abrir formulario nativo de servicio | 11,2 ms | 6,2 ms |
| JS/CSS inicial solicitado, gzip | 173.333 bytes | 179.728 bytes |

El incremento inicial es 6.395 bytes gzip; no hay consultas adicionales al abrir IAtry. El coste adicional medido de JavaScript al navegar es 0,6 ms. Se evitó montar anticipadamente el árbol oculto del panel; la primera medición del candidato daba 17 ms en Servicios y después del ajuste dio 8,2 ms. Las mediciones de pared incluyen la fase del próximo frame, por lo que variaciones pequeñas requieren esa cautela. No se observa la regresión histórica de cientos de milisegundos.

## Recuperación y publicación pendiente

Base recuperable en GitHub: `c1c117196e15490433ae7a827a1524ea1da84f83`, también identificada por la etiqueta remota existente `release/react-iatry-2026-10-25-rc1`. Etiqueta local adicional preparada: `rollback/pre-iatry-visual-2026-10-26`; aún no publicada.

El workflow `.github/workflows/pages.yml` conserva `workflow_dispatch.inputs.source_ref`, checkout de esa referencia y el mismo despliegue de Pages. Para recuperar el frontend anterior:

1. GitHub → Atry-Agency/ATRY-Turnos → Actions → **Publicar interfaz Atry Turnos** → **Run workflow**.
2. Seleccionar `main` y poner en `source_ref`: `c1c117196e15490433ae7a827a1524ea1da84f83`.
3. Ejecutar, comprobar build/deploy correctos y verificar `https://atryturnos.com`. No requiere migraciones, cambios en Supabase ni reset/force-push de main. La restauración tarda lo que tarde el workflow de Pages.

Antes de publicar, **después de la confirmación final**: volver a obtener origin/main y exigir que siga en la base revisada; publicar/verificar la etiqueta de recuperación local; actualizar main con fast-forward del commit candidato (sin force); comprobar el workflow, el dominio y el proyecto público. Detenerse si aparecen cambios ajenos, falla la exclusión o el dominio apunta a otra configuración. No se han ejecutado esos pasos de publicación.

## Revisar localmente

`npm --prefix frontend/react run build` genera el frontend, y el empaquetado habitual usa las variables públicas ya configuradas del proyecto. No imprimirlas ni cambiarlas.

Con el artefacto preparado: `node scripts/react/iatry-visual-preview.cjs`. Abrir http://127.0.0.1:3323/?demo=1&plan=2#/app/inicio. Ese servidor permite solo archivos del manifiesto, bloquea APIs locales y conexiones externas mediante CSP, y utiliza exclusivamente la demo. No necesita acceso administrativo.
