/** Extensible linguistic layer. IDs resolve only to existing, permission-filtered capabilities. */
export const intentRules:{id:string;patterns:RegExp[]}[]=[
 {id:'services.list',patterns:[/\bque servicios\b/,/\b(?:ver|mostra|consulta).{0,20}servicio/,/\bcatalogo\b/]},
 {id:'services.create',patterns:[/\b(?:agrega|crea|nuevo|alta).{0,30}\bservicio\b/]},
 {id:'services.price',patterns:[/\bprecio\b/,/\b(?:subi|baja|cobra).{0,35}\$\s*\d/]},
 {id:'services.duration',patterns:[/\b(?:duracion|dura|durara)\b/]},
 {id:'services.assign',patterns:[/\b(?:asigna|ofrece|ofrecen).{0,35}servicio/]},
 {id:'services.hide',patterns:[/\b(?:oculta|despublica).{0,30}servicio/]},
 {id:'services.publish',patterns:[/\b(?:publica|activa).{0,30}servicio/]},
 {id:'customers.create',patterns:[/\b(?:crea|agrega|nueva).{0,20}(?:cliente|ficha)\b/]},
 {id:'customers.history',patterns:[/\bhistorial\b/]},
 {id:'customers.update',patterns:[/\b(?:edita|actualiza|cambia).{0,25}(?:cliente|ficha|contacto)\b/]},
 {id:'customers.search',patterns:[/\b(?:busca|consulta|ver|mostra).{0,20}cliente/]},
 {id:'bookings.no_show',patterns:[/\b(?:falto|falta|no vino|no asistio).{0,25}(?:turno|cliente)\b/,/\bcliente.{0,25}(?:falto|no vino|no asistio)/]},
 {id:'schedule.absence',patterns:[/\b(?:vacaciones|almuerzo|descanso|descansar|no trabajo|no atiendo|ausencia del profesional)\b/]},
 {id:'schedule.exception',patterns:[/\b(?:abrimos|cerramos|abrir|cerrar).{0,30}(?:hasta|a las|desde)/]},
 {id:'bookings.availability',patterns:[/\b(?:horario|lugar|turno|hueco).{0,15}(?:libre|disponible)\b/]},
 {id:'bookings.affected',patterns:[/\breservas? afectadas?\b/,/\bturnos? afectados?\b/]},
 {id:'bookings.reschedule',patterns:[/\b(?:reprograma|reagenda|moveme|mover|cambia la hora)\b/]},
 {id:'bookings.cancelled',patterns:[/\bcancela.{0,25}(?:reserva|turno)\b/]},
 {id:'bookings.confirmed',patterns:[/\bconfirma.{0,25}(?:reserva|turno)\b/]},
 {id:'bookings.create',patterns:[/\b(?:reservame|agendame)\b/,/\b(?:agenda|reserva|crea|nuevo).{0,20}(?:reserva|turno)\b/]},
 {id:'bookings.list',patterns:[/\b(?:ver|mostra|consulta).{0,20}(?:agenda|reservas|turnos)\b/]},
 {id:'team.list',patterns:[/\bque profesionales\b/,/\bquienes atienden\b/,/\b(?:ver|mostra|consulta).{0,20}(?:equipo|profesional)/]},
 {id:'business.statistics',patterns:[/\b(?:estadisticas|indicadores|cancelaciones del mes)\b/]},
 {id:'business.summary',patterns:[/\bresumen.{0,20}negocio\b/]}
];
export const language=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[¿?¡!]/g,'').replace(/\s+/g,' ').trim();
