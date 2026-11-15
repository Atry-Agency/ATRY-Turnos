# Revisión UX/UI de ATRY Turnos

Candidato local en `codex/premium-ux-audit`, basado en la versión publicada `811650d`. Sin publicación ni cambios de Supabase, contratos, permisos o reglas comerciales.

## Referencia revisada

Se inspeccionaron visualmente las 29 páginas de `reglas de uso.pdf`. Es un documento basado en imágenes; extraer su texto no permitía evaluar los ejemplos. Se renderizaron y revisaron todas las páginas. El contenido publicitario del autor y sus ejemplos no se tomaron como instrucciones del producto.

| Páginas | Principio y aplicación en ATRY |
| --- | --- |
| 1 | Etiquetas encima de campos. Ya estaba aplicado en general; se normalizó el buscador de Clientes y el nombre del servicio ocupa toda la fila. |
| 2 | Buscar y recorrer listas. Se conservan los buscadores actuales. No se reemplazó el selector de dos países por un buscador innecesario. |
| 3 | Lenguaje natural. Se conservan la personalidad de IAtry y las etiquetas operativas claras. |
| 4 | Ayudas de formato. Se conservan fechas nativas, validaciones y decimales regionales. No se impone una máscara telefónica uruguaya a Panamá. |
| 5 | Etiquetas concisas. «Más opciones» en Agenda se reemplaza por un control de tres puntos, con nombre accesible «Herramientas de agenda». |
| 6 | Selecciones múltiples. Se mantienen las casillas de profesionales: son claras para equipos pequeños y no requieren reemplazo estético. |
| 7–8 | Priorizar cifras. Son ejemplos repetidos; los indicadores ya destacan el valor sobre su etiqueta. Sin cambios cosméticos. |
| 9 | Campos delimitados. Ya se cumple; se conservan sus superficies. |
| 10 | Iconos reconocibles. Se mantiene la iconografía existente y los emblemas originales. |
| 11 | Reducir esfuerzo en formularios. Nombre, precio y duración primero. Seña y buffers pasan a un apartado plegable con resumen, sin eliminar campos ni datos. |
| 12 | Jerarquía clara. Se preserva la acción principal de guardar; opciones secundarias separadas. Los errores compartidos ganan contraste y señal visual. |
| 13 | Moderar saturación en oscuro. Se conservan las paletas aprobadas; se comprueban los diálogos con los tokens reales del tema existente. Se corrigen etiquetas que retenían un color oscuro fijo sobre el fondo oscuro del diálogo. No se introduce una paleta paralela. |
| 14 | Opción «Otro». No se añaden valores a catálogos del backend por una recomendación visual. |
| 15 | Final satisfactorio. Se conserva la confirmación premium existente; no se agrega una celebración antes de un resultado verificado. |
| 16 | Relleno de botones. El sistema compartido ya es consistente. Se corrigen controles puntuales demasiado pequeños. |
| 17 | Texto de acción. Se conserva «Guardar servicio» por su claridad; no se sustituye por una frase publicitaria. |
| 18 | Enlaces reconocibles. Se mantienen los enlaces y acciones con estilo existente. |
| 19–21 | Menos ruido, color con significado y aire útil. Se reducen campos avanzados visibles al crear un servicio; no se eliminan los colores semánticos aprobados. |
| 22–23 | Sombras delicadas. Son ejemplos repetidos; no se reemplazan tarjetas correctas. Feedback usa separación discreta y texto legible. |
| 24–28 | Alternativas de navegación inferior. Se revisó la navegación actual, pero no se introduce otra barra que compita con el menú y con IAtry. |
| 29 | Estado activo, etiquetas, objetivos táctiles y área segura. Agenda, ayuda de espera y controles de IAtry alcanzan 44 px en móvil; los diálogos usan el viewport visual y conservan espacio para el teclado. No se fuerzan 48 px a cada celda de un calendario, porque alteraría su escala. |

## Pantallas y hallazgos

| Área | Evidencia y decisión |
| --- | --- |
| Inicio | Jerarquía de indicadores y acción principal coherentes. Se conserva. |
| Agenda | Selector Día/Semana/Mes de 32 px; filtros de estado de unos 22 px. Se amplían a 44 px en móvil y se compacta el control secundario de herramientas en la misma fila. No se cambia la escala temporal. |
| Reservas | Se revisa el formulario público UY/PA y la disponibilidad existente sin confirmar reservas. Se conservan datos, calendarios y composición aprobada. |
| Clientes | La etiqueta del buscador tenía 16 px y una alineación distinta a los formularios. Se normaliza y se coloca sobre la fila completa de búsqueda; placeholder más corto. Una carga fallida sin resultados previos ya no muestra «0 clientes» ni una lista vacía como si estuviera confirmada. |
| Servicios | En iPhone el formulario presentaba seis campos numéricos con igual prioridad y el guardado quedaba fuera de la primera vista. Se separan los esenciales de seña y tiempos adicionales. Los valores no nulos abren el apartado al editar; el resumen muestra los valores actuales. |
| Equipo y horarios | Tarjetas y organización semanal correctas. Sin rediseño. Los diálogos reciben las mejoras compartidas. |
| Estadísticas | Se conservan jerarquía, límites del plan y distinción entre actividad e ingresos cobrados. |
| Configuración | Se conservan formularios y pestañas existentes. Se prueban cambios de ancho y diálogos. |
| Suscripciones | Se conservan precios, estados, bloqueos y condiciones vigentes, incluida la contratación paga de PA bloqueada. |
| IAtry | Posición y composición aprobadas. Se amplían controles de ventana y categorías a 44 px en móvil; no se cambian motor, memoria, energía ni permisos. |
| Estados | Feedback de error con texto de primer nivel y señal de borde discreta; estados vacíos y confirmaciones correctos se conservan. |
| Formularios compartidos | Bloqueo de desplazamiento de fondo, cabecera visible al recorrer el diálogo, ajuste al viewport visual y asociación simultánea de ayuda y error mediante `aria-describedby`. |

## Garantías del cambio

- Se conservan todos los campos del servicio, incluso dentro del apartado plegado. Un campo inválido oculto abre automáticamente el apartado antes de dirigir el foco al error.
- USD conserva precisión en centavos y UYU su contrato existente. No se modifican conversiones ni reglas de disponibilidad.
- La confirmación para descartar cambios y la prevención de guardados duplicados se conservan.
- Se reutilizan colores, tipografías y tokens de ATRY. Sin nuevas dependencias de producto.
- El movimiento de la nueva indicación plegable respeta `prefers-reduced-motion`.

## Comprobaciones reproducibles

- `npm run build`: TypeScript y compilación del artefacto.
- `npm run test:react`: suite existente de UI, IAtry, continuidad, permisos y presentación.
- `NODE_PATH=… PLAYWRIGHT_BROWSERS_PATH=… node scripts/react/premium-ux-browser.cjs`: Chrome y WebKit; 320/390/430/1440 px; diez pantallas por combinación. UY/PA: se comparan los payloads de formulario con seña y buffers plegados; los envíos se interceptan y reciben un error ficticio, sin guardar registros. Incluye campos inválidos, viewport reducido por teclado, desplazamiento de fondo, confirmación de descarte e IAtry.
- Revisión visual de capturas antes/después en móvil y escritorio. Revisión adicional de diálogos claros/oscuros, errores y reservas públicas.

Las pruebas de teclado móvil usan el viewport visual simulado de navegador; no sustituyen una prueba táctil en un iPhone físico. Los datos utilizados son ficticios y locales. Ningún resultado de estas pruebas se presenta como una operación verificada en Supabase real.

## Resultado del candidato

- Compilación y TypeScript aprobados.
- Suite React aprobada: 32 pruebas base más los scripts de regresión existentes y el nuevo test de componentes.
- Cinco suites de consolidación de IAtry aprobadas, incluidos los casos de permisos y aislamiento; ninguna política productiva se modifica.
- 80 combinaciones de pantalla/navegador/ancho recorridas sin desbordamiento horizontal: diez pantallas × Chrome/WebKit × 320/390/430/1440 px.
- Ocho envíos ficticios de formulario interceptados: UY/PA en móvil y escritorio, ambos navegadores. Cero guardados y cero solicitudes externas.
- Errores de Clientes comprobados mediante fallo de lectura inyectado y recuperación con «Reintentar».
- Contraste de etiquetas oscuras: 2,29:1 antes; 8,73:1 después, con la paleta ATRY existente. Texto de inputs y estados revisados con mínimo 4,5:1 en los casos comprobados.
- Capturas finales inspeccionadas en claro/oscuro y móvil/escritorio. Formularios públicos y horarios UY/PA revisados sin confirmar reservas.
- El motor determinista, las herramientas, las confirmaciones y los permisos conservan su código publicado. Esta rama no incorpora ni elimina el trabajo conversacional independiente que continúa en la rama multipaís.

Vista local: `http://127.0.0.1:3355/#/app/servicios`. Datos ficticios y PostgreSQL desechable. No es la sesión ni la base productiva.
