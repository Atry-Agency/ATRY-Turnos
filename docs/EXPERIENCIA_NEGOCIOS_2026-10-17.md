# Experiencia del negocio — 17 de octubre de 2026

## Cambios entregados

- Navegación abreviada, con iconos y selección curva. El sidebar conserva desplazamiento por rueda, táctil y teclado, sin barra visible.
- Configuración agrupa negocio, notificaciones y accesos según capacidades, y plan/suscripción. Mi cuenta separa perfil, seguridad/sesiones y negocios.
- Configuración inicial destacada y recorrido por identidad, servicios y horarios, con revisión explícita antes de finalizar.
- Horarios permite hasta seis tramos por día, días cerrados, copia entre días, resumen semanal y fechas/ausencias. Guarda semana y pausas de forma atómica y rechaza cambios que invaliden reservas activas existentes.
- Las jornadas especiales reemplazan el horario base de una fecha; las pausas semanales siguen aplicando. Para pausas puntuales se agregan bloqueos, incluso varios en la misma fecha.
- Notificaciones muestra preferencias operativas y consumo real del negocio. Solo aparece si el plan incluye correo; lista de espera también requiere su capacidad. No se añadió edición de plantillas ni WhatsApp automático.
- Plan presenta capacidades, fechas y cuota reales; comparación y solicitudes de mejora/cambio sujetas a aprobación manual de Atry. Los negocios pendientes no presentan la prueba interna como un plan contratado.
- Crear otro negocio quedó dentro de Mi cuenta > Mis negocios, con explicación y aceptación explícita: cada espacio requiere contratación y habilitación propias. No comparte suscripción ni cupos.

## Validación

`npm test`: 134 pruebas aprobadas, cero fallos y cero omitidas. Incluye PostgreSQL, API local, disponibilidad real entre tramos, rechazo de superposiciones, reservas existentes, rollback y aislamiento de usuarios/planes.

Interfaz local: guardado de 09–11, 14–15 y 17–18; copia entre días y cancelación sin guardar; notificaciones persistentes; creación de segundo negocio pendiente; Individual con horarios propios y sin equipo, recursos ni notificaciones; vista de 390 px sin desbordamiento horizontal.

Supabase: exclusivamente proyecto `djoxdtloqwbrhgtgencc`. Migración `202610170040` aplicada con comprobación de versión previa, hash y conteos. SHA-256: `ada4af055ce91376a6f4125b63fa50404a954bf437735f9d0ef7128dde7aa2d4`.

Se ejecutó `supabase/operations/verify-weekly-availability.sql` en el SQL Editor remoto: prueba de tres tramos, superposición rechazada, operación atómica, identidad ajena rechazada y permisos de función. Todo finaliza en ROLLBACK. Resultado final: 2 negocios, 4 usuarios, 2 reservas y 0 pausas recurrentes, iguales a la situación previa. Ningún horario de prueba quedó guardado en producción.

## Copia manual puntual

Guardada fuera del repositorio, en la carpeta privada `respaldo-manual-007` junto al proyecto. Archivo `turnos-pre-040.json`, permisos 0600; carpeta 0700. SHA-256: `f9303be98efd77bfed78b055250625510cd09a5c3b365ef92a12c25fd67d5899`.

Incluye horarios, pausas, excepciones, cierres, ausencias, preferencias, definición previa de la función de notificaciones, registro de migraciones y conteos principales. No es una copia integral: excluye Auth, contactos, secretos y Storage. No se añadieron servicios pagos ni un sistema nuevo de respaldos.

Eliminaciones permanentes continúan deshabilitadas. Las mejoras de plan, pagos y renovaciones mantienen aprobación manual. No se modificó ATRY Lab.
