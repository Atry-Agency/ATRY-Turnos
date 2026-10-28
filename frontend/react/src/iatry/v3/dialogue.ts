import {voice} from './personality';
import {type InstructionSeed,type InstructionStep} from './instructions';
import {language} from './intent-catalogue';
import {validate} from './validation';
import type {Capability,Values} from './contracts';
import type {OperationFacts} from '../shared/OperationCard';
/** Local conversational draft only. Never resolves record IDs, fetches, prepares RPCs or grants access. */
export type Dialogue={seed:InstructionSeed;error?:string};
export const displayValue=(key:string,value:unknown)=>{
 const s=String(value);if(/^(?:\d{4}-\d\d-\d\d)(?:T\d\d:\d\d)?$/.test(s)){const [d,t]=s.split('T');const date=new Date(d+'T12:00:00Z');if(Number.isFinite(date.valueOf()))return new Intl.DateTimeFormat('es-UY',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}).format(date)+(t?' · '+t:'');}
 return key==='duration_min'?s+' minutos':key==='price_uyu'?'$ '+s:s;
};
export function missingField(tool:Capability,seed:InstructionSeed){if(tool.id==='customers.create'&&seed.values.name&&!seed.values.email&&!String(seed.values.phone||'').replace(/[^0-9]/g,''))return tool.fields.find(f=>f.key==='email');return tool.fields.find(f=>f.required&&!Object.hasOwn(seed.values,f.key)&&!seed.references[f.key]);}
function basePrompt(tool:Capability,seed:InstructionSeed){const f=missingField(tool,seed);if(!f)return tool.kind==='read'?(tool.id==='business.statistics'?'Veamos cómo viene tu negocio. ¿Consultamos los números?':tool.id==='customers.search'?'Busquemos esa ficha. ¿Querés que la consulte?':tool.id==='services.list'?'¿Vemos los servicios de tu negocio?':'Ya tengo lo necesario. ¿Lo consultamos?'):'¡Listo! Te muestro cómo quedaría antes de hacer cambios.';
 if(tool.id==='customers.create'&&f.key==='email')return '¿Qué correo o teléfono dejamos como contacto?';
 if(f.key==='name')return tool.id==='services.create'?'¡Dale! ¿Cómo se va a llamar?':tool.area==='Clientes'?'¿Cómo se llama el cliente?':'¿Qué nombre le ponemos?';
 if(tool.id==='services.create'&&['price_uyu','duration_min'].includes(f.key)&&!seed.values.price_uyu&&!seed.values.duration_min)return 'Perfecto. ¿Cuánto dura y cuánto cuesta?';
 const prompts:Record<string,string>={service:'¿Qué servicio querés ajustar?',customer:'¿De qué cliente hablamos?',staff:'¿Para qué profesional lo preparamos?',person:'¿Qué profesional querés consultar?',price_uyu:'¿Qué precio querés ponerle, en pesos?',duration_min:'¿Cuántos minutos dura?',starts_at:'¿Desde qué día y hora? Por ejemplo, 16/11/2026 a las 13:00.',ends_at:'¿Hasta qué día y hora?',q:'¿A qué cliente buscamos?',date:'¿Para qué fecha?',reason:'¿Qué motivo querés dejar anotado?'};
 return prompts[f.key]||f.label;
}
export function localPrompt(tool:Capability,seed:InstructionSeed){return voice({state:missingField(tool,seed)?'question':'ready',tool,values:seed.values,question:basePrompt(tool,seed)});}
function dateTime(raw:string){const source=language(raw);const iso=source.match(/\b(\d{4}-\d\d-\d\d)(?:[tT]| a las | a la | a | )(\d{1,2}:\d\d)\b/);if(iso)return iso[1]+'T'+iso[2].padStart(5,'0');const local=source.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})(?: a las | a la | a | )(\d{1,2}:\d\d)\b/);return local?local[3]+'-'+local[2].padStart(2,'0')+'-'+local[1].padStart(2,'0')+'T'+local[4].padStart(5,'0'):undefined;}
export function continueDialogue(tool:Capability,current:InstructionSeed,source:string):Dialogue{
 const seed=structuredClone(current),s=language(source),field=missingField(tool,seed);if(!source.trim()||source.length>500)return{seed,error:'Contame ese dato en una frase breve.'};
 const person=source.match(/^(?:para|profesional(?: es)?|con)\s+(.+)$/i);if(person&&tool.fields.some(f=>f.key==='staff')){seed.references.staff=person[1].trim();delete seed.values.staff;return{seed};}
 const updates:Values={},duration=s.match(/\b(\d{1,3})\s*(?:minutos|min)\b/),price=s.match(/\$\s*(\d+(?:[.,]\d+)*)/)||s.match(/\b(\d+(?:[.,]\d+)*)\s*pesos\b/)||s.match(/(?:cuesta|precio(?: es)?|cobrar)\s+(\d+(?:[.,]\d+)*)\b/);
 const contact=source.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),phone=source.match(/^(?:(?:telefono|teléfono|celular)\s+)?(\+?\d[\d -]{4,32})$/i);if(tool.id.startsWith('customers.')){if(contact)updates.email=contact[0];if(phone)updates.phone=phone[1].trim();}
 if(field?.key==='name'&&!/minutos|min\b|pesos|\$|cuesta|precio/.test(s)&&!/(?:nombre|llama)/.test(s)){try{validate({...field,options:undefined,value:source.trim()},source.trim());seed.values.name=source.trim();return{seed};}catch(e){return{seed,error:(e as Error).message};}}
 if(duration&&tool.fields.some(f=>f.key==='duration_min'))updates.duration_min=duration[1];
 if(price&&tool.fields.some(f=>f.key==='price_uyu'))updates.price_uyu=price[1].replace(/\.(?=\d{3}(?:[.,]|$))/g,'').replace(',','.');
 const rename=source.match(/(?:se (?:va a )?llama|nombre(?: es)?|llamalo(?: mejor)?)\s+(.+?)(?=,?\s+(?:y\s+)?(?:dura|cuesta|duracion|precio)\b|$)/i)||(field?.key==='name'?source.match(/^(.+?)(?:,\s*|\s+y\s+|\s+)(?:dura|cuesta)\b/i):null);
 if(rename&&tool.fields.some(f=>f.key==='name'))updates.name=rename[1].trim();
 const instant=dateTime(source);if(instant){const key=/hasta|termina|regreso|fin/.test(s)?'ends_at':/desde|empieza|inicio/.test(s)?'starts_at':field?.key;if(key&&tool.fields.some(f=>f.key===key))updates[key]=instant;}
 if(!Object.keys(updates).length&&field){
  if(typeof field.options==='function'){seed.references[field.key]=source.trim();return{seed};}
  if(Array.isArray(field.options)){const matches=field.options.filter(o=>language(o.label)===s||o.value===source.trim());if(matches.length!==1)return{seed,error:'Elegí una de las opciones para que no nos confundamos.'};updates[field.key]=matches[0].value;}
  else if(field.type==='datetime-local')return{seed,error:'Necesito el día y la hora exactos. Podés escribir 16/11/2026 a las 13:00.'};
  else updates[field.key]=source.trim();
 }
 if(!Object.keys(updates).length)return{seed,error:'¿Qué dato querés corregir? Podés decir «30 minutos», «500 pesos» o «el nombre es Barba».'};
 try{for(const[key,value]of Object.entries(updates)){const f=tool.fields.find(f=>f.key===key)!;validate({...f,options:Array.isArray(f.options)?f.options:undefined,value},value);if(f.type==='datetime-local'){const [d,t]=String(value).split('T');validate({key:'day',label:'fecha',type:'date',required:true},d);validate({key:'time',label:'hora',type:'time',required:true},t||'');}}Object.assign(seed.values,updates);if(seed.values.starts_at&&seed.values.ends_at&&String(seed.values.ends_at)<=String(seed.values.starts_at))throw Error('La fecha de regreso debe ser posterior al inicio.');return{seed};}catch(e){return{seed:structuredClone(current),error:(e as Error).message};}
}
export function draftFacts(tool:Capability,seed:InstructionSeed):OperationFacts{
 const labels:Record<string,string>={name:'Nombre',price_uyu:'Precio',duration_min:'Duración',staff:'Profesional',customer:'Cliente',service:'Servicio',starts_at:'Desde',ends_at:'Hasta'};
 const rows=tool.fields.flatMap(f=>{const v=seed.values[f.key],ref=seed.references[f.key];if(ref)return[{label:labels[f.key]||f.label,value:ref==='@self'?'Tu profesional · por elegir':ref+' · por elegir'}];return v!==undefined&&v!==''&&!Array.isArray(v)&&typeof v!=='boolean'?[{label:labels[f.key]||f.label,value:displayValue(f.key,v)}]:[];});
 const from=seed.values.starts_at,to=seed.values.ends_at;
 return{title:typeof seed.values.name==='string'?seed.values.name:tool.title,kind:tool.area==='Servicios'?'service':tool.area==='Clientes'?'customer':tool.area==='Horarios'?'period':tool.area==='Agenda'?'booking':'record',rows:rows.filter(r=>r.label!=='Nombre'||r.value!==seed.values.name),...(from&&to?{interval:{start:displayValue('starts_at',from),end:displayValue('ends_at',to),title:String(seed.values.reason||'Período propuesto')}}:{})};
}
export function parseFollowUp(step:InstructionStep,tool:Capability,source:string):Dialogue{return continueDialogue(tool,step.seed,source);}

export function quickReplies(tool:Capability,seed:InstructionSeed){const f=missingField(tool,seed);if(!f)return[];if(Array.isArray(f.options))return f.options.slice(0,3).map(o=>o.label);if(f.key==='duration_min')return['15 minutos','30 minutos','60 minutos'];if(f.key==='price_uyu')return['0 pesos'];return[];}
