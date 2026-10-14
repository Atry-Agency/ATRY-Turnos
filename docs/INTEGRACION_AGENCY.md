# Cómo incorporar Atry Turnos a Atry Agency

Nota de Misión 001: este documento describe exclusivamente una posible sección comercial en el sitio externo de Agency. La aplicación Atry Turnos no contiene landing comercial; su raíz es acceso/panel.

## Identidad

- Marca del producto: **Atry Turnos** (no es un servicio genérico revendido).
- Marca madre y comercialización: **Atry Agency**.
- Repositorio GitHub independiente, preferentemente privado, con despliegue y versionado autónomos.
- No alojar un SaaS comercial con operaciones de base de datos en GitHub Pages. Usar GitHub para código y CI/CD, y un proveedor adecuado para ejecutarlo.

## Sección comercial en Agency

Estructura sugerida de la página `Servicios > Atry Turnos`:

1. Encabezado: **"Tus clientes reservan. Vos atendés."**
2. Qué resuelve: llamadas, mensajes, dobles reservas, ausencias, desorganización.
3. Demostración interactiva real: enlace a una peluquería de ejemplo con datos ficticios.
4. Beneficios: agenda, equipo, clientes, horarios, cancelaciones, análisis, web y privacidad.
5. Capturas del panel y reservas (sacar una vez que esté desplegado).
6. Precios, impuestos aplicables, prueba y términos de contratación.
7. Botón `Comenzar` enlazado a `https://atryturnos.com/#/registro` (URL propuesta, **no verificada**).
8. Botón `Ingresar` enlazado a `https://atryturnos.com/#/login` (URL propuesta, **no verificada**).
9. Contacto de implementación personalizada (servicio adicional Atry Agency).
10. Preguntas sobre WhatsApp, pagos, confidencialidad y servicio técnico.

## SaaS propiamente dicho

El comercio crea su cuenta, configura servicios y profesionales y comparte el enlace `https://atryturnos.com/#/reservar/slug-del-negocio`. Los clientes no necesitan cuenta ni instalación. Los administradores usan su panel privado.

## Dominio

Podés empezar con un subdominio temporal de despliegue; cuando valides el nombre y el presupuesto, confirmar disponibilidad y comprar un dominio. Las rutas que contiene el paquete funcionan en un solo dominio. `app.` y `api.` pueden separarse después; no es una obligación técnica inicial.

## Precio propuesto (sujeto a validación)

- Individual: $590 UYU/mes, hasta 1 profesional.
- Negocio: $1.190 UYU/mes, hasta 5 profesionales.
- Pro: $1.990 UYU/mes, hasta 10 profesionales.
- Prueba: 14 días.

La simulación de planes no procesa pagos. Validar competencia actual, disposición a pagar, costos, facturación e impuestos antes de publicar precios definitivos.
