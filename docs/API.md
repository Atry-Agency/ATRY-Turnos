# Endpoints API — Preview 1.0

Todas las URLs son del mismo origen. La autenticación se realiza por cookie `HttpOnly` (no se debe almacenar un token de sesión en LocalStorage).

## Pública

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/health` | Salud básica |
| GET | `/api/config` | Versión y capacidad disponible |
| POST | `/api/auth/register` | Alta de propietario + negocio + jornada inicial |
| POST | `/api/auth/login` | Crear sesión |
| GET | `/api/auth/me` | Perfil, membresías |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET | `/api/public/:slug` | Servicios y profesionales visibles |
| GET | `/api/public/:slug/availability?date=YYYY-MM-DD&service_id=...&staff_id=...` | Horarios libres |
| POST | `/api/public/:slug/book` | Crear reserva con consentimiento |
| POST | `/api/public/:slug/waitlist` | Solicitud de lista de espera |
| GET | `/api/manage/:token` | Consultar reserva con enlace privado |
| POST | `/api/manage/:token/cancel` | Cancelar respetando ventana |
| POST | `/api/manage/:token/reschedule` | Reprogramar con token (API; sin pantalla pública todavía) |

## Privada · Negocio

Prefijo: `/api/business/:business_id`

- `GET /` y `PATCH /`: perfil, marca y políticas.
- `GET /services`, `POST /services`, `PATCH /services/:id`: catálogo.
- `GET /staff`, `POST /staff`, `PATCH /staff/:id`: profesionales.
- `GET /staff/:id/hours`, `PUT /staff/:id/hours`: jornada semanal.
- `GET /time-off`, `POST /time-off`, `DELETE /time-off/:id`: ausencias.
- `GET /bookings?date=YYYY-MM-DD`, `POST /bookings`, `PATCH /bookings/:id`: reservas.
- `GET /waitlist`, `PATCH /waitlist/:id`: interesados.
- `GET /customers`, `PATCH /customers/:id`: clientes y notas.
- `GET /dashboard`: métricas e insights.
- `GET /notifications`: cola de mensajes (pendientes, NO enviados).
- `GET /audit`: auditoría.
- `GET /export/bookings`: CSV con reservas.

## Administración central

- `GET /api/admin/businesses`: cartera de negocios.
- `PATCH /api/admin/businesses/:id`: cambios **manuales** de plan y estado.

### Ejemplo: crear reserva

```json
{
  "service_id": "UUID-servicio",
  "staff_id": "UUID-profesional",
  "starts_at": "2026-10-20T13:00:00.000Z",
  "customer_name": "Valentina",
  "customer_email": "valentina@example.com",
  "customer_phone": "099123456",
  "accept_policy": true
}
```

Las fechas se almacenan en UTC; el calendario público muestra hora de Montevideo (UTC−03 en esta versión). Siempre se valida disponibilidad de nuevo dentro de la transacción que crea la reserva.
# Ampliaciones de Misión 001

- POST `/api/auth/forgot-password`: solicitud genérica; no envía correo sin proveedor.
- POST `/api/auth/reset-password`: token/password, uso único, vence en 30 minutos y revoca sesiones.
- GET `/api/business/:id/bookings?date=YYYY-MM-DD&days=1..31`: período; empleados solo ven su profesional.
- GET `/api/business/:id/customers/:customer/history`: historial, propietario/encargado.
- GET `/api/business/:id/smartslots?date=YYYY-MM-DD`: alternativas reales por servicio.
- GET/POST `/api/business/:id/members`: propietario; vinculación a cuenta existente.
- GET `/api/offers/:token`, POST `/api/offers/:token/accept`: oferta de espera que vence, aceptación transaccional con accept_policy.
- GET `/api/admin/operations`: administrador; estados de integración y métricas agregadas.
- PATCH `/api/business/:id`: logo_url como data URL PNG/JPEG/WebP y onboarding_completed=1 con servicio activo.

El administrador de plataforma no sustituye la membresía de negocio en las rutas privadas. El empleado tiene consulta de su agenda; no puede gestionar clientes, reservas, configuración ni exportaciones. POST de gestión pública retorna solo datos resumidos y no notas internas.


## Rutas añadidas en Misión 002

Cuenta: POST /api/auth/account; GET/PATCH /api/account/profile; POST /api/account/password; GET/DELETE /api/account/sessions; POST /api/organizations.
Invitaciones: GET/POST/DELETE /api/business/:id/invitations; GET /api/invitations/:token; POST /api/invitations/:token/accept. Membresías PATCH/DELETE /api/business/:id/members/:userId.
Agenda SSE: GET /api/business/:id/events. Reglas: /api/business/:id/breaks, /exceptions, /holidays, /resources y asignaciones de recursos a servicios.
Comunicaciones: /api/business/:id/notification-preferences; /mail-jobs; GET /api/account/mail y /api/dev/mail/:id (solo proveedor local y acceso autorizado).
Gestión pública: GET /api/manage/:token/availability. Creación de reservas y aceptación de ofertas admiten idempotency_key.
Operación: GET /api/business/:id/insights y /entitlements; incidencias del negocio. Administración: /api/admin/diagnostics, /plans e /incidents.

Los métodos y validaciones concretos están en accounts.js, communications.js, scheduling.js, realtime.js y operations.js. Todas las rutas privadas verifican sesión y pertenencia/rol. API anterior preservada; empleados operan solo su profesional. No hay API de pagos.
