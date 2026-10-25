# ATRY Turnos — Migración React: informe técnico de revisión local

Fecha: 25 de octubre de 2026. Rama experimental: `feature/react-migration`.

## 1. Resultado y alcance

La entrada principal, navegación, pantallas privadas, autenticación, reservas públicas, administración y landing se implementan con React y TypeScript. Vite genera una distribución autónoma. El arranque normal del servidor usa esa distribución; la referencia anterior permanece disponible únicamente mediante una opción explícita o el servidor de comparación de desarrollo.

Este resultado es una revisión local. No autoriza ni ejecuta publicación, fusión, push, migraciones remotas o cambios de datos reales. La activación de cloud en un paquete público mantiene el bloqueo `CLOUD_BACKEND_VALIDATED=1` del proyecto. La equivalencia del backend cloud contra staging real no se declara validada por esta migración.

## 2. Arquitectura

- `frontend/react/src/main.tsx`: configuración pública síncrona, inicialización del adaptador cloud cuando corresponde y montaje de React; registro del service worker solo en el build de aplicación habilitado.
- `app/model.ts`: identidad, negocio activo, generación de sesión, permisos, suscripción, caché, actualizaciones, preferencias y solicitudes de reautenticación. Se consume como almacén externo con `useSyncExternalStore`.
- `app/NativeApp.tsx`, `Shell.tsx`, `navigation.ts`: rutas hash compatibles, shell responsive, guardas de permisos, temas y coordinación de formularios y diálogos.
- `app/FeatureHost.tsx`: registro de pantallas y diálogos. Inicio se carga directamente para evitar la espera de Suspense en el primer montaje. Pantallas secundarias, administración, cloud y editores conservan carga separada.
- Carpetas por función: agenda, servicios, clientes, equipo, horarios, comunicación, suscripción, configuración, estadísticas, cuenta, onboarding, autenticación, público y administración.
- `infrastructure/scoped-api.ts` y `session-api.ts`: descartan respuestas de sesiones o negocios anteriores; controlan capacidades antes del transporte sin sustituir la autorización del servidor.
- `infrastructure/api-client.ts`: caché y transporte compartidos, invalidación antes y después de escrituras y un único reintento de la misma solicitud tras reautenticación.
- `ui`: campos con etiquetas, feedback, modales, confirmaciones y guardas de edición comunes.

No se insertan las antiguas pantallas HTML dentro de contenedores React. Los formularios, tablas, filtros y acciones son JSX. Se conservan cadenas SVG autorizadas del catálogo de iconos; no se utiliza HTML procedente de datos de usuario para generar interfaces.

## 3. Inventario de pantallas

| Área | Pantallas y comportamiento conservado |
| --- | --- |
| Inicio y activación | Inicio según plan, actividad semanal, próximos turnos, configuración inicial y progreso |
| Agenda | Día, semana y mes, filtros, búsquedas, atajos, ficha, historial, reserva manual, reprogramación, cancelación y gestión de visitas |
| Catálogo | Servicios, duración, precio, publicación, profesionales y recursos asociados |
| Clientes | Búsqueda, alta, edición, historial, contacto, reservas, turnos fijos y exportación según plan |
| Equipo y accesos | Profesionales, colores, servicios, fotos, visibilidad pública, jornadas, ausencias, invitaciones y permisos |
| Disponibilidad | Horarios semanales, excepciones, bloqueos, recursos y horario propio de empleado |
| Operación | Turnos fijos, lista de espera y horarios disponibles |
| Comunicación | Preparación manual de WhatsApp, plantillas, pendientes, pospuestos y gestionados; no representa entrega ni lectura |
| Configuración | Datos del negocio, reglas de reservas, notificaciones, apariencia, logo, estilos y personalización por plan |
| Comercial | Suscripción, períodos, acceso, solicitudes de plan y renovación, ayuda y soporte |
| Cuenta | Perfil, contraseña, correo, negocios, cambio de organización y creación de negocio |
| Estadísticas | Estadísticas básicas y avanzadas con sus capacidades comerciales originales |
| Acceso | Login, registro en dos pasos, cuenta sin negocio, recuperación, restablecimiento, verificación e invitaciones |
| Público | Reserva individual, visita combinada con cotización del servidor, comprobante, enlace privado de gestión y oferta de espera |
| Administración | Inicio, negocios, detalle, usuarios, comercial, correos, sistema, soporte, datos, auditoría y configuración |
| Landing | Selector de planes, galería con teclado, laboratorio WhatsApp, identidad y dos demostraciones React embebidas |

Las veinte rutas privadas se enumeran en `src/app/routes.ts`. Las rutas públicas y administrativas preservan los enlaces hash existentes. Los cambios de ruta conservan o descartan borradores mediante confirmación; una operación pendiente bloquea salidas incompatibles.

## 4. Contratos y lógica de negocio

Disponibilidad, duración, recursos, cuotas, políticas de cancelación, capacidades, reservas y cotizaciones continúan validados por el backend existente. La migración no introduce una segunda implementación de sus reglas en el frontend.

El catálogo local del empleado usa la proyección pública limitada del backend local. Cloud conserva el RPC privado ya autorizado. La adaptación añade valores de presentación para campos ausentes; nunca calcula disponibilidad a partir de esa proyección.

Una reserva pública cuyo servidor confirmó pero cuya respuesta se pierde conserva el cuerpo y UUID originales. El reintento verificado genera una única reserva. Las visitas se crean y reprograman como conjuntos de tramos mediante una cotización del servidor.

Los CRUD que no disponen de idempotencia de creación en el contrato original siguen teniendo esa limitación. Se bloquean envíos simultáneos en el cliente, pero no se inventa una garantía de deduplicación del servidor. Ante una respuesta incierta debe comprobarse el listado antes de repetir manualmente una creación.

## 5. Código anterior retirado de la distribución

El build ordinario excluye el piloto y no publica `app.js`, `workspace.js`, `features.js`, `management.js`, `control-center.js`, `react-services-bridge.js` ni los demás controladores antiguos de pantallas. `cloud/browser-entry.mjs` deja de ser el punto de montaje visual; React utiliza los adaptadores de infraestructura directamente.

La distribución usa una lista cerrada `react-assets.json`. El servidor no sirve archivos JavaScript arbitrarios del repositorio cuando se entrega esa distribución. Los empaquetadores de Pages copian exclusivamente sus recursos públicos y generan nuevamente la versión del service worker después de escribir la configuración pública.

## 6. Código que permanece y motivo

- Las hojas de estilo aprobadas y las fuentes/logos se conservan como base visual. Se añadieron selectores equivalentes para controles JSX sin alterar sus selectores anteriores.
- `theme-core`, `agenda-core`, `visit-core`, los núcleos de WhatsApp/fotos y la caché son funciones o motores inertes compartidos; se importan como módulos, sin importar sus controladores DOM antiguos.
- Los adaptadores cloud de autenticación, RPC, realtime y protección de reservas permanecen para conservar contratos y seguridad. El worker de protección se genera como recurso independiente con hash.
- `web/` y el código del piloto permanecen en la rama como referencia auditable y para reproducir comparaciones. No forman parte del paquete ordinario React. `ATRY_COMPARISON_BUILD=1` permite compilar el piloto de comparación de forma explícita.
- El backend Node, SQL y pruebas de dominio se conservan. La opción `ATRY_LEGACY_REFERENCE=1` permite ejecutar la referencia local cuando se necesita comparar.

## 7. Dependencias

React y React DOM 19.3.1; TypeScript 7.0.2; Vite 8.3.5; tipos de React/DOM y Node fijados en el lockfile de la carpeta frontend. El backend conserva Supabase JS 2.117.3, Noble Hashes 2.4.0 y Nodemailer 10.1.0; herramientas de pruebas existentes PGlite y esbuild. No se actualizaron dependencias backend para resolver problemas ajenos al alcance.

La versión efectiva se puede auditar en ambos `package-lock.json`. La compilación exige Node 22.13 o posterior, como el proyecto original. No se realizó una consulta de vulnerabilidades en red en este cierre; CI conserva su auditoría configurada. Las advertencias conocidas de dependencias del informe anterior no deben interpretarse como resueltas por una migración visual.

## 8. Pruebas y evidencias

Los logs y JSON originales se conservan en `evidence/`. Los archivos con sufijo `failed` documentan fallos intermedios; no son el resultado final de una suite. Debe consultarse el JSON de aprobación correspondiente y su fecha de generación.

- Regresión Node/PostgreSQL local: 243/243 aprobadas.
- React: pruebas de componentes, contratos, repositorios, sesión, permisos, fotos, API, catálogo local/cloud y protección de reservas; el log unitario contiene el total final.
- Shell nativo: 43 comprobaciones de navegación, planes, acceso, menú y borradores.
- HTTP local: cuenta y múltiples negocios, registro y contraseña, invitación/empleado, reservas individuales/visitas y administración.
- Cloud: SDK Supabase y adaptador reales con HTTPS interceptado, comandos locales en SQLite en memoria; reautenticación inválida y válida, cuerpo/UUID idénticos y una única operación final.
- Landing: dos demos, propagación de nombre/tema/vista y cinco anchos sin desbordes.
- Temas: 105 combinaciones de plan, tema permitido, ancho y pantalla. Contraste de agenda solo en Pro.
- Service worker: instalación, recarga demo offline, apertura de otro chunk y comprobación de que la caché excluye API y URL con parámetros.
- Accesibilidad: Enter/Escape y restauración de foco del menú, navegación de pestañas con flechas/End, asociación tab/panel y movimiento reducido.
- Preview: login deshabilitado y ninguna llamada API al abrir autenticación o reserva pública.

Las pruebas HTTP usan bases en memoria y puertos efímeros. La demo opera en memoria del navegador. No se enviaron correos, WhatsApp, solicitudes de pago ni reservas a sistemas reales.

## 9. Seguridad y aislamiento

La autorización del servidor permanece como última barrera. El cliente valida el contexto antes y después de solicitudes y no reutiliza datos de un negocio anterior. Se probó la invalidación de respuestas administrativas al cambiar la sesión y el rechazo de identidades sin permisos antes de transportar solicitudes.

La confirmación administrativa solicita la contraseña sin almacenarla en datos del formulario original ni en almacenamiento del frontend. Al fallar se vacía y conserva la operación pendiente. Al confirmar se reenvía una única vez la solicitud original. El almacenamiento de sesión normal continúa a cargo del SDK existente.

El empaquetado rechaza claves secretas y JWT privilegiados; solo admite la clave pública configurada. Los artefactos excluyen servidor, bases, archivos de entorno y credenciales privadas. El bloqueo de validación cloud permanece. El preview no intenta operar contra un backend.

El protocolo de los iframes comprueba origen y ventana emisora. Sus cambios son metadatos visuales dentro de una demo ficticia, sin nuevas consultas reales. Los enlaces privados de reservas no se incluyen en caché ni almacenamiento de aplicación. Los Blob URL de fotos se revocan al desecharlos o desmontar su contexto.

## 10. Rendimiento

Las mediciones brutas se guardan en `native-performance.json`: Chrome headless local, cinco contextos nuevos por interfaz, demo Pro, 1440×960, sin throttling y con service workers bloqueados. Son comparaciones de laboratorio local; no estimaciones de experiencia en dispositivos físicos.

La primera implementación diferida de Inicio introducía una demora de Suspense. Se investigó midiendo el instante de montaje en `requestAnimationFrame`, separándolo de la latencia de sondeo del test. Se cargó Inicio directamente; el resto de módulos secundarios sigue separado. El resultado final y los tamaños exactos se incluyen en `MEDICIONES.md`.

React reduce la transferencia inicial y el número de scripts; añade memoria y algo de tiempo de montaje respecto al script original. No se presenta como mejora universal. No se midió carga con backend remoto, redes móviles, Safari o Android físico.

## 11. Comparaciones visuales

Se conservaron capturas reales anteriores y React en 320, 390, 430, 768 y 1440 píxeles. La auditoría registra diferencias por píxel, dimensiones y límites de la comparación. Los pares del shell se registran por separado y la landing se añade después de sus pruebas funcionales.

Los textos y dimensiones se verifican automáticamente en las suites comparativas. Las diferencias residuales de administración incluyen rasterización/fragmentación de textos y controles; las imágenes se conservan para revisión. Los conteos y máximos finales constan en `MEDICIONES.md`. No se afirma equivalencia de cada píxel en todas las pantallas.

El PDF de revisión contiene las imágenes incrustadas, con referencia anterior y React identificadas. Los PNG completos permanecen en las carpetas de evidencia y no dependen de enlaces externos.

## 12. Errores encontrados y correcciones

- Fuentes bloqueadas por la lista de directorios de Vite: se permitió el directorio de recursos necesario, manteniendo el límite de archivos.
- Núcleos UMD interpretados con rama Node al agrupar para navegador: transformación acotada a nueve núcleos inertes; las fuentes Node permanecen intactas.
- Carrera de foco entre pasos de registro: efecto de layout al cambiar de paso.
- Proyección local de empleado sin atributos del catálogo privado: adaptación limitada y dos pruebas de contrato.
- Navegación de negocio duplicaba cargas: promesa compartida e invalidación condicionada a la misma generación.
- Pérdida de borradores durante recarga/background: guardas `canRefresh`, recarga diferida y control de operaciones pendientes.
- Selectores visuales antiguos dependían de `data-action`: se añadieron equivalentes nativos para administración y logout.
- Foto resuelta después de desmontar: revocación de su Blob URL aunque la respuesta llegue tarde.
- Prueba de showcase dependía de que hoy fuera laborable: consulta de fixture a siete días; reglas reales de domingo intactas.
- Fixture de SDK no interceptaba HTTPS por un glob y no proporcionaba la versión de error de Auth: regex explícita y cabeceras de la API en el simulador. Ninguna credencial real fue utilizada.
- Confirmaciones de estado y aviso de colores: etiquetas explícitas de cancelar/completar/ausencia y comparación de color con el mismo umbral original.
- Espera inicial de Suspense: Inicio directo, con medición anterior/posterior.

## 13. IAtry: mapa para una integración futura

IAtry V1.2 no se importó ni se reescribió. Se verificaron las huellas de sus 589 archivos protegidos.

| Módulo experimental | Reutilización futura |
| --- | --- |
| `iatry-core.js` | Reutilizables análisis de servicios, elegibilidad, presencia y selección; convertir exportaciones a módulos sin cambiar reglas |
| `iatry-memory.js` | Reutilizable normalización y memoria con almacenamiento inyectado; conservar clave por demo/usuario/negocio/rol y limpieza al cambiar sesión |
| `iatry-knowledge.js` | Reutilizables textos y pasos; adaptar selectores de destino a refs/identificadores estables React |
| `iatry-identity.js` | Reutilizables paleta y estructura visual; convertir `avatar()` HTML a JSX |
| `iatry.js` | Adaptar controlador: leer snapshot/puerto del modelo y ciclo de React; retirar dependencia de `state`, `showDialog` y controladores DOM globales |
| `iatry-motion.js` | Adaptar a hooks/refs, efectos con cleanup y preferencia reduced motion; conservar fases y movimientos aprobados |
| CSS y laboratorio | Reutilizar estilos y muestras como referencia; revisar anclas, portales y aislamiento de foco antes de conectar |

Esta tabla no habilita la integración ni agrega consultas nuevas al producto.

## 14. Límites y riesgos antes de sustituir producción

1. Cloud no se probó contra un proyecto remoto autorizado. Los fixtures verifican contratos y UI, no infraestructura, RLS desplegada, entrega de correo, OAuth/PKCE completo en un proveedor real ni configuración Turnstile real.
2. La matriz de temas cubre tres pantallas representativas y opciones válidas; no constituye el producto cartesiano de todas las rutas, todos los errores y todos los dispositivos.
3. Las pruebas de accesibilidad son funcionales y semánticas acotadas. Falta revisión con lector de pantalla y no se declara certificación WCAG.
4. Se usó Chrome headless en macOS con viewport móvil. Safari, Firefox y dispositivos físicos necesitan un ensayo de aceptación antes de publicar.
5. Los endpoints CRUD originales sin idempotencia conservan el riesgo descrito de reintento manual tras respuesta incierta.
6. La consola administrativa tiene una superficie grande: se recorrieron todas sus secciones y operaciones críticas representativas; no se ejecutaron todos los comandos destructivos contra un servicio real.
7. Las demos impiden mensajes y reservas reales por diseño. Su aprobación no demuestra conectividad productiva.

La implementación React puede revisarse y ejecutarse localmente como aplicación independiente. No se recomienda sustituir producción únicamente a partir de estos resultados locales: primero debe pasar la aceptación en staging con configuración real autorizada, navegadores objetivo y revisión del PDF. El bloqueo de empaquetado cloud conserva precisamente esa separación.

## 15. Ejecución local

Desde este worktree:

```sh
npm ci
npm ci --prefix frontend/react
npm run build
npm run test:react
npm test
npm run dev:react
```

Demo aislada de trabajo: `http://127.0.0.1:3321/?demo=1&plan=3#/app/inicio`.
Landing: `http://127.0.0.1:3321/descubrir.html`.
Comparación anterior: `http://127.0.0.1:3321/legacy/?demo=1&plan=3#/app/inicio`.

`npm start` entrega el build React con el backend local configurado del proyecto. Como antes, puede usar su base y worker de correo configurados: no debe iniciarse contra datos reales para repetir las pruebas. Los scripts `full-native-*-http.cjs` crean su propia base en memoria y son la opción de verificación aislada.

Para repetir E2E se necesita Playwright y Chrome; en este equipo se usó el runtime de Codex indicado por los scripts/logs. Los comandos de generación Pages preparan artefactos locales, no publican por sí mismos. Las modificaciones de CI añaden instalación, build y pruebas React; no se ejecutó ninguna acción remota.

## 16. Conservación y auditoría

Las huellas de 324 archivos de main y 589 de IAtry coinciden con el respaldo inicial: sin archivos cambiados ni faltantes. Los repositorios protegidos no fueron reseteados ni limpiados. Los cambios se limitan al worktree experimental.

Evidencia principal: `legacy-regression.txt`, `unit-tests.txt`, `deployment-react.txt`, `native-*.json`, carpetas comparativas y `protected-sources.json`. Los resultados fallidos históricos permanecen para que pueda auditarse el diagnóstico y su corrección. El PDF y las imágenes son artefactos locales; no hubo publicación ni fusión.
