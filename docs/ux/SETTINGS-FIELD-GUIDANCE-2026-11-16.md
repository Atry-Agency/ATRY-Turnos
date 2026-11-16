# Configuración y ayudas de formulario — 16/11/2026

Trabajo local sobre `d736300`, rama `codex/settings-field-guidance`. Sin publicación, migraciones ni cambios de datos o permisos.

Se volvieron a revisar visualmente las 29 páginas de la referencia «reglas de uso.pdf». Se aplican las indicaciones pertinentes sobre etiquetas claras, ejemplos/formato, jerarquía, reducción de ruido, iconos reconocibles y objetivos táctiles. No se reproducen los diseños ni el contenido promocional del documento.

## Correcciones

- Causa confirmada: `font: inherit` en el botón Configuración anulaba la tipografía de `.navlink`. Antes: 16 px / peso 500 frente a 13 px / 650 en los demás destinos. Ahora comparte ambos valores.
- El submenú conserva las rutas y sus permisos, con etiquetas cortas. Se retiran sus siete iconos secundarios y los títulos visuales redundantes; la agrupación conserva nombres accesibles. Solo el nivel principal lleva icono.
- Subopciones discretas, alineadas y con estado activo claro; 36 px en escritorio y al menos 44 px en móvil. No se alteran ThemeStudio, formularios ni vistas previas.
- Catálogo reutilizable de ejemplos para TextField, con respeto de placeholders específicos y de valores, restricciones, autocompletado y nombres de campos existentes.
- Ayudas contextuales en áreas de texto y entradas sin guía: clientes, servicios, turnos, recurrencias, configuración, comunicaciones, soporte, administración, registro, cuenta e IAtry.
- Ejemplos telefónicos por país cuando el componente dispone de ese contexto; ayuda internacional neutra cuando no lo tiene. Precios USD con decimales y UYU conservando el contrato actual.
- Las etiquetas permanecen visibles. Los ejemplos no se envían, no se validan como valores ni se guardan. No se incorporan máscaras que impidan teléfonos internacionales.
- Fechas, horas, archivos, colores, controles de rango, selectores y casillas conservan sus controles nativos. El campo de texto HEX recibe un ejemplo separado.

## Verificación

Inventario de 209 controles JSX; las entradas de texto editables directas sin guía pasan de 23 a cero. Las excepciones nativas se comprueban por tipo.

- `node scripts/react/field-examples-test.cjs`: ejemplos, tipos nativos, valores existentes, validación, accesibilidad y exclusión de props de presentación del DOM.
- `node scripts/react/settings-navigation-test.cjs`: nueve combinaciones de rol/plan, sin enlaces o accesos nuevos.
- `npm run build` y `npm run test:react`.
- `settings-field-guidance-browser.cjs`: Chrome/WebKit, 320/390/430/1440; tipografía real calculada, ausencia de iconos duplicados, enlaces profundos, campos vacíos, conservación de valores y validación obligatoria. Comparación antes/después en 390/1440.
- Se mantienen las pruebas existentes de formularios UY/PA para comprobar importes y payloads. Toda la verificación usa datos ficticios locales.

Resultado: compilación y suite React aprobadas; 32 comprobaciones de ejemplos; matriz de navegación de nueve perfiles; Chrome/WebKit en los cuatro anchos aprobados, incluidas paletas personalizadas claras/oscuras con contraste de texto mínimo 4,5:1. La regresión existente comprobó diez pantallas por combinación y ocho envíos UY/PA interceptados, sin guardar registros.
