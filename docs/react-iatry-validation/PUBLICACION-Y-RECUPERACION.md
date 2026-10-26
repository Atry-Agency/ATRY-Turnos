# Publicación React + IAtry y recuperación

Preparación del 25/10/2026. Repositorio `Atry-Agency/ATRY-Turnos`.
No se publicó durante esta preparación. Se requiere confirmación del titular para el despliegue público.

## Revisiones conservadas

- Frontend publicado anterior: `9a5a0d6ad6b6a1b1373f0079021ab67bc5517dc6`.
- Etiqueta de recuperación: `rollback/pre-react-iatry-2026-10-25`.
- Despliegue anterior comprobado: https://github.com/Atry-Agency/ATRY-Turnos/actions/runs/40035133111 (build y deploy exitosos; confirmado en Settings > Pages actualizado).
- Candidato nuevo: commit señalado por `release/react-iatry-2026-10-25-rc1`, en `codex/react-iatry-consolidation`. El hash exacto se comunica al pedir confirmación. No se modifica después sin repetir las comprobaciones afectadas y mostrar la nueva revisión.
- Las etiquetas se preparan localmente; se enviarán junto con las referencias necesarias después de la confirmación. Ningún push se realizó en esta fase.

## Configuración conservada

GitHub Pages mediante GitHub Actions, dominio `atryturnos.com`, HTTPS activo, rutas por hash y página `descubrir.html`. Sin modificaciones DNS ni de ajustes del hosting.
Supabase definitivo: `djoxdtloqwbrhgtgencc`. El paquete usa la URL y clave pública verificadas desde el runtime público actual; la clave no se incluye en este documento ni en commits. El paquete generado está en `dist/github-preview`, ignorado por Git. Las variables existentes del repositorio se reutilizan al desplegar. La comprobación del artefacto bloquea destino incorrecto, preview desconectado, claves privilegiadas y cualquier bloqueo experimental de arranque.
No se cambiaron `cloud/` ni `supabase/` respecto del commit publicado; no se ejecutaron RPC, migraciones ni operaciones de Auth/Storage.

## Verificaciones terminadas

- Build Vite + TypeScript correctos.
- 252/252 pruebas generales y 32/32 React.
- 21 rutas comprobadas localmente sobre el paquete a publicar: pantallas privadas en demo ficticia, reserva pública demo y formulario de login anónimo sin enviar credenciales. Conexiones externas bloqueadas. Sin capturas, videos ni PDF.
- 108 archivos del manifiesto presentes y runtime cloud del proyecto correcto.
- El frontend anterior se reconstruyó desde el código de la etiqueta, con dependencias instaladas correspondientes al lockfile sin cambios. Se verificaron sus entradas `app.js` y `cloud-backend.js`. No se contactó Supabase. El artefacto original de Actions ya no está disponible, por lo que el rollback reconstruye desde la revisión conservada.
- El workflow admite `source_ref` y compila React solo si está presente en la revisión elegida; permite reconstruir también la versión anterior.

No equivalen a pruebas completas de RLS/EXECUTE ni a una restauración de datos: los recorridos reales se comprobarán manualmente tras publicar. El respaldo de base/Storage no se completó ni se restauró. Esta estrategia de rollback recupera el frontend; no revierte datos ingresados durante el uso ni cambios de terceros en Supabase.

## Publicación, solo tras confirmación

1. Verificar que `origin/main` sigue en el commit anterior. Si cambió, detenerse y revisar las diferencias; no forzar un push.
2. Publicar las etiquetas identificables de recuperación y candidato.
3. Actualizar `main` al commit candidato aprobado mediante avance directo, sin force-push. El push activa `.github/workflows/pages.yml`.
4. Esperar build y deploy exitosos; confirmar en Pages que la ejecución pertenece al commit aprobado y mantiene el mismo dominio.
5. Revisar primero carga/login y después, con el titular, agenda, reservas, servicios e IAtry. No efectuar pruebas destructivas ni envíos reales sin instrucción específica. Si hay un problema grave, ejecutar recuperación.

## Recuperación exacta

Desde GitHub, después de que el nuevo workflow esté en main:

1. Abrir https://github.com/Atry-Agency/ATRY-Turnos/actions/workflows/pages.yml.
2. Pulsar **Run workflow**, seleccionar rama **main** y escribir en **source_ref**:
   `rollback/pre-react-iatry-2026-10-25`.
3. Ejecutar el workflow y esperar build/deploy exitosos. El workflow nuevo hace checkout del código anterior y lo publica en el mismo hosting utilizando las mismas variables públicas.
4. Confirmar que el checkout del job corresponde a `9a5a0d6ad6b6a1b1373f0079021ab67bc5517dc6` y que Pages vuelve a servir el frontend anterior.
5. Recargar la aplicación conectado a Internet. Ambos service workers priorizan red; si una pestaña instalada conserva la interfaz anterior, cerrar/reabrir o hacer recarga completa. No borrar almacenamiento de sesión ni datos de usuario automáticamente.

No hace falta borrar commits, restaurar base de datos, ejecutar migraciones ni cambiar dominio. Main conservará el código nuevo aunque se haya desplegado el antiguo; evitar nuevas publicaciones hasta resolver la incidencia, porque un nuevo push a main podría volver a publicar React.

Alternativa de operador con GitHub CLI, si está disponible y autenticada (no se instaló ni ejecutó):

```sh
gh workflow run pages.yml --repo Atry-Agency/ATRY-Turnos --ref main -f source_ref=rollback/pre-react-iatry-2026-10-25
```

La confirmación de publicación no implica que el rollback ya se haya ejecutado públicamente. Su reconstrucción local está verificada; el despliegue público de recuperación usaría el mismo pipeline de Pages.
