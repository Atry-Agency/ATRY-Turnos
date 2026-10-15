# Navegación y barrido de marca · 15/10/2026

- Símbolo Atry original recortado sobre el panel izquierdo, con desenfoque horizontal hacia la izquierda. Sin imágenes externas ni animaciones pesadas; formulario derecho conservado.
- Caché de lecturas exclusivamente en memoria, con clave por usuario y ruta del negocio, copias independientes, vencimiento de 5–20 segundos y límite de 60 entradas. Las escrituras invalidan antes y después; errores no se guardan. Respuestas anteriores a una invalidación no repueblan la caché.
- Auth, permisos, sesiones, enlaces privados, exportaciones, disponibilidad y operaciones públicas siempre consultan al servidor. La verificación de permisos y conflictos al guardar permanece en Supabase.
- Prelectura de Agenda, Clientes y catálogo al entrar, y de secciones al apuntar o enfocar su enlace. Empleados solo anticipan su agenda. No se muestran éxitos ni datos ficticios.
- Realtime, Actualizar, retorno a pestaña, cambio de negocio y cierre de sesión invalidan las lecturas. Se comparte el catálogo simultáneo de servicios y profesionales y se paraleliza el arranque del negocio.

Validación: suite completa 92/92; controles específicos 7/7 tras el último ajuste del catálogo; compilación cloud correcta. Clientes comprobado en navegador en SQLite aislado sin pantalla completa de carga. La mejora evita viajes repetidos; una lectura inicial o vencida sigue dependiendo de la red y de Supabase. No se promete latencia cero. Sin cambios en Supabase ni en la SQLite original.
