# Pulido final de IAtry Experience

Base y rollback: a505294350976724def9504af8b9117d74448b7c. Alcance exclusivo de marketing; sin modificaciones del motor IAtry, Auth, adaptadores, datos ni configuración de Supabase.

La confirmación conserva superficie blanca/violeta, con indicador verde pequeño y trazado animado de check. El descanso confirmado mantiene la identidad violeta y añade un acento semántico verde, sin grandes superficies verdes. Respuestas interactivas con entradas breves y texto natural que identifica la simulación.

Energía interna continua, reflejos de interpretación, preparación más activa y satisfacción breve al terminar. Transformaciones/opacidad, sin dependencias nuevas. Movimiento reducido y pausa manual deshabilitan efectos.

## Presentación automática

Reloj narrativo local independiente del scroll de documento. Requiere seis segundos sin actividad y la sección fijada ocupando el viewport. Interrumpe inmediatamente al desplazar, tocar o usar teclado. El avance virtual conserva su posición al devolver control manual, evitando saltar de escena. No llama scrollTo del documento: ese método se mantiene solamente para botones de navegación pulsados por el visitante.

No inicia fuera de pantalla, en pestaña oculta, con movimiento reducido, con movimiento pausado, en el capítulo interactivo, al enfocar/usar/leer el área de mensajes ni después de completar la presentación. Tras las tres escenas narradas pasa al CTA; la demo interactiva se abre manualmente. Un control separado permite pausar/reanudar la presentación. Al finalizar no hay bucle.

## Validación

Compilación TypeScript/Vite; conservación literal del contenido exterior, precios y CTA; regresiones de seis viewports Chrome/WebKit; pruebas con reloj controlado para inactividad, control manual, pausa, reanudación, CTA final, demo protegida y movimiento reducido. No se crean capturas, PDF, vídeos, datos, usuarios, notificaciones ni operaciones externas.

Rollback: Actions → Publicar interfaz Atry Turnos → Run workflow → source_ref=rollback/pre-iatry-cinema-final-2026-10-27. Recupera a505294 sin modificar Supabase.

Incidencia previa conocida: la prueba general de visitas ficticias en tests/visits.test.js falla con una opción de disponibilidad indefinida; no pertenece a los archivos de este pulido y no se altera aquí.

Ajustes finales solicitados: primera respuesta en 600 ms; retirada del párrafo repetido y de la etiqueta del encabezado. Se conserva el contexto ficticio en los resultados («en esta demostración»), confirmaciones simuladas y disponibilidad real al pie. Un gesto rápido que avance varios capítulos presenta los intermedios a intervalos breves mientras la sección permanezca visible; no bloquea ni revierte el scroll de documento. Los botones de capítulo siguen siendo directos.

Ritmo final: IAtry interpreta en 600 ms y prepara en 800 ms; la confirmación del usuario simulado espera 1,8 s para dar tiempo de lectura; IAtry muestra el resultado en 600 ms. El desplazamiento manual puede adelantar la narrativa. Las respuestas de descanso, catálogo y vacaciones usan lenguaje cercano sin anunciar cambios reales.
