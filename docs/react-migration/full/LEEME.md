# Revisión integral React — entrada de lectura

- [Informe técnico exhaustivo](INFORME.md): arquitectura, inventario, contratos, retiro de controladores, seguridad, límites y ejecución.
- [Mediciones verificadas](MEDICIONES.md): rendimiento, todos los bundles y diferencias visuales por carpeta.
- [Estado local](ESTADO.md).
- [PDF con capturas incrustadas](<../../../output/pdf/React - Revision integral y capturas.pdf>).
- [Evidencia bruta](evidence/).

El PDF incluye una selección amplia de comparaciones reales; los 500 pares completos están en las carpetas de evidencia. La landing larga se divide en tramos con solapamiento para conservar legibilidad. El manifiesto del PDF identifica imágenes y páginas.

## Resultados de aprobación

| Área | Evidencia |
| --- | --- |
| Regresión 243/243 | `legacy-regression.txt` |
| React 32/32 | `unit-tests.txt` |
| Distribución 6/6 | `deployment-react.txt` |
| Shell y navegación | `native-shell/qa.json`, `native-shell/visual.json` |
| Cuenta y negocios | `native-http.json` |
| Registro y contraseña | `native-auth-http.json` |
| Invitaciones y empleado | `native-invitation-http.json` |
| Reservas y visitas HTTP | `native-public-http.json` |
| Administración | `native-admin-http.json` |
| Cloud aislado/reautenticación | `native-cloud.json` |
| Landing y demos | `native-marketing.json`, `native-marketing/visual.json` |
| Temas | `native-themes.json` |
| Offline/cache | `native-pwa.json` |
| Teclado/foco/preview | `native-accessibility.json` |
| Agenda interactiva nativa | `agenda-functional.json` |
| Fotos, configuración y operación | `team-functional.json`, `settings-functional.json`, `operations-http.json` |
| Rendimiento | `native-performance.json` |
| Píxeles | `pixel-audit.json`, `pixel-audit-summary.json` |
| Main e IAtry | `protected-sources.json` |

Los archivos `failed` son diagnósticos históricos anteriores a su corrección. No deben confundirse con la aprobación de la suite correspondiente.

Todo permanece local. La validación de frontend no habilita publicar ni declara validado un backend cloud remoto. Consultar los límites y recomendación del informe antes de sustituir la versión anterior.
