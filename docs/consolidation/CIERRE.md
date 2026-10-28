# Candidato único de consolidación — 28/10/2026

Base publicada y recuperación: `9e0f1a88845677109544c8aece978d15aefe1da4`. Rama del candidato: `codex/iatry-final-consolidation`. No se publicó, no se modificó Supabase y no se ejecutaron nuevos ensayos reales. Los tres frentes delegados trabajaron en worktrees separados; la integración final y las compilaciones React se realizaron desde una sola carpeta.

## Resultado

- Nodemailer 10.1.4 exacto corrige los tres avisos del analizador de direcciones. No se alteran transportes, preferencias ni workers. Auditoría raíz de dependencias productivas y auditoría completa del frontend: **0 vulnerabilidades** al cierre.
- Servicios, clientes y los demás resultados de colección aparecen en listas compactas. Cada elemento abre una única ficha; cinco resultados iniciales y expansión incremental. Nombre, información principal y estado se conservan. La conversación mantiene un campo para continuar desde los resultados.
- Las referencias de servicios/clientes usan exclusivamente identificadores de lecturas autorizadas. Se resuelven nombres únicos, ordinales del último resultado/filtrado, selección explícita, último elemento y selección anterior. Ante duplicados o referencia incierta se pregunta. Los filtros activo/oculto trabajan sobre la consulta disponible sin pedir nuevamente datos.
- La memoria de resultados es efímera (cinco minutos), pertenece a una instancia con usuario/negocio/rol/versión de sesión inmutables y se elimina al cancelar, caducar, cambiar de contexto o cerrar. No se guarda en almacenamiento global. Una propuesta sin guardar nunca se convierte en un registro supuesto. Tras una escritura verificada solo se conserva el registro que la relectura confirmó.
- Al preparar un cambio referido a un resultado se vuelve a leer y comparar el registro. Si cambió o desapareció, se exige una nueva consulta. Antes de ejecutar siguen vigentes autorización, recheck, confirmación, escritura única y relectura. No hay reintentos automáticos de escrituras inciertas.
- Se retiraron «Tu solicitud», «De dónde sale esta información» y los detalles repetidos de la conversación principal. Diagnóstico, procedencia y notas quedan en un único apartado «Información de la conversación».
- Asesor comercial determinista: solo una necesidad concreta carga `/subscription` mediante el adaptador existente. Usa precios, límites, features y tratamiento impositivo recibidos. No consulta durante saludos. Propietario únicamente; respuestas tardías de otro contexto se descartan. El enlace lleva a la pantalla existente de planes: no crea solicitudes, pagos, contactos ni activaciones. Una recomendación de capacidad del producto no habilita operaciones pendientes de IAtry.

## Permisos conservados

| Rol | Individual | Negocio | Pro |
|---|---|---|---|
| Propietario | Operaciones bloqueadas | **17 herramientas: 7 lecturas + 10 escrituras** | Operaciones bloqueadas |
| Encargado | Bloqueado | Bloqueado | Bloqueado |
| Empleado | Bloqueado | Bloqueado | Bloqueado |

Edición de clientes: **solo notas**; identidad, contactos y consentimiento permanecen protegidos. Reservas, cancelaciones, notificaciones y las dos capacidades incompatibles no se habilitan. El asesor es información comercial, no una herramienta operativa nueva ni un cambio de esta matriz.

Las sesiones reales faltantes y el procedimiento mínimo están en [PERMISOS.md](PERMISOS.md). No se fabricaron membresías ni se modificaron planes. La evidencia PostgreSQL/adaptador de 114 observaciones anteriores se conserva; las nuevas pruebas no se presentan como homologación real de roles o planes.

## Verificaciones ejecutadas

- TypeScript y Vite: aprobados.
- Suite React completa: aprobada (entendimiento, personalidad, continuidad, descubrimiento y seguridad existentes).
- Backend: **255/255**; correos en memoria/loopback, sin envíos externos. Incluye tres regresiones nuevas de Nodemailer.
- Consolidación: referencias/TTL/duplicados/ordinales/filtros, edición contextual → precio → confirmación única → relectura simulada, cliente por ID y notas, descarte/creación, sesiones y asesor integrado: aprobadas. No hubo llamadas reales.
- Asesor puro: límites 1/4/10, ordinal de quinto profesional, catálogo y precios recibidos, feature, rol, homologación y datos insuficientes: aprobado.
- Permisos: **33 casos**, lista exacta de 17 y nueve combinaciones rol/plan, caducidad/cambio de sesión, proyecto, acceso y rutas materializadoras: aprobados.
- PostgreSQL aislado + adaptador cloud, perfil conectado: **19 resultados de operaciones y 2 combinaciones de seguridad**, confirmación, relectura, duplicación, negocio/RPC/plan: aprobados; cero peticiones externas.
- Release y artefacto: 7 lecturas/10 escrituras, propietario/Negocio, notas solamente, módulos de ensayo y cambios no aprobados rechazados: aprobados.
- Chrome y WebKit, 390×844 y 1440×900: listas, detalle, precio, ordinal, confirmación deshabilitada inicialmente, descarte, filtro, diagnóstico, ausencia de errores/desbordamiento y limpieza móvil: aprobados. Viewport móvil reducido a 390×460 para comprobar compositor. Sin capturas, videos, escrituras ni peticiones externas en estas pruebas.

La verificación de Actions se actualizó para ejecutar también `npm run test:iatry-consolidation`; Pages conserva compatibilidad con revisiones anteriores que no tienen ese script. El workflow remoto todavía no se ejecutó: requiere publicación/push posterior autorizado.

## Probar localmente

Abrir `http://127.0.0.1:3344/local-assistant`. Es SQLite temporal, usuario ficticio, correo deshabilitado y sin Supabase. Este entorno local no demuestra acceso productivo de Pro ni de otros roles: el artefacto conectado mantiene la matriz anterior.

1. «Mostrame mis servicios».
2. «Cambiale el precio al Servicio 1» → «600 pesos» → revisar propuesta. Solo se guarda con checkbox y confirmación; en esta vista el guardado sería exclusivamente local.
3. «Mejor dejalo como estaba» abandona la propuesta sin guardar; no revierte automáticamente algo ya confirmado.
4. Consultar otra vez, elegir un resultado y decir «Modificá ese», o «Ocultá el segundo».
5. «Mostrame los inactivos». «Ahora agregame otro» inicia un nuevo servicio, sin reutilizar el ID anterior.
6. «Quiero agregar el quinto profesional»: comparación solo si los entitlements actuales confirman un límite inferior. Si el plan ya lo permite, IAtry no recomienda comprar otro.

## Publicación y recuperación — ejecutar solo con autorización posterior

Referencia local preparada: `rollback/pre-iatry-final-consolidation-2026-10-28` → `9e0f1a8`. No se publicaron commits ni etiquetas en esta misión.

Antes de desplegar: comprobar `origin/main` y cambios de terceros, subir candidato y etiqueta, verificar que la etiqueta remota apunta al SHA completo anterior, ejecutar el workflow existente para el SHA aprobado y verificar sus comprobaciones. Mantener las variables actuales de dominio/proyecto público `djoxdtloqwbrhgtgencc`; nunca introducir claves administrativas.

Recuperación, después de que esa etiqueta esté publicada:

```sh
gh workflow run pages.yml --ref main -f source_ref=rollback/pre-iatry-final-consolidation-2026-10-28
```

Esperar el workflow exitoso y comprobar el dominio. El workflow hace checkout de `source_ref`: no necesita revertir ni forzar `main`. Recupera la versión anterior del frontend y su política, sin tocar Supabase. El rollback recupera también las dependencias históricas de esa revisión; la corrección actual de Nodemailer debe conservarse para la publicación normal.
