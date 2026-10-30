# Confirmación premium de reservas

Entrega basada en 34d954b. Rollback: `rollback/calendar-premium-20261030`.

Solo presentación pública y exportación manual a Google Calendar/Apple Calendar (.ics). Se conservan precios, enlace privado, reprogramaciones, cancelaciones y permisos. No se incluye onboarding experimental, servidor de demostración ni conexión profesional/OAuth.

Datos: respuesta existente y catálogo público del mismo negocio. El logo respeta la proyección de marca del plan. Fotos: adaptador público existente y `show_public`; ausencia/error muestra UserRound. Identificadores: selección de disponibilidad, nunca deducidos por nombre.

Solo reservas confirmadas con fechas válidas permiten exportar. Los eventos no incluyen contactos, notas privadas ni enlace de gestión. El cliente guarda el evento; no hay sincronización automática al cambiar o cancelar el turno.

Google Maps usa dirección pública o coordenadas válidas, sin geolocalización de ATRY. Mapa OpenStreetMap con atribución visible: solo coordenadas explícitas y local físico. El contrato nuevo de coordenadas/modalidad y su configuración no están disponibles en Supabase actual y quedan pendientes. No se aplican migraciones ni se inventan coordenadas para producción.

Publicación: workflow `pages.yml`. Reversión: ejecutarlo con `source_ref=rollback/calendar-premium-20261030`, sin cambios de datos.

Pruebas de reservas con datos locales ficticios; ninguna nueva escritura productiva.
