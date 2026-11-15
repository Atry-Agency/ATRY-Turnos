# Ajuste visual local: panel y footer

Base: 306a11e. Sin publicación, push ni cambios de Supabase.

- Se retiran flechas decorativas de los CTA de configuración y plan. Las demás señales de avance del panel usan el chevron discreto del sistema de iconos existente. Se conservan las señales funcionales de volver, calendario y enlaces externos.
- Footer público: composición editorial en grafito, jerarquía más clara, logo original y enlaces con área táctil cómoda. Todos sus textos y enlaces se conservan; Agency apunta a su dominio oficial. Sin flechas circulares ni documentos legales nuevos.
- Componente compartido PanelSkeleton para cargas internas reales de módulos, listas, formularios, equipo, agenda y estadísticas. La forma es no interactiva, expone estado ocupado y conserva el mensaje accesible. Los errores y reintentos continúan con Feedback.
- Los tres indicadores de guardado del panel pasan a un pulso compacto; no cambian los bloqueos ni el resultado de las operaciones.
- La carga inicial con el logotipo ATRY no cambia. Se comparó exactamente el bloque de arranque de NativeApp contra la base.
- Se respeta movimiento reducido. Ningún icono, clase CSS o placeholder modifica consultas, permisos, importes ni reservas.

Verificación: compilación/TypeScript y suite React completas aprobadas; comprobación del artefacto y restricciones existentes aprobada con cero solicitudes Supabase. Chrome/WebKit en 320/390/430/1440: carga real de módulo retenida para observar el skeleton, transición a datos, accesibilidad del estado, ausencia de flechas decorativas revisadas, footer con todos sus enlaces, logo original cargado y cero escrituras. Se inspeccionaron capturas móviles y de escritorio.

Vista local: http://127.0.0.1:3360/?demo=1&plan=2#/app/inicio
Footer: http://127.0.0.1:3360/descubrir.html (pie de página)
