import {createSocialResponder} from './social';
import {voice} from './personality';
import {isContextReference} from './references';
import {resolvePeriod} from './temporal';
import {ordinalChoice} from './language';
import {extractEntities} from './entities';
import {continueDialogue,displayValue,localPrompt,missingField} from './dialogue';
import {dateOf,interpretInstruction,type InstructionSeed,type InstructionStep} from './instructions';
import {language} from './intent-catalogue';
import {today,plusDate} from '../../domain/format';
import type {Capability} from './contracts';
export type FrameDraft={toolId:string;memory:InstructionSeed};
export type ConversationFrame=FrameDraft&{stopped?:boolean;reply?:string;pending?:{draft:FrameDraft;changes:{label:string;before:string;after:string}[]};clarification?:{question:string;choices:{label:string;draft:FrameDraft}[]}};
const clone=<T,>(v:T):T=>structuredClone(v);
/** Semantic memory belongs to one action in one conversation, never to global/session storage. */
export function createFrame(step:InstructionStep,source=''):ConversationFrame{return{toolId:step.id,memory:{values:{...extractEntities(source),...clone(step.seed.values)},references:clone(step.seed.references)}};}
export function projectFrame(frame:FrameDraft,tool:Capability):InstructionSeed{
 const groups=[['staff','staff_id','person'],['service','service_id'],['customer','customer_id']];const memory=clone(frame.memory);
 for(const f of tool.fields){if(Object.hasOwn(memory.values,f.key)||memory.references[f.key])continue;const group=groups.find(g=>g.includes(f.key));const source=group?.find(key=>Object.hasOwn(memory.values,key)||memory.references[key]);if(source){if(memory.references[source])memory.references[f.key]=memory.references[source];else memory.values[f.key]=memory.values[source];}}
 const keys=new Set(tool.fields.map(f=>f.key));return{values:Object.fromEntries(Object.entries(memory.values).filter(([key])=>keys.has(key))),references:Object.fromEntries(Object.entries(memory.references).filter(([key])=>keys.has(key)))};
}
export function intentReply(frame:FrameDraft,tool:Capability){const kept=Object.keys(projectFrame(frame,tool).values).map(key=>({duration_min:'la duración',price_uyu:'el precio',name:'el nombre'}[key]||'ese dato'));return (tool.kind==='create'?'Vamos a crear '+(tool.area==='Servicios'?'un servicio nuevo':tool.area==='Clientes'?'una ficha nueva':'una reserva nueva')+'. ':'Preparamos '+tool.title.toLowerCase()+'. ')+(kept.length?'Ya tengo '+[...new Set(kept)].join(' y ')+'. ':'')+localPrompt(tool,projectFrame(frame,tool)).replace(/^(?:Vamos con ese servicio nuevo|Le damos un lugar en tu catálogo)\. /,'');}
export function frameIssue(frame:FrameDraft){const {starts_at:from,ends_at:to}=frame.memory.values;return from&&to&&String(to)<=String(from)?'El final tiene que ser posterior al inicio. Confirmame la fecha y la hora de regreso.':'';}
export function framePrompt(frame:ConversationFrame,tool:Capability){return frameIssue(frame)||(frame.pending?voice({state:'correction-pending',tool,values:frame.memory.values}):frame.clarification?voice({state:'ambiguity',tool,values:frame.memory.values,question:frame.clarification.question}):frame.reply||localPrompt(tool,projectFrame(frame,tool)));}

function changed(before:FrameDraft,after:FrameDraft,tools:readonly Capability[]){if(before.toolId.split('.')[0]!==after.toolId.split('.')[0])return[];const tool=tools.find(t=>t.id===after.toolId)!,previous=projectFrame(before,tool),next=projectFrame(after,tool);const fields=[...tool.fields,...(family(tool)==='services'?Object.entries({name:'Nombre',price_uyu:'Precio',duration_min:'Duración'}).filter(([key])=>!tool.fields.some(f=>f.key===key)).map(([key,label])=>({key,label})):[])];return fields.flatMap(f=>{const old=previous.values[f.key]??previous.references[f.key]??before.memory.values[f.key],value=next.values[f.key]??next.references[f.key]??after.memory.values[f.key];if(old===undefined||value===undefined||language(String(old))===language(String(value)))return[];return[{label:f.label,before:old==='@self'?'Tu profesional':displayValue(f.key,old),after:value==='@self'?'Tu profesional':displayValue(f.key,value)}]});}
function propose(frame:ConversationFrame,draft:FrameDraft,tools:readonly Capability[],reply?:string):ConversationFrame{
 const values=draft.memory.values;if(values.starts_at&&values.ends_at&&String(values.ends_at)<=String(values.starts_at))return{...frame,reply:'El final tiene que ser posterior al inicio. ¿Qué fecha u hora corregimos?'};
 const changes=changed(frame,draft,tools);if(changes.length)return{toolId:frame.toolId,memory:clone(frame.memory),pending:{draft,changes},reply:'¿Usamos estos cambios?'};
 return{...draft,reply};
}
const clean=(s:string)=>s.replace(/^(?:(?:no|en realidad(?: es)?|mejor|quiero|quisiera|necesito|prefiero)[,\s]+)+/i,'').trim();
function family(tool:Capability){return tool.id.split('.')[0];}
function switchTarget(tool:Capability,source:string,all:readonly Capability[]){const s=language(source),area=family(tool);
 if(/^(?:uno|una|otro|otra|un servicio|una ficha)?\s*(?:nuevo|nueva)|^(?:crear|crea|agregar|agrega) (?:uno|una)\b/.test(s)){const id=area==='services'?'services.create':area==='customers'?'customers.create':area==='bookings'?'bookings.create':undefined;return all.find(t=>t.id===id);}
 if(/\b(?:crea\w*|agrega\w*|consulta\w*|mostra\w*|cancela\w*|modifica\w*|edita\w*|cambia el precio|subi el precio)\b/.test(s)){const parsed=interpretInstruction(source,all,all);if(!parsed.clarification&&parsed.steps.length===1){const candidate=all.find(t=>t.id===parsed.steps[0].id);if(candidate)return candidate;}}
 return undefined;
}
export function confirmFrame(frame:ConversationFrame,accept:boolean,tools:readonly Capability[]):ConversationFrame{
 if(!frame.pending)return frame;
 const draft=accept?clone(frame.pending.draft):{toolId:frame.toolId,memory:clone(frame.memory)},tool=tools.find(t=>t.id===draft.toolId)!;
 return{...draft,reply:voice({state:accept?'correction-accepted':'correction-rejected',tool,values:draft.memory.values,changes:frame.pending.changes,question:missingField(tool,projectFrame(draft,tool))?localPrompt(tool,projectFrame(draft,tool)):undefined})};
}

export function chooseFrame(frame:ConversationFrame,index:number,tools:readonly Capability[]){const choice=frame.clarification?.choices[index];return choice?propose(frame,clone(choice.draft),tools):frame;}
export function continueFrame(frame:ConversationFrame,source:string,all:readonly Capability[],base=today()):ConversationFrame{
 const social=createSocialResponder().reply(source,{pending:true});if(social)return{...frame,reply:social.text};
 const s=language(source),tool=all.find(t=>t.id===frame.toolId);if(!tool||source.length>500||!source.trim())return{...frame,reply:'Contame ese dato en una frase breve.'};
 if(/\d\s*%/.test(s))return{...frame,reply:'Entendí el porcentaje. Los descuentos y promociones todavía no están disponibles; no cambié la propuesta.'};
 if(frame.clarification){const ordinal=ordinalChoice(source,frame.clarification.choices.length);if(ordinal!==undefined)return chooseFrame(frame,ordinal,all);const matches=frame.clarification.choices.map((c,i)=>({c,i})).filter(({c})=>language(c.label)===s||s.length>=4&&language(c.label).includes(s.replace(/^el |^la /,'')));if(matches.length===1)return chooseFrame(frame,matches[0].i,all);}
 if(frame.pending&&/^(?:si|dale|correcto|confirmo|usar estos datos|si, cambiar)[.! ]*$/.test(s))return confirmFrame(frame,true,all);
 if(frame.pending&&/^(?:no|no gracias|conservar|conservar anterior|dejalo como estaba)[.! ]*$/.test(s))return confirmFrame(frame,false,all);
 if(/^(?:mejor )?(?:cancelar|cancela|cancelalo|descartar|descartalo|olvidalo|no quiero seguir)(?: la conversacion| esta solicitud| esto)?[.! ]*$/.test(s))return{...frame,stopped:true,pending:undefined,clarification:undefined,reply:'No voy a ejecutar nada. Podés cerrar esta solicitud con «Empezar otra consulta».'};
 if(family(tool)==='services'&&/^(?:uno|un servicio|otro)?\s*(?:existente|que ya existe)|^(?:modificar|ajustar) (?:uno|el existente)\b/.test(s)){const ids=[...(frame.memory.values.price_uyu?['services.price']:[]),...(frame.memory.values.duration_min?['services.duration']:[])];const targets=(ids.length?ids:['services.price','services.duration']).map(id=>all.find(t=>t.id===id)!);if(targets.length>1)return{...frame,clarification:{question:'¿Qué querés ajustar del servicio existente?',choices:targets.map(t=>({label:t.title,draft:{toolId:t.id,memory:clone(frame.memory)}}))}};return{toolId:targets[0].id,memory:clone(frame.memory),reply:localPrompt(targets[0],projectFrame({toolId:targets[0].id,memory:frame.memory},targets[0]))};}
 if(family(tool)!=='services'&&/^(?:uno|una|otro|otra)?\s*(?:existente|que ya existe)[.! ]*$/.test(s)){const options=all.filter(t=>family(t)===family(tool)&&['read','update'].includes(t.kind)).slice(0,3);return options.length?{...frame,clarification:{question:'¿Qué querés hacer con ese registro existente?',choices:options.map(t=>({label:t.title,draft:{toolId:t.id,memory:clone(frame.memory)}}))}}:{...frame,reply:'Todavía no puedo preparar esa modificación. No hice cambios.'};}
 if(isContextReference(source)){
  if(frame.clarification)return{...frame,reply:'¿Cuál de las opciones querés elegir?'};
  const seed=projectFrame(frame,tool),references=Object.entries(seed.references);
  if(frame.pending)return{...frame,reply:'Primero confirmemos o descartemos el cambio pendiente; después seguimos con ese elemento.'};
  if(references.length===1&&!/anterior|ultimo|segundo|primero|tercero|agregue|cree/.test(s))return{...frame,reply:'Seguimos con '+(references[0][1]==='@self'?'tu profesional':references[0][1])+'. '+localPrompt(tool,seed)};
  if(tool.kind==='create'&&seed.values.name)return{...frame,reply:'¿Te referís a la propuesta «'+seed.values.name+'»? Todavía no está guardada. Podemos seguir ajustándola; no la voy a tratar como un registro existente.'};
  return{...frame,reply:'No puedo identificar ese registro con certeza. Decime el nombre o elegilo entre las opciones disponibles; no hice cambios.'};
 }
 const working=clone(frame.pending?.draft||frame),target=switchTarget(tool,clean(source),all);
 if(target?.id===working.toolId&&/^(?:(?:uno|una|otro|otra)\s+nuev[oa]|(?:crear|crea|agregar|agrega)\s+(?:uno|una))[.! ]*$/.test(language(clean(source))))return{...frame,reply:intentReply(frame,target)};
 if(target&&target.id!==working.toolId){
  const draft:FrameDraft={toolId:target.id,memory:family(target)===family(tool)?clone(frame.memory):{values:{},references:{}}};
  // An existing target is never silently reused as the identity of a new record.
  if(target.kind==='create')for(const key of family(target)==='services'?['service','service_id']:family(target)==='customers'?['customer','customer_id']:['booking']){delete draft.memory.values[key];delete draft.memory.references[key];}
  const explicit=interpretInstruction(source,all,all,base).steps.find(t=>t.id===target.id);if(explicit){Object.assign(draft.memory.values,explicit.seed.values);Object.assign(draft.memory.references,explicit.seed.references);}
  Object.assign(draft.memory.values,extractEntities(source));return propose(frame,draft,all,intentReply(draft,target));
 }
 if(frame.stopped)return{...frame,reply:'Esta solicitud quedó descartada. Empezá otra consulta para seguir.'};
 const draft:FrameDraft={toolId:working.toolId,memory:clone(working.memory)},currentTool=all.find(t=>t.id===draft.toolId)!,seed=projectFrame(draft,currentTool),f=missingField(currentTool,seed),correction=clean(source);
 if(currentTool.id==='schedule.day'){const field=currentTool.fields.find(f=>f.key==='weekday'),value=Array.isArray(field?.options)?field.options.find(o=>language(o.label)===language(correction).replace(/^(?:el |era para el )/,'')):undefined;if(value){draft.memory.values.weekday=value.value;return propose(frame,draft,all);}}
 const person=correction.match(/^(?:es )?(?:para|profesional(?: es)?|cliente(?: es)?|con)\s+(.+)$/i),staffKey=currentTool.fields.find(f=>['staff','person','staff_id'].includes(f.key))?.key,customerKey=currentTool.fields.find(f=>['customer','customer_id'].includes(f.key))?.key;
 if(person){const name=person[1].trim().replace(/^(?:la |el )?(?:profesional|cliente)\s+/i,''),isStaff=/profesional/.test(correction),isCustomer=/cliente/.test(correction),keys=isStaff&&staffKey?[staffKey]:isCustomer&&customerKey?[customerKey]:[staffKey,customerKey].filter((k):k is string=>Boolean(k));
 if(keys.length>1)return{...frame,clarification:{question:'¿Hablás del cliente o del profesional?',choices:keys.map(key=>({label:key===staffKey?'Del profesional':'Del cliente',draft:{...clone(draft),memory:{values:Object.fromEntries(Object.entries(draft.memory.values).filter(([k])=>k!==key)),references:{...draft.memory.references,[key]:name}}}}))}};
 if(keys.length===1){draft.memory.references[keys[0]]=name;delete draft.memory.values[keys[0]];return propose(frame,draft,all);}}

 if(currentTool.fields.some(f=>f.key==='starts_at')){
  const contextDay=String(seed.values.starts_at||draft.memory.values.date||'').slice(0,10),period=resolvePeriod(source,base,contextDay);
  if(period.values){Object.assign(draft.memory.values,period.values);return propose(frame,draft,all);}
  if(period.question)return{...frame,reply:period.question};
 }
 const contextualClock=s.match(/^(?:a las? |desde |hasta )?(\d{1,2}:\d\d)$/);
 if(contextualClock&&currentTool.fields.some(f=>f.key==='starts_at')){
  const contextDay=String(seed.values.starts_at||draft.memory.values.date||'').slice(0,10),key=/^hasta /.test(s)?'ends_at':/^desde /.test(s)||!seed.values.starts_at?'starts_at':!seed.values.ends_at?'ends_at':undefined;
  if(!contextDay)return{...frame,reply:'Ya tengo la hora. ¿Para qué día es?'};
  if(!key)return{...frame,reply:'¿Esa hora es el inicio o el final del bloqueo?'};
  const time=contextualClock[1].padStart(5,'0');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return{...frame,reply:'Revisá la hora: necesito un horario válido.'};
  draft.memory.values[key]=contextDay+'T'+time;return propose(frame,draft,all);
 }
 // Resolve date-only corrections in the context of the existing interval, preserving explicit hours.
 const contextDay=String(seed.values.starts_at||seed.values.date||seed.values.day||draft.memory.values.date||'').slice(0,10),anchor=/\b(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(s)&&/^\d{4}-\d\d-\d\d$/.test(contextDay)?contextDay:base;
 const day=dateOf(s,anchor),hasDate=/\b(?:hoy|ayer|manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b|\d{4}-\d\d-\d\d/.test(s),hasClock=/\d{1,2}:\d\d|\b(?:de|desde|hasta) (?:las? )?(?:\d|una|dos|tres)/.test(s);
 if(day&&hasDate&&!hasClock&&currentTool.fields.some(f=>['starts_at','date','day','new_date','start_day'].includes(f.key))){
  if(currentTool.fields.some(f=>f.key==='starts_at')){const from=String(seed.values.starts_at||''),to=String(seed.values.ends_at||'');
   if(!from&&!/hasta|fin|regreso/.test(s)){draft.memory.values.date=day;return{...draft,reply:'Ya tengo el día. ¿Desde qué hora y hasta qué hora lo preparamos?'};}
   if(from&&to&&from.slice(0,10)!==to.slice(0,10)&&!(from.slice(11)==='00:00'&&to.slice(11)==='00:00'&&Date.parse(to.slice(0,10))-Date.parse(from.slice(0,10))===86400000)&&!/(?:inicio|desde|regreso|hasta|fin)/.test(s)){return{...frame,clarification:{question:'¿Cambiamos el inicio o el regreso a esa fecha?',choices:[['El inicio','starts_at'],['El regreso','ends_at']].map(([label,key])=>({label,draft:{...clone(draft),memory:{...clone(draft.memory),values:{...draft.memory.values,[key]:day+'T'+String(seed.values[key]).slice(11,16)}}}}))}};}
   const endOnly=/regreso|hasta|fin/.test(s);if(endOnly)draft.memory.values.ends_at=day+'T'+(to.slice(11,16)||'00:00');else{draft.memory.values.starts_at=day+'T'+(from.slice(11,16)||'00:00');if(from&&to&&from.slice(11)==='00:00'&&to.slice(11)==='00:00'&&Date.parse(to.slice(0,10))-Date.parse(from.slice(0,10))===86400000)draft.memory.values.ends_at=plusDate(day,1)+'T00:00';else if(from&&to&&from.slice(0,10)===to.slice(0,10))draft.memory.values.ends_at=day+'T'+to.slice(11,16);}
  }else{const dateFields=currentTool.fields.filter(f=>['date','day','new_date','start_day'].includes(f.key));let key=f?.type==='date'?f.key:/nueva/.test(s)&&dateFields.some(f=>f.key==='new_date')?'new_date':/actual|original/.test(s)?'date':dateFields.length===1?dateFields[0].key:undefined;if(!key&&dateFields.length>1)return{...frame,clarification:{question:'¿Qué fecha querés cambiar?',choices:dateFields.map(f=>({label:f.label,draft:{...clone(draft),memory:{...clone(draft.memory),values:{...draft.memory.values,[f.key]:day}}}}))}};if(key)draft.memory.values[key]=day;else return{...frame,reply:'¿A qué fecha de esta solicitud te referís?'};}
  return propose(frame,draft,all);
 }
 if(currentTool.fields.some(f=>f.key==='starts_at')){const parsed=interpretInstruction('Bloqueame ese horario '+source+(!hasDate&&contextDay?' '+contextDay:''),all,all,base);if(parsed.clarification)return{...frame,clarification:{question:parsed.clarification.question,choices:parsed.clarification.choices.map(c=>({label:c.label,draft:{...clone(draft),memory:{values:{...draft.memory.values,...Object.fromEntries(Object.entries(c.steps[0].seed.values).filter(([key])=>['starts_at','ends_at'].includes(key)))},references:draft.memory.references}}}))}};
 if(parsed.steps[0]?.seed.values.ends_at){Object.assign(draft.memory.values,Object.fromEntries(Object.entries(parsed.steps[0].seed.values).filter(([key])=>['starts_at','ends_at'].includes(key))));return propose(frame,draft,all);}}
 // A bare correction can target a single reference field; multiple candidates require clarification.
 if(correction!==source&&/^[a-záéíóúüñ][a-záéíóúüñ .'-]*$/i.test(correction)&&!hasDate){const references=currentTool.fields.filter(f=>f.type==='select'&&typeof f.options==='function');if(references.length===1){const key=references[0].key;draft.memory.references[key]=correction;delete draft.memory.values[key];return propose(frame,draft,all);}if(references.length>1)return{...frame,clarification:{question:'¿Qué dato querés corregir?',choices:references.map(f=>({label:f.label,draft:{...clone(draft),memory:{values:Object.fromEntries(Object.entries(draft.memory.values).filter(([key])=>key!==f.key)),references:{...draft.memory.references,[f.key]:correction}}}}))}};}
 let independent=extractEntities(source);
 if(/^mejor \d{1,3}[.! ]*$/.test(s)){const keys=['duration_min','price_uyu'].filter(k=>draft.memory.values[k]!==undefined);if(keys.length!==1)return{...frame,reply:'¿Ese número es la duración en minutos o el precio en pesos?'};independent={[keys[0]]:s.match(/\d+/)![0]};}
 if(/^(?:ese|esa|eso)$/.test(s))return{...frame,reply:'¿Cuál exactamente? Decime el nombre para elegirlo sin confundirnos.'};
 if(independent.name&&!currentTool.fields.some(f=>f.key==='name')&&f?.type==='select'&&typeof f.options==='function'&&Object.keys(independent).length===1){draft.memory.references[f.key]=String(independent.name);delete draft.memory.values[f.key];return propose(frame,draft,all);}
 if(Object.keys(independent).length){Object.assign(draft.memory.values,independent);return propose(frame,draft,all);}
 // A short answer is a field value only after intent/correction resolution, never before.
 const shortTime=s.match(/^(?:a las |desde |hasta )?(\d{1,2}:\d\d)$/i),answerText=shortTime&&contextDay&&f?.type==='datetime-local'?contextDay+'T'+shortTime[1].padStart(5,'0'):f&&['select','text','number'].includes(f.type)?correction:source;
 const answer=continueDialogue(currentTool,seed,answerText);if(answer.error)return{...frame,reply:answer.error};
 Object.assign(draft.memory.values,answer.seed.values);Object.assign(draft.memory.references,answer.seed.references);
 // Retain independent facts even when the current tool does not expose them.
 Object.assign(draft.memory.values,extractEntities(source));
 return propose(frame,draft,all);
}
