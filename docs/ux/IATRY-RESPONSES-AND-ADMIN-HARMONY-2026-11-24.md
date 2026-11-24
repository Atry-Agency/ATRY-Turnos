# IAtry y armonía administrativa — 24 de noviembre de 2026

Entrega local, sin publicación ni capturas. La referencia visual orienta la presentación; no autoriza funciones, datos ni confirmaciones nuevos.

## Respuestas de IAtry

Se incorpora un lenguaje de respuesta reutilizable con colores de texto, acento, superficies y separadores propios del asistente. La identidad, el emblema y las familias originales se conservan.

- `ResponseCard` y `ResponseHeading`: encabezado con icono familiar y título, explicación, pasos agrupados, acciones y opciones relacionadas. Los iconos de las guías proceden del destino real, no de una nueva interpretación del pedido.
- `AssistanceCard`: deja de depender de los márgenes genéricos de `stack`. Los pasos conservan su texto completo y los enlaces su destino y navegación protegida. Las sugerencias pasan de enlaces sueltos a filas táctiles completas.
- Guías y orientación: una región de desplazamiento para el contenido y compositor fuera de ella. Se respeta el espacio ocupado por la cabecera en escritorio y el viewport disponible en móvil.
- Resultados y fichas de operaciones: mismo lenguaje de superficies, encabezados y contraste. Las consultas no reciben un estado visual de guardado. Se conserva la distinción entre propuesta, confirmación pendiente y resultado verificado.
- Aclaraciones: opciones con tamaños cómodos. Resultados seleccionables: indicadores de navegación SVG consistentes.
- Administración: las respuestas de conversación, propuestas y lecturas reutilizan los mismos tokens sin modificar el motor administrativo.

No se modifican reconocimiento, herramientas, transportes, permisos, validaciones, confirmaciones, precios, reservas ni contratos. Los saludos simples continúan como mensajes; no se les agrega una tarjeta innecesaria. No se añaden flechas diagonales decorativas ni modelos pagos.

## Corrección adicional de Administración

La captura del usuario mostró dos problemas que un chequeo de ancho de documento no detectaba:

1. En anchos intermedios, la antigua grilla de negocios reducía sus columnas, pero `display:contents` seguía distribuyendo el estado como una celda independiente. Terminaba en la columna estrecha del icono y partía la fecha. La nueva composición conserva los metadatos juntos y se adapta al ancho de la lista mediante container queries. Cada fecha se mantiene en una línea.
2. Los filtros usaban `display:contents` sobre un `details`, con una distribución desigual. Escritorio utiliza un contenedor de grilla explícito; móvil conserva el desplegable. Los valores controlados se conservan al cambiar de tamaño. Los selectores siguen siendo nativos con un cheurón visual uniforme, espacio interior y las mismas opciones.

También se refina la escala del título del encabezado. Las comprobaciones ahora miden líneas reales de fecha y distribución de cada grupo, además de límites exteriores.

## Referencias de diseño

Skill `apple-design`: Layout (agrupación, alineación y adaptación), Typography (jerarquía y legibilidad), Accessibility (contraste, texto ampliado y foco), Buttons (acciones reconocibles y área táctil), Modality (tarea identificable y salida clara), y el principio de control de la persona de Generative AI. IAtry sigue siendo determinista: se toman principios de interacción, no se presenta como un nuevo modelo generativo.

Decisiones propias de ATRY: violeta sobrio, superficies claras con matiz lavanda, título e icono alineados, acción dominante y opciones secundarias en filas. No es una copia de iOS ni una certificación Apple.

## Verificación realizada

- Compilación TypeScript/Vite, suite React y consolidación de IAtry, incluidos los controles de las 17 herramientas y permisos.
- `iatry-response-browser.cjs`: Chrome y WebKit a 320, 375, 390, 430, 768 y 1440px; guías, pasos, consultas relacionadas, destinos, compositor y fichas de resultados. Sin escrituras.
- `iatry-response-states.cjs`: ambos motores a 390 y 1440px; contraste de texto renderizado >=4,5:1, foco visible, texto al 200 %, viewport de altura reducida y compositor alcanzable.
- `iatry-owner-guidance-browser.cjs`: ambos motores a 390 y 1440px; navegación protegida y cancelación de salida, fecha según negocio PA/UY, consultas de ausencia y búsqueda de solo lectura.
- `iatry-instructions-browser.cjs`: conversación, corrección de propuesta, traspaso al formulario, confirmación explícita y relectura en SQLite desechable. La prueba conservaba textos retirados y omitía el profesional que ahora pide IAtry; se actualizan esas expectativas y la fecha fija antigua. El producto no se cambia para eludir la prueba.
- `admin-premium-browser.cjs`: diez secciones en ambos motores; nuevos chequeos de líneas de fechas, grilla de filtros y espacio para el indicador del selector. Se cubren también 900, 1024, 1100 y 1280px, además de la matriz habitual, para reproducir el caso del panel lateral de escritorio.

No se toman imágenes por la instrucción vigente del usuario. DOM renderizado y medidas no equivalen a una revisión perceptual con capturas ni a pruebas con VoiceOver o teclado físico en un iPhone. Esas comprobaciones físicas no se certifican.
