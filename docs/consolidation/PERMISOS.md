# Consolidación de permisos de IAtry — 28/10/2026

Base publicada: `9e0f1a8`. Este frente no modifica código de permisos, Supabase, cuentas, membresías ni suscripciones. Reutiliza la homologación y los ensayos autorizados de la primera etapa; no confunde las pruebas locales con sesiones reales.

## Matriz definitiva del alcance publicado

| Rol autenticado | Individual | Negocio | Pro |
|---|---|---|---|
| Propietario | Bloqueado: falta homologación con sesión real | **17 herramientas** en su negocio autorizado | Bloqueado: falta homologación con sesión real |
| Encargado | Bloqueado | Bloqueado: falta sesión real | Bloqueado |
| Empleado | Bloqueado; sin contrato administrativo habilitado | Bloqueado; sin contrato administrativo habilitado | Bloqueado; sin contrato administrativo habilitado |

No existe restricción a Pelu en el alcance publicado propietario/Negocio. Se exige coincidencia entre negocio de sesión y AppPort, rol propietario, plan exactamente `negocio`, proyecto Supabase correcto y sesión vigente. Un plan superior (`pro`) no implica permiso de IAtry en esta fase. Las RPC existentes mantienen autorización por negocio y rol: el frontend no concede privilegios de servidor.

Las 17 herramientas son: siete de servicios (`list/create/price/duration/details/publish/hide`), cuatro de clientes (`create/update/search/history`), cuatro de horarios (`read/day/absence/blocks`), `team.list` y `business.statistics`. La edición de clientes solo permite notas; identidad, contacto y marketing continúan bloqueados. Ausencias incluye intervalos, días completos y vacaciones multidía dentro de la misma herramienta. Reservas, correos, notificaciones, creación de equipo y las dos incompatibles permanecen fuera.

`accessEnabled=false` bloquea las diez herramientas de escritura y conserva siete lecturas autorizadas: comportamiento de acceso existente, sin ampliación. La revocación/cambio de sesión, usuario, negocio, rol o versión invalida el contexto previo antes de ejecutar. Si estadísticas no está disponible según entitlements, tampoco se ofrece esa lectura: no se transforma un fallo de feature en permiso.

## Evidencia conservada

- Ensayos reales documentados: propietario/Pelu/Negocio, servicios y clientes (creación/notas), semana y pausa recurrente con restauración, ausencias horaria/completa/multidía y consultas correspondientes. Ver `docs/iatry-phase-one/CIERRE.md` y `ENTREGA.md`.
- Las 114 observaciones PostgreSQL/adaptador previas cubren propietario/encargado × tres planes y el rechazo esperado de estadísticas Individual, autorización, aislamiento y límites 1/4/10. No se repitieron porque este frente no cambia contratos.
- Inventario real previo de membresías: dos propietarios con Negocio; no hay encargado/empleado/Individual/Pro disponibles para homologar. No se alteraron datos para fabricar esos perfiles.
- Límites configurados del producto: Individual 1 profesional, Negocio 4 y Pro 10. La primera etapa no incorpora profesionales: no puede ampliar ni saltar esos límites.

## Verificación adicional enfocada

Ejecutar desde la raíz del repositorio:

```sh
node scripts/react/iatry-consolidation-permissions-test.cjs
```

Resultado: **33 casos aprobados, cero llamadas de transporte**. Bundle temporal fuera de `frontend/dist`, eliminado al finalizar. Comprueba lista exacta de 17, los nueve pares rol/plan, denegación de contextos caducados o cambiados, suspensión de escrituras, feature de estadísticas, proyecto equivocado, rutas materializadoras y capacidades fuera de etapa. No realiza peticiones ni usa datos productivos.

No se declara homologación real adicional por pasar estos casos. La estética, los componentes y los permisos publicados permanecen intactos.

## Propuesta mínima para cerrar perfiles pendientes

No hace falta crear infraestructura para conservar propietario/Negocio publicado. Para ampliar, primero obtener sesiones **ya existentes** de un entorno ficticio autorizado:

1. Propietario de Individual y propietario de Pro: sesiones normales de dos negocios de prueba con esos planes reales y sin alterar suscripciones. Comprobar identidad, entitlements, herramientas y alcance con lecturas; cualquier ensayo de escritura requerirá aprobación separada con registros exactos.
2. Encargado de un negocio ficticio con Negocio y empleado con profesional asignado: sesiones normales existentes. Validar contratos y denegaciones, sin conceder permisos extra al empleado. Si no existen estas cuentas, presentar su creación y asignación como autorización independiente; no ejecutarla implícitamente.
3. Para declarar homologado encargado en Individual o Pro, necesitan sus sesiones y negocios correspondientes: una sesión Negocio no prueba los otros planes.

Pueden reutilizarse cuentas de ensayo que ya tengan varias membresías correctamente autorizadas; no es necesario exigir cuatro cuentas nuevas. Hoy no hay esas membresías en el inventario conocido. No se solicita ni recibe ninguna contraseña en el chat. Mantener cada celda bloqueada hasta disponer de evidencia correspondiente; estos pendientes no impiden ofrecer comercialmente el alcance propietario/Negocio ya aprobado.
