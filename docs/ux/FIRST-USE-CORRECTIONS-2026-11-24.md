# Correcciones del recorrido de primer uso — 24/11/2026

Trabajo local en `codex/ux-f1-f7`, conservando las correcciones anteriores. El usuario pidió implementar las fricciones observadas y no generar capturas.

## Cambios

- Contacto: ayuda persistente y asociada a teléfono/correo en reservas manuales y públicas. Sigue alcanzando con uno; se conservan las validaciones existentes. El formulario público enfoca teléfono cuando faltan ambos contactos.
- Crear turno: Inicio y Clientes reutilizan el mismo buscador de clientes y selector de horarios disponibles de Agenda. Se mantienen el cliente preseleccionado, borradores, restricciones de empleados y validaciones del servidor.
- Después de crear o reprogramar: se abre la fecha y se selecciona el profesional elegido en móvil. Los filtros que ocultarían el turno se limpian. La recarga de Agenda ahora sincroniza también esas preferencias cuando la fecha no cambia; antes solo recuperaba fecha y modo.
- Menú móvil: elegir la sección actual también cierra el drawer y restablece el fondo y el foco mediante el mecanismo existente.
- Página pública: se diferencia de «Crear turno». «Compartir» reúne copiar enlace, probar como cliente y abrir WhatsApp con un texto preparado. No envía mensajes. Se reutiliza en primeros pasos y la orientación de IAtry.
- Primeros pasos: marcas explícitas de revisión por usuario y negocio, guardadas en el dispositivo, con una próxima acción. No equivalen a validación de disponibilidad, suscripción o configuración; no finalizan el onboarding automáticamente. El cierre y sus requisitos siguen siendo los existentes.
- IAtry: reconocimiento de objetivos de orientación y compartir enlaces sin nuevas herramientas; aclaración editable después de una solicitud no entendida; sugerencias iniciales de configuración cuando corresponde. Una referencia `@self` sin profesional resuelto pregunta por el profesional en vez de afirmar que ya tiene todos los datos. Los accesos de orientación respetan el rol.
- Dictado opcional del navegador: idioma del negocio activo, texto editable, envío explícito y errores visibles. Sin dependencias ni modelos pagos añadidos. Se cancela al desmontar o cambiar de contexto. No confirma ni ejecuta operaciones.

## Verificación reproducible

```sh
npm run build
npm run test:react
NODE_PATH=/private/tmp/atry-ux-tools/node_modules node scripts/react/first-use-browser.cjs
```

La ruta de Playwright es la instalación local disponible; no es una dependencia nueva del producto.

- Build TypeScript/Vite y suite React, IAtry, permisos y contratos. Incluye 27 comprobaciones nuevas de orientación, negaciones, progreso aislado y profesional pendiente. Se conserva la política de 17 herramientas aprobadas.
- Pruebas de interacción/renderizado sin screenshots: Chrome y WebKit en 320, 390, 768 y 1440 px. Creación y reprogramación verificadas mediante lectura de PostgreSQL desechable y el adaptador cloud existente; comprobación de profesional móvil y ausencia de overflow horizontal.
- Cambio UY/PA: progreso aislado; idioma de dictado `es-UY`/`es-PA`; reserva PA a las 14:30 locales y snapshot de 1299 centavos USD en ambos motores a 390 px.
- IAtry: orientación, compartir, fallback editable y ausencia con profesional pendiente no generan escrituras. Dictado y permiso denegado probados con un doble de la API nativa; el texto no se envía automáticamente.
- Sin cambios en Supabase, servidor, adaptador cloud, precios ni permisos. Sin publicación.

## Límites

No se verificaron micrófonos físicos, reconocimiento de voz real, iPhone/PWA físico, VoiceOver ni entregas externas de WhatsApp/correo. La presencia del dictado depende del soporte del navegador; escribir sigue disponible. Las comprobaciones de geometría e interacción no se presentan como una revisión visual mediante capturas, que el usuario excluyó.
