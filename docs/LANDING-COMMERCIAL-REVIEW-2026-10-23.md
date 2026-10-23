# Landing comercial: revisión local del 23/10/2026

Estado: **sin publicar**. Rama `codex/landing-commercial-evolution`, base `6d260eb` de main. Se conserva `web/descubrir.html` como diseño base; no se utilizó la alternativa storytelling.

## Alcance

Solo `descubrir.html/css/js`, seis capturas nuevas, dos herramientas locales de revisión y sus pruebas. Sin cambios en la interfaz del SaaS, Supabase, Storage, planes, cuotas, Brevo, autenticación o despliegues.

- Cuarta pestaña Comunicación; cambios de imagen con altura estable, decodificación previa, protección frente a respuestas fuera de orden y recuperación ante errores.
- Ejemplo interactivo de cinco tipos de mensajes. Reutiliza el motor puro `whatsapp-core.js`; no llama APIs, no abre WhatsApp ni envía mensajes.
- Comparación comercial con WhatsApp manual en los tres planes y 2/10/100 plantillas propias; seis plantillas de ATRY editables aparte. Pro: 100 es un límite técnico.
- Fotografía opcional, privacidad pública y avatar de iniciales explicados con el editor real. No se inventó una fotografía: la captura muestra explícitamente el estado sin foto.
- Captura de Clientes desplegable; enlace a las demos reales de Clientes y Equipo.
- Identidad interactiva existente conservada. Nombre y colores se aplican a los dos iframes aislados; demostración rotulada Pro.
- Precios 790/1490/2490, profesionales 1/4/10, correos 0/300/900 conservados.
- FAQ distingue envío manual, email automático, aceptación y entrega.
- Movimiento discreto, alternativa de movimiento reducido, estados de foco y áreas táctiles de 44 px en los controles nuevos.

## Investigación del render defectuoso

Se observó una primera vista **local con capture=1** sin aplicar varias reglas específicas: `.pb-signature` y `.pb-facts` tenían display block. No se aceptó esa imagen.

Comparación posterior del mismo componente a 1280 px:

| Variante | Firma | Datos | Separación ícono/texto | Duración |
|---|---|---|---|---|
| Producción con demo | flex | grid | 9 px | block |
| Local normal | flex | grid | 9 px | block |
| Local capture=1 | flex | grid | 9 px | block |

El archivo theme-studio.css servido local y en producción coincide con el repositorio (SHA-1 `5b87261916a67989a872ca5ddedde48a636a6b57`). El modo capture solo suprime el aviso demo; no cambia esos selectores. Tras recargar, el defecto no se reprodujo. **No hay evidencia suficiente para atribuir el disparador inicial a un fallo del producto, al modo capture o a caché específicamente.** No se cambió CSS del producto para ocultar el problema.

Para evitar aceptar otro render incompleto, la herramienta local sirve recursos con `Cache-Control: no-store`, espera fuentes y dos frames de pintado, y expone `data-capture-ready`/`data-capture-failures`. Rechaza espaciado perdido, imágenes visibles sin cargar y desborde horizontal. Este control no sustituye la inspección visual manual.

## Capturas

Capturas del producto real servido localmente, sin cambiar su HTML ni CSS. Se sustituyen únicamente los datos de la demo en memoria mediante la herramienta local: Estudio Aurora; profesionales y clientes ficticios; servicios entre $400 y $950. Sin teléfono, email personal, dirección privada ni identificadores visibles.

- `panel.webp`: panel y actividad.
- `agenda.webp`: agenda semanal.
- `reservas.webp`: selección pública con precios ficticios.
- `comunicacion.webp`: bandeja real y estados de recordatorios.
- `clientes.webp`: Clientes y botón circular WhatsApp.
- `foto.webp`: recorte del editor real, mostrando fotografía opcional y privacidad.

Las primeras cinco usan 1280×720. Foto es un detalle de 560×450 para legibilidad. Se revisaron visualmente antes de su inclusión final; las imágenes iniciales con nombres técnicos o estilos incompletos se descartaron.

## Verificaciones

17 pruebas aprobadas:

```
node --test tests/landing-commercial.test.js tests/showcase-preview.test.js tests/staff-photos-ui.test.js tests/whatsapp-round2.test.js
```

Pruebas nuevas: carreras al cambiar capturas; error de imagen; renderer de mensajes y límites; datos ficticios aislados; dimensiones y enlaces/precios; rechazo de capturas sin espaciado o con imágenes incompletas.

Verificación en navegador: cuatro pestañas y teclas Home; altura de panel estable (705.875 px en viewport 1280); colores y nombre aplicados en ambos iframes; 320/390/768/1280/1440 sin desborde horizontal; revisión visual de Inicio, Agenda, Clientes, Comunicación, reservas y editor de foto del producto a 390 px; portada y mensajes de landing en móvil; planes y Comunicación en escritorio. Consola de landing sin errores ni advertencias observados.

CSS analizado con esbuild sin advertencias; JavaScript válido; git diff --check limpio. Movimiento reducido comprobado en reglas y lógica; no se cambió la preferencia del sistema del usuario.

## Rendimiento

- Captura inicial: 110,412 → 58,114 bytes (47% menos).
- Tres capturas originales principales: 247,294 → 161,484 bytes (35% menos), más imágenes nuevas diferidas.
- Capturas WebP sin dependencias externas, dimensiones declaradas y carga diferida secundaria.
- JS de landing ~5.3 KB gzip; motor puro WhatsApp ~2.6 KB gzip; CSS ~10.4 KB gzip. Sin librería de animación ni scroll hijack.
- No se midieron Core Web Vitals reales ni una puntuación Lighthouse; no se inventan resultados.

## Revisión y publicación

Ejecutar `node scripts/preview-commercial.js` y abrir `http://127.0.0.1:3473/descubrir.html`.
La ruta `/__capture__/?demo=1&plan=3&capture=1#/app/inicio` sirve exclusivamente la fixture comercial local. Las herramientas viven fuera de web/ y no forman parte de GitHub Pages.

Pendientes antes de publicar: aprobación visual del usuario de composición, capturas y texto comercial; comprobación en Safari de un iPhone físico (la emulación de tamaño no sustituye Safari real). No se hizo push, merge, despliegue ni operación remota de datos.
