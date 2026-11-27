# Cierre de caja · revisión local · 27/11/2026

## Dirección de producto

El cierre es una revisión acompañada por IAtry: elegir lo recibido, resolver lo pendiente, agregar extras, contar efectivo cuando corresponde y confirmar. La identidad existente de IAtry —LiquidAvatar y sus estados— es el elemento distintivo; controles, importes y navegación mantienen una composición tranquila. No se añadió otro asistente ni un catálogo de herramientas de escritura.

Se aplicó apple-design a React web: jerarquía, divulgación progresiva, agencia, feedback y movimiento con propósito. Referencias locales: writing.md (Best practices), motion.md (Best practices), entering-data.md, generative-ai.md, layout.md y accessibility.md. Los títulos y el tono son decisiones de diseño de ATRY, no una certificación de conformidad nativa.

- «Cerremos la caja» con avatar oficial; estados reales de interacción, preparación, error, confirmación y éxito.
- Una pregunta breve por escena, progreso compacto y campos relevantes a la situación.
- «Seleccionar todos» conserva su significado en hover: desliza las letras sin afirmar que se guardaron cobros. La selección actualiza importes; el editor «Ajustar» revela opciones de cada trabajo.
- «Equipo y caja» concentra filtros y actualización. No hay un bloque de instrucciones debajo de la selección colectiva.
- Extras, efectivo y revisión tienen lenguaje y composición compartidos. Los beneficios, divisiones de pago y notas aparecen al necesitarlos.
- El avance nunca registra operaciones. «Confirmar jornada» requiere autorización explícita. El avatar sólo muestra éxito tras verificar el resultado.
- Si la respuesta se pierde, se ocultan las acciones ordinarias y cualquier importe aparente de una revisión nueva: se comprueba la solicitud original. La revisión queda conservada.
- Transiciones de selección, revelado de campos y texto breves; sin números interpolados ni rebotes. Alternativa estable con movimiento reducido y funcionamiento completo sin hover.
- Modal centrado, espacio para los anillos de foco y desplazamiento interior. En alturas cortas se desplaza el contenido completo para mantener accesibles el formulario y sus acciones.
- Los avisos informativos sin acciones no interceptan clics sobre botones.

## A01–A10: cambios y evidencia

La auditoría original sigue en AUDIT-CLOSEOUT-2026-11-26.md; esta revisión documenta su resolución.

| Hallazgo | Resolución | Comprobación |
| --- | --- | --- |
| A01 | Al pasar de parcial a completo se recalcula el saldo vigente | Aserción de importe, no sólo reproducción |
| A02 | Distribución adaptable y un desplazamiento utilizable en paisaje/altura corta | Geometría real Chrome/WebKit, 320–1440px y alturas 300–844px |
| A03 | Error asociado al campo, aria-invalid y foco en el primer dato inválido | Aserciones de accesibilidad y foco |
| A04 | Borradores por usuario, negocio, sesión y día; no se restaura autorización | Recarga, pausa, actualización, cambio de día, aislamiento y vencimiento |
| A05 | Descuentos reales y cortesías sin cobros ficticios | Saldos, movimientos inmutables, redondeo exacto y concurrencia |
| A06 | Revisiones vacías, sin dinero y pospuestas válidas | Confirmación y ausencia de eventos monetarios |
| A07 | Resolución de Agenda dentro de la misma transacción | Cancelación, replay y rollback tardío |
| A08 | Agrupación por ID de profesional y selección de los trabajos visibles | Dos profesionales; selección filtrada conservada |
| A09 | Historial paginado de 20, búsqueda y filtros explícitos | 20+4 sin duplicación; búsqueda y reapertura |
| A10 | Pasos según las circunstancias y confirmación específica | Se omite efectivo cuando no corresponde; recuperación de respuesta perdida |

## Integridad y límites

La migración 202611270003 es aditiva y se ejecutó exclusivamente en bases aisladas locales. Se reutilizan el libro financiero, los contratos, los permisos, las proyecciones y las RPC de Agenda existentes. No se modificó producción ni se ejecutaron migraciones remotas.

Los beneficios requieren el permiso existente de devoluciones, motivo, saldo vigente y confirmación. Porcentaje calculado sobre el saldo pendiente, con precisión de centésimas de porcentaje y redondeo monetario exacto; la cortesía elimina el saldo restante sin crear ingresos. Conservan precio original, auditoría y movimientos inmutables. Esta versión no añade una interfaz para revertir descuentos o cortesías ya confirmados.

Las cancelaciones respetan las restricciones de Agenda y las visitas combinadas; un fallo posterior revierte también la cancelación. Una misma solicitud tiene replay idempotente y no puede reutilizarse con otro contenido. Las pruebas concurrentes usan PostgreSQL 17.6 real, conexiones independientes y detección de espera de bloqueo, además de PGlite para escenarios aislados.

Borradores en sessionStorage de la pestaña/sesión, vigencia 24h; no son una copia remota ni una sincronización entre dispositivos. Una revisión guardada no restaura la casilla de autorización. Los filtros del historial consultan al solicitarlos; escribir importes o seleccionar trabajos no envía escrituras ni consultas por cada cambio.

La validación de navegadores usa DOM, árbol accesible, estilos computados y geometría, sin nuevas capturas por indicación del usuario. No sustituye una evaluación presencial en iPhone/VoiceOver. No se probaron producción, PostgREST remoto ni carga masiva.

## Vista para revisar

http://127.0.0.1:3388/?cierre=20261127#/app/finanzas/closeout

Base efímera de ensayo con tres trabajos de hoy, dos profesionales y sin cobros precargados. Las vistas antiguas y sus datos de ensayo se conservaron. No usar para operaciones reales; al detener el servidor de ensayo se pierde esa base temporal.

## Evidencias conservadas

En evidence/2026-11-27/: browser-regressions.json (A01–A10, dos navegadores), interaction.json (hover real, tacto y movimiento reducido), themes.json (13 paletas × 2 modos × 2 navegadores), recovery.json (conexión y borradores), concurrency.json (PostgreSQL real) y checks.txt (pruebas de regresión, React y finanzas). Compilación y comprobación de diferencias completadas. Las pruebas generales y financieras preceden al último ajuste de textos y CSS; las pruebas finales de interacción, temas y recuperación verifican la nueva composición.

## Extras y lenguaje de los campos

«Cobré algo más» consulta el catálogo existente del negocio una vez al necesitarlo. Permite combinar servicios, repetirlos con cantidades, quitarlos y optar por un detalle personalizado. Los precios precargan un total editable; elegir nuevamente servicios recalcula ese total de referencia. Los servicios ocultos siguen identificados como tales. Un fallo del catálogo permite continuar con texto personalizado y ofrece reintento.

Esta selección es una ayuda local de composición: el contrato confirmado sigue enviando ingresos independientes con detalle, monto y método. No crea reservas, no completa servicios ni duplica recibos de una reserva. Los elementos y cantidades se conservan en el borrador con validación, y el registro definitivo conserva su descripción y el total declarado. No hay cambios de esquema, permisos ni RPC.

Los campos usan «Cuánto cobraste», «Cuánto pagaste» y ayudas compartidas según el contexto. El efectivo solicita todo el dinero físico de la caja, incluido cambio y efectivo inicial; excluye medios digitales. Las diferencias requieren una explicación sin presentarla como opcional.

Comprobado en Chrome/UYU y WebKit/USD: varios servicios, repetición, suma exacta, eliminación, importe editado y restaurado, texto personalizado, fallo de catálogo, gasto y cierre confirmado una sola vez. Se verificaron anchos 320/375/390/430/768/1440 y orientación horizontal. Evidencia: extra-services.json. Compilación con TypeScript, suite React, suite financiera de cierre y 37 verificaciones de ayudas de campos: aprobadas.

## Controles y superficies del cierre

Las casillas conservan input nativo y etiquetado; su presentación usa la marca Lucide existente, trazo animado en ambas direcciones y respuesta de presión. La fila de cierre indica una consecuencia futura («Se cerrará» / «Quedará abierta»), sin simular confirmación. Los campos y selectores usan la superficie del tema y bordes derivados de su texto; se retiró el gris fijo del cierre. Movimiento reducido conserva estados sin animaciones; alto contraste usa colores de sistema.

Se eliminó el recuadro de foco automático sólo en los títulos de escena con tabindex=-1. El foco programático se conserva para orientar lectores de pantalla; campos, casillas y botones mantienen sus indicadores de teclado. Comprobado en el navegador local que el título permanece enfocado con outline none.

Evidencias controls.json, controls-circuit.json y controls-themes.json: Chrome/WebKit, teclado/Space, trazo al marcar/desmarcar, foco visible en casillas, conservación del conteo, cero escrituras por cambios de selección, responsive 320–1440 y paisaje, movimiento reducido y alto contraste. El circuito financiero completo sigue requiriendo un único envío confirmado y recupera respuestas perdidas. Trece temas × dos modos × dos navegadores incluyen contraste de campos y marca de casilla. Sin cambios financieros, de permisos ni migraciones.

## Unificación de formularios y cierre de ventanas

Los campos de formularios financieros, revisión guiada y filtros del historial comparten superficie del tema, borde de control y foco interior, sin acumular outline exterior y halo. Las tarjetas seleccionadas conservan la casilla y el fondo contextual con un borde discreto; las superficies informativas de caja y recuperación dejan de usar el gris heredado. Los títulos programáticamente enfocados de revisión financiera siguen el criterio de los títulos de escena.

Los botones de cierre de la primitiva Modal y de IAtry usan la clase semántica dialog-close: hover de puntero y foco visible con el rojo existente de Cancelado (--atry-danger, #E51D4F), y símbolo blanco. No se alteró el cierre, la protección de borradores ni la política de confirmación.

Evidencia surfaces-and-dismissal.json: Chrome y WebKit, Night Swim claro/oscuro, modal de métodos, gasto, modal compartido de Servicios e IAtry; foco interior, superficies, hover/foco rojo-blanco, 320/375/390/430/768/1440 y paisaje; cero escrituras financieras. Compilación con TypeScript y git diff --check aprobados. Verificación en IAB nuevo: fondo blanco, outline none y foco de 1px interior (además del borde del control). La pestaña anterior se conservó con su borrador porque la revisión automática bloqueó descartarlo para recargar; la vista actualizada quedó abierta aparte.
