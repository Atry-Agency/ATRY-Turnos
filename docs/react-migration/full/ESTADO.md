# Estado de revisión local — 25/10/2026

La aplicación principal, autenticación, pantallas privadas, reservas públicas, administración y landing tienen entrada React autónoma. El build ordinario excluye el piloto y los controladores DOM anteriores. El servidor y empaquetadores utilizan la distribución React; la referencia sigue aislada para auditoría.

- Build TypeScript/Vite: aprobado.
- Regresión: 243/243; React: 32/32.
- HTTP aislado: cuenta, registro, invitaciones, reservas, visitas y administración aprobados.
- Reautenticación cloud con SDK real y red interceptada: aprobada.
- Landing, demos, teclado/foco, preview sin llamadas API y service worker offline: aprobados.
- 105 verificaciones de temas válidos y anchos aprobadas.
- 500 pares visuales auditados; resultados exactos y diferencias residuales en MEDICIONES.md.
- Main e IAtry: 324 y 589 huellas sin cambios ni faltantes.

La implementación y evidencia local no certifican un backend cloud desplegado ni todos los navegadores/dispositivos. Se conserva el bloqueo de validación cloud y se recomienda aceptación en staging antes de sustituir producción. No hubo publicación, push, merge ni cambios remotos.

Informe exhaustivo: INFORME.md. Mediciones y bundles: MEDICIONES.md. Evidencia bruta: evidence/. El PDF de revisión incluye las capturas incrustadas.
