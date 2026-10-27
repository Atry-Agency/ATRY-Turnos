# IAtry Experience — publicación de landing

Base publicada: `58e7c992340c7955f63bae9441de2f40842cdd05`.
Rollback: etiqueta `rollback/pre-iatry-cinema-2026-10-27`.

Cambios limitados a cuatro archivos de marketing y dos comprobaciones locales. Motor IAtry, permisos, adaptador cloud, funcionalidades del producto, configuración Supabase y workflow sin modificaciones respecto de la base. La sección utiliza exclusivamente estado React y datos ficticios; ninguna confirmación ejecuta una operación real. Las capacidades simuladas en desarrollo y el piloto restringido están identificados explícitamente.

Validación: TypeScript/Vite, suite React existente, integridad literal de contenido comercial exterior/precios/CTA, Chrome y WebKit en 320x568, 390x844 y 1440x960, navegación de siete capítulos, conversaciones guiadas, movimiento reducido, pausa, ausencia de desbordamientos, llamadas externas/API y secretos en el artefacto.

## Recuperación inmediata

1. GitHub → Actions → «Publicar interfaz Atry Turnos» → Run workflow.
2. Seleccionar rama `main` e ingresar `rollback/pre-iatry-cinema-2026-10-27` en `source_ref`.
3. Ejecutar y esperar que build y deploy terminen correctamente.
4. Comprobar https://atryturnos.com/descubrir.html y el acceso habitual.

El workflow recupera los archivos del commit anterior y vuelve a desplegarlos. No requiere cambios en Supabase, migraciones ni reescribir el historial Git.
