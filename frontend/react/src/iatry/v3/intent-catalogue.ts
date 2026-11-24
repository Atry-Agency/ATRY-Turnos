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

import type {Capability,IntentSpec} from './contracts';
import {analyzeLanguage,literalLanguage,stripFillers,type LanguageAnalysis} from './language';
export type ConfidenceLevel='high'|'medium'|'low';
export interface InterpretationConfidence {level:ConfidenceLevel;evidence:string[];candidates:string[]}
export const actionConcepts:Readonly<Record<string,readonly string[]>>={
 create:['agrega','crea','mete','suma','incorpora','poneme','alta','nuevo','nueva'],
 read:['ver','mostra','consulta','lista','listado'],
 search:['busca','encuentra','encontra','consulta','ver','mostra'],
 update:['cambia','modifica','edita','actualiza','ajusta','organiza','configura'],
 price:['subi','baja','cobra'],duration:['dura','durara'],
 details:['renombra'],publish:['publica','activa'],hide:['oculta','despublica'],
 history:['historial'],absence:['no trabajo','no atiendo','vacaciones','descanso','descansar','almuerzo','bloqueame','ausencia'],
 statistics:['estadisticas','indicadores','facture','gane','vendi','ingrese'],
};
const service=['servicio','servicios','catalogo'],customer=['cliente','clientes','ficha','fichas','contacto','contactos'],schedule=['horario','horarios','jornada','semanal'];
const restriction=['La intención solo prepara una propuesta.','Se conservan acceso, plan, validación, confirmación y relectura del contrato.'];
const spec=(actions:string[],entities:string[],examples:string[],attributes?:string[]):IntentSpec=>({actions,entities,examples,attributes,requiredFields:[],restrictions:restriction});
/** Linguistic metadata is descriptive, never a grant. Extend here or on Capability.intent. */
export const capabilityIntents:Readonly<Record<string,IntentSpec>>={
 'services.list':spec(['read'],service,['Mostrame los servicios','Qué servicios tengo']),
 'services.create':spec(['create'],service,['Agregá un servicio','Fren, poneme un servicio más']),
 'services.price':spec(['price','update'],service,['Cambiá el precio del servicio'],['precio']),
 'services.duration':spec(['duration','update'],service,['Cambiá la duración del servicio'],['duracion','dura']),
 'services.details':spec(['details','update'],service,['Cambiá el nombre del servicio'],['nombre','descripcion']),
 'services.publish':spec(['publish'],service,['Publicá un servicio']),
 'services.hide':spec(['hide'],service,['Ocultá un servicio']),
 'customers.create':spec(['create'],customer,['Agregá un cliente']),
 'customers.update':spec(['update'],customer,['Actualizá la ficha de un cliente']),
 'customers.search':spec(['search'],customer,['Buscá un cliente']),
 'customers.history':spec(['history'],customer,['Mostrame el historial del cliente']),
 'schedule.read':spec(['read'],schedule,['Consultá los horarios']),
 'schedule.day':spec(['update'],schedule,['Ajustá el horario semanal']),
 'schedule.absence':spec(['absence'],['no trabajo','no atiendo','vacaciones','descanso','almuerzo','ausencia','hoy','manana','horario','profesional'],['Bloqueame mañana','Mañana no trabajo']),
 'schedule.blocks':spec(['read'],['bloqueos','ausencias','vacaciones'],['Mostrame los bloqueos']),
 'team.list':spec(['read'],['equipo','profesional','profesionales','empleados'],['Mostrame el equipo']),
 'business.statistics':spec(['statistics','read'],['negocio','estadisticas','indicadores'],['Cómo viene mi negocio','Mostrame los indicadores']),
};
export function registerIntent(tool:Capability):Capability {
 const intent=tool.intent||capabilityIntents[tool.id];return intent?{...tool,intent:{...intent,requiredFields:tool.fields.filter(f=>f.required).map(f=>f.key)}}:tool;
}
export interface IntentAnalysis {lexical:LanguageAnalysis;confidence:InterpretationConfidence;ids:string[];blocked?:string;informational?:boolean}
const wordPresent=(words:Set<string>,term:string)=>term.split(' ').every(w=>words.has(w));
export function analyzeIntent(source:string,tools:readonly Capability[]):IntentAnalysis {
 if(!source.trim()||source.length>500)return{lexical:{text:'',tokens:[],repairs:[]},ids:[],blocked:'Necesito una instrucción breve, de hasta 500 caracteres.',confidence:{level:'low',evidence:['Entrada vacía o fuera del límite.'],candidates:[]}};
 const registered=tools.map(registerIntent),vocabulary=registered.flatMap(t=>t.intent?[...t.intent.entities,...(t.intent.attributes||[]),...t.intent.actions.flatMap(a=>actionConcepts[a]||[a])]:[]);
 const lexical=analyzeLanguage(source,vocabulary),s=language(lexical.tokens.filter(t=>!t.protected).map(t=>t.word).join(' ')),words=new Set(lexical.tokens.filter(t=>!t.protected).map(t=>t.word)),ids:string[]=[],evidence:string[]=[];
 const low=(reason:string):IntentAnalysis=>({lexical,ids:[],blocked:reason,confidence:{level:'low',evidence:[reason],candidates:[]}});
 if(!source.trim()||source.length>500)return low('Necesito una instrucción breve, de hasta 500 caracteres.');
 if(/\bn0\b/i.test(source)||/\b(?:no|nunca|jamas|tampoco)\b/.test(s.replace(/\bno (?:trabajo|atiendo|laburo|vino|vinieron|asistio|asistieron)\b/g,''))||/\bsin (?:crear|crea|agrega|agregar|cambia|cambiar|ejecutar|guardar|hacer)\b/.test(s))return low('Entendí una negación. No preparé cambios. ¿Qué querés hacer?');
 if(/\b(?:si (?:tuviera|pudiera|quisiera|algun|un dia)|quizas|tal vez|ojala|supongamos|hipoteticamente|crearia|agregaria|me gustaria saber|cuando pueda)\b/.test(s)||/\bsi (?:hay|puedo|puedes|podes|se puede|queda)\b/.test(s))return low('¿Querés preparar una tarea ahora o estás consultando una posibilidad?');
 if(/\b(?:dijo|dijeron|dice|decia|escribio|ejemplo|frase|texto|mensaje)\b/.test(s)&&/["“«]/.test(source)||/^["“«].*["”»][.! ]*$/.test(source.trim()))return low('Eso parece una cita o un ejemplo. ¿Querés preparar una tarea del negocio?');
 const operational='(?:borra(?:r|me|lo|la|los|las|nos)?|elimina(?:r|me|lo|la|los|las|nos)?|destrui(?:r|me|lo|la)?|drop|truncate)';
 if(new RegExp('(?:^|;\\s*|\\by\\s+)(?:(?:quiero|necesito|por favor)\\s+)*'+operational+'\\b').test(s))return low('No automatizo eliminaciones. Usá los controles específicos del sistema.');
 const informational=/^(?:(?:quiero|necesito) (?:saber|entender) |(?:me podes|podes|podrias|puedes) (?:explicar|decir) |(?:como|donde|puedo|podria)\b.*(?:agreg|cre|modific|cambi|ocult|public|bloque|cancel)|(?:explica|explicame|ensename|tutorial|pasos para)\b)/.test(stripFillers(s));
 if(informational)return{lexical,ids:[],informational:true,confidence:{level:'high',evidence:['Pregunta informativa, sin orden operativa.'],candidates:[]}};
 if(/\b(?:y|luego|despues)\s+(?:envi[a-z]*|manda[a-z]*|paga[a-z]*|invita[a-z]*|exporta[a-z]*)\b/.test(s))return low('Hay una acción adicional fuera de este contrato. Separá las tareas; no preparé cambios.');
 if(/\b(?:me encanta|me gusto|compre|contrate|probe|ya existe|estoy leyendo|hay un nuevo|tengo un nuevo)\b/.test(s))return low('Entendí una descripción. ¿Querés preparar alguna tarea?');
 if(/\bpero\b/.test(s))return low('Necesito separar esas indicaciones para evitar cambios contradictorios. ¿Cuál preparamos primero?');
 const containsAlternative=/\b(?:o|o bien)\b/.test(s);
 const explicitActions=new Set<string>();
 for(const tool of registered){const intent=tool.intent;if(!intent)continue;
  const action=intent.actions.filter(a=>(actionConcepts[a]||[a]).some(term=>wordPresent(words,term)&&!(a==='create'&&term==='poneme'&&!/\b(?:un|una|otro|otra|nuevo|nueva|mas)\b/.test(s))));
  const entities=intent.entities.filter(term=>wordPresent(words,literalLanguage(term))),attributes=(intent.attributes||[]).filter(term=>wordPresent(words,literalLanguage(term)));
  if(action.length&&entities.length&&(!intent.attributes?.length||attributes.length)){
   ids.push(tool.id);evidence.push(tool.id+': acción '+action.join('/')+', entidad '+entities.join('/')+(attributes.length?', atributo '+attributes.join('/'):''));
   for(const a of action)if(!['read','search','history','price','duration','details','statistics'].includes(a))explicitActions.add(a);
  }
 }
 // Price/duration/name are attributes of creation, not independent inferred edits.
 if(ids.includes('services.create')&&!/\b(?:y|luego|despues)\s+(?:cambia|subi|baja|edita|modifica)\b/.test(s))for(const id of ['services.price','services.duration','services.details']){const i=ids.indexOf(id);if(i>=0)ids.splice(i,1);}
 if(ids.includes('customers.history')){const i=ids.indexOf('customers.search');if(i>=0)ids.splice(i,1);}
 if(ids.includes('schedule.blocks')){const i=ids.indexOf('schedule.absence');if(i>=0)ids.splice(i,1);}
 // A related entity after «de/del» is context, not a second requested object.
 if(ids.length>1&&!/\b(?:y|o)\b|;/.test(s)){
  const relation=s.search(/\b(?:de|del)\b/);
  if(relation>=0){const primary=new Set(s.slice(0,relation).split(' ')),specific=registered.filter(t=>ids.includes(t.id)&&t.intent?.entities.some(entity=>wordPresent(primary,literalLanguage(entity)))).map(t=>t.id);if(specific.length)ids.splice(0,ids.length,...specific);}
 }
 const competing=explicitActions.size>1&&!/\b(?:y|luego|despues)\b|;/.test(s);
 if(containsAlternative&&ids.length>1||competing)return{lexical,ids:[],blocked:'Hay más de una acción posible. Decime cuál querés preparar primero.',confidence:{level:'low',evidence:[...evidence,'Alternativas o acciones en conflicto.'],candidates:ids}};
 const intentWords=new Set(vocabulary.flatMap(x=>literalLanguage(x).split(' ')));
 const fuzzy=lexical.repairs.filter(t=>(t.repair==='fuzzy'||['svc','svcs','cli','prof','profs'].includes(t.key))&&intentWords.has(t.word));
 if(fuzzy.length)evidence.push('Corrección léxica acotada: '+fuzzy.map(t=>t.raw+' → '+t.word).join(', '));
 const adjectiveOnly=ids.some(id=>registered.find(t=>t.id===id)?.intent?.actions.includes('create'))&&!actionConcepts.create.filter(a=>!['nuevo','nueva'].includes(a)).some(a=>words.has(a));
 if(adjectiveOnly)evidence.push('La creación se infiere de un adjetivo, sin verbo explícito.');
 const level:ConfidenceLevel=ids.length>1?'low':ids.length===1?(fuzzy.length||adjectiveOnly?'medium':'high'):'low';
 return{lexical,ids,confidence:{level,evidence,candidates:ids}};
}

/** Clause boundaries retain original text/values and use the same registered action lexicon. */
export function instructionClauses(source:string,tools:readonly Capability[]):string[] {
 const actions=new Set(tools.map(registerIntent).flatMap(t=>t.intent?.actions.filter(a=>!['price','duration','details','history','statistics'].includes(a)).flatMap(a=>actionConcepts[a]||[a])||[]));
 const tokens=analyzeIntent(source,tools).lexical.tokens,breaks:number[]=[];
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i];if(token.raw===';')breaks.push(token.end);
  else if(!token.protected&&token.word==='y'){
   const following=tokens.slice(i+1).slice(0,8),end=following.findIndex(t=>t.word==='y'||t.raw===';');
   if(following.slice(0,end<0?undefined:end).some(t=>!t.protected&&actions.has(t.word)))breaks.push(token.start);
  }
 }
 if(!breaks.length)return[source];let start=0;const clauses:string[]=[];
 for(const end of breaks){clauses.push(source.slice(start,end).replace(/[; ]+$/,'').trim());start=end;}
 clauses.push(source.slice(start).replace(/^(?:;\s*|y\s+(?:(?:despu[eé]s|luego)\s+)?)/,'').trim());
 // Strip the delimiter from every subsequent clause, not from literal values.
 return clauses.map((s,i)=>i?s.replace(/^(?:;\s*|y\s+(?:(?:despu[eé]s|luego)\s+)?)/,'').trim():s);
}
