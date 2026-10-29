# Cierre local de IAtry V3 — 29/10/2026

Base publicada: `9c65b17be09e88613bb5aaa0d8aa7822d5d1a1ee`. Candidato único en `codex/iatry-v3-closeout`. No se publica, no se amplían los permisos productivos y no se modifica Supabase. Monitor y permisos se prepararon en worktrees independientes; la integración y las compilaciones se hicieron en una sola carpeta, sin compilaciones simultáneas.

## Corregido

- Las referencias posicionales admiten ordinales y marcadores numéricos (`al segundo`, `del 2`, `número 2`, `#2`). Los importes, duraciones y fechas no son índices. La intención y los datos originales se interpretan antes de completar un tema elíptico con el contexto anterior: «cambia el precio del 2 a 500» conserva el precio 500 y toma el ID de la segunda fila autorizada.
- Los datos ya proporcionados se conservan al seleccionar/corregir un registro. Una corrección del objetivo requiere aceptar la modificación de la propuesta. Una referencia irresoluble elimina el objetivo pendiente y bloquea la preparación, conservando el precio/demás datos para que el usuario pueda elegir nuevamente.
- «Ese» usa la selección concreta; «el anterior», la selección anterior; «el último», el último resultado de la lista vigente, no un supuesto orden de creación. Nombres duplicados, referencias contradictorias, posiciones fuera de rango, caducidad y cambio de sesión no proporcionan IDs inventados. Se conservan relectura previa, confirmación y verificación posterior.
- «Confirmo» reconoce una propuesta pendiente sin escribir, sin marcar el checkbox y sin generar consentimiento. Desde el borrador puede abrir la revisión; desde la revisión mantiene la propuesta y exige el control visual «Confirmar y ejecutar». No equivale a éxito ni habilita reintentos de operaciones inciertas.
- Los temas explícitos tienen prioridad sobre el conjunto anterior: servicios → profesionales/clientes/horarios no arrastra «servicio» ni su ID. Incorporar profesionales dirige a Equipo y al asesor de capacidad existente; no crea una herramienta de incorporación ni solicita datos de un servicio.
- El monitor deja de buscar `control-center.js`. Descubre el módulo React actual desde HTML/manifiesto y valida dominio canónico, proyecto, clave pública, alcance exacto de 17 herramientas, notas solamente y demo sin escrituras. No ejecuta JavaScript remoto. Monitor público corregido probado con salida 0; su workflow remoto no se ejecuta hasta una publicación posterior autorizada.

No se modifican CSS, colores, emblema, animaciones ni diseño del panel. Los ajustes de React se limitan al enrutamiento conversacional y a la confirmación existente.

## Perfiles preparados y alcance real

| Perfil | Preparado localmente | Habilitado en producción |
|---|---:|---:|
| Propietario Individual | 16; sin estadísticas, límite 1 profesional | 0: falta sesión real |
| Propietario Negocio | 17; límite 4 profesionales | **17: alcance actual conservado** |
| Propietario Pro | 17; límite 10 profesionales | 0: falta sesión real |
| Encargado Negocio | 17 según contratos del backend | 0: falta sesión real |
| Encargado Pro | 17 según contratos del backend | 0: falta sesión real |
| Empleado, cualquier plan | 0 herramientas administrativas de esta etapa | 0 |

La matriz de las 17 herramientas y las pruebas por perfil están en [PERMISOS.md](PERMISOS.md). No fue necesario cambiar la política productiva ni crear una segunda implementación de permisos. Clientes: identidad/contactos/consentimiento siguen bloqueados en el perfil real; edición únicamente de notas. Reservas, cancelaciones, notificaciones, creación de profesionales y las dos incompatibles siguen fuera.

Para homologar las cuatro columnas nuevas hacen falta sesiones normales existentes de propietario Individual, propietario Pro, encargado Negocio y encargado Pro, siempre de negocios ficticios autorizados. Para verificar una denegación real de empleado, además una sesión con profesional asignado. Pueden ser personas con varias membresías; no se exigen cuentas nuevas. Primero solo identidad/entitlements/lecturas. Cada escritura real futura requiere autorización de registros y campos concreta. No se cambian planes ni membresías para simular perfiles.

## Validación

- TypeScript y compilación Vite: aprobados; suite React completa: aprobada.
- Conversaciones: precios con/sin símbolo, ordinal/número, reuso de hechos, cambio y pérdida de referencia, confirmación verbal sin escritura, temas explícitos y asesor: aprobadas. Cero escrituras o llamadas externas en estas regresiones.
- Permisos de cierre: **34 comprobaciones**, nueve combinaciones rol/plan y cinco perfiles mediante diez lecturas cloud/PGlite; límites 1/4/10, estadísticas Individual ausentes, sin correo/notificaciones.
- Se reutilizan las **114 observaciones PostgreSQL/adaptador** anteriores. La regresión del perfil conectado conserva confirmación, escritura única, relectura y aislamiento; ninguna prueba local se presenta como homologación real de otro perfil.
- Monitor: **5 grupos** de pruebas negativas/positivas aprobados y HTTP público corregido con salida 0. Ver [MONITOR.md](MONITOR.md).
- Seguridad: lista exacta 17, nueve perfiles de política, notas solamente, sesión/negocio/proyecto, rutas materializadoras bloqueadas y rechazo de artefactos alterados: aprobados. Auditorías npm sin vulnerabilidades en el alcance revisado.
- Chrome/WebKit, 390×844 y 1440×900, con viewport móvil 390×460: listas, referencia inválida y recuperación sin perder el importe, propuesta correcta sin volver a preguntar precio, «Confirmo» sin checkbox ni escritura, cambio de tema, asesor, scroll/cleanup móvil y movimiento reducido: aprobados. Sin capturas, videos ni peticiones externas.

Comandos de regresión integrados en `npm run test:iatry-consolidation`; los workflows existentes ya ejecutan ese comando. El monitor no consulta Auth, datos privados ni Supabase: su resultado no se presenta como prueba de autenticación o correo.

## Vista previa

`http://127.0.0.1:3344/local-assistant` abre una sesión ficticia de SQLite temporal, correo deshabilitado, sin Supabase. No usar credenciales reales en esta vista. La preparación local de planes/roles no concede accesos productivos.

Recorrido: «Mostrame mis servicios» → «Cambiale el precio al segundo a $500» → «Confirmo». Debe abrirse la ficha de revisión con precio 500; sigue siendo obligatorio marcar la casilla y confirmar visualmente. No hace falta guardar para comprobarlo. Podés probar «el 99» y luego «el segundo» mientras se prepara el borrador: debe volver a resolver el servicio y conservar el precio. «Mejor dejalo como estaba» descarta lo no guardado. Después consultar profesionales o pedir el quinto profesional no debe preparar otro servicio.

## Publicación y rollback preparados, no ejecutados

Etiqueta local `rollback/pre-iatry-v3-closeout-2026-10-29` → `9c65b17`. El artefacto candidato declara esa revisión como recuperación y mantiene 7 lecturas/10 escrituras propietario/Negocio; Individual/Pro/encargados continúan bloqueados.

Con aprobación posterior: verificar `origin/main` y ausencia de cambios ajenos, publicar y verificar la etiqueta, subir el candidato aprobado y usar Pages existente. No hay migraciones ni pasos de Supabase.

Tras publicar la etiqueta, recuperación mediante el workflow existente:

```sh
gh workflow run pages.yml --ref main -f source_ref=rollback/pre-iatry-v3-closeout-2026-10-29
```

El workflow hace checkout de la revisión anterior; no hace falta force-push ni revertir datos. Verificar el workflow y el dominio al finalizar. Esta misión no realiza push, despliegue, cambios de suscripción ni ensayos productivos.
