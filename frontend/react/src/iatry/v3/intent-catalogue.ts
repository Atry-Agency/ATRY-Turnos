import {normalizeLanguage} from './language';
/** Extensible linguistic layer. IDs resolve only to existing, permission-filtered capabilities. */
export const intentRules:{id:string;patterns:RegExp[]}[]=[
 {id:'services.list',patterns:[/\bque servicios\b/,/\b(?:ver|mostra|consulta).{0,20}servicio/,/\bcatalogo\b/]},
 {id:'services.create',patterns:[/\b(?:agrega|crea|nuevo|alta).{0,30}\bservicio\b/]},
 {id:'services.details',patterns:[/\b(?:cambia|modifica|edita|renombra).{0,30}(?:nombre|descripcion).{0,30}servicio/,/\b(?:nombre|descripcion) del? servicio/]},
 {id:'services.price',patterns:[/\bprecio\b/,/\b(?:subi|baja|cobra).{0,35}\$\s*\d/]},
 {id:'services.duration',patterns:[/\b(?:duracion|dura|durara)\b/]},
 {id:'services.assign',patterns:[/\b(?:asigna|ofrece|ofrecen).{0,35}servicio/]},
 {id:'services.hide',patterns:[/\b(?:oculta|despublica).{0,30}servicio/]},
 {id:'services.publish',patterns:[/\b(?:publica|activa).{0,30}servicio/]},
 {id:'customers.create',patterns:[/\b(?:crea|agrega|nueva).{0,20}(?:cliente|ficha)\b/]},
 {id:'customers.history',patterns:[/\bhistorial\b/]},
 {id:'customers.update',patterns:[/\b(?:edita|actualiza|cambia).{0,25}(?:cliente|ficha|contacto)\b/]},
 {id:'customers.search',patterns:[/\b(?:busca|consulta|ver|mostra).{0,20}cliente/]},
 {id:'bookings.no_show',patterns:[/\b(?:falto|falta|no vino|no asistio).{0,25}(?:turno|cliente)\b/,/\bcliente.{0,25}(?:falto|no vino|no asistio)/,/^.{1,50}\bno vino\b/]},
 {id:'schedule.blocks',patterns:[/\b(?:ver|mostra|consulta).{0,25}(?:bloqueos|ausencias|vacaciones)/]},
 {id:'schedule.read',patterns:[/\b(?:ver|mostra|consulta).{0,20}horarios?\b/]},
 {id:'schedule.day',patterns:[/\b(?:cambia|organiza|ajusta|configura).{0,25}horario/,/\b(?:horario|descanso|pausa) semanal\b/]},
 {id:'schedule.absence',patterns:[/\b(?:vacaciones|dias? libres?|almuerzo|descanso|descansar|no trabajo|no atiendo|ausencia del profesional)\b/,/\bbloquea\w*.{0,30}(?:horario|manana|hoy|tarde|noche|de una|de \d)\b/]},
 {id:'schedule.exception',patterns:[/\b(?:abrimos|cerramos|abrir|cerrar).{0,30}(?:hasta|a las|desde)/]},
 {id:'bookings.availability',patterns:[/\b(?:tengo|hay|queda|quedan|tenemos)\s+(?:algun |un )?cupos?\b/,/\b(?:horario|lugar|turno|hueco).{0,15}(?:libre|disponible)\b/]},
 {id:'bookings.affected',patterns:[/\breservas? afectadas?\b/,/\bturnos? afectados?\b/]},
 {id:'bookings.reschedule',patterns:[/\b(?:pasa(?:me|la|lo|r)?|mueve(?:me|la|lo)?|move(?:me|r)?)\b.{0,25}\bcita\b/,/\b(?:reprograma|reagenda|moveme|mover|cambia la hora)\b/]},
 {id:'bookings.cancelled',patterns:[/\bcancela.{0,25}(?:reserva|turno|cita)\b/]},
 {id:'bookings.confirmed',patterns:[/\bconfirma.{0,25}(?:reserva|turno|cita)\b/]},
 {id:'bookings.create',patterns:[/\b(?:pone(?:me)?|pon|agenda(?:me|la)?|crea(?:me)?|cuadra(?:me)?)\b.{0,25}\bcita\b/,/\b(?:reservame|agendame)\b/,/\b(?:agenda|reserva|crea|nuevo).{0,20}(?:reserva|turno|cita)\b/]},
 {id:'bookings.list',patterns:[/\bque citas\b/,/\bcomo esta.{0,15}agenda\b/,/\b(?:ver|mostra|consulta).{0,20}(?:agenda|reservas|turnos|citas)\b/]},
 {id:'team.list',patterns:[/\bque profesionales\b/,/\bquienes atienden\b/,/\b(?:ver|mostra|consulta).{0,20}(?:equipo|profesional)/]},
 {id:'business.statistics',patterns:[/\bcuanto (?:hice|ingrese|facture|gane|vend[ií])\b/,/\b(?:estadisticas|indicadores|cancelaciones del mes)\b/,/\bcomo (?:va|viene|anda|esta).{0,20}(?:negocio|actividad)\b/]},
 {id:'business.summary',patterns:[/\bresumen.{0,20}negocio\b/]}
];
export const language=normalizeLanguage;
