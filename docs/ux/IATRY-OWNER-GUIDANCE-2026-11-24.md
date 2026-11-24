# IAtry: orientación y recorridos de dueño — 24/11/2026

## Alcance

Implementación local autorizada a partir del recorrido de dueño en PC/móvil. Sin capturas, push, despliegues, cambios de Supabase, políticas, precios ni nuevas herramientas operativas.

## Cambios

- Capa determinista de información del producto: correos y estados de entrega, señas estimadas, ingresos frente a cobros, cierres, agenda por fecha, turnos fijos, lista de espera, WhatsApp manual, identidad, equipo/accesos, servicios y pausas, cuenta/seguridad, exportaciones y perfil regional.
- Respuestas breves con pasos, destinos reales y preguntas relacionadas. Las funciones y enlaces respetan rol/plan. Las consultas informativas no preparan escrituras. Las consultas de datos existentes, como servicios, conservan sus herramientas autorizadas.
- «¿Quién no vino?» es una consulta y no una propuesta de marcar ausencia. Puede abrir Agenda con «No asistió» y el período solicitado. «Buscame a Camila» usa la búsqueda de clientes, conservando el alcance de sesión y negocio.
- Preguntas de contacto distinguen cuenta personal, negocio y ficha de cliente; si falta el contexto, preguntan cuál.
- Orientación móvil: los enlaces cierran el panel y navegan por el guard existente. Una salida se confirma una sola vez; cancelar conserva el borrador. Un destino de la pantalla actual también cierra IAtry correctamente. Las preferencias de agenda se aplican tras autorizar la navegación.
- Si una operación de IAtry no está habilitada, puede ofrecer un acceso manual a su área cuando la navegación del usuario lo permite. Las 17 herramientas homologadas y sus confirmaciones no se amplían.
- Inicio e historial de clientes abren el detalle del turno consultando nuevamente el contrato existente. No se presenta la fila resumida como una reserva completa y actualizada. Se impiden duplicados y no se reemplaza otro formulario abierto durante la consulta.
- Desde un turno se accede a los avisos del correo del cliente. La actividad permite buscar y ver más registros del lote de hasta 100 avisos existente. Un correo puede corresponder a varias reservas; no se atribuye una entrega a un turno sin evidencia. No se incorporan datos personales a la URL ni se conserva este contexto entre usuarios/negocios.
- Foco de IAtry: en escritorio se prioriza el campo de texto antes de recurrir a botones de la cabecera; en móvil se mantiene el cierre como foco inicial, sin abrir el teclado automáticamente.
- Encabezado móvil: etiquetas compactas hasta 600 px y áreas táctiles mínimas de 44 px, para evitar solapamientos con el menú.

## Verificación

```sh
npm run build
npm run test:react
NODE_PATH=/private/tmp/atry-ux-tools/node_modules node scripts/react/iatry-owner-guidance-browser.cjs
NODE_PATH=/private/tmp/atry-ux-tools/node_modules node scripts/react/first-use-browser.cjs
```

La ruta de Playwright corresponde a la instalación local disponible, no a una dependencia nueva del producto.

- 89 comprobaciones enfocadas: preguntas frente a órdenes, búsquedas acotadas, UY/PA y cambio de día, períodos de ausencia, destinos según rol/plan, lectura fresca de turnos y referencia que ya no existe.
- Suite React: regresión de lenguaje panameño/uruguayo, contratos, permisos, estados, 17 herramientas y confirmaciones existentes.
- Chrome y WebKit: 320, 375, 390, 430, 768 y 1440 px; detalles desde Inicio/historial, cancelación de salida sin perder borradores, navegación con una sola confirmación, foco en actividad de mensajes, consultas sin escrituras, búsqueda real de clientes y convivencia UY/PA.
- Regresión del primer uso: creación y reprogramación leídas de vuelta en PostgreSQL desechable, profesional móvil, compartir y dictado simulado.

## Límites explícitos

El conocimiento describe las funciones del código, no inventa resultados del negocio. No se incorpora contabilidad, cobro online, consulta de ingresos diarios ni un catálogo nuevo de precios. No se homologa correo/WhatsApp externo, audio real ni iPhone físico. La revisión usa DOM e interacciones renderizadas sin capturas, conforme al pedido del usuario.
