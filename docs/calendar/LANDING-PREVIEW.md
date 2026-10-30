# Presentación comercial de la confirmación

Candidato local sobre d309274. No publicado.

La sección de React `ConfirmationShowcase` se inserta después de los tres bloques Tu día / Tus clientes / Tu identidad, antes de WhatsApp. No cambia hero, IAtry, planes ni precios. Su CTA enlaza al selector `#demo` existente.

`web/assets/landing/confirmacion.webp` es una captura auténtica del componente publicado `ConfirmationExperience`, tomada el 30/10/2026 en viewport390×844, recortada únicamente al área de producto (390×816). Fixture local de Estudio Aurora, logo original ATRY, avatar sin fotografía, Plaza Independencia como ubicación pública. No utiliza información de clientes ni cuentas reales. Se mantiene la atribución de OpenStreetMap visible. Archivo WebP~39KB, lazy-loading y dimensiones explícitas.

La microsecuencia usa opacidad sobre regiones de la misma captura: confirmado, calendarios, ubicación. En escritorio sigue la posición de la sección; en móvil hace un único recorrido breve al entrar la captura en pantalla. Nunca desplaza la página ni intercepta gestos. Los controles funcionan por teclado. Movimiento reducido desactiva secuencia y transiciones; se limpian observadores, listeners, frames y timers. Sin dependencias nuevas ni llamadas de red desde esta sección, salvo descargar la captura local.

El texto aclara que el cliente guarda manualmente el evento y debe actualizarlo si cambia su turno. No promete sincronización automática ni integración profesional. La ubicación se presenta como dependiente de los datos configurados.

La confirmación real inicial queda explícitamente clara por defecto, independientemente del tema del negocio. Se conserva el soporte oscuro del componente para vistas explícitas y las preferencias del resto de la aplicación.

Validación: compilación, suite React y regresión focalizada de posición, tres momentos, scroll acotado, recurso ligero, CTA existente, ausencia de escrituras y modo claro inicial. Inspección responsive en 320,390,430 y escritorio, sin desbordamiento horizontal. No se modificó Supabase ni se publicó.
