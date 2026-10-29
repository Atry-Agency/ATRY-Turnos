# Monitor HTTP público

29/10/2026. Se reemplazó el chequeo de `control-center.js`, eliminado por la migración React, por el descubrimiento de la entrada JavaScript real desde `index.html`. No se fija un hash de bundle ni un commit: los cambios normales de compilación siguen siendo válidos.

El monitor usa `https://atryturnos.com/`, comprueba que no redirija a otro origen y solicita solamente HTML, configuración pública, manifiesto, entrada React y declaración de compilación. Cruza la entrada con `react-assets.json`, rechaza JavaScript vacío o fallback HTML, comprueba el proyecto `djoxdtloqwbrhgtgencc` y el formato de clave pública. No ejecuta JavaScript descargado.

La declaración de IAtry debe conservar el alcance aprobado: propietario/Negocio, las 17 herramientas exactas con su separación lectura/escritura, edición de clientes solo notas, demo sin escrituras y ejecución automática desactivada. Un fallo se informa con código y salida de proceso 1; jamás imprime claves ni contenido descargado.

Validación focalizada: `node --test tests/monitor-public.test.js`, 5/5 grupos aprobados. Incluyen cambio de hash, archivos ausentes, fallback HTML, manifiesto inconsistente, proyecto/clave/scope incorrectos, módulo externo y redirección externa; metadatos se parsean como JSON, sin evaluación.

Comprobación HTTP pública de solo lectura aprobada el 29/10/2026 04:02 UTC: los cinco componentes respondieron 200; entrada publicada `/assets/app-pTPhVtE_.js`. No se llamó a Supabase ni se utilizó autenticación.

Ejecutar: `node scripts/monitor-public.js`. Los campos `auth`, `database` y `brevo` permanecen `unknown`: la disponibilidad HTTP y la declaración del artefacto no prueban permisos del servidor, reservas ni entrega de correo. Sin cambios de frontend, permisos o infraestructura.
