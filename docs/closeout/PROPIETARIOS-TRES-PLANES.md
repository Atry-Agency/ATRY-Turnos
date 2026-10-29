# Publicación aprobada: propietarios de tres planes — 29/10/2026

Autorización expresa del usuario: Individual16 sin estadísticas, Negocio17, Pro17; encargado/empleado sin herramientas operativas IAtry. No cambia estética, Supabase, suscripciones, usuarios o negocios.

Se conserva el catálogo homologado de primera etapa, confirmación visual obligatoria, protección de sesión/negocio, ejecución única y relectura. Clientes solo notas; reservas, cancelaciones, notificaciones y capacidades incompatibles siguen bloqueadas. La prohibición de contacto es específica de IAtry: la pantalla normal y su RPC conservan sus contratos legítimos.

## Validación diferencial

- Compilación TypeScript/Vite y suite React aprobadas.
- Consolidación conversacional y 67 comprobaciones de permisos aprobadas con expectativas 16/17/17.
- Motor conectado sobre PostgreSQL aislado + adaptador cloud: 38 resultados Individual/Pro, tres grupos de controles de servidor, confirmación, escritura única, relectura, aislamiento, empleado denegado y sobrecupo denegado. Cero solicitudes externas/notificaciones. Reutiliza evidencia anterior Negocio y matriz local114.
- Monitor cinco pruebas, seguridad notas-only, política de publicación y artefacto aprobados.
- Individual rechaza estadísticas incluso si una feature del cliente se presenta incorrectamente como habilitada; planes desconocidos y roles distintos de owner no amplían alcance.
- Auditoría del artefacto declara herramientas por plan; comprobación de publicación y monitor rechazan planes, roles o listas de herramientas alterados.

Evidencia real reutilizada: sesiones normales del propietario en los tres negocios ficticios, lecturas de catálogo/equipo/horarios/clientes disponibles y límites 1/4/10 leídos tras habilitación administrativa autorizada. No se realizaron nuevas escrituras reales. No se presenta como validación real exhaustiva de todas las escrituras de Individual/Pro: esa diferencia permanece documentada y el usuario autorizó publicar reutilizando contratos y evidencia local.

Controles backend existentes: sesión Auth válida, membresía exacta por negocio, autorización RPC, características del plan (estadísticas Individual denegadas), cupos de profesionales 1/4/10 y validación de registros/asignaciones del negocio. No se aplican migraciones ni se introducen contratos nuevos.

## Recuperación

Rollback publicado y verificado: `rollback/pre-iatry-owner-plans-2026-10-29` → `15ac08b137791405e2588bec1445abece3bea19b`.

GitHub Actions → «Publicar interfaz Atry Turnos» → Run workflow → source_ref = `rollback/pre-iatry-owner-plans-2026-10-29`. Publica el frontend anterior sin modificar Supabase ni reescribir main. El workflow selecciona el código completo de esa referencia.

La comprobación HTTP/artefacto acredita código y política publicados; no afirma que una operación haya escrito datos reales. Los perfiles encargado/empleado y sus vinculaciones no forman parte de esta publicación.
