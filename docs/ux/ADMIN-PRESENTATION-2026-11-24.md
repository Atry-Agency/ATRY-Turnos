# Administración: presentación y acceso a tareas — 24 de noviembre de 2026

Entrega local. Se conserva la identidad ATRY, las diez secciones y todos los formularios, confirmaciones y contratos administrativos. No se publican cambios ni se ejecutan operaciones productivas. Las correcciones locales de reservas anteriores siguen separadas en sus propietarios.

## Criterio y alcance

El administrador necesita identificar pendientes, encontrar un negocio y abrir la operación correcta. Se mantiene la navegación existente y se mejora cómo se presentan los mismos datos.

Referencias leídas de `apple-design`:
- `layout.md`, Best practices: “Group related items to clearly express related information or functions.” Aplicación: precio y unidad juntos; límites agrupados; capacidades separadas de la edición.
- `lists-and-tables.md`, Best practices: “Keep item text succinct so row content is comfortable to read.” Aplicación: en móvil, los registros conservan etiquetas y valores con separaciones y ritmo consistentes; los planes dejan de depender de una tabla de seis columnas.
- `buttons.md`, Best practices: “Make buttons easy for people to use.” Aplicación web: controles de acceso directo con mínimo de 44 CSS px, foco visible y estados hover/press. No se equiparan píxeles web con puntos nativos.
- `accessibility.md`, Best practices: “Support larger text sizes.” Aplicación: comprobación del contenido ampliado al 200 %, sin alturas fijas que recorten información.

Se consultaron además tipografía, color, diseño para iOS, búsqueda y traducción de principios a otras plataformas. Las decisiones de composición son criterio de diseño adaptado a ATRY, no una certificación Apple. Se reutilizan las familias y tokens existentes; los colores administrativos locales mantienen fondo, superficie, tinta, texto secundario, línea y acento violeta.

## Cambios

- `PlanCards`: vista de los mismos registros administrativos. Nombre, importe mensual con unidad UYU, profesionales y correos del ciclo, las tres capacidades independientes y la misma acción `plan` con el registro original. Estado vacío explícito.
- Listas compartidas: contenedor de valor por celda, etiquetas y valores alineados en móvil, separadores suaves. Se preservan tablas semánticas y el énfasis de enlaces existente.
- Búsqueda global: icono familiar, entrada flexible y etiqueta accesible. Mismo destino y parámetros.
- Accesos contextuales: pendientes, vencimientos, pagos por verificar, fallos de correo e incidencias; en la ficha del negocio, correos e historial filtrados. Son enlaces a consultas existentes, sin ejecución de acciones.
- IAtry: cabecera más compacta, mismo emblema y apertura. Sin cambios conversacionales, capacidades ni confirmaciones.
- Capacidad comercial: formulario en dos columnas cuando cabe y una en móvil, motivo y acción de guardado con espacio propio. Mismos nombres, valores y validaciones.

## Verificación

- Compilación Vite/TypeScript y suite React.
- `admin-premium-browser.cjs`: Chrome/WebKit, 320, 375, 390, 430, 768 y 1440px; diez secciones, límites interiores, enlaces de 44px, filtro rápido, formulario de edición original, nombres largos, drawer, teclado y saludo de IAtry. Se bloquea cualquier escritura o solicitud externa.
- WebKit utiliza Option+Tab para recorrer botones, conforme a su preferencia de teclado; Chrome usa Tab.
- `admin-premium-states.cjs`: Chrome/WebKit a 390 y 1440px; carga, error y reintento reales del harness; preferencia de navegador oscura conservando la identidad administrativa clara; contraste calculado del DOM; texto al 200 %; ficha y diálogo de suscripción; acciones desplegables de usuarios.
- Contraste de texto secundario nuevo sobre blanco: 5,73:1. Acento de enlaces sobre blanco: 7,01:1. Texto principal: 15,30:1. Las capacidades también expresan Sí/No; no dependen del color.

Sin capturas, por indicación del usuario. Las comprobaciones de geometría, estados y navegación no sustituyen una revisión perceptual con imágenes, VoiceOver real ni un iPhone físico. No se afirma ausencia absoluta de errores ni homologación de accesibilidad de toda la aplicación.
