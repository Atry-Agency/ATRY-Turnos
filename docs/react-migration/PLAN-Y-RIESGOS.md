# Plan con puertas de calidad

| Etapa | Entrega | Condición de avance y rollback |
|---|---|---|
| 0: esta entrega | Auditoría, matriz, worktree, stack aislado y ServiceCard | Suite original, build, funcional del piloto, pares visuales, mediciones; revisión del usuario |
| 1: contratos | Fachadas ESM tipadas de motores puros y API, errores, scope, invalidación y realtime | Fixtures JS/TS idénticos, permisos/tenant, cancelación de respuestas; legacy sigue activo |
| 2: compartidos | Shell, botones, campos, diálogos accesibles, tokens | Capturas por planes/temas/tamaños, teclado, foco/borradores, sin cambio estético; activación local por ruta |
| 3: servicios/clientes/equipo | Una pantalla completa a la vez, acciones y formularios | CRUD E2E, conflictos/revisión, fotos y cuotas; retirar manejador legacy de esa ruta sólo tras equivalencia |
| 4: configuración/comunicación/comercial/admin | Preservar permisos, plantillas, pagos manuales y evidencias | Roles, multinegocio, límites, correo ficticio, reauth, revisiones; activar individualmente |
| 5: agenda/privadas/públicas/visitas | Migración de flujos completos, no simplificados | Día/semana/mes, móvil, buffers, carreras, idempotencia, token, multi-servicio atómico y red lenta |
| 6: rendimiento/offline/publicación futura | Bundles por ruta, SW/CSP/base path, observabilidad y rollback | Comparación equivalente, validar backend de staging, aprobación expresa antes de publicar |
| 7: IAtry | Adaptar motores y componentes/contexto/motion | Estabilización previa React; equivalencia V1.2, privacidad y reduced-motion |

No se inicia etapa1 ni conversiones masivas automáticamente tras esta entrega.

## Riesgos concretos

| Riesgo | Nivel | Mitigación / prueba |
|---|---|---|
| Override de funciones/eventos globales y orden de scripts | Alto | Inventario de propietarios; una ruta/un formulario/un handler; desmontaje y pruebas ida/vuelta |
| Borradores, dobles submits y claves idempotentes al rerender | Alto | Estado de formulario explícito, envío bloqueado, misma clave ante retry, restauración tras fallo |
| Reglas de reserva y visitas duplicadas en cliente | Alto | Mantener servidor/RPC como autoridad; usar puros, no reescribir reglas por conveniencia |
| Fugas entre negocios o respuestas tardías | Alto | Scope usuario+negocio+rol, abort/versionado, purga y revocación realtime; tests cruzados |
| CSS por cascada y variantes por plan | Alto | Orden idéntico, sin reset, captura por tema/tamaño, congelar fixtures |
| Confundir mediciones de demo con Supabase | Alto | Reportar separados CPU/render, lecturas de adaptador, red y RPC; producción no medida aquí |
| React añade bytes mientras coexiste con legacy | Medio | Medir bundle de producción, dividir rutas al escalar, retirar legacy sólo al superar puertas |
| Service worker entrega mezcla de versiones | Alto | Nuevo scope/build hash y prueba de actualización/rollback antes de despliegue; piloto sin worker |
| Efectos montados dos veces y múltiples streams | Alto | Suscripción con dispose y owner único; probar mount/unmount y cambio de scope |
| Costura global temporal del piloto | Medio | Acotada a tarjetas demo; reemplazar por API explícita antes de ampliar React |
| Dependencia existente Nodemailer 10.1.0 | Medio | npm audit detecta avisos addressparser; registrar reparación independiente y probar correo antes de actualizar |

## Defectos existentes / límites de observación

Advertencia npm audit de Nodemailer registrada en RESULTADOS, sin actualización automática del backend. La coexistencia de overrides y estado global es deuda estructural observada, no defecto visual nuevo. No se hicieron cambios arbitrarios de estética. Los pares visuales de tarjetas permiten detectar regresión local; no certifican que todo el producto esté libre de defectos visuales.

## Estrategia de validación requerida

Unitarias: motores puros, serialización, formato y seguridad de contenido de componentes. Integración: contratos HTTP/RPC, auth, roles y multiempresa, cache/invalidación y realtime. Funcionales: cada fila de MATRIZ, formularios sucios, validaciones, errores de servidor y recuperación de conexión. Reservas: concurrencia, duración/buffers, ausencias/recursos, cancelación/reprogramación, visitas atómicas e idempotencia. Visual: mismos datos, reloj, plan/tema y viewport; incluir móvil 320/390/430, tablet768 y desktop1440. Accesibilidad: labels, foco, Escape/Tab, teclado y reduced-motion. Backend: SQLite y PGlite aislados, nunca migraciones o env productivo.

Rendimiento: carga fría/caliente, navegación, selección servicio/profesional, disponibilidad, diálogo y agenda; contar hits/cache y solicitudes, medianas/rangos con número de muestras. Medir Supabase/staging posteriormente con ResourceTiming y tiempos del adaptador/RPC, distinguiendo red/DB/serialización/render. No aplicar un presupuesto porcentual antes de tener línea base estable; no declarar mejoras con una muestra ni tiempos de demo como latencia de Supabase.
