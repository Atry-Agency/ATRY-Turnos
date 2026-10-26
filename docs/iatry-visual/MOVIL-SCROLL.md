# IAtry · aislamiento del desplazamiento móvil

26/10/2026. Corrección local; no publicada. No hubo nuevas operaciones en Supabase.

La captura reportada corresponde a la variante visual que conservaba solo `overscroll-behavior: contain`, sin una hoja modal que inmovilizara el fondo. La protección previa de V3 solo estaba en su rama operativa experimental. Además, bloquear únicamente el body no cubre todos los contenedores desplazables ni todos los gestos de borde de iOS.

Se incorpora la hoja protegida a la variante visual y se refuerza el hook V3: fondo inerte, body/documento y ancestros desplazables bloqueados con restauración, capa protectora, foco contenido y altura de visualViewport. Se permite el movimiento interno cuando un contenedor del panel puede consumirlo; se cancela la transferencia al fondo en los extremos y fuera del panel. El fallback usa listeners no pasivos solo mientras está abierto en pantalla compacta. Pinch zoom no se bloquea. Al cerrar, minimizar, rotar a escritorio o desmontar se retiran los listeners y se restauran estilos y desplazamiento.

El panel conserva colores, emblema, animaciones y memoria. En la variante visual las guías que señalan un control retiran el panel en móvil para dejarlo accesible; el usuario puede retomar la guía desde IAtry. No se altera su lógica de negocio.

Pruebas focalizadas correctas:

- Chrome en emulación móvil: gesto táctil real mediante CDP desplaza el panel y mantiene el fondo fijo.
- Chrome/WebKit en viewport compacto: límites superior/inferior y gesto fuera del panel; restauración del fondo tras cerrar. Las comprobaciones de TouchEvent de borde son sintéticas; WebKit usa además rueda real en viewport compacto porque Playwright no admite rueda en WebKit móvil.
- V3 móvil en Chrome/WebKit: foco, 320/390 px, altura compacta, rotación, minimizar y navegación restaurada.
- Candidato visual en Chrome/WebKit: guías, controles señalados, edición manual local de servicios, borradores protegidos, preferencias, responsive y roles existentes.
- Compilación TypeScript/Vite y barrera del artefacto visual correctas: 14 módulos de asistente permitidos, `automatedOperations: false`; el motor y catálogo V3 no entran en el artefacto visual.

No se generaron capturas, videos ni PDF. No se probó un Safari de iPhone físico por automatización; la confirmación en ese dispositivo queda pendiente. La web pública mantiene su código anterior hasta autorización de despliegue.

Ramas: `codex/iatry-mobile-scroll` para el candidato visual, `codex/iatry-v3-supabase` para el asistente operativo. La prueba real de Servicios previa terminó 3/3 y sigue cerrada, sin ampliar autorizaciones.
