# Finanzas y Caja — primera fase local

Rama de trabajo: `codex/finance-cash-local`. No aplicar esta migración a una instancia alojada como parte de la revisión local.

## Probar

```sh
npm run build
npm run preview:finance
```

Abrir `http://127.0.0.1:3385/#/app/finanzas`. El servidor usa el adaptador cloud existente con PostgreSQL efímero (PGlite), sin Supabase alojado, credenciales externas, correos ni pasarelas. Todo desaparece al detenerlo. Hay tres reservas ficticias futuras por negocio en Uruguay y Panamá. Se puede cambiar el negocio desde Espacio activo.

La activación de Finanzas es explícita. Empezar, abrir Caja principal con un fondo contado, registrar un cobro parcial, consultar Pendientes y registrar el resto por otro medio. Desde Caja se revisa el efectivo esperado, se ingresa el contado y se confirma el cierre. Una diferencia exige motivo. Un turno también permite abrir directamente su cobro desde el detalle de Agenda.

Cada formulario pasa por edición y revisión antes de confirmar. Ninguna selección registra dinero. Si la respuesta es incierta, se conserva la solicitud original por usuario y negocio en sessionStorage; verificar antes de reintentar. El reintento usa la misma clave y el mismo contenido. No hay reenvíos automáticos al cargar una pantalla.

## Alcance implementado

- Resumen por período del negocio: cobros, otros ingresos, gastos, devoluciones y flujo neto. El valor de servicios completados se muestra separado.
- Cobros parciales o totales vinculados a reservas; saldo pendiente independiente del estado del turno. Distintos cobros permiten combinar efectivo y transferencia.
- Ingresos y gastos manuales independientes, métodos de pago asociados a cuentas.
- Apertura, efectivo esperado, arqueo y cierre con diferencias explicadas; historial de cierres inmutable.
- Devoluciones con opción explícita de reducir el cargo o reabrir el saldo; corrección de registros manteniendo el original. No se corrige una sesión de efectivo cerrada.
- Activación sin inventar cobros ni deudas históricas. Completar un turno después de activar crea un cargo, nunca un pago.
- Historial con cursor de 50 movimientos; hasta 80 pendientes visibles y 30 sesiones recientes. El total pendiente incluye todos los cargos. La búsqueda del formulario filtra las reservas cargadas (90 días anteriores / 31 siguientes, hasta 80); una reserva fuera de esa ventana se abre desde Agenda.

## Arquitectura e integridad

`FeatureHost → FinanceScreen → useLoader/scopedApi → cloud/api-adapter → atry_finance_read/command`.

Las funciones privadas con search_path vacío autorizan cada operación usando la sesión vigente y la membresía del negocio. Las tablas tienen RLS y no conceden acceso directo al cliente. El propietario tiene permisos financieros; un manager requiere concesiones explícitas por operación. La interfaz de esta fase se ofrece al propietario; todavía no incluye un editor de concesiones para managers.

Importes en unidades menores bigint y cadenas JSON, sin aritmética flotante para saldos. Moneda y zona provienen del negocio; no se mezclan UYU y USD. No hay fechas retroactivas. Los movimientos y asignaciones son inmutables; sus proyecciones de saldo se mantienen mediante triggers dentro de la misma transacción. Las proyecciones evitan sumar el historial completo para cada cuenta o saldo global.

Una fila financiera por negocio serializa escrituras cortas, con clave idempotente, huella del contenido y actor. Para cobros se toma primero una protección de la reserva y luego el bloqueo financiero, en el mismo orden que la finalización desde Agenda, para evitar un ciclo entre claves foráneas y el libro financiero. Una restricción única impide dos cajas abiertas sobre la misma cuenta. La revisión de sesión evita cerrar con un arqueo obsoleto. Todos los cambios se auditan. La apertura ajusta el efectivo retenido sin duplicarlo ni contabilizarlo como ingreso. Las diferencias de cierre tampoco son ventas ni gastos.

Los precios actuales de planes permanecen iguales. Individual/Negocio tienen el circuito base y una caja; Pro/Prueba admiten hasta diez cajas. No se anuncian capacidades financieras avanzadas aún no implementadas. El acceso vencido permite consultar y cerrar una sesión existente, pero no nuevos movimientos. El servidor vuelve a comprobar estas restricciones.

## Diseño

Apple Design se aplica como criterio de jerarquía, claridad, control y recuperación, sin copiar controles nativos. Un resultado financiero principal, datos secundarios comparables y explicaciones junto a conceptos que podrían confundirse. Se reutilizan botones, campos, diálogos, skeletons, confirmaciones y Lucide existentes. Los importes usan cifras tabulares; no se animan los saldos. Las tarjetas usan los tokens de su superficie, distintos de los del fondo COLOR CLUB. El movimiento reutiliza la política global de reduced-motion. La interfaz móvil evita tablas anchas y mantiene objetivos táctiles de 44 px o más.

## Validación reproducible

```sh
npm run test:finance
npm test
npm run test:react
NODE_PATH=<instalación-local-de-playwright>/node_modules node scripts/react/finance-browser.cjs
```

Las pruebas SQL ejercitan las RPC reales, sin mocks monetarios: pagos parciales/mixtos, límites, devoluciones, cierres obsoletos, insuficiencia de efectivo, diferencias, inmutabilidad, reconciliación de proyecciones, aislamiento entre negocios, permisos manager/staff, sesiones vencidas, precios y moneda USD. Las pruebas de navegador recorren el circuito completo en Chrome/WebKit, incluida la pérdida de una respuesta ya confirmada sin duplicar el cobro. Se inspeccionan DOM, geometría y contraste renderizados; no se toman capturas.

## Siguientes fases y límites antes de producción

Comisiones y liquidaciones por profesional, exportaciones y estadísticas avanzadas, integración de datos financieros de Clientes/Equipo/Estadísticas e IAtry, editor de permisos y administración completa de métodos son trabajo posterior. IAtry incorpora orientación financiera contextual y accesos manuales por rol y capacidad. No consulta saldos desde el chat ni agrega herramientas o permisos de escritura.

Falta validar concurrencia con conexiones independientes a PostgreSQL de servidor y el transporte PostgREST real en un entorno de ensayo autorizado; PGlite ejecuta las consultas localmente y no reemplaza esa validación. Revisar planes de ejecución con volumen representativo antes de producción.

La retención financiera necesita una política explícita de archivo y borrado: las claves foráneas y los registros inmutables impiden eliminar entidades que tengan historial financiero. No se habilita borrado financiero ni se altera un cierre pasado. Las rectificaciones de cierres ya confirmados y las modificaciones de cargos por cancelación requieren una fase específica; no se altera automáticamente una deuda porque se cancele una reserva.

No se ejecutaron migraciones remotas ni se modificó producción. Esta fase está preparada para revisión funcional local, no para despliegue automático.

## Resultado de esta revisión local — 26/11/2026

- Compilación TypeScript/Vite correcta.
- 275 pruebas generales aprobadas; suite React existente aprobada.
- Pruebas específicas del modelo y las RPC financieras aprobadas.
- Chrome y WebKit: circuito de pagos UYU/USD, cobro parcial y saldo restante, dos medios, gasto, arqueo/cierre y recuperación de operación confirmada cuya respuesta se perdió (red interrumpida y HTTP 503), sin duplicados.
- Cinco pestañas a 320, 375, 390, 430, 768, 1060 y 1440 px sin desbordamiento de página; controles verificados de al menos 44 px. Formulario a 320 px y navegación por Escape.
- ATRY Original y doce paletas COLOR CLUB, claro/oscuro, en móvil y escritorio: contraste renderizado de los textos del resumen ≥4.5:1.
- Flujo neto negativo con signo explícito y barra por debajo de la línea cero.

Los resultados anteriores no sustituyen las validaciones de concurrencia, retención y transporte remoto enumeradas como pendientes. El servidor entregado sigue usando únicamente datos ficticios efímeros.

## Experiencia para principiantes — segunda revisión local

Apple Design, `onboarding.md › Best practices`: «Consider providing a collection of context-specific tips instead of a single onboarding flow». Se aplican ayudas plegables junto a la tarea y un recorrido de conteo → revisión → confirmación, sin tutorial obligatorio ni datos financieros precargados.

- Abrir caja dentro del cobro conserva reserva, importe y nota; una respuesta de apertura perdida puede verificarse sin cerrar el formulario ni duplicar la operación. La apertura y el cobro mantienen confirmaciones independientes.
- Cierre con explicación opcional, efectivo inicial y movimiento neto, diferencia humana en vivo (falta/sobra/coincide), motivo cuando corresponde y confirmación explícita. El conteo no se completa automáticamente.
- Devolución y anulación identifican el movimiento original y sus consecuencias. Devolver requiere elegir si se reduce el cargo o vuelve a quedar pendiente; no se asume una opción.
- Métodos nuevos requieren elegir dónde queda el dinero. Se separa la etiqueta accesible de la explicación y se conserva la selección explícita en la revisión.
- Más acciones usa el menú compartido sin mover el contenido; variante de tema del negocio y objetivos de 44 px. Período plegable sólo en Resumen/Movimientos; Caja/Pendientes indican su alcance.
- Confirmación de cobro con saldo actualizado sólo tras una relectura nueva, estado totalmente cobrado, resaltado breve de movimientos/cierres y foco accesible. Reduced-motion elimina los efectos; no se animan importes.
- IAtry explica caja, pagos parciales, devoluciones, diferencias, métodos y servicios completados. Sus enlaces sólo seleccionan pantallas y respetan rol/capacidad; no preparan ni ejecutan nuevas operaciones.
- Inicio denomina el indicador de servicios completados como valor de servicios, separado de cobros reales.

Prueba adicional: `node scripts/react/finance-guidance-test.cjs` y `NODE_PATH=<playwright>/node_modules node scripts/react/finance-novice-browser.cjs`. El recorrido simula desconocimiento financiero en Chrome/WebKit, móvil y escritorio, incluidas apertura con respuesta perdida y borrador conservado, cobro parcial/total, devolución con decisión explícita, diferencia y cierre, configuración y navegación contextual de IAtry.
