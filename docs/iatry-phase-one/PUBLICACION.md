# Habilitación aprobada — 28/10/2026

Alcance autorizado: 17 herramientas, exclusivamente propietario autenticado de negocio con plan Negocio, cualquier negocio autorizado. Clientes: creación y consultas; actualización solo notas. Los demás roles/planes, reservas, notificaciones y las dos incompatibles permanecen bloqueados. Confirmación, validación del servidor y relectura obligatorias; sin reintentos automáticos tras incertidumbre.

Se activó el interruptor en el candidato local. El artefacto debe declarar exactamente 7 lecturas y 10 escrituras, rol owner/plan negocio y customers.update limitado a notes. No se cambiaron RPC, RLS, usuarios, datos, planes ni configuración de Supabase y no se ejecutaron nuevas escrituras reales.

Rollback publicado y verificado: `rollback/pre-iatry-phase-one-2026-10-28` → `5a5aaa4868366eb51afcb181c6b0cc49d7c0e1ce`. El workflow Pages admite `source_ref` con esa etiqueta. `origin/main` se verificó en ese mismo SHA antes de preparar el despliegue.

**Publicación detenida antes de modificar main**, siguiendo la instrucción de detenerla ante un fallo de verificación. La primera ejecución de compilación y pruebas React en paralelo fue inválida: Vite limpia frontend/react/dist mientras la suite genera módulos de test allí, causando MODULE_NOT_FOUND. No hubo fallo del producto acreditado ni se lanzó el workflow de publicación.

La repetición secuencial de la suite React pasó completamente, incluidos 19 grupos de seguridad, conversación, permisos y descubrimiento. La compilación pasó. El perfil connected del motor con PostgreSQL/adaptador local pasó 19 resultados (17 herramientas más variantes de ausencia) y dos grupos de seguridad; confirmación, una sola escritura, relectura y rechazo entre negocios/rol/plan. Edición de clientes en ese perfil conserva nombre/contacto y modifica solo notas. Cero solicitudes externas.

Para retomar: confirmación del usuario tras este incidente; verificar nuevamente main y rollback; repetir checks únicamente si cambia código; push normal del candidato a main, sin force; observar el workflow Pages y verificar luego dominio, sesión autorizada y consultas sin escrituras adicionales. No hay migraciones ni pasos de Supabase.

La versión publicada permanece en `5a5aaa4`. El interruptor activado en la rama local no modifica esa versión. Los informes CIERRE/ENTREGA conservan la evidencia histórica; la matriz JSON representa el alcance autorizado del candidato, no un despliegue ya realizado.

Comprobación final del artefacto local: `phase-one-operational`, 7 lecturas, 10 escrituras, proyecto correcto, 119 assets, cero consultas a Supabase. Pasaron rechazo de artefacto con política no aprobada, plan adulterado y edición de identidad/contacto. El workflow existente ya ejecuta compilación y tests secuencialmente; no se cambió. No se lanzó una ejecución de Pages ni se verificó una nueva versión pública porque se detuvo el despliegue. El dominio publicado no se modificó.
