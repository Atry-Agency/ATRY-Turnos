# Auditoría local del Cierre inteligente de IAtry

Fecha: 26/11/2026, America/Montevideo. Rama: `codex/finance-cash-local`.

## Dictamen

La integridad financiera resistió los escenarios probados, incluida concurrencia real con conexiones independientes a PostgreSQL de servidor. La experiencia todavía necesita correcciones antes de recomendar su publicación: hay un fallo de correspondencia entre una respuesta y el importe, validación tardía sin foco en el error y un problema grave de espacio útil en horizontal.

Un principiante puede completar una jornada normal siguiendo las ayudas. No se puede afirmar todavía que resuelva toda jornada sin asistencia: un descuento real, una revisión con sólo excepciones, una interrupción con recarga y la resolución de un trabajo no realizado presentan fricciones concretas. Es una evaluación heurística y operativa; no reemplaza una prueba con personas ajenas al desarrollo.

Esta entrega añade pruebas y evidencia. Conserva la implementación anterior: no aplica silenciosamente las propuestas funcionales de este informe. No se publicaron cambios, no se ejecutaron migraciones remotas ni se tocaron datos productivos. No se tomaron capturas. Los ensayos utilizan exclusivamente datos ficticios y bases nuevas, separadas de las vistas locales del usuario.

## Jornadas y errores ensayados

| Escenario | Resultado observado |
| --- | --- |
| Profesional independiente, plan Individual | Cobro bancario 900 de un servicio de 1000, ingreso espontáneo 1, gasto en efectivo 5, apertura 100 y conteo 95. Neto 896; apertura excluida del ingreso; cierre sin diferencia; quedan 100 por cobrar. |
| Negocio con varios empleados | En PostgreSQL real se crearon seis reservas alternando dos profesionales. Se disputaron cobros, cancelación y finalización desde conexiones separadas. Sin duplicación de cargos o cobros en los casos medidos. |
| Jornada guiada UY / PA | Chrome con UYU y WebKit con USD: selección colectiva, pago dividido, parcial, trabajo no realizado, trabajo espontáneo, gasto, apertura olvidada y conteo. Tres eventos de cobro para dos reservas seleccionadas, un único cierre por negocio y estados de Agenda conservados. |
| Cobro previamente registrado | La selección utiliza el saldo restante, sin volver a cobrar la parte anterior. |
| Servicio sin pago o no realizado | La excepción no inventa pagos, cancela turnos ni borra cargos. Conserva el saldo y exige resolver Agenda por separado. |
| Descuento deliberado | Recibir 900 de 1000 deja deuda de 100. Actualmente no existe una operación de descuento en el cierre. No se lo consideró un descuento aplicado. |
| Importe excesivo | Impide confirmar, pero el error aparece al intentar salir de Otros movimientos, dos pasos después del importe equivocado. |
| Volver atrás y modificar respuestas | Conserva importes y movimientos espontáneos. Se encontró la inconsistencia A01 al pasar de parcial a «importe completo». |
| Recargar antes de enviar | La protección de salida existe; si se acepta salir, se pierde el borrador y vuelve la fecha actual. No se registra dinero. |
| Sin conexión antes de enviar | La solicitud queda pendiente; al recuperar conexión, recargar, verificar y reintentar, se registra exactamente una vez. |
| Respuesta perdida después de registrar | La prueba aborta una respuesta realmente procesada. Verificar recupera el resultado sin otro POST ni segundo cierre. |
| Fallo tardío al cerrar | Tanto PGlite como PostgreSQL de servidor revierten los cobros anteriores de esa misma transacción. |
| Sólo excepciones, sin dinero ni caja | No permite finalizar la revisión; el servidor devuelve `FINANCE_CLOSEOUT_EMPTY`. |

Los trabajos de los fixtures guiados se ubican en el día siguiente para aislarlos del resto de los ensayos. Los movimientos se registran ahora, como establece el contrato; no se simula una fecha contable pasada. Los métodos bancarios son registros manuales, sin verificación de una transferencia real.

## Concurrencia pendiente: completada en servidor aislado

Se utilizó PostgreSQL **17.6**, instalado como herramienta temporal fuera del repositorio. El servidor escuchó sólo en `127.0.0.1:55439`; directorio `/private/tmp/atry-finance-pg-audit/data`. El script rechaza otro directorio y no lee `DATABASE_URL` ni credenciales de proyectos. Crea una base nueva, carga las migraciones y fixtures, y la elimina al terminar. Las identidades y sesiones de Auth son sintéticas.

Se observaron esperas reales `wait_event_type = Lock` con PID de backend distinto, no únicamente promesas simultáneas dentro de PGlite:

1. Misma solicitud y clave: ambas conexiones obtienen el mismo resultado; una sola revisión.
2. Claves distintas con la misma cotización: la segunda se rechaza por revisión obsoleta.
3. Cobro parcial directo frente a cierre colectivo: se rechaza la cotización anterior.
4. Cobro completo colectivo frente a cobro directo posterior: se rechaza el sobrepago.
5. Dos recuperaciones de apertura con cierre: una apertura y un cierre, sin duplicación.
6. Cierre que gana frente a cobro en efectivo: el cobro tardío se rechaza porque no queda caja abierta.
7. Cobro en efectivo que gana frente a cierre: se rechaza el conteo obsoleto.
8. Cancelación desde Agenda: el cierre espera y rechaza la reserva cancelada.
9. Finalización desde Agenda: el cierre espera y detecta el cambio de estado; queda un solo cargo y no hubo deadlock en ese ensayo.
10. Fallo deliberado después de preparar un cobro: revierte eventos, proyecciones y revisión.
11. Otra empresa puede registrar dinero mientras la primera mantiene bloqueado su libro.
12. Desconexión antes de COMMIT: PostgreSQL revierte la transacción abierta.

Conciliación final: **5 revisiones, 2 sesiones cerradas, cero saldos negativos y cero diferencias** entre saldos y asientos o entre proyecciones de cargos y asignaciones. Los rechazos esperados son parte de la aprobación de la prueba, no operaciones omitidas.

Evidencia: [resultado del servidor](evidence/2026-11-26/concurrency.json). Reproductor: `scripts/react/finance-closeout-concurrency.cjs`. Esto no certifica todas las intercalaciones posibles ni sustituye pruebas de carga o PostgREST real.

## Problemas y correcciones propuestas

| ID / prioridad | Evidencia y consecuencia | Corrección propuesta |
| --- | --- | --- |
| A01 · Alta | Cobros → escribir 700 de 790 (UY) o 7 de 12.99 (PA) → desmarcar → Excepciones → «Sí recibí el importe completo». El campo conserva 700 o 7. La respuesta contradice lo preparado. `CashCloseout.tsx`, función `choose`, reutiliza el importe previo. | Al elegir explícitamente completo, usar el saldo pendiente vigente y eliminar cualquier división anterior, o devolver a la edición del cobro para confirmarlo. Añadir regresión de parcial → pendiente → completo. |
| A02 · Crítica para altura compacta | En **844 × 390**, tras estabilizar el viewport, el diálogo mide 326 px y el cuerpo sólo **12 px** en ambos motores. Encabezado, explicación, cinco indicadores y pie consumen el espacio. | Variante por altura disponible: explicación plegable, progreso compacto «Paso 5 de 5», pie más breve y un solo scroll útil. No ocultar acciones ni introducir scrolls anidados. Repetir con teclado visible y error de red. |
| A03 · Alta | Un importe superior al saldo pasa Cobros y Excepciones; se bloquea recién al salir de Otros movimientos. **0 campos con `aria-invalid`**; el foco queda en Continuar en Chrome y en BODY en WebKit, sin llevar al problema. | Validar importe y método al abandonar Cobros; error junto al campo, `aria-invalid`/`aria-describedby`, foco en el primero inválido y saldo restante visible. Mantener la validación de servidor. |
| A04 · Alta para jornadas largas | Al aceptar la recarga se pierden selección, fecha y extras. «Recargar y reiniciar revisión» también elimina todo el borrador sin una confirmación adicional. La solicitud ya enviada sí se conserva. | Separar refrescar datos de descartar; reconciliar el borrador sin reenviarlo, señalar conflictos y pedir descarte explícito. Borrador temporal por usuario, negocio y sesión, con caducidad y limpieza al salir de la cuenta. Nunca reejecutarlo automáticamente. |
| A05 · Alta, capacidad faltante | El intento de descuento deja deuda. Reducir el cobro no modifica el valor del servicio. | Operación explícita «Aplicar descuento», con motivo, permiso, límite sobre el saldo, vista previa, confirmación e historial inmutable. Requiere diseño de contrato financiero; no resolverlo alterando el precio histórico o simulando devolución/gasto. |
| A06 · Media | Jornada sólo con impagos o trabajos no realizados: se pueden responder las excepciones, pero no guardar la revisión sin otro movimiento/cierre. | Distinguir «Guardar revisión sin movimientos» de un cierre de caja. Confirmación explícita de metadatos, sin eventos monetarios ficticios. Si se mantiene la restricción, explicarla antes de completar cuatro pasos. |
| A07 · Media | «El trabajo no se realizó» conserva Agenda y cualquier deuda, correctamente, pero obliga a salir, resolverlo por otro lado y reconstruir el recorrido. | Acceso contextual a la reserva con borrador conservado, retorno al cierre y actualización de ese caso. No cancelar ni condonar mediante una excepción. |
| A08 · Media, equipos | Se muestra el profesional, pero faltan agrupación/filtro y selección explícita por profesional o método. Cada reserva sin selección requiere respuesta individual. | Agrupar por profesional con cantidades y subtotales; filtro sin perder las otras selecciones; acciones colectivas acotadas y visibles. La selección nunca debe equivaler a un cobro automático. |
| A09 · Media | La lectura del historial devuelve sólo las últimas diez revisiones y no ofrece paginación de las anteriores. | Paginación bajo demanda y búsqueda por fecha; no aumentar indefinidamente la carga inicial. |
| A10 · Baja / criterio de diseño | Cinco pasos fijos incluso sólo con dinero digital; explicaciones largas y repetidas. El éxito usa «Registro confirmado» sin un resumen específico del conjunto. | Recorrido contextual más corto, ayudas ampliables, resumen final «2 reservas, 1 gasto, caja cerrada, 1 saldo pendiente» basado en el resultado real. Sin celebraciones que sugieran conciliación bancaria. |

Las propuestas A05 y A06 requieren decisiones funcionales y pruebas del contrato; esta auditoría no las incorporó como nuevas escrituras de IAtry.

## Apple Design: experiencia, personalidad y movimiento

Aplicada como principios para una web React, conservando ATRY, Eurostile, Lucide y COLOR CLUB; no como una imitación de controles nativos ni una certificación Apple.

- **Conservar:** una confirmación monetaria final explícita; cifras exactas sin animación de conteo; nada seleccionado por defecto; separación de efectivo, transferencias y trabajo completado; recuperación honesta de apertura olvidada.
- **Jerarquía y espacio:** `layout.md › Visual hierarchy`, «Use progressive disclosure to make layouts cleaner and easier to interact with». A02 y A10 necesitan reducir lo fijo antes que achicar la tipografía.
- **Errores:** `entering-data.md › Best practices`, «Dynamically validate field values»; `writing.md › Best practices`, errores cerca del problema y con una salida concreta. Fundamentan A03.
- **Personalidad:** mantener «Vos confirmás» y evitar tecnicismos como cotización/revisión del libro en las preguntas del usuario. Propuesta de preguntas: «¿Qué cobraste?», «¿Quién quedó sin pagar?», «¿Hubo otros movimientos?», «¿Cuánto efectivo contaste?» y «¿Confirmamos este resumen?». Es criterio editorial, no texto impuesto por Apple.
- **Movimiento:** `motion.md › Providing feedback` recomienda brevedad y precisión. La implementación usa transición de paso de 160 ms y cambios de selección de 120–160 ms; el código desactiva el movimiento con `prefers-reduced-motion`. Conservar ese enfoque. Para errores, desplazar/focalizar el campo una sola vez, sin sacudidas ni esperas. Al recuperar conexión, mostrar el estado verificado, no una animación de éxito anticipada.

Renderizado: **60 mediciones** — cinco pasos × seis anchos (320, 375, 390, 430, 768, 1440) × dos motores. En altura 844 px: centrado horizontal con error menor a 1 px, cero overflow horizontal, pie dentro del diálogo y separación de 16 px. En la vista visible del usuario, 835 × 803: diálogo 720 × 739, error de centrado 0 px y separación de 16 px. Esos aprobados no ocultan el fallo de altura A02.

Original y doce paletas, claro/oscuro, ambos motores: los cinco roles de texto medidos sobre sus fondos renderizados alcanzan ≥4.5:1. No es una certificación de contraste de todos los elementos del producto. Se probó incremento de la fuente raíz; no equivale a validar zoom real al 200 %, Dynamic Type, teclado físico iPhone o VoiceOver.

Evidencia: [observaciones y geometría](evidence/2026-11-26/browser.json), [escenarios monetarios](evidence/2026-11-26/scenarios.txt).

## Reproducibilidad y límites

Resultados de esta auditoría: `npm test` **275/275**, `test:react`, `test:finance`, `test:finance-closeout`, escenarios adicionales, ambos recorridos de navegador y todas las paletas completados con salida 0. `git diff --check` sin incidencias. La primera ejecución de las regresiones generales quedó restringida por `listen EPERM`; se repitieron con permiso de localhost y pasaron. Los escenarios adicionales verifican los defectos observados, por lo que una salida 0 de esos scripts no significa que A01–A10 estén corregidos.

No se recompiló la aplicación en esta entrega porque no se cambió código de producto. La revisión renderizada utiliza el artefacto local existente. El PostgreSQL temporal se detuvo después de finalizar las pruebas; las vistas locales anteriores se conservaron.

```sh
npm run test:finance
npm run test:finance-closeout
node scripts/react/finance-closeout-audit-cases.cjs
NODE_PATH=/private/tmp/atry-ux-tools/node_modules node scripts/react/finance-closeout-browser.cjs
NODE_PATH=/private/tmp/atry-ux-tools/node_modules node scripts/react/finance-closeout-audit-browser.cjs
NODE_PATH=/private/tmp/atry-ux-tools/node_modules node scripts/react/finance-closeout-themes.cjs
NODE_PATH=/private/tmp/atry-finance-pg-audit/node_modules node scripts/react/finance-closeout-concurrency.cjs
```

Las rutas temporales identifican las herramientas de esta máquina, no dependencias añadidas al producto. Playwright necesita permiso para abrir localhost y lanzar navegadores. El reproductor concurrente necesita el clúster local aislado descrito arriba y `pg` como herramienta externa. No acepta un proyecto remoto.

No se ensayaron producción, pasarelas, confirmaciones bancarias reales, proxies de Supabase/PostgREST, caídas físicas del servidor/disco, rendimiento a escala productiva, dispositivo iPhone físico o usuarios reales sin experiencia. El ensayo de desconexión y rollback no demuestra durabilidad frente a una falla física. La política de retención y rectificación de cierres sigue pendiente de definición. Ningún nivel de confianza de IAtry autoriza operaciones sin confirmación.
