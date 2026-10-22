# Presentación comercial de ATRY Turnos — local

Página: `/descubrir.html`. Destino previsto: `https://atryturnos.com/descubrir.html` después de una publicación autorizada. No se publicó ni se modificó Atry Agency.

Se revisó visualmente la referencia de ATRY Agency. Se utilizan los archivos oficiales de tipografía y símbolo de ATRY, una composición clara con violeta, capturas actuales del producto y textos propios. Se retiró el marco oscuro inclinado de la primera propuesta a pedido del usuario.

Incluye portada, visor de tres capturas con navegación de teclado, beneficios, selector de las tres demos con guía de exploración, pasos para empezar, planes, preguntas frecuentes y accesos a registro, sesión y contacto. El acceso a la demo desde el formulario de autenticación lleva ahora a esta presentación. Las demos permanecen independientes, en memoria y sin envíos.

Las capturas se tomaron de la versión local con datos ficticios. El parámetro `capture=1` omite los avisos superiores de demo exclusivamente para encuadrar las capturas; no habilita servicios, envíos o almacenamiento. Los enlaces públicos de la presentación no usan ese parámetro. Las imágenes se identifican en la página como capturas reales con datos ficticios.

Se mantienen precios propuestos 790/1490/2490 UYU, profesionales 1/4/10 y correo 0/300/900. Individual no promete logo propio. Las condiciones de contratación e impuestos se indican junto a los planes. Las funciones nuevas presentadas son de la versión local: la integración cloud pendiente debe validarse antes de publicar el conjunto.

Validación: navegación desde el acceso; selector Individual/Negocio/Pro y sus destinos; cambio de capturas; revisión visual en escritorio y teléfono de 390 px; sintaxis JavaScript; suite existente, 180 pruebas aprobadas (data/qa-showcase-final.log). Al ejecutar la suite se actualizaron dos expectativas a los nombres de tema en español y se corrigió la clasificación HTTP de la restricción de colores traducida, conservando el rechazo 403.

Servidor de revisión: puerto 3320, base aislada qa-theme-studio.sqlite, correo y trabajador deshabilitados. Nada se envió a GitHub o Supabase.

## Cierre local — 22/10/2026

La sección Tu marca ahora muestra dos instancias de la aplicación real, cada una con su propia demo Pro en memoria: el panel de escritorio y el teléfono, que permite alternar entre Panel y Reservas. Se retiró la ilustración simplificada. Las cuatro paletas y el nombre se aplican con el mismo esquema validado y motor de armonía de la aplicación. Claudia Llorente y Agustina Rojas son los contactos ficticios de esta presentación. No se reemplazan los datos de los otros tres ejemplos independientes.

El teléfono conserva una pantalla con proporción 390/844 y escala uniforme. En teléfonos y tablets estrechas se muestra la experiencia móvil en vez de comprimir el escritorio. Las instancias se cargan al acercarse a la sección. El puente comprueba origen y ventana padre y solo existe con demo=1 + showcase=1 dentro de un marco. No puede modificar el plan, realizar envíos ni acceder a administración real. Los enlaces de salida y cerrar sesión se bloquean en el marco; las demos completas siguen disponibles desde los botones de la landing. Solo el documento explícito de esa demo permite marcos del mismo origen; acceso normal y API conservan DENY/frame-ancestors none.

Se incorporó el logotipo original blanco de ATRY Agency en el pie oscuro y se mantienen sus enlaces oficiales. Las capturas actuales son JPG de 1905 x 1072 px: panel, agenda y reservas. La captura de reservas se renovó tras corregir el tamaño del nombre del negocio respecto del ancho real de su tarjeta (antes crecía con la pantalla completa y cortaba NegocioPlan2). No se agrandan más allá de su resolución original; se omiten los avisos superiores de demo en estas capturas.

Verificación visual e interactiva: 390, 768 y 1440 px, sin desbordes horizontales; proporción del teléfono 0,4621 en los tamaños comprobados; nombre en ambas instancias; paletas ATRY/Rosa/Salvia/Arena; alternancia Panel/Reservas; selección de servicio real conservada al cambiar paleta; preguntas frecuentes y pie con logotipo original. Suite completa 183/183 aprobadas en data/qa-landing-final-2026-10-22.log. Pruebas específicas de aislamiento 4/4 en data/qa-showcase-isolation.log, incluyendo rechazo de mensajes de otra ventana/origen. Cabeceras HTTP verificadas para demo explícita, demo normal, acceso y API.

Todo continúa únicamente en local. No hay commit, push, publicación ni modificación de Supabase. Sigue pendiente completar la equivalencia cloud de apariencia y visitas combinadas antes de una futura publicación del conjunto.

## Ajustes de mensaje y conversión — 22/10/2026

Se aplicaron los seis ajustes revisados con el usuario: definición explícita de agenda/reservas online en portada; retirada de una sección emocional repetitiva y reducción de espacios/textos; llamadas principales unificadas como «Probar sin cuenta»; orientación por situación de negocio y cupos de confirmaciones/recordatorios explicados; acceso a consulta por WhatsApp junto a los planes; y «Abrir demo completa» junto al panel y al teléfono.

La apertura completa genera una demo independiente en otra pestaña con nombre y esquema de tema validado conservados (no transfiere reservas ni datos de sesión). Solo se leen esos parámetros con demo=1; configuración inválida u opciones fuera del plan se ignoran, dejando la demo normal. Conserva los avisos de demostración ficticia. Se comprobó desde el navegador que Estudio Aurora y #A44B6D pasan a la reserva completa. Las tres selecciones de demo mantienen su destino correspondiente y el texto unificado. Revisión sin desbordes en móvil de 320/390 px y escritorio. Se corrigió además la inserción de iconos para que no agrande accidentalmente el texto de los botones.

Validación adicional: 7/7 pruebas de demo y presentación aprobadas en data/qa-landing-cta-2026-10-22.log. Ningún envío de mensajes, publicación o modificación remota.
