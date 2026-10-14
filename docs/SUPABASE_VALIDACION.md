# Validación real de Supabase — 14 de octubre de 2026

Proyecto exclusivo: `djoxdtloqwbrhgtgencc`, ATRY-Turnos. No se intervino ATRY LAB Operaciones.

Migraciones 007–014 aplicadas y auditadas. El registro privado contiene las ocho versiones y hashes SHA-256 coincidentes con los archivos. Cero tablas públicas/privadas sin RLS. Usuarios anónimos no pueden crear organizaciones; clientes autenticados no pueden invocar directamente la reserva pública; el servicio protegido sí tiene ese permiso.

El editor duplicó el lote durante la preparación. La primera transacción se completó; el guard de versiones detuvo la segunda. Se auditó el estado con una consulta nueva, sin reejecutar migraciones. Para lotes posteriores se usa siempre un editor nuevo y vacío.

Prueba real mediante GoTrue y PostgREST, con dos cuentas temporales y JWT emitidos por Supabase:

- Creación de identidades de prueba por la API de administración y acceso con contraseñas aleatorias. No se enviaron correos externos.
- Metadatos `platform_admin` y `role` no otorgan privilegios en la aplicación.
- Cada cuenta crea su organización mediante RPC y solo puede leer esa organización bajo RLS.
- RPC de catálogo rechaza el ID de una organización ajena.
- La revocación elimina inmediatamente el acceso privado del JWT previo y no afecta la otra cuenta.

Limpieza autorizada de los fixtures de esa ejecución: comprobación de IDs, marcas de integración y ausencia de datos operativos inesperados; eliminación de perfiles/organizaciones y de sus identidades Auth. Resultado remoto final: usuarios=0, negocios=0, reservas=0, identidades Auth=0. SQLite y respaldos conservados.

Las credenciales de servidor se guardan exclusivamente bajo `data/cloud-private/`, excluido de Git. Nunca se incluyen en la interfaz, el build ni este informe. Los manifiestos privados de pruebas no se publican; sus contraseñas se retiran tras la limpieza.

Todavía faltan pruebas reales de confirmación de correo/recuperación, empleados/invitaciones, reservas concurrentes, Realtime y recorridos del navegador. Las migraciones 015–022 ya se aplicaron y sus ocho hashes coinciden; se verificó RLS en todas las tablas y acceso de escrituras privado/por rol. Estos resultados no certifican todavía el producto completo online.

## Segunda ejecución de integración (todavía en curso)

Tres identidades temporales y dos negocios genéricos. Aprobados remotamente: equipo verificado/rol empleado, aislamiento, concurrencia real sobre un profesional y sobre un recurso compartido, idempotencia, protección de reservas ante cambios de servicios, reserva pública por RPC del servicio, gestión privada, cancelación repetida y reprogramación; panel, Insights, preferencias, notificaciones, auditoría y exportación. Realtime recibió revisiones propias y ninguna de la organización ajena. Se corrigió la autenticación explícita del websocket con JWT. El formulario del navegador creó una reserva real de prueba, visible después en la agenda. Los fixtures de esta segunda ejecución siguen pendientes de limpieza autorizada al finalizar las pruebas; no se presenta el estado actual como producción vacía.

Las funciones atry-public y atry-mail están desplegadas. La pública requiere configuración real y responde PUBLIC_NOT_CONFIGURED (503) mientras falte; el worker mantiene la verificación JWT y no tiene entrega habilitada. No se enviaron mensajes externos.
