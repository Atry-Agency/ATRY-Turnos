# Apariencia e identidad · revisión local

Estado: implementación local en revisión. No publicada, sin cambios en GitHub, Supabase ni datos de producción.

## Cómo probar

Servidor aislado: http://127.0.0.1:3320/ . Base de QA: data/qa-theme-studio.sqlite. Correo y worker deshabilitados.

Abrir /?demo=1&plan=1 (o 2 o 3) y entrar a Configuración → Apariencia e identidad. Cada demo conserva sus cambios solo en memoria durante la sesión y se reinicia al recargar. No envía mensajes ni crea operaciones comerciales reales.

## Personalización por plan

| Plan | Base | Opciones |
| --- | --- | --- |
| Individual | ATRY Essential, claro, violeta, superficies limpias | Tres colores seleccionados y modo claro/oscuro. Sin carga de logo ni controles de componentes avanzados. |
| Negocio | ATRY Business, claro, violeta/cian, tarjetas con mayor profundidad | Logo y recorte, colores principal/secundario, paletas, modo, contornos, modo y composición de página pública. |
| Pro | ATRY Signature, base blanca y sidebar violeta (oscuro opcional) | Todo lo anterior, fondo/superficies/navegación, fuente ATRY o sistema, tarjetas, botones, densidad, contraste de agenda y hasta seis estilos guardados. |

La exploración de otro tema solo afecta la vista previa y bloquea publicar esa exploración. No concede funciones ni cambia la suscripción.

## Comportamiento

- Borrador separado del tema publicado, con comparación, vista de panel/reservas y escritorio/móvil.
- Descartar y restaurar requieren una confirmación clara. Restaurar conserva el logo.
- Protección al salir por enlaces, cambiar sección o negocio y cerrar/recargar la pestaña con cambios.
- Guardado por propietario en el backend local; validación de valores y permisos en el servidor, incluido el antiguo endpoint general.
- Revisión optimista: un formulario antiguo no puede sobrescribir silenciosamente un estilo más nuevo.
- Las configuraciones avanzadas quedan almacenadas al bajar de plan, pero se proyecta un tema permitido; vuelven al subir.
- Los colores de estado siguen separados del color comercial. El color del profesional se puede editar en Equipo y se advierte si se parece a otro; la agenda lo muestra como una marca independiente.
- Solo se admiten tokens/enumeraciones y colores HEX. No hay CSS arbitrario, fuentes remotas ni URLs de estilos.
- Contraste calculado para texto, acciones y superficies. Los tonos extremos pueden ajustarse para mantener legibilidad.

## Validación

169 pruebas del proyecto aprobadas, incluidas cuatro nuevas de esquemas, contraste, planes, baja/subida, revisión, HTTP, persistencia local y separación entre negocios. La prueba HTTP verifica lecturas nuevas después de guardar en SQLite; no representa una prueba contra Supabase.

Navegador: borrador sin alterar raíz publicada, cambio de color guardado, presets Pro guardados, exploración Pro desde Individual sin permisos, ausencia de desborde de página en 320/390 px y revisión de escritorio/tablet.

## Antes de publicar

El nuevo esquema theme_config/theme_revision está implementado en SQLite. La migración y validación equivalentes del RPC de Supabase todavía deben prepararse y probarse antes de desplegar esta versión. No debe publicarse el frontend como una integración cloud terminada: el RPC actual no guarda estos tokens avanzados. También hay que verificar el color de profesionales en el RPC cloud. Ningún cambio remoto fue realizado.

## Ajuste de armonía automática
Fondos y superficies se proyectan a tintes suaves compatibles con el modo, conservando el valor original en la configuración. Al personalizar Navegación dejando el principal ATRY predeterminado, se deriva el acento de esa navegación. Un principal explícitamente personalizado se respeta. Gráfica, métricas y enlaces comparten ese acento. Los estados semánticos permanecen independientes. La vista previa explica el ajuste antes de aplicar. Prueba adicional: combinación rosa saturada, contraste, conservación del original y estabilidad del tema ATRY predeterminado.
