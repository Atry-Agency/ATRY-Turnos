# IAtry V3: comprensión determinista, confianza y atribución del chat

Estado: candidato local; sin publicación, backend nuevo, dependencias nuevas ni cambios en Supabase.

## Auditoría previa

Se comparó el intérprete comprometido en Git con el candidato utilizando exactamente las mismas frases sintéticas. El script de comparación lee archivos mediante `git show`; no hace checkout, reset ni modifica la copia de trabajo.

Limitaciones confirmadas:

- `language.ts` aplicaba equivalencias y distancia de edición a una cadena completa. No conservaba evidencias ni posiciones para distinguir vocabulario operativo de valores literales. Las transposiciones solo tenían tratamiento específico en fechas.
- Las expresiones regulares de `intent-catalogue.ts` dependían del orden acción → objeto y de distancias cortas entre palabras. «Fren, poneme un servicio más» y «Un servicio nuevo agregame» quedaban sin intención.
- La alternativa de `recognition.ts` contaba palabras coincidentes con títulos y alias. Dos palabras comunes podían bastar para interpretar una instrucción; no había una clasificación común de negación, hipótesis o pregunta informativa.
- «No quiero crear un servicio», «¿Cómo agrego un servicio?» y una cita de otra persona podían generar propuestas de creación. Esto no ejecutaba escrituras, pero era una interpretación incorrecta.
- La memoria de resultados ya era privada, autorizada y de cinco minutos para servicios/clientes. Se conservó ese contrato; faltaban protección frente a autocorrección en comparaciones y una ruta explícita para «otro igual».
- En el chat, `align-self` no podía alinear mensajes cuando el padre no era flex. La burbuja propia podía quedar junto al margen izquierdo en respuestas sociales y otros contenedores.

## Implementación en los propietarios existentes

### Léxico y valores

`language.ts` expone un análisis reutilizable con texto original, posiciones, token normalizado, protección literal y tipo de corrección. `literalLanguage` permite comparar nombres sin pasar por autocorrección.

Las reparaciones aproximadas requieren un candidato canónico único, primera letra coincidente, palabras de al menos cinco caracteres y una edición. La distancia OSA Damerau-Levenshtein reconoce transposiciones adyacentes. Las repeticiones de tres o más letras se comprimen únicamente si producen vocabulario conocido. Abreviaturas como `svc`, `cli` y `prof` tienen equivalencias revisadas y requieren confirmar la intención.

Se conservó el tratamiento temporal más restrictivo: no convertir «manada» en mañana mediante una sustitución. Los nombres explícitos/entre comillas, teléfonos, identificadores, importes y horas no reciben reparaciones de intención. Los valores se extraen del texto original, no del texto autocorregido. Las muletillas se retiran en los límites, sin eliminarlas arbitrariamente dentro de nombres.

### Registro y confianza

`IntentSpec`, adjunto a las herramientas por `registerIntent`, registra acciones/conceptos, entidades, atributos, ejemplos, campos requeridos del contrato y restricciones. Las 17 herramientas homologadas tienen metadatos. `Capability.intent` permite registrar una capacidad futura en el mismo mecanismo; la prueba incluye una capacidad ficticia sin agregar reglas al intérprete.

Los permisos siguen perteneciendo a `access.ts`, la política de producción y el servidor. Los metadatos lingüísticos no otorgan permisos ni amplían las 17 herramientas.

La confianza es categórica y explicable, no una probabilidad:

| Nivel | Evidencia | Conducta |
| --- | --- | --- |
| Alta | Una intención inequívoca con acción/objeto y atributos pertinentes, o patrón específico existente compatible | Solicitar/completar datos; conservar revisión y confirmación |
| Media | Reparación aproximada, abreviatura, creación inferida de «nuevo» o copia contextual | Mostrar una pregunta sencilla con aceptar/rechazar; sin iniciar el paso |
| Baja | Negación, hipótesis, alternativas, contradicción, antecedente ausente o texto insuficiente | Aclarar o mostrar las acciones disponibles; sin propuesta ejecutable |

Las preguntas informativas se clasifican como tales y no generan cambios. La confianza también registra candidatos y razones concretas. Las repeticiones de palabras no suman evidencias artificialmente.

`instructions.ts` mantiene la interpretación, las semillas y los límites existentes. Las cláusulas conservan sus valores originales; cada parte debe ser entendida y se mantiene el límite de tres pasos, con revisión individual. Una parte negativa, no soportada o incierta impide preparar solo la parte restante.

### Contexto y confirmación

- Los resultados/selecciones deben ser autorizados, inequívocos y de no más de cinco minutos.
- Las comparaciones de nombres usan el normalizador literal; `Servisio` y `Servicio` no se confunden por autocorrección.
- «Hacé otro igual» solo acepta un servicio seleccionado o un resultado único vigente. Pregunta primero, copia nombre/descripción/precio/duración y nunca copia identificadores, asignaciones ni otros atributos operativos.
- Antes de preparar la copia se relee el origen y se verifica que no cambió. Un origen vencido o modificado exige consultar de nuevo.
- «Mejor cambiá la hora» requiere un antecedente de turno identificado en una propuesta vigente; sin él pide aclaración. No habilita herramientas de reservas fuera de los permisos existentes.
- Usuario, negocio y versión de sesión continúan formando el alcance. La invalidación borra referencias, semillas y estado de conversación.
- Ni «sí» en una aclaración, ni una confianza alta, ni una reparación léxica son autorización de escritura. Se conservan datos obligatorios, validación, autorización, vista previa, token vigente, consentimiento visual y relectura.

### Presentación

`chat.css` añade márgenes lógicos a la burbuja compartida para que propios queden a la derecha y respuestas a la izquierda incluso con un padre de bloques. El historial conserva esa atribución. Los dos asistentes administrativos conservan el mismo tratamiento mediante su hoja original. No se cambiaron colores, tamaños, navegación ni diseño de tarjetas.

## Medición reproducible

Corpus manual: 135 frases positivas y 54 negativas, más un conjunto adicional de validación de 21 positivas y 20 negativas. Son ejemplos sintéticos revisados, sin conversaciones privadas. El conjunto adicional se utilizó también para revisar un caso de relación entre objetos («bloqueos del equipo»); no se presenta como una evaluación ciega externa.

| Métrica sobre las mismas frases | Intérprete comprometido | Candidato local |
| --- | ---: | ---: |
| Positivas resueltas a la intención esperada | 118 / 156 | 156 / 156 |
| Negativas con propuesta de acción | 33 / 74 | 0 / 74 |
| Confusiones a otra intención aceptada en las positivas | 0 | 0 |

Una negativa también se cuenta como falso positivo si sugiere una única intención probable, aunque todavía pida aceptarla.

«Resuelta» incluye una intención probable que exige aceptar una aclaración antes de continuar; no significa ejecución. El reporte separa respuestas directas, aclaraciones, niveles y matriz por intención. No se extrapola esta tasa a todo el español.

Además se prueban 17 transposiciones generadas —una por intención— y 135 negaciones antepuestas a las frases positivas. El candidato resuelve las 17 transposiciones a la intención correcta y rechaza las 135 negaciones, sin confundir herramientas.

Comandos:

```sh
node scripts/react/iatry-language-baseline.cjs f87783b9cf5c56ab3b1c38c3e40f7050b9db78b1
npm run test:iatry-language
npm run test:react
npm run test:iatry-consolidation
npm test
npm run build
NODE_PATH=<directorio-local-de-playwright> node scripts/react/iatry-language-browser.cjs
```

`test:react` incluye el nuevo corpus y las pruebas de contexto. Se generan reportes sintéticos en `/tmp/atry-robust-language-report.json` y `/tmp/atry-language-baseline-report.json`. No hay telemetría de mensajes ni modificación automática de reglas.

## Límites deliberados

No se promete comprender cualquier frase ni corregir palabras arbitrarias. Más de una edición, vocabulario desconocido, datos contradictorios y referencias sin antecedente pueden requerir aclaración. Solo hay memoria de entidades para las fuentes ya autorizadas y contexto de propuestas identificado; no se infiere acceso a otros catálogos ni se busca en datos privados para adivinar un nombre.

Las verificaciones de navegador usan Chrome/WebKit y datos ficticios locales, sin capturas. No equivalen a probar en un iPhone físico, VoiceOver ni una sesión real de producción.

## Verificación de esta entrega

- Compilación TypeScript/Vite: aprobada.
- `npm run test:react`: aprobada, incluido el nuevo corpus/contexto y las regresiones de personalidad, lenguaje Uruguay/Panamá, permisos, presentación y seguridad.
- `npm run test:iatry-consolidation`: aprobada; misma disponibilidad 16/17 según plan/rol, sesiones, referencias y contratos.
- `npm test`: 270 aprobadas, cero fallos.
- Nuevo recorrido `iatry-language-browser.cjs`: Chrome/WebKit en 320, 375, 390, 430, 768 y 1440 px; 12 combinaciones. Cinco expresiones equivalentes, aceptación de confianza media, negación, conversación de varios turnos, alineación social/administrativa, sin desbordamiento ni escrituras.
- Recorrido existente `iatry-instructions-browser.cjs` sobre la compilación final: Chrome/WebKit en 390 y 1440 px; alta/corrección, revisión, consentimiento explícito y relectura en SQLite local, períodos AM/PM, plan compuesto y consultas consecutivas.
- `git diff --check`: aprobado. Sin modificaciones en servidor, cloud, migraciones, política de producción ni dependencias. El cambio de `package.json` solo registra el comando de pruebas.

Las escrituras de integración son exclusivamente de fixtures locales desechables. No se realizaron solicitudes de escritura a producción ni envíos reales. Las correcciones previas del hover del sidebar permanecen en la copia local y no se publicaron.

## Corrección posterior: verbos con pronombre y errores en la raíz

Se detectó un hueco real en expresiones coloquiales: una raíz con una letra omitida seguida de `te` no entraba en la reparación de una sola edición de la palabra completa. La revisión permite separar un pronombre enclítico conocido (`me`, `te`, `se`, etc.) y comparar la raíz únicamente con verbos operativos conocidos, manteniendo una edición y un candidato canónico único. Las reparaciones aproximadas continúan en confianza media.

La corrección es compartida por crear, publicar, ocultar y modificar, no una equivalencia para una frase concreta. Se agregaron ejemplos sintéticos revisados en distintas herramientas, sus negaciones y nombres literales que coinciden con formas de verbos. Un cierre coloquial después de «servicio» no se utiliza como nombre ni se transforma en una categoría o público. Un nombre explícito sí se conserva.

Verificado en Chrome y WebKit, 390/1440 px: se pregunta si se desea crear un servicio y después se pide el nombre, sin inferir datos ni escribir. Compilación y regresiones React aprobadas. Continúa exclusivamente en local.
