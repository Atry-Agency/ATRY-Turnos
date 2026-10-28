# Primera etapa: candidato consolidado (28/10/2026)

Base: `122818e`. Sin publicación. La configuración productiva conserva cinco lecturas acotadas y cero escrituras. La habilitación preparada está desactivada en código y no se controla mediante URL, preferencias ni runtime-config. No se cambiaron tablas, funciones, RLS, usuarios, membresías, suscripciones ni configuraciones de Supabase. Solo se ejecutaron las cuatro escrituras específicas autorizadas en Pelu.

## Alcance preparado para aprobación final

17 herramientas para **propietarios con plan Negocio**, en cualquier negocio del que realmente sean propietarios. La selección pendiente de aprobación ya no fija Pelu como ID. El aislamiento sigue comprobándose en sesión, AppPort, adaptador y RPC existentes. No se eliminan las restricciones actuales hasta aprobar la habilitación y verificar su artefacto correspondiente.

| Rol | Individual | Negocio | Pro |
|---|---|---|---|
| Propietario | Bloqueado: falta sesión real | 17 herramientas preparadas, aprobación pendiente | Bloqueado: falta sesión real |
| Encargado | Bloqueado: falta sesión real | Bloqueado: falta sesión real | Bloqueado: falta sesión real |
| Empleado | Sin permisos administrativos habilitados | Sin permisos administrativos habilitados | Sin permisos administrativos habilitados |

Esto distingue permisos implementados en los contratos de permisos homologados con una sesión real. Las pruebas locales propietario/encargado × tres planes siguen siendo válidas, pero no se presentan como sesiones de Supabase. El inventario real actual contiene únicamente dos membresías de propietario, ambas Negocio; no hay sesiones de los otros perfiles que recuperar. No se crearon cuentas ni se modificaron planes para fabricarlas.

Límites configurados realmente en Supabase: Individual 1, Negocio 4, Pro 10 profesionales; estadísticas desactivadas en Individual. El rechazo de sobrecupo por el servidor fue probado previamente en PostgreSQL local, no modificando planes en Supabase.

## Herramientas y límites

- Servicios: listar, crear, modificar precio, duración, nombre/descripción, activar y ocultar (7 herramientas contando consulta). Evidencia real previa reutilizada, incluido el ensayo del 28/10.
- Clientes: crear, buscar, historial y actualizar **solo notas** (4). Cambiar nombre, correo o teléfono queda bloqueado en conexiones reales antes de preparar la escritura: la RPC puede propagar esos datos a recurrencias. También se bloquea alterar consentimiento de marketing. No se añade una RPC ni se consulta toda la agenda para intentar evitar este efecto.
- Horarios: consultar semana, consultar bloqueos, cambiar día semanal con pausas y registrar ausencia (4). Ausencia cubre períodos horarios, día completo y varios días; no se cuentan como herramientas extra.
- Equipo y estadísticas: consultar profesionales e indicadores (2).

Total 17. Reservas, cancelaciones, notificaciones, correos, lista de espera y las dos incompatibles (`schedule.exception`, `waitlist.booked`) siguen fuera de alcance.

## Ensayo real autorizado y completado

Proyecto `djoxdtloqwbrhgtgencc`; Pelu `374cd00d-3e37-497f-9292-9bb959c1ef88`; Rodrigo `35c53427-98ad-4f28-b0c1-c5cc5f82ae14`; sesión normal del propietario, adaptador cloud, motor IAtry y RPC existentes. No se usó SQL para escribir ni una credencial administrativa en el navegador.

1. Miércoles: 09–18 → 09–13 / 14–18. `atry_save_week` respondió `ok:true` y sus ventanas; relecturas de horas y reglas confirmaron la pausa 13–14 y los demás días intactos.
2. Restauración: miércoles 09–18, sin pausa. Respuesta `ok:true`; relectura confirmó lunes a sábado 09–18, domingo cerrado, cero descansos recurrentes: mismo estado efectivo original.
3. Día completo: 18/11/2026 00:00 → 19/11/2026 00:00 Uruguay. RPC respondió `ok:true`, ID `092cb06c-5a0c-465e-aae8-4b331af84f2c`. Relectura confirmó 03:00Z → 03:00Z y motivo «IAtry · Día completo controlado 2026-11-18».
4. Vacaciones: 20/11/2026 00:00 → 23/11/2026 00:00 Uruguay (20, 21 y 22). RPC respondió `ok:true`, ID `ae3d82ac-977a-4f25-b5b9-8c7a46e4eee9`. Relectura confirmó ambos extremos y motivo «IAtry · Vacaciones controladas 2026-11-20».

Antes: cero reservas futuras, cero recurrencias y cero ausencias superpuestas del profesional. Después: dos reservas y dos notificaciones existentes, sin incremento; dos nuevas ausencias autorizadas. No se invocaron rutas de correo, reservas o notificaciones. No se verificó entrega de mensajes ni se afirma que hubo envíos. El gate terminó en `done`; servidor detenido y nuevas escrituras denegadas por defecto.

Se ejecutaron además las herramientas `schedule.read` y `schedule.blocks` con esa sesión: mostraron la semana restaurada y los tres bloqueos del profesional (incluido el anterior del 16/11). No expanden recurrencias ni crean reservas.

## Correcciones y pruebas focalizadas

- La confirmación visual queda vinculada al token de la propuesta. No puede heredarse una casilla marcada al preparar otra operación. Comprobado en la interfaz real, preparando dos propuestas sin ejecutar nuevas escrituras: la segunda muestra casilla desmarcada y botón deshabilitado. Sin cambios estéticos.
- Protección explícita de identidad/contacto y consentimiento del cliente; notas permitidas. Pruebas específicas de campos denegados. Se conservan las pruebas previas de propagación local, aislamiento y rechazo atómico de contactos duplicados.
- Prueba aislada del alcance futuro: propietario/Negocio en cualquier negocio coincidente; otros roles/planes y negocio no coincidente denegados; rutas materializadoras bloqueadas. La activación solo se simula dentro de un bundle de test temporal. El código del candidato mantiene aprobación falsa.
- Gate de cuatro escrituras: valores exactos, restauración semanal, día completo/multidía, relectura y cierre terminal.
- Compilación, política productiva actual, seguridad conversacional y verificación de respuestas pasan. El artefacto actual declara cinco lecturas y cero escrituras. Una prueba de artefacto temporal verifica además la futura atestación de 7 lecturas/10 escrituras, rechaza un plan adulterado y rechaza ese artefacto bajo el código todavía no aprobado. Se reutilizan los 114 casos PostgreSQL/adaptador y las nueve huellas RPC previas; no se repitió la batería completa.

## Publicación y recuperación

La aprobación final debe especificar **activar las 17 herramientas para propietario/Negocio en cualquier negocio autorizado, clientes editables solo en notas**, o publicar conservando los bloqueos. No se puede interpretar una aprobación visual como permiso de escritura.

Con esa aprobación: verificar `origin/main`; publicar y verificar la etiqueta `rollback/pre-iatry-phase-one-2026-10-28` que apunta a `5a5aaa4868366eb51afcb181c6b0cc49d7c0e1ce`; cambiar el interruptor de aprobación en código para activar el alcance aprobado; la atestación y el control del artefacto ya están preparados para exigir exactamente 7 lecturas y 10 herramientas de escritura con las restricciones de campos y rol/plan; compilar y verificar; ejecutar el workflow Pages existente. El control actual del artefacto impide publicar una ampliación sin esa atestación concordante. No requiere migraciones ni cambios de Supabase.

Rollback: GitHub Actions → Publicar interfaz Atry Turnos → Run workflow → `source_ref=rollback/pre-iatry-phase-one-2026-10-28` (o el SHA completo anterior). No revierte datos: las dos ausencias autorizadas se conservan. La etiqueta es local; debe publicarse/verificarse antes del despliegue. No se hizo push en esta etapa.

Para ampliar después: hacen falta sesiones de encargado y empleado con asignaciones correctas, y propietario de negocios Individual y Pro en un entorno autorizado. Hoy no existen en este proyecto. No hace falta crear esa infraestructura para publicar el alcance acotado de propietario/Negocio; no se propone alterar suscripciones para simularlo. La edición de contactos con efectos en recurrencias seguirá bloqueada hasta disponer de propuesta y relectura de esos efectos homologadas.
