import {intentRules,language} from './intent-catalogue';
import {recognize} from './recognition';
import {today,plusDate} from '../../domain/format';
import type {Capability,Values} from './contracts';
export interface InstructionSeed {values:Values;references:Record<string,string>}
export interface InstructionStep {id:string;title:string;seed:InstructionSeed;enabled:boolean;effect:string}
export interface Clarification {question:string;choices:{label:string;steps:InstructionStep[]}[]}
export interface Instruction {source:string;steps:InstructionStep[];notes:string[];clarification?:Clarification;understood:boolean}
const weekdays=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
function dateOf(s:string,base:string){const iso=s.match(/\b(\d{4}-\d{2}-\d{2})\b/);if(iso)return iso[1];if(/pasado manana/.test(s))return plusDate(base,2);if(/\bmanana\b/.test(s))return plusDate(base,1);if(/\bhoy\b/.test(s))return base;const day=weekdays.findIndex(w=>s.includes(w));if(day>=0){const current=new Date(base+'T12:00:00Z').getUTCDay();return plusDate(base,(day-current+7)%7)}if(/semana que viene|proxima semana/.test(s)){const current=new Date(base+'T12:00:00Z').getUTCDay();return plusDate(base,((8-current)%7)||7)}return''}
const hours:Record<string,number>={una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12};
function clock(token:string,pm=false){const p=token.split(':'),h=hours[p[0]]??Number(p[0]),m=Number(p[1]||0);return Number.isInteger(h)&&h>=0&&h<24&&m>=0&&m<60?String(pm&&h<12?h+12:h).padStart(2,'0')+':'+String(m).padStart(2,'0'):''}
const hourToken='(?:\\d{1,2}(?::\\d{2})?|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)';
export function interpretInstruction(source:string,all:readonly Capability[],enabled:readonly Capability[],base=today()):Instruction{
 const s=language(source),notes:string[]=[],available=new Set(enabled.map(t=>t.id));
 if(source.length>500||/(?:^|;\s*|\sy\s+)(?:por favor )?(?:borra\w*|elimina\w*|destrui\w*|drop|truncate)\b/.test(s))return{source,steps:[],notes:['No automatizo eliminaciones. Usá los controles específicos del sistema.'],understood:false};
 const clauses=source.split(/\s+y (?:despu[eé]s |luego )?|;\s*/i);
 if(clauses.length>1){const parts=clauses.map(part=>interpretInstruction(part,all,enabled,base));if(parts.every(p=>p.understood&&p.steps.length>0&&!p.clarification)){const combinedSteps=parts.flatMap(p=>p.steps);if(combinedSteps.length>3)return{source,steps:[],notes:['Separá la orden en planes de hasta tres pasos.'],understood:false};const vacation=combinedSteps.length===2&&combinedSteps.some(t=>t.id==='schedule.absence')&&combinedSteps.some(t=>t.id==='bookings.affected');if(vacation)combinedSteps.sort((a,b)=>a.id==='bookings.affected'?-1:b.id==='bookings.affected'?1:0);return{source,steps:combinedSteps,notes:[vacation?'Primero consultamos las reservas afectadas; después podrás preparar el bloqueo. No se cancela ningún turno.':'Cada acción solicitada se prepara y confirma por separado. No se agregan acciones implícitas.',...parts.flatMap(p=>p.notes)],understood:true}}if(parts.some(p=>p.clarification)||clauses.slice(1).some(p=>/\$\s*\d|^(?:crea|agrega|cancela|bloquea|mostra|subi|baja)/i.test(language(p))))return{source,steps:[],notes:['Necesito aclarar cada parte de esta orden. Probá una acción por vez; no ejecuté ninguna.'],understood:false}}
 const matched=intentRules.filter(rule=>rule.patterns.some(p=>p.test(s))).map(x=>x.id);
 let ids=[...new Set(matched)];
 if(/\b(?:falto|ausencia)\b/.test(s)&&!/(?:turno|cliente|profesional|vacaciones)/.test(s)){return{source,steps:[],notes:['Una ausencia de cliente y una ausencia del equipo tienen efectos distintos.'],understood:true,clarification:{question:'¿Faltó un cliente a su turno o no atiende un profesional?',choices:['bookings.no_show','schedule.absence'].map(id=>{const t=all.find(t=>t.id===id)!;return{label:t.title,steps:[{id,title:t.title,seed:{values:{},references:{}},enabled:available.has(id),effect:id==='bookings.no_show'?'Cambia el estado del turno elegido.':'Bloquea la disponibilidad del profesional elegido.'}]}})}}}

 if(ids.includes('services.create'))ids=ids.filter(id=>!['services.price','services.duration'].includes(id));
 if(ids.includes('bookings.availability'))ids=ids.filter(id=>id!=='bookings.create');
 if(ids.includes('bookings.affected'))ids=ids.filter(id=>id!=='bookings.list');
 if(ids.includes('bookings.no_show'))ids=ids.filter(id=>id!=='schedule.absence');
 const combined=ids.includes('schedule.absence')&&ids.includes('bookings.affected');
 if(combined)ids=['bookings.affected','schedule.absence'];
 else if(ids.length>1){const clauses=source.split(/\s+y (?:despu[eé]s |luego )?|;\s*/i);if(clauses.length>1){if(clauses.length>3)return{source,steps:[],notes:['Separá la orden en planes de hasta tres pasos.'],understood:false};const parts=clauses.map(part=>interpretInstruction(part,all,enabled,base));if(parts.every(p=>p.understood&&p.steps.length>0&&!p.clarification))return{source,steps:parts.flatMap(p=>p.steps),notes:['Cada acción solicitada se prepara y confirma por separado. No se agregan acciones implícitas.',...parts.flatMap(p=>p.notes)],understood:true};return{source,steps:[],notes:['Necesito que aclares cada acción de esta orden compuesta. Probá una por vez; no ejecuté ninguna.'],understood:false}}const options=ids.map(id=>all.find(t=>t.id===id)).filter((t):t is Capability=>Boolean(t));return{source,steps:[],notes:['La frase puede referirse a más de una tarea. Elegí la intención antes de preparar cambios.'],understood:options.length>0,clarification:{question:'¿Qué tarea querés preparar?',choices:options.map(t=>({label:t.title,steps:[{id:t.id,title:t.title,seed:{values:{},references:{}},enabled:available.has(t.id),effect:t.kind==='read'?'Consulta a pedido.':'Requiere vista previa y confirmación.'}]}))}}}
 if(!ids.length){const matches=recognize(source,[...all]);if(matches.length===1&&[matches[0].title,...matches[0].aliases].some(label=>language(label)===s||s.split(' ').filter(w=>w.length>3&&language(label).split(' ').includes(w)).length>=2))ids=[matches[0].id];else return{source,steps:[],notes:['No puedo resolver esa instrucción con certeza. Elegí una tarea disponible o describí una sola acción.'],understood:false}}
 const date=dateOf(s,base),steps=ids.flatMap(id=>{const tool=all.find(t=>t.id===id);if(!tool)return[];const values:Values={},references:Record<string,string>={};if(date){for(const key of ['date','new_date','day','start_day'])if(tool.fields.some(f=>f.key===key))values[key]=date}
 if(id==='schedule.absence'){
  if(date)values.starts_at=date+'T00:00';
  values.reason=/vacaciones/.test(s)?'Vacaciones':/almuerzo/.test(s)?'Almuerzo':/descans/.test(s)?'Descanso':'Ausencia';
  if(date&&/no trabajo|no atiendo/.test(s)){values.starts_at=date+'T00:00';values.ends_at=plusDate(date,1)+'T00:00';notes.push('Propongo el día completo; revisá ambas fechas y el profesional antes de confirmar.')}
  if(/\b(?:me |no trabajo|no atiendo|bloqueame|descanso)\b/.test(s))references.staff='@self';
 }
 if(id==='bookings.affected'&&date){values.starts_at=date+'T00:00';notes.push('La consulta de reservas afectadas no cancela ni reprograma ningún turno.')}
 if(id==='services.create'){
  const name=source.match(/\bservicio(?: de)? (.+?)(?= de \d+| \d+\s*(?:minutos|min)\b| a \$| por \$|$)/i);if(name)values.name=name[1].trim();
  const duration=s.match(/\b(\d{1,3})\s*(?:minutos|min)\b/);if(duration)values.duration_min=duration[1];
 }
 const price=s.match(/\$\s*(\d+(?:[.,]\d+)*)/)||s.match(/\b(\d+)\s*(?:pesos|uyu)\b/);if(price&&tool.fields.some(f=>f.key==='price_uyu'))values.price_uyu=price[1].replace(/\.(?=\d{3}(?:[.,]|$))/g,'').replace(',','.');
 if(id==='services.price'){if(/\d\s*%/.test(s))notes.push('Indicá el importe final en pesos. No aplicaré un porcentaje implícito.');const ref=s.match(/precio (?:del? |de la )?(.+?)(?= (?:a|en) \$?\d|$)/);if(ref)references.service=ref[1].trim()}
 if(id==='bookings.no_show'){const ref=s.match(/^(.+?) (?:falto|no vino|no asistio)/);if(ref)references.booking=ref[1].replace(/^el cliente /,'').trim()}
 if(id==='customers.search'){const match=source.match(/\bcliente\s+(?:llamado\s+)?(.+)$/i);if(match)values.q=match[1].trim()}
 if(id==='customers.history'){const match=source.match(/historial (?:del cliente |de |del )(.+)$/i);if(match&&!/^(?:un cliente|cliente)$/i.test(match[1]))references.customer=match[1].trim()}
 if(id==='customers.create'){const match=source.match(/(?:cliente|ficha de)\s+(.+?)(?=\s+(?:con|correo|email|telefono)|$)/i);if(match)values.name=match[1].trim();const email=source.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);if(email)values.email=email[0];const phone=source.match(/(?:telefono|teléfono|celular)\s+(\+?\d[\d -]{5,18})/i);if(phone)values.phone=phone[1].trim()}
 const explicitId=s.match(/\b(?:cliente|ficha) (?:llamado |de )?["“](.+?)["”]/);if(explicitId&&tool.fields.some(f=>f.key==='customer'))references.customer=explicitId[1];
 return[{id,title:tool.title,seed:{values,references},enabled:available.has(id),effect:tool.kind==='read'?'Consulta información autorizada.':id==='schedule.absence'?'Bloquea el período elegido si el servidor lo permite. No cancela reservas.':'Solo prepara datos: requiere revisión y confirmación explícita.'}];});
 if(!steps.length)return{source,steps,notes:['La función no existe en este catálogo.'],understood:false};
 const range=s.match(new RegExp('(?:de|desde) (?:las? )?('+hourToken+') (?:a|hasta) (?:las? )?('+hourToken+')\\b'));
 const until=s.match(new RegExp('hasta (?:las? )?('+hourToken+')\\b'));
 if(range||until){const a=range?.[1],b=range?.[2]||until?.[1],pm=/tarde|noche|\bpm\b/.test(s),am=/madrugada|\bam\b|de la manana/.test(s),ambiguous=[a,b].filter(Boolean).some(x=>{const h=hours[x!.split(':')[0]]??Number(x!.split(':')[0]);return !x!.includes(':')&&h>0&&h<12})&&!pm&&!am;
  const apply=(evening:boolean)=>steps.map(step=>{const copy:InstructionStep={...step,seed:{values:{...step.seed.values},references:{...step.seed.references}}};if(['schedule.absence','bookings.affected'].includes(step.id)&&date&&a&&b){copy.seed.values.starts_at=date+'T'+clock(a,evening);copy.seed.values.ends_at=date+'T'+clock(b,evening)}if(step.id==='schedule.exception'&&b)copy.seed.values.end=clock(b,evening);return copy});
  if(ambiguous&&steps.some(x=>x.id.startsWith('schedule.')))return{source,steps,notes,understood:true,clarification:{question:'¿A qué horario te referís?',choices:[{label:range?clock(a!)+ '–'+clock(b!):clock(b!),steps:apply(false)},{label:range?clock(a!,true)+'–'+clock(b!,true):clock(b!,true),steps:apply(true)}]}};
  const timed=apply(pm);steps.splice(0,steps.length,...timed);
 }
 if(/\bfalto\b/.test(s)&&!/(?:turno|cliente|profesional)/.test(s))notes.push('Si hablás de un cliente, marcamos su turno; si falta un profesional, bloqueamos su disponibilidad. Especificá cuál.');
 if(/vacaciones|almuerzo/.test(s)&&!range)notes.push('La conversación pedirá el inicio y fin exactos; no asumiré horarios ni fecha de regreso.');
 if(combined)notes.push('Primero consultaremos las reservas afectadas. Después podrás preparar el bloqueo. Cada paso se inicia por separado; no hay cancelaciones implícitas.');
 return{source,steps,notes,understood:true};
}
