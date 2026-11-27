# Cierre inteligente de IAtry — implementación local

Conserva el módulo financiero y sus ayudas anteriores. Rama `codex/finance-cash-local`. Sin publicación, migraciones remotas, pasarelas ni modelos pagos.

## Probar sin reemplazar datos anteriores

```sh
npm run build
npm run preview:finance-closeout
```

Vista nueva: `http://127.0.0.1:3387/#/app/finanzas/closeout`. Instancia efímera aislada con reservas ficticias UY/PA para el día siguiente; elegir su fecha en el primer paso. Los ensayos anteriores siguen disponibles en sus puertos: no se los detiene ni se reconstruyen sus movimientos como si fueran datos migrados. Esta instancia se reinicia al detener su servidor.

También se abre desde Caja o Más acciones → Cierre inteligente de IAtry. IAtry ofrece una explicación contextual y un enlace al recorrido. Ese enlace no prepara ni registra operaciones.

## Recorrido y consecuencias

1. **Cobros.** Ninguna reserva viene marcada como pagada. La selección colectiva requiere una acción explícita y usa únicamente el saldo disponible, descontando pagos previos. Se revisan cliente, servicio, profesional, fecha, importe y método. Se admiten pagos parciales y dos métodos para una reserva, con suma validada y métodos distintos. Las reservas ya cobradas, canceladas o con ausencia quedan fuera de los cobros nuevos.
2. **Excepciones.** Cada reserva disponible sin pago seleccionado necesita una decisión: no se recibió pago, trabajo no realizado o fuera de la revisión. Se conserva esa declaración con su contexto; no cambia el estado de Agenda, no elimina cargos ni inventa pagos. Cancelaciones y devoluciones de operaciones anteriores se resuelven en sus controles existentes y después se recarga el recorrido.
3. **Otros movimientos.** Trabajos espontáneos y ventas se anotan como ingresos independientes, sin crear reservas ficticias. Los gastos corresponden a dinero ya pagado. Cada movimiento exige concepto, importe y método. No se simulan cobros bancarios ni se calcula comisión por un trabajo espontáneo.
4. **Efectivo.** Se revisa una caja a la vez. Sus métodos de efectivo deben corresponder a esa caja; los medios digitales quedan separados. Si faltó abrirla, la persona declara el efectivo que había antes de los movimientos y un motivo. La apertura se registra ahora, identificada como recuperada: no se deduce el inicial del saldo final ni se inventa una hora pasada. El cierre es explícito y opcional; el efectivo contado nunca se rellena automáticamente. Falta/sobra/coincide se calcula con unidades menores exactas.
5. **Revisión.** Se detallan importes, neto por método, cada pago, excepciones, apertura recuperada y qué caja se cerrará o quedará abierta. Es necesario marcar la autorización y pulsar Confirmar y registrar todo. Avanzar, seleccionar, escribir o cambiar de paso no registra movimientos.

## Integridad y consumo

Una lectura cotizada por fecha, paginada a 80 reservas, utiliza el adaptador y la autorización existentes. La primera página reutiliza el resumen financiero para tener métodos y sesiones consistentes; no hay consultas por checkbox ni por tecla. No se permite avanzar con páginas pendientes de cargar.

Un POST a `/finance/command`, operación `closeout`, agrupa las operaciones en una transacción PostgreSQL. Reutiliza las funciones financieras originales para apertura, cobros, ingresos, gastos y cierre. Comprueba sesión, membresía, plan, permisos, moneda, revisión del libro, estado/saldo de cada reserva, cuenta de efectivo y revisión de sesión. Las reservas se protegen antes del bloqueo financiero, en el orden de Agenda. Los ingresos del conjunto se procesan antes de sus gastos; los registros se fechan ahora, sin reconstruir un orden histórico que no se conoce.

Claves estables de idempotencia para el conjunto y sus movimientos. Repetir el mismo conjunto devuelve su resultado; cambiar el contenido con la misma clave se rechaza. Un nuevo conjunto tampoco puede reutilizar una clave interna enviada previamente fuera de él. Un error al final revierte incluso la apertura y los movimientos anteriores de esa transacción. Una respuesta perdida se verifica por la clave original y vuelve a Caja sin duplicar el cierre.

`finance_closeouts` conserva resultados y excepciones, con RLS, sin acceso directo desde el cliente y con inmutabilidad. Caja muestra las diez últimas revisiones. Las tablas y los registros actuales permanecen; no se cambia el contrato de reservas ni sus estados, precios de planes o comisiones. No se agregan herramientas de escritura a IAtry.

Límites explícitos: hasta 200 reservas con pago, 40 ingresos/gastos, 500 excepciones y un cuerpo de solicitud acotado para el transporte existente. Las revisiones mayores deben dividirse; no se recortan ni guardan parcialmente. El cliente admite dos métodos por reserva; la validación del contrato admite hasta tres partes distintas. Un cierre cuenta una caja; otras cajas se revisan por separado.

## Diseño y accesibilidad

Apple Design: `layout.md › Visual hierarchy` — «Order content by relative importance»; `onboarding.md › Best practices` — «Teach through interactivity»; `motion.md › Best practices` — movimiento al servicio de la tarea.

El diálogo tiene ancho máximo de 720 px, margen exterior en escritorio, indicadores centrados y el mismo eje para contenido y acciones. Su altura permanece estable entre pasos. La zona central se desplaza; el pie no tapa filas. En móvil se adapta al espacio visible y conserva controles táctiles. Las selecciones cambian suavemente superficie/borde, los pasos reutilizan la transición compartida y reduced-motion elimina el movimiento. Los importes se actualizan inmediatamente sin animar cifras ni retrasar entradas.

## Pruebas y límites

```sh
npm run test:finance
npm run test:finance-closeout
npm test
npm run test:react
NODE_PATH=<playwright>/node_modules node scripts/react/finance-closeout-browser.cjs
NODE_PATH=<playwright>/node_modules node scripts/react/finance-closeout-themes.cjs
```

SQL: pagos previos, pagos divididos, excepciones, trabajos espontáneos, gastos, recuperación declarada, diferencia, reversión transaccional ante fallo tardío, idempotencia, colisión de claves internas, historial inmutable y denegación entre negocios/roles.

Navegador Chrome/WebKit: selección colectiva y excepción, pago dividido y parcial, ingreso espontáneo y gasto, conteo, confirmación explícita única, pérdida de respuesta sin duplicación, cero solicitudes al seleccionar/escribir/avanzar. Geometría a 320–1440 px. Original y doce paletas en claro/oscuro: texto seleccionado ≥4.5:1, centrado horizontal/vertical y pie sin superposición. Verificación DOM/AX/estilos renderizados, sin capturas.

No se afirma cobertura de todos los casos imaginables: quedan la validación de concurrencia con conexiones independientes a PostgreSQL de servidor, PostgREST real y volumen representativo antes de producción, además de la política de retención/rectificación de cierres de la fase anterior. No se ejecutan migraciones remotas para resolver esas validaciones.

Referencia técnica contrastada: [Supabase Database Functions](https://supabase.com/docs/guides/database/functions). Los tests locales no sustituyen un ensayo remoto autorizado.
