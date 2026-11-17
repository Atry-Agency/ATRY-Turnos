# Normalización del Design System — candidato local

Fecha: 16/11/2026. Rama: `codex/design-system-normalization`.
Base publicada: `ba8f99109e29dbbcb8a6dd70dc04c1d7241217ae`.
Estado: implementación y comprobaciones locales; sin push ni despliegue.

## Resultado y alcance

Se normalizaron los propietarios de estilos compartidos, manteniendo la identidad, las fuentes originales, los temas y las variantes comerciales. No se cambiaron contratos, consultas, payloads, permisos, planes, moneda, lógica de reservas ni Supabase. No se añadieron dependencias. La landing y las ilustraciones de marca no se rediseñaron.

| Problema comprobado | Corrección y propietario |
| --- | --- |
| Escalas y geometrías repetidas en distintas hojas | `web/design-tokens.css` centraliza los nombres existentes y añade roles de tipografía, espaciado, controles y diálogo. `styles.css` lo importa. |
| Botones con reglas de tamaño superpuestas | `web/buttons.css` utiliza una sola geometría base; mantiene los colores semánticos aprobados, variantes e iconos. |
| Tamaños y jerarquías diferentes entre etiquetas, campos y encabezados | Tokens compartidos, `ui/fields.css`, `ui/layout.css`, `PageHeader` y `SectionHeading`; Servicios y Clientes reutilizan los encabezados. |
| Reglas de inputs que también afectaban al textarea por especificidad | Selector de baja especificidad con `:where`; textarea con mínimo propio, sin alterar controles de color, archivos, radio o checkbox. |
| Modales con geometría duplicada, encabezados desplazables y compensaciones negativas | `ui/dialog.css` es el propietario React; encabezado fijo, cuerpo desplazable, foco, viewport visible y safe areas. Se elimina `dialog-layout.css`. |
| Horas nativas AM/PM recortadas en un modal de 320 px | `scheduling/weekly-editor.css` usa el ancho real del cuerpo: apila los campos cuando no caben y reserva el área táctil de eliminación. |
| Editores WhatsApp que ya tenían scroll propio | Variante interna `scroll="content"` del modal: conserva un único desplazamiento y sus acciones. Las reglas legacy quedan delimitadas a modales no React. |
| Colores de avisos/confirmaciones y errores ajenos al tema | Superficies semánticas ligadas a los colores del tema, incluyendo confirmaciones y texto de error. |
| Encabezados, tablas y búsqueda administrativa con escalas propias inconsistentes | Tokens compartidos en `admin/premium.css`; se conserva la tipografía de datos y la densidad administrativa intencional. |
| Detalles de navegación y tarjetas con medidas dispersas | Tokens de espaciado y radios en `workspace-premium.css`, `theme-studio.css` y estilos base; variantes de marca conservadas. |

## Reglas para continuar

1. Fundaciones en `web/design-tokens.css`; no redefinir una escala en cada pantalla.
2. Componente compartido antes que selector específico de pantalla. No añadir otra hoja final para corregir especificidad.
3. `ThemeScope` sigue siendo la fuente de variantes por negocio: colores, radios, fuentes y densidad. No sustituirlos por constantes.
4. Controles estándar: 44 px de altura; compactos 40 px en escritorio y 44 px cuando corresponde a interacción táctil. Checkbox visual 20 px dentro de etiqueta táctil. Texto de input 16 px en móvil/coarse pointer para evitar zoom por tamaño pequeño.
5. Tipografía por función: etiquetas 13 px, cuerpo 14 px, ayuda 12–13 px, sección 16 px, tarjeta 20 px, diálogo 20–24 px y página 28–36 px. Los componentes editoriales y las visualizaciones de datos conservan sus excepciones justificadas.
6. Espaciado base 4/8/12/16/20/24/32/40/48/64; tarjeta y diálogo 24 px en escritorio y 16 px en móvil. No resolver encajes mediante márgenes negativos.
7. Modales: encabezado fuera del scroll; contenido largo dentro del cuerpo. Los editores con scroll propio deben declararlo, evitando dos áreas superpuestas.
8. No se eliminaron todos los valores literales ni todos los `!important` del repositorio: siguen existiendo variantes especializadas y protecciones de contraste. La migración fue deliberada, no un reemplazo mecánico que altere la identidad.

## Comprobaciones aprobadas

- Compilación de producción y verificación del artefacto local.
- `npm test`: 270/270 aprobadas.
- Suite React y `npm run test:iatry-consolidation`: aprobadas, incluidas las 67 regresiones focalizadas de permisos. Se conservan 17 herramientas (16 para Individual), bloqueo de referencias ambiguas/ajenas y confirmación visual obligatoria.
- Panel: 20 vistas × 6 anchos × 2 motores = 240 mediciones, sin desbordamiento horizontal.
- Administración: 10 secciones × 6 anchos × 2 motores = 120 comprobaciones, sin desbordamiento horizontal.
- Modales de servicio/estados: 12 contextos; foco, cierre, conservación de borrador, scroll, contenido largo, contraste claro/oscuro y propagación de altura por token.
- Clientes con nombre/nota largos, carga pendiente, error 503 y reintento: 8 contextos; no se presentan errores como listas vacías.
- Semana/profesional: 8 contextos; campos horarios y acciones accesibles, sin guardar.
- Reserva manual y configuración de WhatsApp: 12 contextos; scroll único, encabezado estable y viewport de teclado simulado. Sin guardar ni enviar.
- Regresiones existentes de formularios/payloads UY y PA, autenticación, notificaciones, configuración lateral y chat administrativo: aprobadas. Se comprobaron importes regionales, campos inválidos, foco/teclado y que «confirmo» no eluda la confirmación visual.
- `git diff --check`: aprobado.

Anchos: **320, 375, 390, 430, 768 y 1440 px**. Motores: Chrome instalado y WebKit de Playwright. Las pruebas de navegador bloquean tráfico externo y escrituras salvo los ensayos de payload interceptados del harness existente; no se escribieron datos remotos.

### Cobertura visual y límites

Capturas renderizadas y revisadas de Inicio, Agenda, Clientes, Servicios, Equipo, Horarios, Turnos fijos, Lista de espera, Estadísticas, Configuración general/Apariencia/Reservas/Publicación, Notificaciones, Accesos, Suscripción, Cuenta, Soporte y Configuración inicial. Administración: Inicio, Negocios, Usuarios, Comercial, Correos, Sistema, Soporte, Datos, Auditoría y Configuración.

Las hojas visuales comparan móvil, tablet y escritorio. Los seis anchos tienen comprobaciones geométricas en ambos motores; no se realizó una inspección humana píxel a píxel de cada combinación. Los temas claro/oscuro se comprobaron en formularios y estados; no se certifica cada combinación de tema, densidad y personalización posible.

**Comunicación:** la fixture PostgreSQL existente entrega un formato que `parseInfo` no admite; la matriz principal muestra y conserva el estado de error/reintento. El editor WhatsApp se verificó separadamente usando la demo local existente (datos ficticios), sin modificar ese contrato ni afirmar homologación del servicio real. No se cambió backend para resolver una auditoría visual.

**No comprobado en esta misión:** iPhone físico/PWA instalada, teclado y safe areas del sistema operativo real, VoiceOver, dispositivos Android físicos, sesiones o perfiles productivos, Auth/CAPTCHA/Storage remotos, conexiones reales Google/Apple ni envíos de WhatsApp/correo. WebKit y el viewport simulado no sustituyen esas homologaciones. IAtry tuvo regresiones funcionales y de seguridad; no se simularon éxitos del servidor.

## Evidencia y reproducción

Capturas reales, métricas y comparaciones en:
`Entregas/Design-System-2026-11-16/` del workspace principal.

- `before/` y `after/`: capturas originales, con datos de prueba.
- `comparacion-clientes-390.png`, `comparacion-modal-service-390.png`, `comparacion-configuracion-reservas-390.png`, `comparacion-admin-configuracion-390.png`: mismo ancho antes/después.
- `revision-panel-*`, `revision-secundarias-*`, `revision-admin-*`: hojas de revisión de capturas originales, sin imágenes generadas.
- `after/metrics.json`: 240 mediciones. La franja amarilla corresponde al harness local, no se incorpora al producto.

Scripts añadidos: `scripts/react/design-system-{browser,admin-browser,states-browser,data-browser,editors-browser}.cjs`. Usan Playwright ya disponible y el PostgreSQL desechable existente. `ATRY_DS_OUTPUT` selecciona la carpeta de evidencia. La fase anterior administrativa requiere `ATRY_DS_PHASE=before` y `ATRY_DS_BASELINE` apuntando al artefacto original; la fase por defecto es el candidato. No se debe reconstruir `frontend/react/dist` mientras el navegador esté usando ese artefacto.

Comandos principales:

```sh
npm run build
npm run test:react
npm run test:iatry-consolidation
npm test
node scripts/react/design-system-browser.cjs
node scripts/react/design-system-admin-browser.cjs
node scripts/react/design-system-states-browser.cjs
node scripts/react/design-system-data-browser.cjs
node scripts/react/design-system-editors-browser.cjs
node scripts/react/release-check.cjs
```

Vista previa conservada en `http://127.0.0.1:3360/?demo=1&plan=2#/app/inicio`. No se creó una nueva ventana de sesión ni se modificó la producción. Antes de publicar se requiere la aprobación del usuario. Base de recuperación del frontend: `ba8f991`; no hay migraciones que revertir.

## Archivos de implementación

- Fundaciones/base: `web/design-tokens.css`, `styles.css`, `appearance.css`, `buttons.css`, `product.css`, `typography.css`, `theme-studio.css`, `workspace.css`, `whatsapp.css`.
- React compartido: `src/main.tsx`, `ui/primitives.tsx`, `ui/layout.tsx`, `ui/dialog.css`, `ui/fields.css`, `ui/layout.css`, `ui/refinements.css`; se retira `ui/dialog-layout.css`.
- Consumidores: `services/ServicesScreen.tsx`, `customers/CustomersScreen.tsx`, `scheduling/WeeklyEditor.tsx`, `scheduling/weekly-editor.css`, `communications/WhatsAppSettings.tsx`, `communications/WhatsAppComposer.tsx`, `admin/premium.css`, `app/workspace-premium.css`.
- QA: cinco scripts DS y ajuste del selector de una prueba existente en `admin-settings-auth-browser.cjs` para usar el CTA de autenticación actualmente publicado.

## Referencias de diseño

Se aplicaron principios, sin incorporar otra biblioteca visual:

- Apple: [Design tips](https://developer.apple.com/design/tips/), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) y [Typography](https://developer.apple.com/design/human-interface-guidelines/typography): legibilidad, alineación, adaptación y objetivos táctiles.
- Carbon: [Spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview): escala y roles de espaciado.
- Material Web: [Theming](https://github.com/material-components/material-web/blob/main/docs/theming/README.md): separación de tokens y propiedades de componentes. No se adoptó Material como estética de ATRY.
