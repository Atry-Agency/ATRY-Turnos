# IAtry: español de Panamá, Uruguay y neutro

Candidato local; sin publicación, llamadas remotas ni cambios de Supabase.

## Cambios

- Normalización compartida de contracciones (`pa'l`, `pa’l`), vocativos al inicio, abreviaturas de consultas y verbos equivalentes. Se conservan las entidades originales; no se reemplazan nombres por identificadores ni se convierten globalmente las palabras «cita» en reservas.
- Reglas existentes ampliadas para citas, cupos, reprogramación y consultas de indicadores. Verbos delimitados para no interpretar «pasado mañana» como «pasar una cita».
- Saludos panameños y expresiones sociales utilizan la personalidad existente, sin forzar modismos ni consultar el backend.
- «Ofi», «dale» y «de una» reconocen una propuesta pendiente, pero no representan consentimiento visual ni ejecutan operaciones. Pueden aceptar una corrección conversacional; la escritura conserva su confirmación independiente.
- Horarios ambiguos y expresiones vagas piden precisión y no sustituyen intervalos aceptados. No se asigna medianoche a solicitudes con «ahorita» o una hora ambigua.
- Las fechas relativas siguen utilizando el día del negocio autenticado: America/Panama o America/Montevideo. La prueba comprueba el mismo instante en lados distintos del cambio de fecha.

## Límites conservados

Propietarios: Individual 16 herramientas; Negocio y Pro 17. Encargados y empleados conservan bloqueos productivos. Edición de clientes limitada a notas. Las operaciones de reservas reconocidas continúan sin habilitarse desde IAtry. Sin nuevos contratos, APIs ni dependencias.

«¿Cuánto hice hoy?» se reconoce como una solicitud de ingresos, pero se explica que no existe una consulta homologada de ingresos diarios: los indicadores disponibles abarcan 30 días y no acreditan cobros. No se inventa una cifra ni se presenta ese período como un total diario.

## Verificación reproducible

- `node scripts/react/iatry-panama-language-test.cjs`: 26 variantes regionales, negativas de citas textuales y palabras parecidas, saludos sin órdenes, confirmaciones contextuales, horas ambiguas, límites de fecha UY/PA y 18 combinaciones país/rol/plan; cero transporte.
- Integrada en `npm run test:react`, junto con las regresiones existentes de lenguaje, continuidad, referencias, personalidad y seguridad.
- `node scripts/react/iatry-closeout-permissions-test.cjs`: permisos y adaptador/PGlite locales.
- `node scripts/react/iatry-phase-one-artifact-test.cjs`: alcance productivo y bloqueo de alteraciones.
- `npm run build`: TypeScript y artefacto compilado.

Estas pruebas acreditan el comportamiento local del motor; no equivalen a nuevos ensayos de Supabase real ni habilitan capacidades pendientes.
