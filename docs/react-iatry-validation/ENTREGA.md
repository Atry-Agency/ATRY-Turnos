# Cierre experimental React + IAtry

Entrega priorizada según la instrucción del 25/10/2026: un PDF técnico de 5 páginas, con 4 capturas existentes incrustadas, y un video existente de 11,84 segundos. Sin nuevas matrices visuales.

PDF: `output/pdf/ATRY - Resumen tecnico React e IAtry.pdf`.
Video: `docs/react-iatry-validation/evidence/IAtry-React-Primeros-pasos.webm`.

Regresión final: 252/252. Unitarias React registradas: 32/32. TypeScript sin errores. Chromium y WebKit funcionales aprobados. Rendimiento: 15 ejecuciones locales; consultar `evidence/performance.json`. Capturas y video anteriores al ajuste menor del reflejo estático del borde, declarado en el PDF.

Pendientes: Supabase desechable (cero pruebas en Supabase real), Firefox sin inicio por limitaciones del entorno, dispositivos físicos. No publicar sin revisar estos pendientes. Producción y checkout original conservados; 913 huellas verificadas sin diferencias.

La fuente del PDF está en `scripts/react-iatry/summary-pdf.py`; utiliza las evidencias existentes y reportlab. Las evidencias con nombres failed son diagnósticos históricos, no resultados finales.
