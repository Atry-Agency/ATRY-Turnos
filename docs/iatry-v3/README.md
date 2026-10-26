# IAtry V3 experimental

Última auditoría real de Servicios y alcance pendiente de autorización: [AUDITORIA-REAL-SERVICIOS.md](AUDITORIA-REAL-SERVICIOS.md).

Estado más reciente: [Integración Supabase y móvil](INTEGRACION-SUPABASE.md). Incluye la matriz cloud, exclusiones y límites de la auditoría remota.

Rama local `codex/iatry-v3-supabase`, basada en V2 (`599f974`). No publicada. Motor determinista sin modelos, APIs de IA, servicios pagos ni dependencias nuevas. El frontend publicado y Supabase no se modificaron.

## Probar

Con Node >=22.13 y las dependencias existentes:

```sh
npm --prefix frontend/react run build
node scripts/react/iatry-v3-preview.cjs
```

Abrir http://127.0.0.1:3322/local-assistant. El acceso es exclusivamente una sesión de prueba en SQLite en memoria; no requiere credenciales reales. Datos ficticios, correo deshabilitado, sin workers de envío ni conexión a Supabase. Al detener el proceso se pierde la base temporal. No compartir ni publicar este servidor de desarrollo. Cambiar el puerto mediante `ATRY_V3_PORT` si está ocupado.

1. Abrir IAtry: saludo, búsqueda y hasta tres propuestas de la pantalla actual.
2. «Explorar todas las funciones» abre las categorías secundarias. Buscar también encuentra cualquier capacidad autorizada por rol/plan.
3. Probar «Crear servicio»: responder, volver, cancelar o revisar resumen. La escritura requiere casilla y confirmación explícita. Resultado solo tras respuesta del servidor.
4. Probar «Mi negocio» y «Mostrame cómo». Las explicaciones no ejecutan acciones.
5. Abrir Preferencias: pausar movimiento. Probar también el movimiento reducido del sistema. El navegador conserva preferencias aisladas por usuario, negocio y rol.

La demo de producto (`?demo=1`) permite explorar, pero simplifica algunos contratos. La vista local anterior es la usada para validar operaciones completas. `?iatry=v2` y `?iatry=v1` conservan las comparaciones anteriores. La operación V3 conectada a Supabase permanece bloqueada: estos resultados no certifican RPC/RLS reales.

## Experiencia y energía

Panel lateral de superficie clara nacarada, no modal en escritorio, con buscador destacado y tres sugerencias contextuales. En pantallas desde 1440 px reserva una columna propia (380 px de panel; 420 px desde 1800), sin superponer los controles del contenido. Por debajo funciona como panel flotante y en móvil funciona como hoja modal protegida. La reserva solo existe mientras está abierto: cerrar o minimizar restaura el ancho original. No se cambian estilos del dashboard, navegación ni tipografías globales. Explorador y modos secundarios, preguntas de una en una y preferencias plegadas. Minimizar conserva el campo en edición y el paso actual; cerrar mantiene la cancelación previa. Escape devuelve el foco al botón; durante una escritura se conserva el bloqueo de cierre/navegación.

El emblema PNG oficial permanece intacto, centrado y estático. Debajo, tres corrientes de gradientes estáticos se desplazan y deforman independientemente mediante transformaciones; no hay giro del gradiente, filtros animados, canvas ni cambios de geometría por frame. Paleta ATRY: violeta, cian, verde y reflejos blancos.

| Estado real de conversación | Respuesta visual |
| --- | --- |
| Cerrado/reposo | Corrientes muy lentas, ciclo de 26 segundos |
| Abierto/preguntas | Corrientes más visibles, 9 segundos |
| Consulta/preparación/ejecución | Actividad mayor, 4,8 segundos y reflejos suaves |
| Resumen pendiente | Pulso delicado y corrientes de 14 segundos |
| Resultado confirmado | Una onda de luz de 850 ms |
| Error/resultado incierto | Atenuación contenida de 550 ms; no anuncia éxito |
| Cierre | Atenuación de 420 ms y vuelta a reposo |

Cada emblema observa su propia intersección. Fuera de pantalla o al ocultarse la pestaña se suspende la actividad. La pausa manual y `prefers-reduced-motion` desactivan las animaciones, conservando la identidad estática. Los únicos bucles de reposo son las tres capas pequeñas de energía visibles; no existe bucle de JavaScript. Una forma nacarada pequeña acompaña la presentación, sin capturar eventos ni invadir los controles; se detiene fuera de vista o al pausar el movimiento. No es una simulación física de fluidos.

## Capas y permisos

- Catálogo: 68 conversaciones con campos y contratos existentes; inventario completo en [CAPACIDADES.md](CAPACIDADES.md).
- Reconocimiento: intenciones acotadas, sin inferir argumentos ejecutables ni ejecutar frases automáticamente.
- Motor: pregunta, respuesta validada, vuelta, resumen, token de confirmación, ejecución y resultado.
- Datos: contexto autorizado de usuario/negocio/rol; caché por operación, catálogo seguro del empleado y descarte de respuestas tardías.
- Herramientas: reutilizan los parsers, validadores y endpoints de React; preparación sin acceso a un ejecutor arbitrario.
- Ejecución: lista explícita de rutas/métodos; sin DELETE, administración, cambios comerciales ni envíos.
- Memoria: preferencias y explicaciones; los contactos y respuestas operativas no se persisten.
- Presentación: componentes de conversación separados del motor y de sus acciones; estado visual derivado del estado funcional.

Se mantienen roles, capacidades del plan, acceso, validación final del servidor y aislamiento por contexto. La confirmación no se puede reutilizar. Conflictos informados como errores; pérdida de conexión tras enviar como resultado incierto, sin reintento automático. Borradores de otras pantallas bloquean escrituras de IAtry y no se sobrescriben.

## Validación local

- TypeScript y compilación: correctos; avisos existentes de `use client` de Motion y runtime-config externo no bloquean el build.
- 32 pruebas React, 10 verificaciones V2 y 16 grupos de seguridad V3: correctos.
- 68/68 capacidades verificadas contra contratos reales del backend local temporal. Las cuatro operaciones de visita, catálogo del empleado y tres operaciones adicionales de apariencia se verificaron de forma dirigida.
- Autorización HTTP local: propietario/encargado/empleado; negocio ajeno rechazado, agenda ajena del empleado rechazada, límites de plan y restricciones sobre reservas futuras conservados.
- Chrome y WebKit: servicio, cliente, reserva, reprogramación y cancelación; volver/cancelar sin escritura, doble confirmación sin duplicado, borrador externo protegido.
- Presentación en ambos motores: hasta tres propuestas, categorías secundarias, geometría del dashboard estable, panel dentro de 320/390/1440 px, foco/Escape, siete estados visuales, pausa, movimiento reducido y suspensión fuera de pantalla.
- Muestra Chrome con corrientes activas: cero layouts y aproximadamente 0,04 ms de JavaScript durante 1 segundo. No es una garantía para todos los dispositivos.
- Comparación local, cinco contextos alternados por variante, Chrome sin throttling, mismo build/backend SQLite: Servicios V2 18,2 ms; V3 20,8 ms (medianas). Dos consultas de ruta en ambas. Primera apertura V2 358 ms; V3 379 ms, medición de pared incluyendo automatización y transición. Abrir IAtry no agrega consultas. En 1,5 segundos de reposo, JavaScript mediano 0 ms en ambas. No son mediciones de latencia Supabase ni equivalentes a las mediciones históricas de demo.

Comandos de pruebas: `npm --prefix frontend/react test`; scripts `scripts/react/iatry-v3-{local,security,authorization,browser,energy,panel,performance}.cjs`. Los de navegador requieren Playwright y los binarios ya disponibles en el entorno de desarrollo. No producen capturas, videos ni PDF. El script de inventario utiliza los resultados locales temporales; sin esos registros indica «Sin registro de prueba reciente».

## Problemas corregidos y límites

Se corrigieron el catálogo/selección de contactos del empleado, reconocimiento de imperativos y órdenes de eliminación no soportadas, resultados ajustados por el servidor, agregados vacíos del backend local, descarte de lecturas canceladas y protección de borradores. En presentación se eliminó la regla heredada que ocultaba primeros pasos al abrir V3; V1/V2 conservan su comportamiento. El foco inicial evita el desplazamiento de la página.

Pendientes explícitos: selección/recorte y subida de archivos, exportación de datos personales, creación privada de visitas combinadas (no existe el contrato privado correspondiente) y comparación de períodos arbitrarios. Comercial, accesos, administración, identidad de cuenta, eliminaciones y envíos se mantienen fuera de la automatización. Las operaciones de visitas existentes sí permiten consulta, confirmación, cancelación y reprogramación completas.

Veredicto: versión operativa local disponible para revisión, con controles de seguridad y presentación simplificada. No lista para publicar las operaciones V3: falta validar su adaptación y autorización contra un entorno Supabase autorizado. Ninguna prueba local demuestra por sí sola las políticas RLS o la entrega de notificaciones de producción.

## Revisión estética del panel · 2026-10-26

Aplicada la referencia exclusivamente al asistente: superficie nacarada clara, encabezado con minimizar/cerrar, pregunta principal, buscador y tres propuestas con iconos. Modos y preferencias quedan en accesos secundarios. Emblema, motor, catálogo, permisos y contratos operativos sin cambios respecto a `220bd03`.

Comprobaciones afectadas: compilación; flujos operativos en Chrome/WebKit; siete estados de energía y pausa; minimizar/retomar conserva un campo todavía sin responder; anchos 320, 390, 768, 1024, 1440 y 1920; contraste de texto secundario frente al matiz más oscuro del panel; colores externos personalizados; restauración exacta de la geometría al cerrar; tipografía y colores originales de dashboard y navegación conservados. Abrir el panel no agrega consultas ni escrituras. Corregidas la tipografía de títulos heredada y la ausencia de un helper de etiqueta accesible propio del asistente. Sin dependencias nuevas ni publicación.
