# ATRY Turnos React

Aplicación autónoma React + TypeScript + Vite. Desde la raíz del worktree:

```sh
npm ci
npm ci --prefix frontend/react
npm run build
npm run test:react
npm test
npm run dev:react
```

Demo: http://127.0.0.1:3321/?demo=1&plan=3#/app/inicio

Landing: http://127.0.0.1:3321/descubrir.html

`npm start` sirve `frontend/react/dist` con el backend local configurado. No usar una base real para repetir pruebas; los scripts HTTP nativos crean SQLite en memoria.

La referencia `/legacy/?demo=1&plan=3#/app/inicio` solo existe en desarrollo. `ATRY_COMPARISON_BUILD=1` incluye la entrada piloto de comparación; el build ordinario la excluye. El backend local puede servir la referencia explícitamente con `ATRY_LEGACY_REFERENCE=1`.

Arquitectura, resultados, límites de validación y evidencias: `../../docs/react-migration/full/INFORME.md`. La compilación no publica. El paquete cloud conserva el requisito de equivalencia `CLOUD_BACKEND_VALIDATED=1`.
