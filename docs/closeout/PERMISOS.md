# Cierre de permisos de las 17 herramientas — 29/10/2026

Base `9c65b17`. Sin ampliación de permisos publicados, cambios de Supabase, nuevas cuentas ni alteración de suscripciones. No se modifica la política de producción: ya prepara todos los perfiles en el entorno local acotado y mantiene el gate real aprobado propietario/Negocio.

## Matriz herramienta × rol × plan

**R** = homologación real existente y habilitada para propietario/Negocio. **L** = funcionalidad local probada; bloqueada en producción por falta de sesión real correspondiente. **—** = no disponible según alcance/contrato. La columna empleado abarca los tres planes.

| Herramienta | Propietario Individual | Propietario Negocio | Propietario Pro | Encargado Negocio | Encargado Pro | Empleado |
|---|---|---|---|---|---|---|
| services.list | L | R | L | L | L | — |
| services.create | L | R | L | L | L | — |
| services.price | L | R | L | L | L | — |
| services.duration | L | R | L | L | L | — |
| services.details | L | R | L | L | L | — |
| services.publish | L | R | L | L | L | — |
| services.hide | L | R | L | L | L | — |
| customers.create | L | R | L | L | L | — |
| customers.update — solo notas | L | R | L | L | L | — |
| customers.search | L | R | L | L | L | — |
| customers.history | L | R | L | L | L | — |
| schedule.read | L | R | L | L | L | — |
| schedule.day | L | R | L | L | L | — |
| schedule.absence | L | R | L | L | L | — |
| schedule.blocks | L | R | L | L | L | — |
| team.list | L | R | L | L | L | — |
| business.statistics | — | R | L | L | L | — |
| Total preparado | 16 | 17 | 17 | 17 | 17 | 0 |

Las ausencias horaria, completa y multidía son variantes de `schedule.absence`, no herramientas extra. Los encargados Individual también permanecen bloqueados; no se propone homologarlos en este cierre. Los contratos locales permiten 16 herramientas en ese perfil, pero eso no constituye una concesión productiva ni un nuevo alcance solicitado.

## Reglas que se conservan

- Individual: límite real del contrato de un profesional, estadísticas deshabilitadas. Negocio: cuatro profesionales. Pro: diez. `team.list` consulta equipo, no crea profesionales ni amplía esos límites.
- Propietario/Negocio puede operar en cualquier negocio donde sea propietario autorizado; no hay ID fijo de Pelu en el gate publicado. AppPort y RPC aplican negocio/rol, además de los controles de la interfaz.
- Edición de clientes: exclusivamente notas en el alcance real; nombre, correo, teléfono y marketing siguen bloqueados por los efectos de contactos sobre recurrencias.
- Cada escritura exige propuesta, confirmación explícita, sesión vigente, contrato existente, una ejecución y relectura. Cambiar sesión/negocio/rol invalida el contexto.
- `accessEnabled=false` bloquea diez escrituras y conserva siete lecturas autorizadas conforme al comportamiento vigente. Estadísticas además requiere su feature.
- Reservas, cancelaciones, envíos, creación de equipo y las dos incompatibles siguen fuera. Empleados no obtienen permisos administrativos.

## Evidencia y prueba enfocada de cierre

Se conservan los **114 resultados** PostgreSQL/adaptador anteriores y sus verificaciones de confirmación, duplicación, relectura, aislamiento, rechazo de escrituras de empleado y sobrecupo 1/4/10. Ensayos reales de servicios, clientes/notas, semana con pausa/restauración y ausencias siguen siendo evidencia propietario/Pelu/Negocio, no evidencia de otros roles/planes. Referencias: `docs/iatry-phase-one/CIERRE.md`, `ENTREGA.md` y `docs/consolidation/PERMISOS.md`.

Nueva ejecución:

```sh
node scripts/react/iatry-closeout-permissions-test.cjs
```

**34 comprobaciones aprobadas**: nueve combinaciones rol/plan, cinco perfiles de preparación (propietarios Individual/Negocio/Pro y encargados Negocio/Pro), diez lecturas RPC del adaptador cloud existente sobre PGlite aislado; entitlements 1/4/10 y estadísticas de Individual desactivadas; cero notificaciones/correos y cero peticiones externas. El bundle se crea en una carpeta temporal eliminada al finalizar; no modifica `frontend/dist`. Solo los fixtures de memoria cambian de plan, no suscripciones reales. La lista publicada continúa exactamente en 17 para propietario/Negocio y cero para los demás perfiles.

## Acceso real mínimo faltante

El inventario conocido solo contiene propietarios Negocio. Para cerrar las otras cuatro columnas L hacen falta sesiones normales existentes de: propietario de un negocio ficticio Individual; propietario de uno Pro; encargado de un negocio ficticio Negocio; encargado de uno Pro. Pueden ser las mismas personas con varias membresías correctas: no se requieren cuatro cuentas nuevas. Para verificar una denegación real de empleado hace falta además una sesión existente con profesional asignado.

Primero se comprueban identidad, entitlements y lecturas no materializadoras. Cualquier escritura real necesita una propuesta separada de registros y campos autorizados; disponer de una sesión no autoriza ensayos nuevos. Si esas membresías/negocios no existen, su creación requiere autorización concreta aparte. No se alteran planes, suscripciones ni permisos para simularlos. Ninguna contraseña debe enviarse al chat.

**Decisión:** propietario/Negocio conserva su alcance publicado. Los otros perfiles están preparados localmente y permanecen bloqueados hasta homologación real; estos pendientes no justifican bloquear el uso comercial del alcance ya autorizado.
