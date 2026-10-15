# Habilitaciones y renovaciones manuales

Atry controla el acceso comercial desde `#/admin`. Los negocios nuevos quedan pendientes, sin una prueba automática. El registro y la confirmación del correo no habilitan operaciones del negocio.

## Procedimiento de Atry

1. El cliente crea su cuenta, confirma el correo y registra su negocio. Puede copiar el código del negocio desde el aviso de habilitación.
2. Atry acuerda el servicio y verifica la transferencia en su banco. La aplicación no consulta cuentas bancarias ni procesa pagos.
3. En Administración Atry, buscar el negocio por nombre, correo, enlace o código y pulsar **Habilitar negocio** o **Gestionar acceso**.
4. Elegir **Activar un período**, seleccionar Individual, Negocio o Pro e indicar el último día de acceso. Ese día está incluido completo según America/Montevideo.
5. Registrar el importe recibido en pesos uruguayos y la referencia. Para una cortesía sin importe, indicar un motivo. Guardar la habilitación.
6. El cliente pulsa **Revisar habilitación** o vuelve a entrar al panel.

Para el siguiente pago, usar **Registrar renovación** y elegir una fecha que amplíe el período. Una referencia de transferencia no puede repetirse para el mismo negocio. Reintentar la misma solicitud no duplica el registro.

## Otras operaciones

- **Conceder o extender prueba**: habilita una prueba con una fecha explícita. No registra un pago y cambia el plan a Prueba.
- **Suspender acceso**: restringe las operaciones sin borrar datos ni cancelar reservas existentes.
- **Restablecer un período vigente**: recupera un período que todavía no venció. No extiende su duración ni registra una transferencia.

Pendiente, vencido o suspendido: el usuario conserva la consulta de su historial, la seguridad de su cuenta, la cancelación de turnos existentes y la finalización de turnos fijos. No puede crear o modificar la operación del negocio. La página pública no ofrece nuevas reservas. El control se verifica en el servidor y la base de datos, además de la interfaz.

El historial administrativo registra quién realizó cada operación, la fecha, el estado anterior y posterior, el importe, la referencia y la nota. No hay una verificación automática de que el dinero fue recibido: esa comprobación corresponde a Atry.

## Validación de esta entrega

- 88 pruebas automatizadas aprobadas, incluyendo PostgreSQL, SQLite, permisos, vencimiento, referencias repetidas e idempotencia.
- Migración 028 aplicada únicamente en ATRY-Turnos (`djoxdtloqwbrhgtgencc`), SHA-256 `714a88d1b045f85183f3d03a4474157a0f8d1565f97df10c5e5a1b4e940836ec`.
- Prueba transaccional real de registro pendiente, activación, vencimiento, acceso de solo lectura, cancelación, cierre de recurrencia, prueba, suspensión y restablecimiento. Fixtures revertidos: cero cuentas y negocios de prueba persistentes.
- Tabla de historial con RLS y sin permisos directos de lectura para usuarios autenticados. No se añadieron grants públicos.
- Recorridos de navegador contra una base SQLite aislada: pendiente, activación, desbloqueo, suspensión y restablecimiento, incluyendo administrador sin negocio seleccionado.

SQLite original, respaldos y Atry Lab Operaciones no se modifican. Los pagos online y la conciliación bancaria automática siguen fuera de esta integración.
