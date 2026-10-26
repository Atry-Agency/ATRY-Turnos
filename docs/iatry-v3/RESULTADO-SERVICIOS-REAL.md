# Primera validación real de IAtry V3 · Servicios

26/10/2026. Autorización expresa del titular: Pelu y sus registros son ficticios. Proyecto `djoxdtloqwbrhgtgencc`; negocio `374cd00d-3e37-497f-9292-9bb959c1ef88`. Rama `codex/iatry-v3-supabase`. Sin publicación ni migraciones.

## Resultado real: 3/3

Se utilizó una sesión normal del propietario, la URL/clave pública y `cloud/api-adapter.mjs` sin modificarlo. Las acciones se iniciaron desde el `OperationalPanel` y el motor de conversación existentes: preguntas, resumen y confirmación explícita para cada escritura. No se utilizaron credenciales administrativas en el navegador ni SQL de escritura.

Servicio creado: **IAtry · Validación controlada 2026-10-26**.
ID real devuelto por Supabase: `251718ac-2322-4b83-905b-f8f609d8597d`.

| Acción en IAtry | Respuesta real de `atry_save_service` | Relectura autenticada del catálogo |
|---|---|---|
| Crear | `{"id":"251718ac-2322-4b83-905b-f8f609d8597d"}` | Precio 0 UYU, duración 15 minutos, activo 1 |
| Cambiar precio | `{"id":"251718ac-2322-4b83-905b-f8f609d8597d"}` | Precio 1 UYU, duración 15 minutos, activo 1 |
| Ocultar | `{"id":"251718ac-2322-4b83-905b-f8f609d8597d"}` | Precio 1 UYU, duración 15 minutos, activo 0 |

Cada resultado se mostró dentro de IAtry **después** de la relectura de Supabase, incluyendo ID, precio, duración, estado y ausencia de profesionales. El estado también apareció en la lista de la vista restringida. No se presentaron como confirmados los valores meramente solicitados.

## Estado final comprobado independientemente en lectura

- Registro conservado e inactivo; no se eliminó.
- Descripción: `Prueba controlada de IAtry; sin atención al público`.
- Precio 1 UYU, duración 15 minutos, seña 0%, buffers 0.
- Cero asignaciones de profesionales y cero de recursos.
- Exactamente tres eventos `service.saved` para ese ID: 21:44:44.913457Z, 21:45:26.158663Z y 21:45:55.366649Z del 26/10/2026.
- Revisión del calendario: 5 → 8.
- Catálogo de Pelu: 1 → 2 servicios. La comparación de cada relectura confirmó que la fila del servicio anterior permaneció igual.
- Clientes: 2 → 2. Reservas: 2 → 2. Trabajos de correo: 6 → 6.
- No se invocaron operaciones de envío ni funciones públicas/Edge de reservas. Los procesos de correo previos no se manipularon; esos conteos no prueban el estado de entrega de trabajos ajenos al ensayo.

La comprobación independiente se hizo con SELECT dentro de una transacción READ ONLY y ROLLBACK en el dashboard, sin ejecutar funciones de negocio desde SQL.

## Barrera y cierre del ensayo

Se preparó una entrada local independiente que reutiliza la presentación premium y móvil existente, sin modificar el frontend publicado. No usa el bootstrap que finaliza registros ni presenta opciones de crear cuentas o recuperar contraseñas. El titular inició sesión directamente en la vista local; no se copiaron tokens desde el dominio publicado ni se registraron contraseñas.

La barrera comprueba proyecto, propietario y negocio, y admite exclusivamente crear el contenido exacto autorizado, cambiar su precio a 1 y ocultar el ID devuelto al crear, en ese orden. Rechaza otros registros, datos, rutas, duplicaciones y resultados inciertos. Una relectura discrepante detiene el ensayo. El perfil normal `connected` sigue bloqueado; la nueva entrada no se importa desde `main.tsx` ni se distribuye en la publicación.

Tras la tercera operación, el estado quedó `done`, que deniega nuevas escrituras. El servidor loopback se detuvo y se eliminó su bundle temporal. La pestaña puede conservar el resultado ya visible, pero no constituye un servidor de validación activo. Reiniciar el helper no permite continuar sobre un servicio existente: una creación repetida con ese nombre se rechaza antes del RPC. No se habilitaron otras capacidades.

## Incidencias y comprobaciones

Sin errores en las tres RPC reales ni en sus relecturas. Durante la preparación local se corrigieron el arranque del núcleo visual, el espaciado del formulario de acceso señalado por el titular y el aislamiento de una referencia mutable del contexto detectado por la prueba de barrera. Estos ajustes se verificaron antes de la primera escritura real.

Pruebas: TypeScript y compilación Vite correctos; suite React/V2 y los 16 grupos de seguridad V3 correctos; prueba específica de la barrera correcta (proyecto, rol, negocio, datos, ID, secuencia, duplicados, cambio de contexto y resultado de red incierto). No se repitieron pruebas visuales masivas ni se generaron medios. No se alteraron componentes de presentación del panel o móvil; el espaciado solo afecta el formulario de esta entrada local.

Archivos: `frontend/react/src/iatry/v3/{access,acknowledgement,contracts,service-validation}.ts`; `scripts/react/iatry-service-validation.tsx`, `iatry-service-validation-preview.cjs`, `iatry-service-validation-test.cjs`; informes de esta carpeta.

## Próximo paso

**Tres capacidades verificadas realmente mediante IAtry con el propietario de Pelu**, no 66 homologadas. La auditoría de permisos y las pruebas PostgreSQL locales no autorizan activar las restantes. `schedule.exception` y `waitlist.booked` siguen bloqueadas; también permanecen sin habilitar las demás operaciones conectadas. El primer fallo de jornadas especiales fue local y requiere homologación frente al esquema remoto que sí tiene la restricción.

Preparados para acordar el siguiente lote controlado, con registros y efectos explícitos. Quedan por validar otros roles, caducidad/cambio de sesión reales, aislamiento entre negocios y demás operaciones contra Supabase. Reservas y recurrencias requieren analizar previamente sus efectos de notificación. No estamos aún preparados para publicar o activar V3 completo.
