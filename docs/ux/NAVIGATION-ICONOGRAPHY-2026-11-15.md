# Corrección de iconografía repetitiva

Base publicada: `1177943`. Cambios exclusivamente de presentación.

## Búsqueda y decisiones

- Eliminadas las 15 instancias directas del SVG `M7 17 17 7M7 7h10v10` de Landing.tsx.
- Eliminado el icono diagonal predeterminado de MarketingIcon y sus usos en demos, identidad, confirmación, enlaces y planes. El componente exige ahora un tipo explícito.
- Eliminadas dos máscaras SVG en CSS: tres flechas bajo el hero y las tres viñetas de la demo. La lista conserva viñetas nativas; la franja del hero conserva sus textos.
- Ampliar usa el icono Maximize de geometría Lucide. Reservar en el encabezado del panel usa calendario. No se añaden círculos.
- Eliminadas flechas decorativas en autenticación, confirmación pública, asesor de planes, CTA de IAtry, presentación de planes, estudio de apariencia y página pública de Seguridad.
- Se conservan los indicadores funcionales: anterior/siguiente de agenda, paso siguiente de registro, selectores, despliegues, iconos de envío de IAtry y enlaces externos explícitos de vista previa del negocio.
- Comunicación → WhatsApp pasa a Comunicación · WhatsApp. Se mantienen las flechas semánticas de antes/después al revisar una corrección de datos y los recorridos de servicios; no son CTA decorativos.
- Se actualizan también las fuentes heredadas para que una regeneración no reintroduzca el problema.

## Regresión y evidencia

- Nueva prueba navigation-iconography-test.cjs en la suite React. Escanea React, HTML/JS heredados y CSS, renderiza la landing y compara los 36 destinos con el contrato capturado antes del cambio.
- Chrome/WebKit 320/390/430/1440: cero SVG diagonales repetidos y máscaras CSS; selector UY/PA, precios, galería, tres demostraciones, ocho rutas del panel y formulario de ingreso. Todas las solicitudes externas y no GET se abortan: no se ejecutan operaciones remotas. La lectura de identidad atry_me también se bloquea.
- Capturas auténticas de antes y después: hero, tarjetas, planes, demos y panel, en 390 y 1440 px. Comparativas en Entregas/ATRYTurnos-Iconografia-2026-11-15.
- Sin cambios en Supabase, contratos, permisos, reglas de reservas ni destinos de navegación. Se conserva el marco de teléfono de proporción fija aprobado.
