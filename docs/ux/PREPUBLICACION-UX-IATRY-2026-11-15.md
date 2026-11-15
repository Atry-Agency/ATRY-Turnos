# Candidato integrado UX premium + IAtry regional

Estado: comprobado localmente, pendiente de autorización final. Sin push, despliegue ni cambios de Supabase.

## Base y conservación

- Producción consultada en GitHub: `811650d5634d4cfe531cbb73b88b8c01025bbfb3`.
- Candidato UX original: `7a27c9b`; contiene esa versión de producción como ancestro.
- Mejoras de IAtry guardadas primero en su rama original: `a7d2303cfa14f7d4e279ccc7490776a04baf041d`, en `codex/multicountry-uy-pa`.
- Se integra ese commit en `codex/premium-ux-audit`, sin descartar ni incluir los archivos independientes de respaldo y documentación operativa pendientes en la otra carpeta de trabajo.
- Único conflicto de merge: el listado de pruebas de `scripts/react/unit.cjs`. Se conservan todos los tests de ambas ramas, con `premium-ux-components-test.cjs` e `iatry-panama-language-test.cjs` ejecutados exactamente una vez.
- Comparación contra `7a27c9b`: los componentes visuales UX permanecen idénticos.
- Comparación contra el commit regional: los siete archivos del entendimiento regional se conservan íntegros. La prueba regional se amplía con una regresión de presentación monetaria.
- Único ajuste adicional de presentación: la ficha previa de IAtry reutiliza la etiqueta regional `Precio (USD)` para Panamá. Se preservan los valores interpretados; no se modifica ningún cálculo, precio comercial o contrato monetario.

## Invariantes comprobados

Sin diferencias respecto de producción en `server`, `cloud`, `supabase`, `config`, dominio, suscripciones, reservas públicas, marketing, políticas productivas de IAtry, autorización ni herramientas de reservas.

Se conservan:

- Propietarios: Individual 16 herramientas; Negocio y Pro 17.
- Encargados y empleados con sus bloqueos actuales.
- Edición de clientes limitada a notas.
- Reservas, notificaciones y capacidades no homologadas bloqueadas en IAtry.
- Precios UY/PA publicados, selector automático/manual y contratación paga de Panamá bloqueada.
- Confirmación visual antes de escribir y verificación posterior del resultado.

## Evidencia del conjunto integrado

- Compilación y TypeScript aprobados.
- Suite React: 32 pruebas base más las suites de IAtry y las regresiones UX/regionales. Ambas nuevas suites se ejecutan juntas.
- Lenguaje: 26 variantes regionales; citas no operativas, saludos, horas ambiguas, fechas UY/PA, 18 combinaciones país/rol/plan y cero escrituras.
- Consolidación: contextos, asesor de planes, 33 casos de permisos y 34 comprobaciones finales, incluyendo adaptador cloud y PostgreSQL local. Sin llamadas externas.
- `premium-ux-browser.cjs`: 80 recorridos de pantalla/ancho/navegador; ocho envíos ficticios interceptados; valores opcionales conservados, precisión USD, teclado simulado, scroll, confirmaciones y contraste. Cero registros guardados.
- `iatry-regional-ux-browser.cjs`: ocho conversaciones de interfaz real con Chrome/WebKit, 390/1440 px, UY/PA. Saludo panameño sin acción; creación de borrador conservando datos; corrección a media hora; «ofi» permite preparar la revisión y completar campos opcionales, pero deja desmarcada la confirmación y deshabilitada la ejecución. Fecha con error ortográfico reconocida. Cero escrituras.
- Artefacto preparado mediante el constructor existente, usando únicamente la configuración pública actual de la web. `release-check.cjs` aprobado: 7 lecturas, 10 escrituras, proyecto esperado, restricciones por rol/plan/notas y ausencia de recursos privados. Sin consultas a Supabase.

No se sustituyen estas pruebas locales por afirmaciones de ensayos productivos nuevos. El teclado móvil se simula mediante el viewport visual; no se afirma una prueba en un iPhone físico.

## Publicación, únicamente tras autorización

1. Volver a comprobar que producción sigue en `811650d`; si cambió, integrar y verificar la diferencia antes de publicar.
2. Publicar y releer la etiqueta de recuperación local `rollback/pre-premium-ux-iatry-2026-11-15`, que apunta a `811650d`.
3. Publicar el candidato aprobado mediante el workflow existente `pages.yml`, conservando todas las variables y habilitaciones actuales.
4. Verificar los jobs, el artefacto servido y una comprobación de solo lectura de la interfaz publicada. No ejecutar ensayos de escritura.

Recuperación: volver a desplegar `811650d` o la etiqueta indicada usando `source_ref` del workflow. No aplicar migraciones inversas ni restaurar datos: esta entrega no modifica la base ni sus contratos.
