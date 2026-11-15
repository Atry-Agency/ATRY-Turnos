# Propuesta local: cierre editorial y confirmación en código

Sin publicación. Basada en el trabajo local de `codex/panel-footer-skeletons`.

## Cambios

- Footer grafito: declaración editorial, directorio en dos columnas, firma original del estudio integrada y franja legal. Se mantienen los siete enlaces y sus destinos; no se incorporan documentos legales pendientes.
- La sección posterior a reservar sustituye su captura por `ConfirmationPhone`, una composición HTML/CSS exclusivamente ilustrativa. Reutiliza los iconos de calendario y los archivos oficiales de Google/Apple del producto. Emblema ATRY original.
- Marco oscuro con isla fuera del contenido, pantalla clara, filas de calendario de 44 px y cierre de 42 px. Ajustes mediante consultas de contenedor para conservar la escala móvil dentro del viewport de escritorio.
- El mapa es una franja estática recortada de la captura existente, con atribución OpenStreetMap; no se inventa cartografía ni se realizan consultas externas. No representa ubicación de un negocio real.
- No contiene enlaces, botones, descargas, iframes, transporte autenticado ni operaciones de reservas. Los tres controles de la sección únicamente resaltan áreas visuales; se mantiene el CTA a la demo existente.
- Se preservan los controles de movimiento reducido y el scroll manual.

## Verificación

- Compilación TypeScript/Vite aprobada.
- Suite React aprobada (32 pruebas base más las suites encadenadas de IAtry, contratos y seguridad).
- Regresión de la sección: posición, tres momentos, recursos oficiales, no acciones en el teléfono, ausencia de transporte operativo y movimiento reducido.
- Chrome y WebKit: 320, 390, 430 y 1440 px. Siete enlaces conservados, logotipos cargados, sin desbordes horizontales, filas de 44 px, cero escrituras y errores JavaScript.
- Release-check aprobado; alcance operativo intacto. Ningún cambio en Supabase, permisos, precios ni reservas.

Vista local: http://127.0.0.1:3360/descubrir.html#despues-de-reservar
