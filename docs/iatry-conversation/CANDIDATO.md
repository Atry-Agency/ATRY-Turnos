# IAtry: conversación natural local

Rama `codex/iatry-v3-natural-conversation`, basada en la versión publicada `65870d2`. No publicada. Sin cambios ni escrituras sobre Supabase.

- La interpretación original sigue reconociendo intenciones, fechas, ambigüedades y planes compuestos. Una capa local conserva respuestas y correcciones, pregunta por el dato siguiente y presenta la ficha. No tiene transporte, permisos ni un segundo backend.
- Burbuja compartida con la landing; se reutilizan esfera, fichas, miniagenda y confirmación. Sin esperas artificiales. Mensajes anteriores y detalles secundarios se pueden desplegar. Resultados extensos muestran primero tres registros.
- Las lecturas autorizadas se realizan cuando la consulta está definida, no al escribir ni para redactar respuestas. El traspaso al motor valida los datos y resuelve referencias contra opciones autorizadas; no repregunta datos válidos. Las escrituras siguen requiriendo autorización efectiva, propuesta, confirmación y relectura.
- Bloqueos productivos intactos: cinco lecturas para el propietario de Pelu, cero escrituras, dos incompatibilidades bloqueadas. La conversación permite preparar ideas sin presentar una operación bloqueada como ejecutable ni completada.

## Cómo probar

Servidor local: `ATRY_V3_PORT=3339 node scripts/react/iatry-v3-preview.cjs` después de compilar. `/local-assistant` usa exclusivamente SQLite temporal, datos ficticios y envíos desactivados. `/?demo=1&plan=2#/app/inicio` muestra los límites de lectura de la demostración pública.

Probá «Agregame un servicio», luego «Barba», «20 minutos y 400 pesos» y «No, mejor 30 minutos». También «Subí el precio del corte a $650», «Mañana descanso de una a dos», «Me voy de vacaciones la semana que viene», «Juan faltó», «Buscá el cliente Ana» y «Cómo va mi negocio». Para precisar fechas escribí, por ejemplo, «hasta 19/11/2026 a las 09:00». No se inventan fechas de regreso ni profesionales.

## Comprobación

Pruebas puras de diálogo y permisos; suite React/seguridad; conversaciones en Chrome/WebKit, iPhone/escritorio, usando mocks y SQLite; protección táctil/foco/rotación; landing compartida en 320/390/1440 px. Sin capturas, videos ni PDF. Las pruebas locales no homologan operaciones adicionales contra Supabase.

Rollback preparado hacia `65870d266a2ee85ab093ff444ea6cdf1d0f38b78` usando el `source_ref` del workflow existente. No ejecutar publicación sin aprobación del usuario.
