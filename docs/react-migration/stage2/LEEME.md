# Etapa 2 - Servicios en React

- [Entrega técnica, componentes, funcionalidades y dependencias](ENTREGA.md)
- [Pruebas, comparación visual, rendimiento y pendientes](RESULTADOS.md)
- Evidencia completa en evidence/: qa.json, http-qa.json, lifecycle-qa.json, pixels.json, visual-manifest.json, legacy-regression.txt y capturas PNG.
- PDF con capturas incrustadas: ../../../output/pdf/React - Etapa 2 - Servicios y comparativas.pdf

## Abrir la versión local

React: http://127.0.0.1:3321/legacy/?demo=1&plan=2&react=1&built=1#/app/servicios

Referencia JS: http://127.0.0.1:3321/legacy/?demo=1&plan=2#/app/servicios

Plan=1/2/3. built=1 usa bundle compilado; omitirlo usa módulos de desarrollo. Los cambios de demo son temporales. Sus precios siguen siendo0 por la simulación existente; los precios reales se comprobaron contra HTTP/SQLite aislado.

## Reproducir desde este worktree

```sh
npm ci --ignore-scripts
npm --prefix frontend/react ci
npm --prefix frontend/react run build
npm --prefix frontend/react test
npm test
npm --prefix frontend/react run dev
```

QA (Playwright del runtime de Codex y Google Chrome instalado):

```sh
NODE_PATH='/Users/rodrigobrun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' node scripts/react/stage2-qa.cjs
NODE_PATH='/Users/rodrigobrun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' node scripts/react/stage2-http-qa.cjs
NODE_PATH='/Users/rodrigobrun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' node scripts/react/stage2-lifecycle-qa.cjs
```

Informes y PDF: usar Python con Pillow/reportlab del runtime Codex y scripts/react/stage2-report.py / stage2-captures.py. El PDF debe renderizarse e inspeccionarse después de regenerarlo. Los scripts de QA/reportes de etapa1 se conservan como referencia histórica; los de etapa2 son los vigentes.

No se requieren .env, Supabase, correo externo ni migraciones para estas pruebas. No se ejecutaron deploy, push ni merge. Producción e IAtry permanecen intactos.
