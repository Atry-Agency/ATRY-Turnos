# Preparación PostgreSQL

No se migró. SQLite WAL continúa para una instancia local. Considerar PostgreSQL al necesitar varias instancias, concurrencia de escritura o recuperación gestionada; medir carga/bloqueos antes.

Preservar IDs, UTC, relaciones y aislamiento por negocio. Convertir triggers, claves y transacciones; proteger solapamientos por profesional/recurso con rangos y restricciones de exclusión; reclamación de correo con bloqueo de filas y SSE con pub/sub compartido.

Respaldar, importar a base nueva, comparar conteos/IDs/relaciones y disponibilidad. Adaptar las 32 pruebas y agregar concurrencia multiinstancia. Ensayar restauración/reversión antes del corte. No borrar ni modificar base original para ensayar. Evitar doble escritura sin estrategia explícita de consistencia.
