# Casos remotos preparados — todos PENDIENTES

Esta es una ficha de ejecución, no evidencia de ensayos realizados. Reutiliza las suites locales del plan; solo cubre aquello que requiere el runtime real. Cada escritura necesita autorización específica de estos registros/valores/efectos antes de ejecutar. No insertar directamente auth.users ni fabricar sesiones.

## Fixtures mínimos propuestos

Cuatro identidades nuevas **solo en staging**, por registro normal y correo de prueba verificado: propietario A, propietario B, encargado C y empleado D. Buzones controlados aún por autorizar; no reutilizar sesiones productivas. Un quinto usuario verificado de operador será el único bootstrap admin staging, con autorización limitada; A/B/C/D permanecen sin administración de plataforma. No se usa la sesión del operador para aprobar permisos de los perfiles.

Seis negocios ficticios: `STG UY Individual`, `STG UY Negocio`, `STG UY Pro`, `STG PA Individual`, `STG PA Negocio`, `STG PA Pro`. A propietario de los tres UY y PA Pro para alternar país dentro de la misma sesión; B de PA Individual/Negocio para comprobar aislamiento A↔B. C/D vinculados por `atry_add_member`/panel normal solo a Negocio/Pro. D asociado a un staff específico, sin administración. Individual no recibe equipo administrativo. Si no están disponibles cuatro buzones, acordar un receptor de pruebas que reciba aliases distintos; no omitir la verificación.

Los planes de prueba se habilitan mediante mecanismo administrativo de cortesía autorizado, sin tocar precios/suscripciones de producción. PA pagado sigue bloqueado. Si la cortesía PA no está admitida por el contrato actual, parar ese subcaso y preparar bootstrap exclusivamente de fixtures staging explícitamente aprobado; no habilitar compras ni relajar el contrato para facilitar pruebas.

Servicios propuestos por negocio: `STG Corte`30min (UY790; PA USD 12,99), `STG Complemento`15min (UY500; PA USD13,01); sin seña/buffers inicialmente. Profesionales ficticios: límite Individual1, Negocio4, Pro10; ensayo de uno adicional debe rechazarse sin persistir. Jornadas09–18 locales, pausa13–14. Fechas relativas futuras, calculadas por negocio al momento del ensayo y escritas en la autorización, no fechas antiguas fijas. Clientes `STG Cliente A/B`, sin marketing, teléfono ficticio válido por país, email de sink autorizado antes de colas.

No interpretar USD como price_uyu. No utilizar .invalid como garantía de ausencia de intentos de envío.

## Matriz y resultados a completar

| ID | Acción autorizable / comprobación | Resultado requerido |
|---|---|---|
| S01 | Registro, verificación, login, refresh, recuperación, logout/revocación de A/B | JWT emitido por staging, user verificado, sesión revocada sin acceso; no sesiones copiadas |
| S02 | Catálogo propio y SELECT directo/RPC ajeno A↔B; headers falsos y bid de otro negocio | Rechazo real del servidor; el marcador regional no otorga identidad |
| S03 | C encargado y D empleado, tanto UI IAtry como RPC directo; alterar staff/servicio/negocio | Contratos administrativos existentes; IAtry mantiene C/D bloqueados productivamente, ninguna ampliación por ensayo |
| S04 | Seis combinaciones país/plan, límite 1/4/10, estadísticas Individual | El servidor rechaza exceso/sin prestación, asesor explica límites sin inventar precio PA |
| S05 | Servicio crear/editar precio/duración/ocultar; cliente crear y editar notas | Propuesta→confirmación visual→una escritura→relectura exacta. Contacto/consentimiento no se editan por IAtry |
| S06 | Reglas semanales/pausas, ausencia completa y3 días, profesional explícito | Zona del negocio, sin alterar reservas existentes ni crear jornadas inventadas |
| S07 | Reserva manual/pública a 10:00 local en ambos países, mismo UTC con día distinto | Hora/fecha propia en UI/SQL/comprobante; monto histórico/moneda correctos |
| S08 | Dos solicitudes reales simultáneas al mismo slot; replay misma clave; misma clave payload distinto; corte tras commit | Un solo ID para éxito/replay, conflicto explícito, relectura ante incertidumbre; sin retry que duplique |
| S09 | Visita con dos servicios USD 26,00/UYU 1290, reprogramación y cancelación | Atomicidad total y snapshots; estado confirmado/cancelado veraz; cola de ensayo inspeccionada |
| S10 | Recurrencia 14:00 semanal, expansión repetida, bloqueo/ausencia y fin de serie | Sin duplicados ni cambio local de hora; disponibilidad protege conflictos. Lecturas materializadoras documentadas como escrituras |
| S11 | IAtry: misma sesión A UY→PA Pro→UY; corrección12,99→15,25, referencias/fecha mañana | Contexto anterior descartado, moneda/tiempo correctos, sin ejecución desde «confirmo» textual ni herramientas nuevas |
| S12 | Foto webp ficticia≤64 KiB, visibilidad privada/pública, lectura ajena/escritura ajena, URL antigua y retiro | Storage real y políticas efectivas; sin bytes productivos ni bucket público |
| S13 | Dos sockets Realtime A/B, cambios por S07; cambio de negocio/logout | Solo revisión autorizada, nunca datos personales, canal anterior desconectado |
| S14 | OPTIONS y origen autorizado/ajeno, CAPTCHA widget staging; hostname/action/cdata incorrectos | Rechazo antes de escribir y sin excepción que omita validación |
| S15 | Recordatorio y cola, worker apagado; posteriormente sink/API/SMTP si autorizados | Zona local y deduplicación; aceptación≠entrega, error incierto no reporta éxito |
| S16 | Links WhatsApp +598/+507 y calendarios Google/ICS con ubicación ficticia | Inspección de enlaces/archivo sin enviar mensajes, hora/zona y Maps correctos |
| S17 | Backups A/B/C y restauración en receptor desechable autorizado | Integridad, ACL/RLS/Storage/login comprobados, medición RPO/RTO; sin down destructivo |

## Compatibilidad: artefactos separados, mismo staging por fases

Guardar el frontend base `002868f` y el candidato en rutas locales/hosts de ensayo distintos, ambos configurados únicamente a staging; no usar attryturnos.com ni su sesión. La base anterior se obtiene de las 47 migraciones; la nueva de 53. No revertir la nueva con datos PA para repetir la anterior.

| Frontend / Edge / BD | País y evidencia |
|---|---|
| anterior/anterior/anterior | UY baseline y datos históricos ficticios antes de migrar |
| nuevo/anterior/anterior | UY operativo; PA no seleccionable ni creable; no invocar RPC inexistentes al iniciar |
| anterior/anterior/nueva | UY conserva contrato; PA cerrado y sin datos aún |
| anterior/nuevo/nueva | UY público completo, CAPTCHA y CORS; cliente antiguo no lee PA |
| nuevo/nuevo/nueva PA cerrado | UY íntegro y flags falsos en servidor y UI; intento PA denegado |
| nuevo/nuevo/nueva con opt-in staging autorizado | PA/UY operan en paralelo, catálogo PA pago ausente; datos exactos |
| cerrar PA tras ensayos | Datos permanecen, nuevas altas/acceso público cerrado; lector compatible disponible para recuperación |

Probar caché/service-worker viejo sin usarlo para abrir PA. Un artefacto anterior no se considera compatible con PA por pasar UY. Archivar hashes de los tres artefactos y resultados por combinación.
