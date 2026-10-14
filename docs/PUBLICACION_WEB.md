# Publicación de Atry Turnos

GitHub Pages estaba configurado para publicar `main` desde la raíz. Como el HTML de la aplicación está en `web/index.html`, el sitio mostraba el README generado por Jekyll.

El workflow `pages.yml` construye y publica solamente la interfaz de `web/`. Los recursos usan rutas relativas, compatibles con `/ATRY-Turnos/`. Los cambios de interfaz en `main` vuelven a desplegar la vista previa automáticamente.

URL: https://atry-agency.github.io/ATRY-Turnos/

Esta publicación muestra la interfaz de acceso y registro. Incluye un aviso visible, deshabilita formularios y bloquea las solicitudes API antes de enviar datos. No usa cuentas ficticias para simular un backend remoto. No publica bases de datos, servidores, variables de entorno ni credenciales.

GitHub Pages sirve archivos estáticos y no ejecuta el servidor Node/SQLite actual. Sigue pendiente completar y validar la conexión de la interfaz a Supabase, incluyendo todas las operaciones del producto. Publicar esta vista previa no completa la Misión 003 ni habilita la aplicación para operar con clientes.

El proceso de construcción de Cloudflare conserva su bloqueo de publicación hasta validar el backend completo. Ningún otro proyecto, dominio ni DNS se modifica con este despliegue.
