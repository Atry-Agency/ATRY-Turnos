# Iconos oficiales de ATRY Turnos

Familia principal: [Lucide](https://github.com/lucide-icons/lucide), revisión `9fcde889d8ed0c6f739cff76e086c27e072e83ec`.
Secador: [Lucide Lab](https://github.com/lucide-icons/lucide-lab), revisión `34b6526d0a67bbe67b8a54b9b101018b1377ef28`.

Los SVG originales, licencias y huellas SHA-256 están incluidos aquí. `sources.json` identifica cada activo. Sólo se incluyen los iconos usados, sin descargas ni fuentes externas durante la ejecución. Los alias semánticos de `domain/icons.ts` mantienen los contratos existentes. `grid` conserva Inicio (House); el grid de tareas de IAtry usa LayoutGrid. Marcas ATRY, IAtry y proveedores conservan sus activos independientes.

Para ampliar: seleccionar un SVG oficial de una revisión fija, incluir licencia y procedencia en el manifiesto, agregar un alias cuando corresponda y ejecutar `node scripts/react/build-icon-library.cjs`. No editar `glyphs.ts` manualmente. Verificar con `node scripts/react/build-icon-library.cjs --check` y las pruebas de navegación/renderizado.

`LibraryIcon` comparte el lienzo de 24 unidades, extremos y uniones redondas. El tamaño y grosor de navegación se controlan desde sus tokens originales (20 px principal, 16 px submenú). Los iconos decorativos están ocultos a lectores de pantalla; los controles conservan etiquetas accesibles. Las animaciones se limitan a carga activa, confirmación y las interacciones existentes de IAtry; se desactivan con reducir movimiento.
