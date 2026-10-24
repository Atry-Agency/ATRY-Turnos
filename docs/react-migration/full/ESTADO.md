# Migración integral — trabajo en curso

Referencia local conservada: `c626238`. Rama de trabajo: `feature/react-migration`.

Este documento es un registro intermedio, no una entrega ni una declaración de migración completa.

## Implementado en React

Servicios; Clientes y ficha/historial; Inicio; Turnos fijos; Lista de espera; estadísticas básicas; oportunidades de agenda; Comunicación; estadísticas avanzadas/incidencias; Primeros pasos; Notificaciones; Horarios (semana, fechas, cierres, ausencias, recursos y asignaciones); horario propio; Soporte; Usuarios y accesos; Equipo y fotografías; Mi plan y acceso.

Diálogos nativos: servicio, cliente, reserva manual desde ficha/Inicio, turno fijo, fin de recurrencia, compositor y configuración WhatsApp, editor semanal y copia de tramos, reglas de disponibilidad, recursos, invitaciones y rol.

Las pantallas se cargan por módulos diferidos. El adaptador temporal usa la API y caché existentes y verifica sesión, negocio y generación antes de publicar respuestas. Los formularios conservan borradores ante errores y bloquean operaciones simultáneas. La API sigue siendo autoridad de permisos, disponibilidad, planes y conflictos.

## Validación ya ejecutada

- Compilación TypeScript/Vite aprobada.
- Regresión existente: 241 pruebas aprobadas (repetidas tras Horarios, Equipo y Suscripción).
- 21 pruebas React/datos/presentación semanal aprobadas en el último registro unitario.
- Clientes: 7 comprobaciones funcionales y 30 pares de capturas (3 planes, 5 anchos, lista/ficha).
- Inicio y primeras pantallas: 35 pares de capturas.
- Comunicación, Primeros pasos, estadísticas avanzadas: 15 pares.
- Notificaciones: 10 pares.
- Horarios: 15 pares.
- El análisis de 155 pares detectó un problema de ajuste móvil en Accesos, corregido extendiendo el selector CSS a los botones React. La repetición de capturas está en curso. Las diferencias de píxeles están registradas en `evidence/pixel-audit.json`; no equivalen por sí solas a aprobación visual final.
- Operaciones demo: agregar/quitar/copiar/guardar semana, cierre, recurso, rechazo de preferencias de correo conservando borrador y confirmación de salida.
- HTTP/SQLite efímero: preferencias y recursos persistidos, conflicto real de jornada HTTP409 con borrador intacto, incidencia de Soporte persistida. Sin worker ni envío externo.
- Equipo: optimización PNG ficticio → WebP, visibilidad, revisión, eliminación y CRUD de profesionales aprobados.
- Suscripción: 15 pares y simulación de solicitud en móvil aprobada.
- Accesos, Soporte y horario propio: 20 pares; Equipo: 15 pares.

La demo mantiene el bloqueo permanente de envíos y de reservas públicas. Las pruebas HTTP usan SQLite en memoria y un servidor efímero, sin Supabase ni correo externo.

## Pendiente obligatorio

Agenda completa y sus interacciones; Configuración y Apariencia; Cuenta y seguridad; completar validación HTTP de solicitudes comerciales y accesos; autenticación/registro/recuperación; todos los recorridos públicos y visitas; consola administrativa; landing/showcase. Retirar shell/router/controladores UI heredados y el puente temporal; distribución React autónoma; pruebas completas de roles/planes/temas/errores, accesibilidad, rendimiento y evidencias finales. Informe y PDF con capturas incrustadas. Mapear reutilización futura de IAtry sin integrarlo.

Actualmente la vista previa todavía carga el shell JavaScript y el puente de demo. No es todavía una aplicación React independiente. Main e IAtry no son directorios de edición de esta migración. No hubo publicación, merge, push ni migración remota.
