# Pulido local de IAtry Experience

Base publicada conservada: 9a1c95ce71b31fb0c475b05e3baf4f4caeff1670. Rama: codex/iatry-cinema-polish. Sin publicación ni cambios en Supabase o en el motor operativo.

La landing importaba las capas líquidas pero no el estilo base que establece position:relative y display:inline-grid del avatar. Sus hijos absolutos se posicionaban respecto al panel; una regla descendiente de span también alcanzaba las capas. Se fija geometría explícita 1:1 dentro de .iatry-story y se limita la regla de metadatos al span directo del encabezado.

Estados de energía ligados a interpretación, preparación, confirmación y respuesta. Agenda de descanso, ficha de servicio y semana de vacaciones ilustrativas; todas las confirmaciones solo modifican estado local. Se conserva la estructura, los mensajes principales, precios, CTA y emblema oficial.

Un único scroll interno con encabezado estable, seguimiento de respuestas, suspensión del seguimiento al leer atrás y control para volver al último mensaje. Se respetan la pausa, movimiento reducido y suspensión del avatar fuera de pantalla.

Pruebas sin capturas: TypeScript/Vite; integridad del contenido comercial; Chrome/WebKit en 320x568,390x844,1440x960; dimensiones de avatar/basin/emblema circulares y contenidas, siete capítulos, simulaciones, vacaciones interactivas y movimiento reducido. Recorrido adicional con movimiento activo: respuestas automáticas y último mensaje visible, recargas sin recursos fallidos ni solicitudes API/Supabase.

Vista local: http://127.0.0.1:3331/descubrir.html#iatry . Servidor Vite para revisión; aprobación y publicación pendientes.
