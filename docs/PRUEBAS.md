# Validación de la entrega — Atry Turnos 1.0-preview

## Automatizada

Ejecutar: `npm test`.

Se prueban:

1. Registro de negocio, inicio de sesión, aislamiento entre empresas y prohibición de acceso a la administración.
2. Disponibilidad de profesionales, reserva pública real, rechazo de superposición, gestión por token y cancelación.
3. Cambio de servicio, horarios, auditoría y exportación de reservas en CSV.
4. Rechazo de reservas fuera de horario y solicitud sin consentimiento.
5. Lista de espera, duplicados, reacción a cancelaciones y registro de oferta pendiente.
6. Límite de profesionales por plan y controles de acceso entre negocios.
7. Dos peticiones concurrentes de reserva para el mismo profesional y hora: **una confirma, la otra devuelve conflicto 409**.

Resultado verificado durante esta entrega: **7/7 pruebas correctas** en Node.js 22.16, en base SQLite temporal en memoria.

## Verificaciones manuales propuestas para ejecutar localmente

- [ ] Abrir Inicio en pantalla de 390px y en escritorio.
- [ ] Entrar con la demo y recorrer Inicio, Agenda, Servicios, Equipo, Clientes, Lista de espera, Configuración y Notificaciones.
- [ ] Crear y editar servicio; ocultarlo y comprobar que desaparece de reservas públicas.
- [ ] Crear profesional, asignarle servicios y configurar horarios.
- [ ] Bloquear un día libre y comprobar que no aparecen horarios reservables.
- [ ] Crear una reserva pública, copiar el enlace privado y cancelar; comprobar que vuelve a aparecer el horario.
- [ ] Hacer una reserva manual y pasar por confirmado / completado.
- [ ] Exportar CSV, revisar auditoría y cola de notificaciones.
- [ ] Probar el usuario de administración y actualizar un plan manualmente.
- [ ] Probar el enlace público desde un segundo dispositivo de la misma red (requiere configuración de HOST y firewall).

**Limitación de la validación actual:** el entorno de prueba de navegador impidió cargar páginas (bloqueo administrativo de navegación incluso en `localhost`). Se verificaron el HTML servido por HTTP, el JavaScript con comprobación sintáctica y renderizado de la página comercial en un entorno de JavaScript simulado, pero **no hay capturas de navegador ni recorrido visual automatizado integral**. Realizar estas pruebas antes de publicar.
# Resultado de Misión 001

13 pruebas aprobadas con `npm test`; ampliaciones en `tests/product.test.js`. Se probaron permisos de empleados/administración, recuperación y revocación, onboarding, SmartSlots, recursos, ofertas concurrentes de espera, persistencia y buffers/métricas. Ver `MISION_001.md` para recorridos visuales y límites de verificación.

