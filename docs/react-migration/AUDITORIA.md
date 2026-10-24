# Modernización React — auditoría y base experimental

Fecha: 24/10/2026. Base verificada mediante fetch: `origin/main = 9a5a0d6ad6b6a1b1373f0079021ab67bc5517dc6`.
Rama: `feature/react-migration`. Worktree: `ATRY Turnos - React`.

## Alcance y conservación

Primera etapa: mapa arquitectónico, matriz, estrategia y prueba nativa React de las tarjetas de servicios. Ninguna pantalla completa se declara migrada. Los archivos heredados, SQL, backend, despliegue y package-lock raíz permanecen idénticos a main. No se publicó, fusionó ni ejecutó SQL remoto.

Main estaba limpio. IAtry V1.2 tenía cambios intencionales sin commit: NO estaba limpio. Se respaldaron 271 archivos modificados/no rastreados, diff binario y SHA-256 en `../respaldo-iatry-v12-react/`. Sus archivos se conservan intactos; no se hizo stash/reset ni commit de IAtry. El respaldo incluye entregables, no node_modules ni archivos ignorados.

## Arquitectura observada

- `web/index.html`: 26 scripts clásicos diferidos, orden explícito; capas CSS acumulativas. Sin empaquetado frontend general. `app.js` contiene router hash, estado, transporte, plantillas, formularios, acciones y boot.
- Estado global léxico `state`: sesión, negocio, capacidades, vista, agenda, selección pública, servicios, profesionales, diálogo, borradores. Estado adicional en módulos (visitas, editor, temporizadores, streams). No hay aislamiento por componente.
- `page()` reemplaza todo `#root` con innerHTML; conserva parcialmente formulario público y clave idempotente del horario. `appLayout` recompone shell y modal; `setScreen` conserva HTML en state.screen. `renderApp(false)` reutiliza la pantalla al abrir diálogos.
- Router `#/login`, `/registro`, `/cuenta-nueva`, `/cuenta`, `/recuperar`, `/restablecer/:token`, `/reservar/:slug`, `/gestionar/:token`, `/oferta/:token`, `/invitacion/:token`, `/app/:vista`, `/app/configuracion/:tab`, `/admin/:seccion`. Desconocidos vuelven a acceso/inicio; verificar futuros enlaces profundos sin cambiar hashes públicos.
- `features.js`, `agenda.js`, `management.js`, `workspace.js`, `commercial.js`, `control-center.js`, `onboarding.js` amplían o sustituyen funciones anteriores y registran manejadores de documento. El orden de carga constituye una dependencia real, no sólo organizativa.
- Formularios con delegación `data-form`, más `data-visit-form`, `data-wa-config`, formularios del centro de control. Confirmación nativa dialog y modal personalizado; dirty tracking, validación HTML, recuperación de foco, Escape y trap de Tab. Migrar exige un único propietario por formulario/evento y conservar submit, cancelación y borradores.
- Puros reutilizables: `agenda-core`, `visit-core`, `theme-core`, `whatsapp-core`, `staff-photo-core`, `read-cache`. Formatos UMD/CommonJS: requieren fachada ESM tipada, no copiar sus reglas. Las variantes demo NO sustituyen reglas del servidor.

## Transporte, permisos y sincronización

`api → readCache → requestApi`: primero demo, luego preview, cloud y HTTP same-origin. Cloud carga Supabase mediante `browser-entry.mjs`, auth, bootstrap, API adapter, proof/captcha, fotografías y realtime. `api-adapter.mjs` conserva rutas HTTP lógicas y traduce a RPC, función pública y Storage. Catálogo agrupa consultas concurrentes; exportación pagina con revisión consistente y protege fórmulas CSV. Recuperación reciente de identidad conserva el formulario administrativo.

Roles owner/manager/staff y platform_admin; capacidades y cupos por negocio, contexto de acceso, verificación de correo, suscripción/activación y permisos de agenda. Ocultar controles es presentación: las autorizaciones siguen en Node y RPC/RLS. SQL en `supabase/migrations` es histórico de comportamiento, no material a ejecutar durante esta etapa. Seguridad por negocio se aplica también a fotos, correo, recursos y exportación.

`read-cache`: memoria, máximo 60 entradas, namespace de usuario+ruta con negocio; TTL 5 s para listas/agenda/clientes, 15 s negocio, 20 s catálogos/horarios. Deduplica lecturas en vuelo, clona respuestas, invalida antes/después de escritura y ante 401/403. No cachea tokens públicos ni disponibilidad. Prefetch de navegación puede anticipar solicitudes; medir llamadas del adaptador separadas de hits de caché.

Realtime: SSE en Node o canal Supabase sobre `calendar_revisions` filtrado por negocio; JWT de usuario; chequeo de contexto cada 30 s y revocación de acceso. Cambios invalidan y refrescan; cerrar canales al cambiar negocio, logout y pagehide. No duplicar suscripciones con efectos React/StrictMode.

## Visual y personalización

CSS compartido: styles → product/control-center/appearance/workspace → typography/business-polish → agenda/theme-studio/visits → whatsapp/buttons/staff-photos. Mantener orden. Tokens dependen de negocio, plan, modo, densidad, fuente, radios y botones; apariencia validada en backend y theme-core, con revisión para conflictos. Logo oficial `assets/brand/atry.png`, fuentes incluidas, paleta y colores de estado/profesionales conservados. No introducir Tailwind, CSS reset o biblioteca visual en esta etapa. El piloto genera el mismo DOM de la tarjeta; texto escapado por React; SVG exclusivamente del registro estático aprobado.

## Offline, build y demos

SW v105: red primero con no-store y fallback de recursos estáticos permitidos; cachés por scope, borrado de versiones propias. No es un motor de reservas offline ni cola de escrituras. API, datos privados y parámetros públicos no se cachean. No prometer disponibilidad offline de datos.

`build-pages.js` copia web, empaqueta cloud/proof con esbuild y genera runtime-config, headers y redirects. Bloquea publicar cloud sin validación. `build-github`/preview y wrangler son rutas existentes de despliegue; el piloto no las altera. La futura entrada React necesitará decisiones de base path, CSP, caché/bundles hash y rollback antes de publicar.

Demo: fixtures independientes por pestaña y planes Individual/Negocio/Pro, escrituras en memoria y sin entrega real. El nuevo servidor sólo sirve web estático bajo `/legacy/`; exige demo=1; no carga cloud/config, bloquea /api, SW y conexiones externas mediante CSP. React se activa únicamente con react=1 y ATRY_DEMO.enabled. Recargar descarta cambios. No importar .env ni credenciales para comprobar este piloto.

## Acoplamiento y conclusiones

Prioridad alta: no migrar `onSubmit`, router y plantillas simultáneamente; su superficie incluye permisos, idempotencia, buffers, visitas atómicas y estado transitorio. Agenda y visitas son las últimas pantallas a convertir por conflictos, múltiples profesionales, recursos y accesibilidad. Mantener backend estable facilita comparar ambos clientes contra los mismos contratos.

Auditoría estática de los subsistemas y ejecución de suite local constituyen evidencia de esta etapa. No equivalen a un pentest ni a E2E completo de cada flujo productivo. `source-inventory.json` contiene inventario verificable de 252 archivos, símbolos, formularios, acciones, RPC y nombres de pruebas. La matriz expresa qué sigue pendiente antes de declarar migradas las funcionalidades.
