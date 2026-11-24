# ATRY Turnos — reglas de desarrollo y calidad

## Propósito y alcance

ATRY Turnos es un producto web React de gestión de negocios y reservas para Uruguay y Panamá. Adoptar la precisión, claridad y atención al detalle de Apple sin copiar iOS, cambiar la identidad ATRY ni imponer convenciones nativas a una web.

Estas reglas aplican al panel de negocios, administración, autenticación, reservas públicas, IAtry y landing. Las instrucciones explícitas del usuario prevalecen; una mejora visual no autoriza cambios funcionales, escrituras reales ni publicación.

Antes de trabajar:
- Confirmar repositorio, rama, estado y base publicada. La carpeta contenedora incluye otros repositorios y copias históricas: no modificarlos ni usarlos como fuente vigente por semejanza de nombre.
- Revisar el flujo completo, componentes, contratos y propietarios de CSS antes de proponer cambios. Una coincidencia de búsqueda es una pista, no un defecto demostrado.
- Conservar trabajo ajeno. No resetear, formatear masivamente ni mezclar mejoras fuera del alcance.

## Skills y criterio de aplicación

Leer las Skills disponibles antes de aplicarlas:
- `frontend-design`: decisiones visuales intencionales y coherentes con ATRY; no habilita otro rediseño si la estética está aprobada.
- `apple-design`: jerarquía, legibilidad, adaptación, feedback y accesibilidad. Leer las referencias pertinentes antes de citar HIG; distinguir una regla documentada de un juicio de diseño. Traducir principios a HTML/CSS/React, sin equiparar puntos nativos con píxeles CSS.
- `web-design-guidelines`: revisar HTML, foco, formularios e interacción con las directrices oficiales vigentes. No copiar mecánicamente recomendaciones que contradigan el producto, el español o los flujos aprobados.
- `vercel-react-best-practices`: rendimiento y organización React según evidencia. El proyecto usa Vite, no Next.js: no añadir RSC, `next/dynamic`, otro router ni bibliotecas de fetching para cumplir una receta.

Las Skills orientan; no sustituyen la identidad, los contratos ni las decisiones aprobadas. Si no están disponibles, informar la limitación sin afirmar que se utilizaron.

## Arquitectura existente: reutilizar antes de crear

Mapa de propietarios de la revisión vigente. Los prefijos `app/`, `ui/`, `domain/`, `infrastructure/`, `admin/`, `iatry/`, `marketing/`, `public/` y `scheduling/` de esta tabla corresponden a `frontend/react/src/`:

| Área | Propietario / punto de entrada |
| --- | --- |
| Arranque y CSS global | `frontend/react/src/main.tsx` |
| Estado, sesión y negocio activo | `frontend/react/src/app/model.ts`, `port.ts`, `NativeApp.tsx` |
| Navegación y composición de módulos | `app/Shell.tsx`, `app/FeatureHost.tsx`, `app/routes.ts`, `app/navigation.ts` |
| Adaptadores, alcance y recursos | `infrastructure/`, especialmente `scoped-api.ts` y `useResource.ts`; adaptador existente en `cloud/` |
| Primitivas y estados compartidos | `ui/primitives.tsx`, `ui/layout.tsx`, `ui/PanelSkeleton.tsx`, `ui/Icon.tsx` |
| Tokens visuales base | `web/design-tokens.css`, importado por `web/styles.css` |
| Tema por negocio | `app/ThemeScope.tsx`, `domain/theme.ts`, `web/theme-studio.css` |
| Geometría compartida | `web/buttons.css`, `ui/fields.css`, `ui/dialog.css`, `ui/layout.css` |
| Variantes de módulo | Hoja del módulo: por ejemplo `scheduling/weekly-editor.css`; administración en `admin/premium.css` |
| IAtry y política operativa | `iatry/`, especialmente `iatry/v3/production-policy.ts` |
| Landing y rutas públicas | `marketing/`, `public/` |

No crear un segundo backend, un cliente paralelo ni otra fuente de reglas comerciales. No editar `dist/` o artefactos generados como solución: corregir la fuente y reconstruir cuando corresponda.

## Identidad, composición y sistema de diseño

- Conservar logos originales, proporciones, Eurostile/Extended, colores oficiales, temas, curva de marca y emblema de IAtry. No redibujar marcas ni reemplazar activos reales por imágenes inventadas.
- Una pantalla tiene una tarea clara y una acción principal dominante por contexto. Ordenar la información y revelar detalles secundarios progresivamente sin eliminarlos.
- Usar superficies, ritmo, tipografía y alineación para jerarquizar; no sumar tarjetas anidadas, bordes, brillos o degradados para aparentar calidad. Mantener los tratamientos de marca ya aprobados.
- Reutilizar `Button`, campos, `PageHeader`, `SectionHeading`, `Modal`, estados y tarjetas existentes. Extender una variante semántica antes de duplicar el componente.
- Usar tokens por función para color, espaciado, tipografía, radios, sombras y movimiento. La escala de espaciado existente parte de 4 px; no crear otra escala por pantalla.
- `ThemeScope` conserva la autoridad sobre personalización, densidad y variantes de plan. No fijar colores de texto o fondos que rompan temas oscuros o paletas permitidas.
- Corregir una inconsistencia en su propietario. Evitar hojas finales de parches, selectores globales nuevos, especificidad creciente, `!important` adicionales o márgenes negativos de compensación. No borrar protecciones existentes sin verificar su función.
- Alinear encabezados con sus datos y etiquetas con sus campos. Centrar texto e iconos dentro de botones; no centrar indiscriminadamente tablas: texto escaneable, importes y columnas numéricas alineados según su función.
- Usar la escala tipográfica existente, pesos y alturas de línea por rol. No reducir texto para encajar ni forzar anchos/altos que lo recorten. Respetar zoom y ampliación de texto al 200 %.
- Iconos familiares del sistema existente, con peso y tamaño consistentes. Quitar flechas decorativas; conservar anterior/siguiente y otros indicadores necesarios. No añadir círculos decorativos alrededor de cada icono.
- Proteger proporciones de imágenes, logos y marcos de teléfono. Declarar dimensiones o `aspect-ratio`; nunca estirar capturas para llenar una composición.

## UX, accesibilidad y formularios

- Preferir semántica nativa: botón para acciones y enlace para navegación. Etiquetar campos y botones de solo icono; ocultar iconos decorativos a lectores de pantalla.
- Foco visible, orden de teclado lógico, estados activos claros y retorno de foco al cerrar overlays. Color y animación no pueden ser la única señal de estado.
- Objetivo táctil habitual de al menos 44 × 44 CSS px; variantes compactas solo cuando sigan siendo utilizables con el método de entrada. No confundir tamaño del dibujo con área interactiva.
- Medir contraste real: al menos 4.5:1 para texto normal y 3:1 para texto grande y límites/indicadores esenciales de controles cuando corresponda. Comprobar temas y fondos reales; no certificarlo a partir de una captura o un hex aislado.
- Etiquetas persistentes, ejemplos breves y genéricos, `name`, `type`, `inputMode` y `autoComplete` apropiados. El placeholder no sustituye la etiqueta. Reutilizar `ui/field-examples.ts`; no precargar contraseñas ni bloquear pegado o gestores de contraseñas.
- Conservar valores y borradores ante errores; señalar el campo inválido, asociar el mensaje y enfocar el primer error al enviar. Validar sin regañar ni preguntar otra vez información aceptada.
- No introducir avisos de salida para elecciones exploratorias de registro. Conservar las protecciones de borradores importantes y operaciones en curso según el flujo existente.
- Mostrar solo un desplazamiento principal por modal. Mantener título, cierre y acciones alcanzables; reutilizar `useVisualViewport`, safe areas y el contrato `scroll="content"` para editores con scroll propio.
- Drawer, banners de demo, teclado, IAtry y acciones fijas no deben tapar controles ni competir por la misma zona táctil. No resolver el problema ocultando contenido u ofreciendo acciones solo en hover.
- Adaptar composición al espacio disponible con flex/grid y media/container queries. Evitar detectar modelos de teléfono. No ocultar overflow globalmente para disimular elementos recortados.

## Cargas, errores y microinteracciones

- Conservar la carga inicial de marca ATRY. Dentro del panel, reutilizar `PanelSkeleton` y sus variantes con geometría estable; no volver a spinners de pantalla completa ni inventar progreso con temporizadores.
- Diferenciar carga inicial, actualización, vacío, error, sin permiso, pendiente y éxito. Un fallo de consulta nunca equivale a cero resultados.
- Mensajes breves, cálidos y concretos, con una salida útil. Estados asíncronos accesibles mediante los mecanismos compartidos; evitar anuncios duplicados o invasivos.
- Durante una escritura impedir duplicados y conservar feedback real. No reintentar automáticamente operaciones de resultado incierto ni mostrar éxito por una animación.
- Usar tokens de movimiento y transiciones breves, interrumpibles y ligadas a una acción. Preferir `transform`/`opacity`; evitar `transition: all`, efectos de layout costosos y esperas artificiales.
- Respetar `prefers-reduced-motion`; ofrecer una alternativa estable a transparencia y movimiento cuando sea necesario. La respiración iridiscente aprobada no puede distraer, cambiar geometría ni deformar el emblema.

## React: claridad, seguridad y rendimiento

- Separar presentación, estado conversacional/de pantalla, dominio y transporte. Mantener componentes y hooks cohesionados; no introducir abstracciones especulativas ni un archivo gigante por cada ampliación.
- Tipar props, estados y resultados; validar datos externos en los contratos existentes. No usar `any`, conversiones o silencios de errores para eludir un contrato.
- Reutilizar `AppPort`, el modelo y los recursos con alcance. Invalidar resultados al cambiar usuario, sesión, rol o negocio; nunca compartir caché privada entre negocios.
- Efectos para sincronización externa, con limpieza de listeners y solicitudes. Derivar valores de props/estado cuando sea posible; no mantener copias redundantes ni definir componentes dentro de otros componentes.
- Mantener keys estables, dependencias correctas y renders puros. No medir DOM ni mutar datos durante render.
- Paralelizar lecturas realmente independientes, sin convertir escrituras ordenadas en un `Promise.all`. No añadir consultas al render o a cada pulsación sin necesidad.
- Conservar `lazy`/`Suspense` e imports analizables por módulo. Cargar dependencias pesadas bajo demanda; no inflar el bundle por un icono o una animación.
- Optimizar con mediciones: no añadir `memo`, `useMemo`, `useCallback`, virtualización o cachés por costumbre. Mantener fluidos los inputs y medir listas grandes sin perjudicar accesibilidad.
- Escribir cambios nuevos legibles y localizados; no reformatear toda la base ni cambiar dependencias por razones visuales.

## Invariantes de producto

- La UI no es la autorización. Conservar validaciones de servidor, adaptador, rol, plan, negocio y sesión; una tarea estética no autoriza cambiar permisos o capacidades.
- Reutilizar el perfil regional del negocio activo para fechas, horas y moneda. Preservar Uruguay/Panamá y precisión monetaria; no utilizar el país del navegador para reinterpretar datos de un negocio.
- IAtry conserva motor determinista, personalidad, memoria, guías y confirmaciones. Sus estados visuales representan estados reales: nunca anunciar ejecución o éxito antes de la respuesta y verificación exigidas por el contrato.
- No habilitar capacidades pendientes, alterar precios, suscripciones, disponibilidad, reservas, notificaciones o políticas de clientes para facilitar una prueba visual.
- Pruebas con datos ficticios y entornos locales. Sin operaciones productivas, migraciones, correos o WhatsApp reales salvo autorización explícita para el alcance concreto. Nunca incluir secretos o datos personales en evidencias.

## Verificación proporcional y criterio de cierre

Para cambios de interfaz:
1. Identificar causa, propietario y consumidores afectados; registrar qué se conserva.
2. Revisar la interfaz renderizada antes y después con datos cortos, largos, vacíos y estados relevantes. No dar por corregido un defecto solo por editar CSS.
3. Comprobar Chrome y WebKit en 320, 375, 390, 430, 768 y 1440 px para cambios compartidos. En cambios locales, cubrir los tamaños y consumidores afectados y justificar el alcance.
4. Revisar temas pertinentes, teclado, foco, scroll, modales largos, safe areas, movimiento reducido y ampliación de texto. No confundir WebKit o teclado simulado con iPhone/PWA físico o VoiceOver real.
5. Guardar capturas comparables con el mismo viewport y contexto cuando demuestren el cambio; datos ficticios y sin publicarlas como activos comerciales por accidente. Evitar nuevas capturas/PDF/videos si el usuario los excluye.
6. Ejecutar compilación y regresiones apropiadas. No repetir toda la infraestructura sin cambios relevantes ni omitir una prueba fallida. Si una aserción depende de un selector retirado, comprobar la conducta equivalente antes de actualizarla.
7. Informar qué se cambió, por qué, qué se verificó y qué no pudo verificarse. Una limitación no es un aprobado.

Comandos existentes desde la raíz; elegir según el cambio:

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

Los scripts de navegador necesitan Playwright y sus navegadores disponibles; los de integración usan el harness PostgreSQL desechable existente. No asumir rutas de dependencias propias de una máquina ni crear cuentas/recursos remotos para ejecutarlos. No reconstruir `dist` mientras una prueba lo esté sirviendo. `release-check` requiere primero el artefacto empaquetado mediante el proceso existente, no solo la compilación Vite.

No hacer push, merge ni despliegue sin autorización para esa entrega. Cuando se autorice: comprobar compatibilidad con la base vigente, preparar recuperación y verificar CI, artefacto y comportamiento publicado. Una compilación local no demuestra un despliegue correcto.

## Referencias y mantenimiento

- Apple HIG: [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) — jerarquía y adaptabilidad; [Typography](https://developer.apple.com/design/human-interface-guidelines/typography) — legibilidad; [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) — visión; [Branding](https://developer.apple.com/design/human-interface-guidelines/branding), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion) y [Loading](https://developer.apple.com/design/human-interface-guidelines/loading) — buenas prácticas. Interpretar para web, no imponer controles Apple.
- [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md): consultar la versión vigente al auditar; adaptar a los contratos y al idioma del producto.
- Evidencia y propietarios actuales: `docs/ux/DESIGN-SYSTEM-NORMALIZATION-2026-11-16.md` y los scripts anteriores. La evidencia histórica orienta; no certifica una revisión futura.

Actualizar este archivo si cambia una decisión arquitectónica real. No convertirlo en un registro interminable de tareas, fijar hashes o cantidades de pruebas como constantes permanentes, ni afirmar certificación Apple o cumplimiento absoluto.
