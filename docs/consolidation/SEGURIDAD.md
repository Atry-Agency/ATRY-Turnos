# Consolidación: correo y dependencias

28/10/2026. Base publicada: `9e0f1a8`.

## Cambio acotado

Nodemailer pasa de `10.1.0` a **`10.1.4` exacto**, sin modificar transportes, workers, preferencias, plantillas ni configuración. Se actualizan únicamente la dependencia y su entrada de lockfile. Conserva la misma versión mayor y requiere Node >=20; ATRY exige >=22.13.

Los avisos oficiales afectan versiones >=3.0.0 y <10.1.4 y documentan 10.1.4 como versión corregida:

- [GHSA-8c8m-p3m8-cjg8](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-8c8m-p3m8-cjg8): comentarios anidados podían liberar una dirección adicional como destinatario.
- [GHSA-m943-m63m-w62w](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-m943-m63m-w62w): un punto y coma entre comillas o comentarios podía finalizar prematuramente un grupo y convertir texto en destinatario.
- [GHSA-85x2-q946-cp5h](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-85x2-q946-cp5h): un cierre angular en una parte local entre comillas podía cambiar el dominio efectivo del destinatario.
- [Release oficial 10.1.4](https://github.com/nodemailer/nodemailer/releases/tag/v10.1.4): correcciones del analizador de direcciones.

El riesgo corresponde al procesamiento de direcciones y a posibles discrepancias con validaciones previas de destinatarios; esta corrección no amplía capacidades de IAtry ni autoriza envíos.

## Verificación

- Instalación reproducible mediante `npm ci --ignore-scripts --offline` en un worktree separado, sin compartir `node_modules`.
- `npm audit --json` raíz: **0 vulnerabilidades**.
- `npm --prefix frontend/react audit --json`: **0 vulnerabilidades**, sin modificar su lockfile.
- `node --test tests/mail.test.js tests/cloud-mail.test.js tests/mail-events.test.js tests/mail-scheduler.test.js`: **11/11 aprobadas**. Incluye EML local, SMTP exclusivamente loopback, deduplicación, estados, preferencias, reintentos, tokens, webhooks y scheduler PostgreSQL simulado.
- `node --test tests/nodemailer-security.test.js`: **3/3 aprobadas**. Casos de los tres avisos con parser y construcción real de mensajes en memoria; verifica destinatario/dominio y ausencia de aceptación externa.

No se usaron SMTP real, credenciales privadas, datos productivos ni llamadas a Supabase. No se modificó el frontend ni se ejecutó compilación React en este frente. La comprobación de Actions del candidato consolidado queda a cargo del flujo final de integración; las auditorías npm son una fotografía del catálogo consultado, no una garantía frente a futuros avisos.
