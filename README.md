# Atry Turnos

Plataforma multiempresa de agenda y reservas, con interfaz JavaScript/HTML/CSS. Tiene un backend local Node.js + SQLite WAL y una implementación online Supabase (Auth, PostgreSQL, RPC, RLS, Realtime y funciones Edge). Son entornos separados: clonar el repositorio no copia ni sincroniza la base productiva.

Requiere Node.js 22.13 o superior. Ejecutar `npm ci` y `npm start`; abrir http://localhost:3300/#/app/agenda. Se crea una base local vacía en `data/atry-turnos.sqlite`. Las variables de `.env.example` se configuran en el entorno; `.env` no se carga automáticamente.

Para una demo exclusivamente local: `SEED_DEMO=1 MAIL_PROVIDER=local npm start`. Cuenta de negocio: `usuario1@example.com` / `AtryDemo2026!`. Administración: `admin.prueba@example.com` / `AtryAdmin2026!`. La demo usa Pro para mostrar todos los módulos; estas cuentas están prohibidas en producción.

La Misión 004 integra contratación manual, solicitud persistente, contacto voluntario por WhatsApp, catálogo administrable y capacidades reales por plan. Individual: $790 UYU/mes y 1 profesional; Negocio: $1.490 y hasta 4; Pro: $2.490 y hasta 10. **Precios propuestos, impuestos pendientes de confirmación.** Los cupos de correo operativo son 0, 300 y 900 por ciclo mensual. El registro o la solicitud no habilitan una suscripción.

Ejecutar `npm test` para las pruebas aisladas y `npm audit --omit=dev` para dependencias. Los datos, respaldos, correos y configuración privada están ignorados por Git. No borrar `data/`.

Documentación actual: [Misión 004](docs/MISION_004.md), [habilitaciones manuales](docs/SUSCRIPCIONES_MANUALES.md), [clientes y turnos fijos](docs/CLIENTES_TURNOS_FIJOS_2026-10-15.md), [correo Supabase](docs/CORREO_SUPABASE.md), [API histórica](docs/API.md). Los informes de misiones anteriores conservan el alcance y los resultados de su fecha; para las reglas comerciales vigentes consultar Misión 004 y el código.

No hay cobros online, conciliación bancaria automática ni WhatsApp automático. La operación está centrada en America/Montevideo y UYU. [Aplicación publicada](https://atry-agency.github.io/ATRY-Turnos/).
