# Atry Turnos — Puerta a producción

Este documento distingue **lo que tenemos** de lo que debe aprobarse **antes de comercializar el servicio**. No confundir una preview local funcional con una plataforma auditada y mantenida.

## P0 — Obligatorio antes de usar datos reales de clientes

1. **Migrar de SQLite a PostgreSQL administrado** con migraciones versionadas, soporte de restricciones de exclusión (`tstzrange`) para garantizar que un profesional no tenga turnos activos superpuestos, e índices adecuados. SQLite es aceptable en un entorno local y piloto muy controlado, pero no es la propuesta final multiinstancia.
2. **Alojamiento seguro** del backend (ASP.NET Core o Node tras decisión definitiva) y frontend; TLS, dominio, CI/CD, ambiente staging, secretos gestionados fuera del repositorio, copias automáticas cifradas, restauración ensayada, métricas y alertas.
3. **Autenticación completa**: verificación de correo, recuperación de contraseña, políticas de sesiones, bloqueo/rate limits distribuidos, MFA opcional para administradores, invitación y revocación de colaboradores, cierre de todas las sesiones.
4. **Autorización por empleado y funciones**: definir permisos finos; miembro staff solo debe ver/modificar su agenda conforme a las reglas del negocio. En la preview hay tres roles de backend, pero no se ofrece gestión integral de colaboradores ni autorización de mínimo privilegio a nivel de registro.
5. **Privacidad y cumplimiento uruguayo**: inventario de datos, fines y bases legales, textos de privacidad, procesamiento de cancelaciones, borrado/restricción cuando legalmente corresponda, retención, seguridad, protección de datos y deberes según Ley 18.331 y normas relacionadas. Revisar con asesoramiento pertinente.
6. **Revisión profesional de seguridad**: pruebas de acceso multiempresa, inyecciones, XSS, CSRF, abuso de reservas, fraude, enumeración de enlaces, robo de tokens y cambios de configuración. Implementar WAF y rate limiting duradero por endpoint, y política anti-spam de turnos.
7. **Reglas horarias**: abstraer la zona horaria, contemplar cambios de horario de verano en países a los que se expanda, feriados, intervalos partidos, sedes, recursos compartidos, reservas que crucen medianoche y actualización de precios. Hoy se fija `America/Montevideo` (UTC−03).
8. **Mensajería real**: integrar proveedor transaccional para confirmación y aviso de cancelación; servicio worker de cola con reintentos, idempotencia, estado de entrega, baja de notificaciones comerciales y registro de consentimientos. Hoy **todos los mensajes quedan pendientes en base**.
9. **Gestión de datos**: migraciones, políticas de eliminación, respaldo/restauración, registro de incidentes, límites de almacenamiento y exportación. El CSV actual incluye datos personales y debe manejarse con cuidado.
10. **Pruebas de carga y accesibilidad**: miles de clientes concurrentes, latencias, fallos de dependencias, mobile 320–390px, teclado, lector de pantalla, contraste, WCAG 2.2 AA como objetivo.

## P1 — Cobros y lanzamiento comercial

- **Mercado Pago para anticipos de comercios**: onboarding OAuth del vendedor; no custodiar fondos; órdenes asociadas a `business_id` y `booking_id`; reserva provisional que expira; evitar colisiones; webhooks firmados/verificados e idempotentes; estados de pago y devolución; conciliación y errores.
- **Suscripciones de Atry**: relación entre contrato, plan, estado y período de facturación; facturación legal, renovaciones, recordatorios de deuda, reintentos y bloqueo proporcional a vencimientos. No activar ni suspender basándose en una redirección del navegador.
- **Planes y límites**: en la preview se limita la cantidad de profesionales activos (Individual 1, Negocio 5, Pro 10, Trial 5). Agregar límites transparentes de recursos, uso, funciones y comunicaciones. Los cambios de plan deben preservar el historial.
- **Entrega automática de correos/WhatsApp**, plantillas revisadas, consentimiento y costos medidos. El canal WhatsApp oficial suele tener costos por categoría/mercado; no vender mensajes ilimitados sin presupuestar.
- **Soporte y operaciones**: página de estado, seguimiento de incidencias, respuesta a bajas, cambios de dominio, reembolsos, capacitación y monitoreo de cancelaciones.

## P2 — Diferenciación Atry

- SmartSlots 2.0: reglas de consolidación de huecos, buffers por recurso, sugerencia de horarios según utilización sin alterar reservas existentes.
- Lista de espera con ofertas expiran y bloqueo provisional; prioridad justa, consentimiento e idempotencia. Actualmente crea ofertas **sin bloquear el slot** y no las envía.
- Reprogramación de clientes desde enlace privado con el mismo motor seguro; hoy solo la tiene el panel del comercio.
- Sincronización opcional con Google Calendar (conflictos externos, límites de sincronización y permisos explícitos).
- Reserva recurrente, combos de servicios, descuentos, paquetes, cupones, tarjetas regalo, multi-sucursal, inventario ligero cuando se justifique.
- Asistente conversacional opcional, siempre supervisado por el motor de disponibilidad; prohibir que la IA confirme reservas por su cuenta.
- Importación de archivos CSV de competidores, validación y mapeo asistidos; exportar en formatos abiertos.
- Métricas de negocio de verdad: conversión de visitantes a reservas, tiempo ahorrado, ausencias prevenidas, retención y seguimiento de cohortes.

## Diseño recomendado de repositorios / despliegue definitivo

```text
AtryAgency (marketing corporativo)
    └── botón Atry Turnos ──> AtryTurnos (repo privado independiente)
                                   ├── /apps/web  React + TypeScript + PWA
                                   ├── /apps/api  ASP.NET Core + EF Core
                                   ├── /packages/contracts  DTO / OpenAPI
                                   ├── /ops  Docker + deploy + monitoring
                                   └── PostgreSQL administrado + cola + jobs
```

La entrega actual Node/SQLite es una preview plenamente ejecutable para validar, no una promesa de que la migración a este stack ya esté terminada.

## Criterios de salida para piloto controlado

- 0 confirmaciones duplicadas en pruebas paralelas y estrés.
- Restauración completa de copia de seguridad probada.
- 0 accesos cruzados entre negocios en pruebas automatizadas.
- Envíos y pagos reales comprobados con sandbox y después con importes pequeños autorizados.
- Calendarios y cancelaciones consistentes con distintos husos horarios cuando se activen.
- Términos y privacidad disponibles, consentimiento y asistencia para derechos de datos.
- Flujos completos en celular, con mensajes de error accesibles y sin pérdida de formularios.
- Observabilidad de errores y métricas operativas en producción.

## Riesgos conocidos de esta preview

- Uso de la API nativa `node:sqlite`; su estado depende de la versión de Node y puede advertir sobre experimentalidad en Node 22.
- El archivo de base de datos local requiere copia consistente durante ejecución. No copiarlo a ciegas como método de respaldo productivo.
- No se envían notificaciones fuera del servidor. No confundir `queued` con `sent`.
- El endpoint de administración cambia estados de planes **manualmente** y no prueba ningún pago.
- La visualización de ingresos registra precios de turnos completados, **no caja conciliada, facturación ni ingresos cobrados**.
- No se entregó auditoría externa de seguridad, prueba visual automatizada completa ni test de carga productiva.
# Estado tras Misión 001

Ver `MISION_001.md` para el alcance actual. El arranque con NODE_ENV=production exige PUBLIC_URL HTTPS y rechaza SEED_DEMO y las cuentas conocidas de demostración. SQLite requiere una sola instancia y volumen persistente. Las colas de recuperación/reservas/ofertas todavía necesitan proveedor y worker de envíos. No hay cobros externos ni garantías de aptitud productiva.


## Actualización Misión 002 (versión 1.2.0)

Este apartado prevalece sobre limitaciones históricas de Misión 001. Empleados pueden operar reservas de su profesional vinculado. Hay correo local/SMTP, SSE, mes completo, descansos, excepciones, feriados y recursos exclusivos. Consultar MISION_002.md y NOTIFICACIONES.md para límites reales. No hay publicación, pagos ni entrega SMTP externa verificada.
