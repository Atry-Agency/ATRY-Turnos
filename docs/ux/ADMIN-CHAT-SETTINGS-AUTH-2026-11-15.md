# IAtry administrativo, navegación y acceso — 15/11/2026

## Alcance

Integra el candidato visual `e8834c1` con una conversación operativa administrativa real, los accesos laterales de Configuración y la transición de registro/acceso recuperada de `657ea0f`. No cambia herramientas, permisos ni contratos operativos de los propietarios ni publica documentación legal pendiente.

### Administración por conversación

Reutiliza AppPort, adminApi y las RPC administrativas existentes. Admite elección de registros autorizados (incluidos ordinales de la última lista), selección múltiple en operaciones compatibles, preguntas de campos pendientes, correcciones, propuestas y confirmación visual. «Confirmo» por chat nunca ejecuta.

| Grupo | Contratos existentes utilizados |
|---|---|
| Acceso del negocio | Prueba, activación, renovación, baja al vencimiento, suspensión y restablecimiento |
| Controles | Pausa de nuevas reservas y correo operativo; no cancela reservas existentes |
| Usuarios | Bloquear/restablecer, revocar sesiones, retirar una membresía |
| Comercial | Seguimiento, estado de solicitud, registro de evidencia de pago; no consulta al banco |
| Soporte | Registrar incidencia, cambiar estado/prioridad, documentar resolución |
| Correo | Cancelar trabajo pendiente seguro, reintentar rechazo comprobado, política y archivado existentes |
| Configuración | Planes y configuración comercial, con impacto global visible |
| Datos | Solicitudes de revisión y eliminación definitiva existente, con identificador escrito, consecuencias y confirmación reforzada |
| Lecturas | Negocios, usuarios, solicitudes, incidencias, correo, auditoría, finanzas, diagnósticos, almacenamiento y configuración |

La comprensión es determinista; el catálogo ofrece alternativas si la frase no basta. No incorpora un backend ni una API de IA. No interpreta un diagnóstico como una reparación ni una programación de correo como entrega.

Antes de escribir se releen precondiciones, sesión y permisos. La propuesta expira a los cinco minutos. Cada paso utiliza una clave propia y se verifica mediante auditoría correlacionada por actor/clave y relectura. No hay repetición automática ante resultados inciertos. Los lotes se detienen ante el primer fallo y conservan los resultados comprobados. Las reglas del servidor sobre último administrador/propietario, sesión reciente, revisiones, cuotas y efectos de correo permanecen intactas.

Los cobros/renovaciones de Panamá continúan sujetos al contrato existente, que todavía bloquea la contratación paga. No se convierte un plan PA a prueba si el servidor no lo permite. No se desactivan profesionales implícitamente para acomodar una prueba.

### Ajuste mínimo del backend

`20261116003945_admin_regional_context.sql` añade país, zona horaria, moneda y locale al final de `private.control_businesses`. No modifica filas, tablas, RLS, privilegios ni RPC. La conversación se bloquea si falta un perfil regional verificable; no supone Uruguay. Se comprobó el esquema productivo mediante lectura y la equivalencia de las siete RPC utilizadas (dos diferencias de hash eran exclusivamente finales de línea CRLF).

### Configuración

Submenú expandible en el sidebar: datos del negocio, apariencia e identidad (propietario), reglas, página pública, notificaciones y accesos según capacidades, y suscripción. Comunicación conserva su destino principal. Se eliminan la navegación horizontal duplicada y sus pestañas; los formularios, ThemeStudio y vistas previas se conservan. Las rutas profundas existentes y la protección de cambios sin guardar siguen funcionando.

### Animación de acceso

Se recupera la superficie violeta opaca única, el desplazamiento de los anclajes del logo/firma y la transición de formulario del código original. Escritorio: 680 ms; móvil: transición breve sin panel lateral oculto. Respeta movimiento reducido y cancela limpiamente ante resize/cambios rápidos. Las copias temporales son inertes, ocultas a accesibilidad y no retienen valores de campos.

## Verificación y reproducción

- `npm test`: suite del sistema y PostgreSQL.
- `npm run build`, `npm run test:react`, `npm run test:iatry-consolidation`.
- `node scripts/react/admin-chat-postgres.cjs`: operaciones y errores solo sobre PostgreSQL local desechable; sin trabajador de envíos.
- `node scripts/react/settings-navigation-test.cjs`: matriz de navegación y capacidades.
- `scripts/react/admin-settings-auth-browser.cjs`: Chrome/WebKit, 320/390/430/1440, revisión sin escritura, rutas directas, animación en ambos sentidos y movimiento reducido.
- `node scripts/react/release-check.cjs`: mantiene las 17 herramientas de negocio, Individual sin estadísticas, edición de clientes solo notas; habilitación administrativa separada y sin indicador de ensayo local en el artefacto.

No se realizaron escrituras de ensayo en Supabase ni sobre negocios reales. Las pruebas de navegador autenticadas se realizaron con identidad ficticia local; no equivalen a una nueva operación real de administración en producción.

## Recuperación

Etiqueta publicada: `rollback/pre-admin-chat-20261115` → `ba82c3cb8e8edb44c7ed67d54abb787eb8bb6abb`.

Reejecutar `pages.yml` por workflow_dispatch con `source_ref` igual a esa etiqueta. Conservar la ampliación aditiva de lectura en Supabase: el frontend anterior ignora los cuatro campos y no requiere un rollback destructivo de base de datos.

## Resultado final previo al despliegue

270 pruebas generales aprobadas; suite React y seguridad aprobada; 82 comprobaciones administrativas enfocadas y 29 escrituras exclusivamente en PostgreSQL local; nueve combinaciones de navegación por rol/plan; ocho combinaciones Chrome/WebKit por viewport. Artefacto comprobado: siete lecturas y diez escrituras de negocio, sin ampliaciones.

Migración administrativa aplicada con autorización específica y releída: cuatro columnas añadidas, ACL idéntica, sin acceso directo anon/authenticated y sin cambios en cantidades de negocios, usuarios, reservas, clientes o profesionales. No hubo ensayos operativos productivos.
