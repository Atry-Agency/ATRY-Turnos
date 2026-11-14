# Evidencia local y reproducción

## Resultado

- `npm run build`: TypeScript y Vite aprobados. Persisten avisos de empaquetado ya conocidos de `runtime-config.js` y directivas de Motion; no son errores de compilación.
- `npm run test:react`: suite aprobada, incluyendo conversaciones, referencias, confirmación visual, bloqueos, relectura, sesión obsoleta y presentación.
- `node --test --test-concurrency=2 tests/*.test.js`: **267 / 267** aprobadas. La primera ejecución dentro del sandbox tuvo 47 impedimentos `listen EPERM` en pruebas HTTP; al permitir servidores temporales en loopback, la misma suite pasó completa. No eran fallos de lógica ni se omitieron pruebas.
- `node scripts/international/postgres.cjs`: cadena completa de migraciones, UY/PA simultáneos a las 10:00 locales, conflicto, RLS y propietario ajeno; USD 12,99; visita de USD 26,00; recurrencia de las 14:00; ausencia que atraviesa medianoche; histórico inalterado tras editar precio; estadísticas, registro regional, WhatsApp +507, reprogramación, cola de correo y contratación PA rechazada.
- `node scripts/international/permissions.cjs`: UY/PA × Individual/Negocio/Pro; límites PostgreSQL 1/4/10, Individual sin estadísticas; lectura de encargado según contrato, imposibilidad de otorgarse roles y denegación de escritura de servicios al empleado.
- `node scripts/international/adapter-iatry.cjs`: PostgreSQL → adaptador cloud → motor IAtry; propuesta USD 12,99, «confirmo» sin escritura, una confirmación explícita y relectura real local; CSV con `12.99, USD`; correcciones decimales; alternancia de contexto y referencias; «mañana» resuelto distinto para UY y PA al mismo instante UTC.
- `node scripts/react/region-test.cjs`: precisión decimal hasta el máximo entero seguro, fechas inválidas, medianoche/año, hoy/mañana/domingo, Google Calendar e ICS, Maps y teléfonos/WhatsApp internacionales sin abrir servicios externos.
- `node scripts/international/browser.cjs`: Chrome y WebKit, **320 / 390 / 430 / 1440 px**, con acceso externo bloqueado. Cambio UY→PA, editor decimal, contratación bloqueada, reservas públicas por RPC local, comprobantes en tema claro, horario seleccionado conservado y zona Google correcta. Sin errores JS ni desbordamiento horizontal. En 390 px, ambos motores prueban conversación y corrección de USD 12,99 a USD 15,25. No genera imágenes ni videos.
- `node --test tests/cloud-api.test.js`: 5 / 5 aprobadas después de incorporar columnas locales al CSV, preservando respuestas antiguas sin fechas y la defensa contra fórmulas.
- Nueva regresión `tests/regional-legacy.test.js`: PA se rechaza en SQLite antes de crear cuentas/negocios; UY sigue funcionando. El adaptador también impide altas PA si falta la versión regional del backend.
- `git diff --check`: aprobado.

Para el navegador, instalar Playwright como herramienta temporal (sin dependencia de producto) y configurar `NODE_PATH`, `PLAYWRIGHT_BROWSERS_PATH` y opcionalmente `ATRY_TEST_CHROME`. La máquina utilizada tiene Chrome en `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

## Alcance de la evidencia

El arnés de navegador reutiliza el gateway y el adaptador del producto; simula CAPTCHA y visitantes independientes para no mezclar sus contadores de rate limit. Las reglas de permisos, conflictos, persistencia y precios se ejecutan en PostgreSQL temporal. No demuestra sesiones reales de Supabase, entrega de correo, OAuth, infraestructura desplegada ni comportamiento en dispositivo físico. Las confirmaciones de Google/Apple son enlaces/archivos manuales; no hay sincronización automática de clientes ni promesas nuevas de integración profesional.

Los archivos de prueba son herramientas locales fuera del manifiesto productivo. No contienen claves productivas. La vista local utiliza exclusivamente personas, direcciones y registros ficticios.

## Auditoría final añadida

- `node scripts/international/security.cjs`: 34 políticas efectivas idénticas, ACL de tablas/esquemas/funciones previas conservadas, siete funciones nuevas internas revocadas, search_path seguro y ataques con propietario ajeno, empleado/anon, sesión inconsistente y pg_temp rechazados. Defaults PA cerrados y cliente UY anterior compatible.
- `node scripts/international/recovery.cjs`: backup/restore local anterior y posterior PA, integridad de 66 tablas salvo revisión esperada de caché y fallo transaccional controlado; no equivale a pg_dump ni recuperación Supabase.
- `node scripts/international/compatibility.cjs`: frontend/motor/adaptador actuales con PostgreSQL anterior y actual para UY, propuesta explícita, una escritura y relectura.
- `node scripts/international/landing-browser.cjs`: Chrome/WebKit320/390/430/1440; UY sin cambios, propuesta PA local sin contratación, manual persistente, país de negocio intacto; host no local no presenta precios PA y pista inyectada no prevalece sobre selección manual.
- `tests/commercial-country.test.js` y `tests/regional-release.test.js`: catálogos exactos, prioridad manual, PA solo local, flags de build cerrados, runner remoto inactivo por defecto y negativa explícita de producción.
- `supabase/operations/regional-preflight.sql`: sintaxis ejecutada en esquema candidato local; no se ejecutó remotamente.

La suite pública proof falló inicialmente por un fixture antiguo que no declaraba el marcador regional: fue actualizado al protocolo actual. No se retiró la comprobación de seguridad; los clientes antiguos siguen teniendo prueba diferencial UY/PA separada. La suite completa posterior pasó.

- Comandos adicionales IAtry: `npm run test:iatry-phase-one` (114 resultados de rol/plan/operación y 7 combinaciones de seguridad), `test:iatry-phase-one-release`, `test:iatry-phase-one-contacts` y `test:iatry-consolidation`, aprobados. La comprobación de contactos conserva las nueve huellas SQL originales contra la base anterior y exige exactamente dos diferencias declaradas en el candidato (`atry_catalog`, `atry_save_service`); no se reemplazó el snapshot de producción. Las semánticas nuevas se comprueban en las suites regionales.
- Paquete estático de verificación en directorio temporal: PA cerrado; ningún script local, SQL, fixture de autorización o documento de auditoría en el manifiesto. Claves ficticias y `verificationOnly`, sin publicación.
