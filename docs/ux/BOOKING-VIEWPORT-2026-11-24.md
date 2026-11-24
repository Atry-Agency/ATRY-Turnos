# Reservas: centrado y cabecera móvil — 24 de noviembre de 2026

Alcance local, posterior al commit publicado `8d7c8d2`. Sin cambios de contratos, reservas, permisos, IAtry, precios o datos productivos. Sin publicación ni capturas.

## Problemas y corrección

- El cuerpo del modal declaraba únicamente `overflow-y:auto`, dejando el eje horizontal en `auto`. Se limita explícitamente a desplazamiento vertical y se verifica que los campos que contiene caben: no se ocultan campos desbordados como solución.
- La variante móvil de creación imponía `92dvh` sin respetar el alto del visual viewport proporcionado por el hook existente. Se limita también al espacio realmente disponible y a las zonas seguras.
- La navegación pública carecía de separación superior para la zona segura. Ahora la respeta y permanece visible en móvil con fondo opaco al desplazar la página.
- La identidad compacta heredaba el centrado del título de escritorio y asignaba dos filas al logo. Logo y nombre comparten una fila, centrados verticalmente y con el título alineado al comienzo.

## Evidencia y límites

`booking-viewport-browser.cjs` comprueba DOM renderizado, medidas de campos dentro del cuerpo del modal, `scrollWidth/clientWidth`, foco de búsqueda/fecha/hora/contacto, intento de desplazamiento horizontal, acceso vertical al botón final, viewport reducido, ida/vuelta al buscador de horarios, composición de identidad y cabecera durante scroll. Chrome y WebKit; 320, 375, 390, 430, 768 y 1440 CSS px.

La zona segura de 47px se simula a partir de las declaraciones CSS reales: Playwright no reproduce la barra de estado de una PWA de iPhone física. Tampoco permite certificar la sensación de rebote elástico ni el teclado físico de iOS. Se requiere una comprobación final en ese dispositivo; no equivale a una certificación Apple.

Regresiones complementarias: compilación y suite React; `first-use-browser.cjs` con creación y reprogramación verificadas en PostgreSQL local desechable, Uruguay/Panamá, Chrome/WebKit a 320, 390, 768 y 1440px. No se toman capturas ni se realizan reservas reales.
