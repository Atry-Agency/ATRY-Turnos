# Atry Turnos — entrega integrada de Misión 001

## 1. Auditoría inicial

La aplicación existente usa Node.js 22.13+, SQLite integrado, API HTTP y una interfaz JavaScript/HTML/CSS. No tiene dependencias de terceros. Había registro, sesiones con scrypt y cookies HttpOnly, servicios, profesionales, horarios, ausencias, reservas públicas/manuales, cancelación, reprogramación administrativa, clientes, exportación, auditoría, Insights por reglas y administración de planes. Siete pruebas de integración cubrían el núcleo.

La entrada principal era una landing promocional con métricas ficticias de presentación. El login exponía credenciales de demo. Los empleados podían consultar datos generales del negocio; el administrador de plataforma podía saltarse la membresía. La lista de espera generaba mensajes sin un mecanismo privado para aceptar. La interfaz usaba verde en lugar de la identidad azul/cian verificada. Los estilos inline necesarios para gráficos y colores estaban bloqueados por CSP.

## 2. Correcciones

- Se retiró la función de marketing y sus rutas se resuelven a acceso o panel. La raíz respeta la sesión y el rol; los enlaces públicos continúan abiertos sin cuenta.
- Se retiraron las credenciales públicas de la pantalla de acceso. El arranque en producción exige PUBLIC_URL HTTPS y rechaza bases con las cuentas demo conocidas.
- Los empleados solo consultan reservas del profesional vinculado. No reciben clientes completos, notas internas generales, estadísticas, equipo, auditoría ni exportaciones. Las modificaciones operativas son de propietarios/encargados.
- La administración de plataforma mantiene sus rutas administrativas, pero necesita membresía para entrar a información privada del negocio.
- Preparación y limpieza deben entrar en la jornada, y el motor rechaza fechas normalizadas inválidas y segundos fuera de minutos completos.
- Las respuestas de cancelación/reprogramación pública no exponen notas internas, contactos completos ni hashes de gestión.
- Una reserva pública no sobrescribe los datos de contacto de un cliente existente.
- SQLite incorpora controles de pertenencia al insertar reservas y triggers contra superposiciones al insertar/actualizar.
- Se corrigió la caché de recursos para ver las actualizaciones de la aplicación. CSP conserva scripts externos al HTML y permite atributos de estilo para los componentes existentes.

## 3. Identidad visual y procedencia

Referencias inspeccionadas mediante el conector GitHub, sin modificarlas:

- [WebAtryLab/styles.css](https://github.com/Atry-Agency/WebAtryLab/blob/main/styles.css): fondo claro, superficies blancas, azul #00a5e2, cian #00cbe6, tarjetas redondeadas, bordes suaves, Eurostile y variantes extendidas.
- [ATRYLab-Administracion/src/styles.css](https://github.com/Atry-Agency/ATRYLab-Administracion/blob/main/src/styles.css): fondo #f5f7f7, navy #071a21, cian #10bde1, navegación lateral y superficies claras.

Los recursos originales se localizaron en `C:\Users\rodri\Archivos locales\Escritorio\ATRY\01_IDENTIDAD_DE_MARCA\FUENTE_ORIGINAL`. Se inventariaron manual, variantes de logo y tipografías. Solo se copiaron `assets/brand/logotipo-color.png` y `assets/brand/favicon.png` a `web/assets/brand/`; los originales permanecen intactos. El símbolo se usa como imagen, sin redibujarlo ni alterar su proporción. Los tokens y componentes adaptados están en `web/product.css`.

Se usa la fuente del sistema para texto operativo. Las referencias usan Eurostile, pero la licencia de distribución web de los archivos originales no se verificó; no se incluyeron esos archivos. La identidad aplicada conserva colores, símbolo, jerarquía, navegación y formas del ecosistema. No se añadió ninguna biblioteca ni licencia externa.

## 4. Funcionalidades realmente implementadas en esta entrega

- Entrada de aplicación, configuración inicial progresiva de negocio/servicios/disponibilidad y finalización persistida.
- Selector entre organizaciones de la cuenta.
- Sistema visual común, tarjetas responsive, estados, skeleton de entrada, foco en campos, labels asociados, modales con nombre accesible y control de teclado.
- Agenda diaria y calendarios por tarjetas de 7/31 días, filtro por profesional y actualización manual. La vista de 31 días es un período móvil, no un calendario mensual alineado de lunes a domingo. No hay arrastrar y soltar.
- SmartSlots: hasta tres alternativas por servicio para una fecha, obtenidas del motor real. No retiene horarios ni usa IA.
- Búsqueda de clientes por nombre/contacto e historial de reservas en su ficha.
- Carga de logo del negocio PNG/JPEG/WebP de hasta 90 KB y visualización pública.
- Vinculación de cuentas ya registradas al equipo, por propietario: encargado o empleado ligado a un profesional. No hay invitaciones por email ni alta de cuenta independiente del registro de negocio.
- Recuperación: solicitud con respuesta genérica, límite por IP, token con hash, vencimiento a 30 minutos, uso único y revocación de sesiones al cambiar contraseña. El enlace queda en `system_outbox`; el envío NO está operativo sin proveedor.
- Reprogramación pública con enlace privado, política temporal y validación real. Conserva profesional; la persona consulta horarios disponibles y propone nueva fecha/hora.
- Ofertas privadas de espera que vencen a los 30 minutos. La aceptación y la reserva se confirman en una sola transacción. El horario no se retiene; una oferta puede quedar indisponible si otra persona reserva primero. El token se entrega en la cola de notificaciones, no por correo externo.
- Estado de integraciones visible en administración general, sin información privada de clientes.
- Copia consistente mediante `scripts/backup.js`, verificación de datos originales mediante `scripts/verify-data.js` y cambios de esquema aditivos.

## 5. Funcionalidades conservadas

Registro de negocios, login/logout, sesión persistente, reservas sin cuenta, asignaciones de servicios, precios/duración/buffers, jornadas, ausencias/bloqueos, cancelación, reprogramación del panel, estados de reserva, lista de espera, notas de clientes, exportación de reservas, auditoría, estadísticas basadas en datos y administración manual de planes. Los turnos anteriores no se borraron ni se recrearon.

## 6. Arquitectura que quedó funcionando

Frontend SPA sin compilación + API Node + SQLite WAL. `server/product.js` contiene los nuevos módulos y se registra desde `server/app.js`. `server/booking.js` sigue siendo el motor de disponibilidad y transacciones. `server/db.js` crea/adapta el esquema de forma aditiva y registra su versión. `web/product.css` contiene tokens y adaptaciones de producto.

Se mantuvo esta arquitectura para preservar datos y reglas probadas. React/TypeScript, ASP.NET Core y PostgreSQL siguen siendo una posible evolución, no están implementados ni son necesarios para ejecutar esta entrega local. SQLite funciona en una instancia con volumen persistente; no se propone como despliegue horizontal multiinstancia.

## 7. Verificaciones y resultados

`npm test`: 13 pruebas aprobadas. Cubre registro/autenticación/aislamiento, reservas/cancelación/conflictos, horarios/exportación/auditoría, validaciones, espera, límites por plan, concurrencia de reservas, recuperación/revocación, permisos de empleados/admin, onboarding/SmartSlots/recursos, aceptación concurrente de ofertas, persistencia al reconectar una base temporal, buffers dentro de jornada y métricas sin incluir turnos futuros como actividad histórica.

`node --check web/app.js` y verificación de sintaxis del backend sin errores. `scripts/verify-data.js` comparó todos los IDs originales contra la copia previa: 2 usuarios, 1 negocio, 3 profesionales, 4 servicios, 9 clientes y 9 reservas conservados. `PRAGMA integrity_check`: ok. La copia está en `data/backup-mision001.sqlite`, dentro de la carpeta de datos ignorada.

La revisión visual se hizo en navegador: login demo, panel, agenda diaria/semanal, búsqueda y ficha de clientes, configuración, SmartSlots y reservas públicas. Se inspeccionó ancho móvil 390 px y escritorio; no equivale a pruebas en dispositivos físicos iPhone/Android. Los casos de API de registro/reserva usan SQLite en memoria o bases temporales, sin sustituir la base del usuario.

## 8. Integraciones pendientes

Mercado Pago de suscripciones y cobros a clientes, webhooks verificados, conciliación, señas con retención y vencimiento, proveedor de correo, worker de recordatorios/reintentos/idempotencia de envíos y WhatsApp oficial. Ningún cobro externo se marca exitoso ni ningún mensaje en cola se presenta como enviado.

## 9. Qué falta para producción y orden propuesto

1. Despliegue HTTPS, gestión de secretos, monitoreo, backups programados y prueba de restauración; políticas de privacidad/consentimiento revisadas para el negocio real.
2. Proveedor de email y worker con deduplicación, reintentos, estados de entrega y retención/limpieza de tokens y colas. Recuperación e invitaciones deben probarse de extremo a extremo con ese proveedor.
3. Administración de membresías: revocar/cambiar roles, invitaciones y cuenta sin negocio; múltiples negocios creados desde una misma cuenta.
4. PostgreSQL con migraciones versionadas, restricciones de rango, plan de importación y pruebas multiinstancia antes de escalar. La versión actual tiene migración aditiva básica, no un historial completo de rollback.
5. Pagos reales separados por comercio/plataforma y verificación de webhooks. No habilitar cobros simulados.
6. Recursos compartidos, descansos recurrentes, feriados a nivel negocio, excepciones de jornada y zonas horarias con DST. La zona admitida continúa siendo America/Montevideo. Los descansos se pueden bloquear por fechas con ausencias; no existe recurrencia automática.
7. Agenda con sincronización entre usuarios, meses completos y mejor búsqueda de horarios en reprogramación pública. Actualmente requiere actualizar para cambios de otros usuarios.
8. Sistema de soporte/incidencias, funcionalidades y límites configurables por plan, métricas operativas completas y alertas. Administración actual gestiona planes/estados y muestra integraciones; no incluye mesa de ayuda.
9. Idempotencia de solicitudes públicas, pruebas de carga, E2E automatizado completo, auditoría de seguridad/accesibilidad y dispositivos reales. No se certifica aptitud comercial ni cumplimiento legal a partir de estas pruebas locales.

## 10. Ejecutar y probar

Node 22.13 o superior. `npm start` conserva los datos existentes y abre el servicio en http://localhost:3300. No se requiere instalar dependencias. `npm test` ejecuta las pruebas aisladas.

Para una demo NUEVA local: en PowerShell, `$env:SEED_DEMO='1'` y `npm start`. La base actual ya contiene la demo, no requiere recargarla. Acceso local: demo@atryturnos.test / AtryDemo2026!; administración: admin@atryturnos.test / AtryAdmin2026!. Producción rechaza estas cuentas conocidas.

Prueba del usuario: iniciar sesión, configurar datos, crear servicio/asignar profesional, ajustar horario, abrir `/#/reservar/estudio-sofia`, elegir servicio/horario, reservar y guardar el enlace privado. Probar cancelación/reprogramación desde ese enlace. En el panel, revisar agenda, cliente y mensajes en cola. El correo y los pagos requieren la integración indicada arriba.

Backup: `node scripts/backup.js data/backup-fecha.sqlite`. Usar un nombre nuevo; no sobrescribe una copia anterior. No copiar únicamente el archivo SQLite mientras está en WAL activo. La restauración debe hacerse con servidor detenido y una copia adicional de los datos actuales, sin reemplazar bases a ciegas.

Las variables de `.env.example` son orientativas; el servidor lee variables del proceso y no carga automáticamente un archivo `.env`.
