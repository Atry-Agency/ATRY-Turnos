> Revisión posterior: la entrada React autónoma y su evidencia están en [full/LEEME.md](full/LEEME.md). El contenido de este documento corresponde a las primeras etapas.

> **Entrega vigente: [Etapa 2 - Servicios](stage2/LEEME.md).** La documentación siguiente describe la base histórica de etapa1.

# Primera entrega - React local

1. [Auditoría](AUDITORIA.md)
2. [Matriz de conservación](MATRIZ.md)
3. [Dependencias y arquitectura propuesta](ARQUITECTURA.md)
4. [Etapas, riesgos y puertas de calidad](PLAN-Y-RIESGOS.md)
5. [Resultados y mediciones](RESULTADOS.md)
6. [Inventario de fuentes, símbolos, formularios, acciones, RPC y pruebas](source-inventory.json)
7. Capturas PNG y resultados brutos en `evidence/`; PDF con imágenes incrustadas en `../../output/pdf/`.

## Reproducir

Desde la raíz de este worktree (Node >=22.13):

```sh
npm ci --ignore-scripts
npm test
npm --prefix frontend/react ci
npm --prefix frontend/react run build
npm --prefix frontend/react test
npm --prefix frontend/react run dev
```

Abrir React: http://127.0.0.1:3321/legacy/?demo=1&plan=2&react=1&built=1#/app/servicios

Abrir referencia JS: http://127.0.0.1:3321/legacy/?demo=1&plan=2#/app/servicios

`built=1` usa el bundle compilado; omitirlo utiliza módulos de desarrollo. Para capturas se agrega capture=1 en ambas variantes (oculta el banner demo mediante la opción existente). Cambiar plan=1/2/3 conserva fixtures y capacidades originales. La app sigue mostrando datos ficticios, sin Supabase.

QA de navegador (requiere Playwright y Google Chrome instalados; se usó el runtime de Codex):

```sh
NODE_PATH='/Users/rodrigobrun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' node scripts/react/qa.cjs
```

Para regenerar las estadísticas y el PDF con el Python de Codex (Pillow/reportlab): `python3 scripts/react/report.py` y `python3 scripts/react/captures.py`.

El script bloquea peticiones externas y fija sólo Date, conserva performance.now real. Ejecuta 15 pares de capturas + un tema personalizado, acciones sobre la tarjeta y 5 muestras de tiempos por variante. No requiere .env ni seed de servidor. La demo pública de un servicio se selecciona explícitamente en memoria para medir servicio/profesional; la lógica de visitas combinadas permanece intacta.

No ejecutar build:pages, deploy, push, migraciones ni conectar credenciales productivas para esta evaluación. Los servidores previos y la versión IAtry de puerto3319 se conservan.

Estado de entrega: archivos guardados localmente, sin publicación ni merge. Las otras funcionalidades siguen legacy. La siguiente etapa requiere revisión del usuario.
