# Correcciones UX F1–F7

Base: `origin/main` en `15bc349`. Rama local: `codex/ux-f1-f7`.
Alcance: correcciones del diagnóstico del 22/11/2026. Sin cambios en contratos, transporte, permisos, IAtry, reservas, precios almacenados o Supabase. Sin push, merge ni despliegue.

## Implementación

- **F1:** `public/Shared.tsx` comparte `ReceiptPrice` entre confirmación y gestión. `recordMoney` conserva el formato y la precisión existentes; ya no se añade UYU a USD. Se mantiene la etiqueta de los registros históricos uruguayos.
- **F2:** `ReservationSummary` identifica cuándo hay una identidad visual. La grilla no reserva una columna inexistente, permite ajustar nombres largos y conserva el logo original cuando está presente. El servicio también puede ajustar sus líneas.
- **F3:** el comprobante usa sus colores semánticos de texto secundario. Agenda utiliza `--panel-on-action` sobre el acento activo. Las etiquetas de estado de Apariencia tienen contraste legible; una regla general ya no anula los colores de la miniatura oscura. No se cambiaron importes ni estados.
- **F4:** Agenda, reserva manual y controles editables de Apariencia reutilizan `--text-input` y `--control-height`. En pantallas estrechas, las dos entradas de color se apilan únicamente cuando no cabe un HEX legible. Las miniaturas no se agrandaron.
- **F5:** «Cómo llegar», controles de vista, pestañas y muestras de color tienen áreas de interacción de al menos 44 px en los casos correspondientes. Se conserva el dibujo pequeño de las muestras; la fila de notificaciones ya tenía un área adecuada y no se alteró.
- **F6:** `ui/useMobileMenu.ts` reúne aislamiento del fondo, semántica modal, recorrido circular del foco, Escape, restauración y cambio de breakpoint. Se utiliza en el panel y en administración. El sidebar cerrado queda inactivo solo en móvil; escritorio conserva navegación normal. Se restauran los valores anteriores de `inert` y `aria-hidden`, sin quitar bloqueos de otros componentes. La navegación aprobada mantiene sus guardas existentes.
- **F7:** `settings/StudioTabs.tsx` conserva botones, iconos, textos y estado de selección. Detecta la continuidad horizontal con `ResizeObserver`, muestra una indicación lateral discreta y desplaza únicamente la fila para hacer visible la pestaña activa. Desconecta observadores/listeners al desmontar y respeta movimiento reducido.

## Regresiones reproducibles

```sh
npm run build
npm run test:react
node scripts/react/ux-corrections-test.cjs
NODE_PATH=/ruta/a/playwright/node_modules node scripts/react/ux-corrections-browser.cjs
ATRY_UX_BASE=http://127.0.0.1:3381 NODE_PATH=/ruta/a/playwright/node_modules node scripts/react/ux-controls-browser.cjs
```

El segundo script de navegador necesita servir el `frontend/react/dist` ya compilado en el origen local indicado. No reconstruir el artefacto mientras lo esté utilizando una prueba. Las rutas de Chrome siguen la convención de los scripts existentes; Playwright y WebKit deben estar instalados en la máquina de validación. No se añade una dependencia al producto.

Los scripts usan componentes reales con registros ficticios y bloquean solicitudes externas y métodos distintos de GET. Para administración se reutiliza el harness PostgreSQL desechable y adaptador existentes. No se guardan formularios ni se usan credenciales remotas.

`ux-corrections-test.cjs` está incorporado a `test:react` y cubre ambos consumidores de comprobante, UY/PA, valores históricos, falta de precisión USD y restricciones por estado. Las verificaciones visuales comprueban render, contraste, geometría, selección, foco, Escape, cierre al navegar y semántica móvil/escritorio. Los selectores de los controles excluyen los paneles ocultos.

## Límites

WebKit emulado no sustituye un iPhone físico, una PWA instalada o una prueba manual de VoiceOver. No se certifican teclado virtual físico, zoom nativo de Safari ni entrega real de correo, mapas o calendarios. Los destinos y contratos de dichas integraciones se conservan y se comprueban con datos ficticios; no se ejecutan acciones externas.

Las capturas y resultados de esta entrega están fuera del bundle, en `Entregas/Correcciones-UX-2026-11-22` del workspace. La evidencia del diagnóstico permanece intacta.

## Resultado local

- Compilación TypeScript/Vite aprobada.
- `test:react` completo aprobado: 32 pruebas base, más las suites de integración, IAtry y presentación incluidas por el runner.
- 26 comprobaciones específicas nuevas de comprobantes aprobadas.
- 120 contextos únicos de comprobantes UY/PA y Agenda en Chrome/WebKit, con seis anchos (320, 375, 390, 430, 768 y 1440 px).
- 36 contextos de controles, Apariencia y menús de negocio/administración aprobados. Altura mínima medida en campos de reserva manual: 44 px. Contraste mínimo de los estados de Apariencia revisados: 4,545:1. Estado seleccionado de Agenda: 5,71:1 claro y 6,00:1 oscuro.
- Regresión existente de reserva manual/WhatsApp aprobada en los doce pares navegador/ancho; sin guardados ni envíos, con comprobación de scroll y viewport de teclado simulado.
- Seis contextos adicionales con movimiento normal y transición móvil → escritorio → móvil aprobados.
- Se revisaron capturas reales claras/oscuras en móvil y escritorio. `git diff --check` aprobado. Backend, contratos de dominio, dependencias e IAtry sin diferencias respecto de la base.
- Los fallos iniciales del harness (selector de un panel oculto, espera de una navegación aún no renderizada y un timeout de carga) se separaron de los defectos de producto. La matriz WebKit detectó y permitió corregir la altura real de los selectores nativos y el recorrido de foco; los casos afectados se repitieron satisfactoriamente.
