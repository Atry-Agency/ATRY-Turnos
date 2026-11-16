import type {AppPort} from '../app/port';
import {adminApi,object,rows,string,type Data} from './api';
import {adminChatTools,chatTool,type AdminChatTool,type ChatField,type TargetKind} from './chat-catalogue';
import {ordinalChoice} from '../iatry/v3/language';
import {adminDatePhrases,adminLanguage,adminIntents,adminSlots,periodDays,targetSearch,isAdminAffirmation,isDraftCancellation} from './chat-language';
import {adminRead,adminEntities,entityOf,operationContext,operationFields,validateChatField,prepareAdminWrite,verifyAdminWrite,contextFingerprint,type ChatEntity,type OperationContext,type PreparedAdminWrite} from './chat-operations';
import {resolveAdminReference,type AdminContext} from './assistant-model';
import {socialIntent,createSocialResponder} from '../iatry/v3/social';
import {calendarDay} from '../iatry/v3/temporal';
import {regionalDay,type RegionalBusiness} from '../domain/region';
export type AdminChatPhase='idle'|'locating'|'choosing'|'collecting'|'review'|'executing'|'verifying'|'done'|'error'|'uncertain';
export interface AdminChatState {phase:AdminChatPhase;tool?:string;messages:{who:'user'|'assistant';text:string}[];question?:string;field?:ChatField;choices:ChatEntity[];toolChoices:string[];selected:string[];values:Data;plans:PreparedAdminWrite[];ticket:string;armed:boolean;riskAccepted:boolean;results:{id:string;name:string;message:string;verified:boolean}[];error?:string;read?:Data}
export interface AdminChatOptions {executionAllowed:()=>boolean;initial:()=>AdminContext;onVerified?:()=>void;clock?:()=>Date;uuid?:()=>string}
function deepFreeze<T>(v:T):T{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(deepFreeze)}return v}
const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
const label=(r:ChatEntity)=>r.name;
const referenceOnly=(s:string)=>/^(?:(?:no |mejor )?(?:el |la |al |del )?(?:primero|primera|segundo|segunda|tercero|tercera|ultimo|ultima|ese|esa|ese mismo|esa misma)|\d+)$/.test(adminLanguage(s));
/** Deterministic conversation + existing admin transport. No credentials, new RPC, broad grant or automatic retries. */
export class AdminChatEngine{
 private api;private listeners=new Set<()=>void>();private alive=true;private pending=false;private contexts:OperationContext[]=[];private targets:ChatEntity[]=[];private selectionKind?:TargetKind;private lastList?:{kind:TargetKind;entities:ChatEntity[]};private source='';private dateTexts:Record<string,string>={};private quotedAt=0;private attempted=new Set<string>();private currentWrite?:PreparedAdminWrite;private receipts=new Map<string,Data>();private social=createSocialResponder();private actor:string;
 private state:AdminChatState={phase:'idle',messages:[],choices:[],toolChoices:[],selected:[],values:{},plans:[],ticket:'',armed:false,riskAccepted:false,results:[]};
 constructor(private port:AppPort,private options:AdminChatOptions){this.api=adminApi(port);this.actor=port.user().id;}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn)}};
 snapshot=()=>this.state;
 private emit(p:Partial<AdminChatState>){if(!this.alive)return;this.state={...this.state,...p};this.listeners.forEach(fn=>fn())}
 private say(text:string,who:'user'|'assistant'='assistant'){this.emit({messages:[...this.state.messages,{who,text}].slice(-40)})}
 private now(){return this.options.clock?.()||new Date()}
 private uuid(){return this.options.uuid?.()||crypto.randomUUID()}
 private check(){if(!this.alive||!this.api.current()||this.port.user().id!==this.actor)throw Error('La sesión administrativa cambió. Volvé a abrir IAtry con tu sesión autorizada.');}
 private authorize(){try{this.check();return true}catch(e){this.emit({phase:this.currentWrite?'uncertain':'error',armed:false,riskAccepted:false,error:(e as Error).message});this.say((e as Error).message);return false}}
 activate(){this.alive=true;this.api.activate()}
 dispose(){this.alive=false;this.api.dispose();this.listeners.clear()}
 locked=()=>this.pending||['executing','verifying','uncertain'].includes(this.state.phase);
 dirty=()=>!['idle','done'].includes(this.state.phase);
 cancel(){if(this.locked()){this.say('Primero necesitamos comprobar el resultado pendiente. No voy a repetir ni descartar esa escritura.');return false;}this.targets=[];this.contexts=[];this.emit({phase:'idle',tool:undefined,field:undefined,question:undefined,choices:[],toolChoices:[],selected:[],values:{},plans:[],ticket:'',armed:false,riskAccepted:false,error:undefined});this.say('Dejamos esa propuesta sin ejecutar. ¿Con qué seguimos?');return true;}
 async receive(source:string){
  if(!source.trim()||source.length>2000||this.pending)return;if(!this.authorize())return;this.say(source,'user');
  if(this.state.phase==='uncertain'){this.say('Hay una respuesta sin verificar. Usá «Comprobar resultado»; no voy a enviar otra escritura.');return;}
  if(isDraftCancellation(source)){this.cancel();return;}
  const temporalAnswer=['choosing','collecting','review','error'].includes(this.state.phase)&&Boolean(this.state.tool)&&(['subscription','followup'].includes(this.state.tool!)&&Object.keys(adminDatePhrases(source)).length>0||this.state.field?.type==='date');
  const social=socialIntent(source);if(!temporalAnswer&&social&&['greeting','thanks','goodbye','wellbeing','fatigue','celebration','resume'].includes(social)){const reply=this.social.reply(source,{pending:this.dirty()});if(reply)this.say(reply.text);return;}
  if(isAdminAffirmation(source)&&this.state.phase==='review'){this.emit({armed:false,riskAccepted:false});this.say('La propuesta está preparada. Revisá la tarjeta y usá su confirmación visual para guardarla.');return;}
  if(this.state.tool&&!chatTool(this.state.tool)?.read&&/^(?:ese no|esa no|no ese|no esa|es otro negocio|es otra cuenta|cambiar registro|cambia el registro)$/.test(adminLanguage(source))){await this.reselectTargets();return;}
  let intents=adminIntents(source,this.state.tool);
  const current=this.state.tool&&chatTool(this.state.tool),field=this.state.field,freeText=field&&['text','textarea'].includes(field.type),explicitCommand=/^(?:(?:quiero|necesito|por favor) )?(?:habilit|activ|renov|renuev|suspend|bloque|desbloque|revoc|retira|pausa|reanud|registr|crea|elimina|borra|cambia|ajusta|modifica|mostra|busca|ver |consulta)/.test(adminLanguage(source));
  if(current&&!current.read&&this.targets.length&&!this.locked()&&(!freeText||explicitCommand||/^(?:no |mejor |era |es )/.test(adminLanguage(source)))){
   const q=targetSearch(source,current.target),recordCue=/\b(negocio|cuenta|usuario|incidencia|solicitud)\b/.test(adminLanguage(source)),r=resolveAdminReference({administrator:true,section:'negocios',data:{rows:this.lastList?.kind===current.target?this.lastList.entities:[]}},source);
   if(q&&!this.targets.some(t=>[t.id,t.name,String(t.email||'')].some(v=>adminLanguage(v)===adminLanguage(q)))||recordCue&&r.record&&!this.targets.some(t=>t.id===r.record!.id)){
    const carry={...this.state.values};for(const k of ['keep_staff_ids','payment_id','business_id','confirm_slug'])delete carry[k];const update=adminSlots(source,current.id,this.baseDay());if(carry._autoNote&&update.subscription_action&&carry.subscription_action!==update.subscription_action){delete carry.note;delete carry._autoNote;delete carry.amount_uyu;}await this.start(current.id,source,carry);return;
   }
  }
  if(current&&!current.read&&['choosing','collecting','review','error'].includes(this.state.phase)&&(!intents.length||intents.length===1&&intents[0]===current.id||freeText&&!explicitCommand)){
   if(this.state.phase==='choosing'&&referenceOnly(source)){const r=resolveAdminReference({section:'negocios',administrator:true,data:{rows:this.state.choices}},/^\d+$/.test(source.trim())?'numero '+source:source);if(r.record)return this.choose([String(r.record.id)]);}
   const before={...this.state.values},base=this.baseDay(),slots=adminSlots(source,current.id,base);Object.assign(this.dateTexts,adminDatePhrases(source));let values={...before,...slots};if('days'in slots&&!('until_day'in slots)){delete values.until_day;delete this.dateTexts.until_day;}if('until_day'in slots&&!('days'in slots))delete values.days;if('note'in slots)delete values._autoNote;if(before._autoNote&&slots.subscription_action&&slots.subscription_action!==before.subscription_action){delete values.note;delete values._autoNote;if(!('amount_uyu'in slots))delete values.amount_uyu;}let consumed=Object.keys(slots).length>0;
   if(field&&!consumed){try{values[field.key]=this.parseField(field,source,base);if(field.type==='date')this.dateTexts[field.key]=source;consumed=true}catch(e){this.say((e as Error).message);return}}
   if(!consumed){this.say(this.state.phase==='review'?'Podés corregir un dato indicando cuál: período, fecha, importe o motivo. Para guardar, usá la confirmación de la tarjeta.':this.state.question||'Elegí el registro sobre el que vamos a trabajar.');return;}
   this.emit({values,plans:[],armed:false,riskAccepted:false,error:undefined});this.autofillTrial();if(this.targets.length){this.pending=true;try{await this.advance()}finally{this.pending=false}}else this.say(this.state.question||'Todavía necesitamos elegir el registro.');return;
  }
  if(!intents.length){this.say('Puedo ayudarte con habilitaciones, suscripciones, accesos, solicitudes, incidencias, correo y configuración administrativa. Decime qué querés hacer. Si falta precisión, lo vemos antes de tocar datos.');return;}
  if(intents.length>1){this.source=source;this.emit({phase:'choosing',toolChoices:intents,choices:[],plans:[],armed:false,riskAccepted:false,question:'¿Qué querés gestionar exactamente?'});this.say('Ese pedido puede tener distintos efectos. ¿A cuál te referís?');return;}
  await this.start(intents[0],source);
 }
 private baseDay(){return regionalDay(this.now(),this.contexts[0]?.record as RegionalBusiness||{})}
 private parseField(f:ChatField,source:string,base:string):unknown{
  if(f.optional&&/^(sin fecha|ninguna|ninguno|omitir|no)$/.test(adminLanguage(source)))return'';
  if(f.type==='date'){const day=calendarDay(source,base);return validateChatField(f,day||source);}
  if(f.type==='number'){const days=f.key==='days'?periodDays(source,true):undefined;return validateChatField(f,days??source.replace(/^(?:mejor|no era|en realidad)\s+/i,'').replace(/^\$\s*/,''));}
  if(f.type==='select'){const s=adminLanguage(source),aliases:Record<string,string>={prueba:'trial','prueba gratuita':'trial',activar:'activate','activar periodo':'activate',renovar:'renew',baja:'cancel',suspender:'suspend',restablecer:'restore',pausar:'true',reanudar:'false',bloquear:'true',desbloquear:'false','a mi':this.actor,'para mi':this.actor};const optionIndex=ordinalChoice(source,f.options?.length||0),match=optionIndex!==undefined?f.options?.[optionIndex]:f.options?.find(o=>o.value===source||adminLanguage(o.label)===s||o.value===aliases[s]);if(!match)throw Error('¿Cuál de las opciones mostradas querés usar?');return validateChatField(f,match.value);}
  if(f.type==='multi')throw Error('Marcá los registros de la lista para evitar confusiones.');
  return validateChatField(f,source);
 }
 async selectTool(id:string){if(!this.state.toolChoices.includes(id)||this.pending)return;await this.start(id,this.source)}
 async start(id:string,source='',carry:Data={}){
  if(this.locked()||!this.authorize())return;const tool=chatTool(id);if(!tool)throw Error('Herramienta no disponible.');this.pending=true;
  const previous=this.targets,previousKind=this.selectionKind;this.source=source;this.dateTexts=adminDatePhrases(source);this.targets=[];this.contexts=[];this.selectionKind=tool.target;
  this.emit({phase:'locating',tool:id,values:{...carry,...adminSlots(source,id,regionalDay(this.now()))},field:undefined,plans:[],ticket:'',armed:false,riskAccepted:false,results:[],read:undefined,choices:[],toolChoices:[],error:undefined,selected:[]});
  try{
   if(tool.target==='global'){this.targets=[{id:'global',name:'Toda la plataforma'}];if(tool.read){await this.read(tool);return;}this.contexts=[await operationContext(this.api,id,this.targets[0])];}
   else{
    const initial=this.options.initial(),kind=tool.target,query=targetSearch(source,kind),list=await adminEntities(this.api,kind,query),entities=list.entities;
    const sameSection=({business:'negocios',user:'usuarios',request:'comercial',incident:'soporte',mail:'correos',payment:'negocios',plan:'configuracion',global:'inicio'})[kind]===initial.section;
    let context=sameSection&&!query?initial:{...initial,data:{rows:entities}};
    if(query)context={...initial,data:{rows:entities}};
    const referential=/\b(primero|primer|primera|segundo|segunda|tercero|tercera|ultimo|ultima|ese|esa|anterior)\b/.test(adminLanguage(source));
    if(referential&&this.lastList?.kind===kind)context={...initial,data:{rows:this.lastList.entities}};
    const found=resolveAdminReference(context,source,undefined);
    let selected=found.record?(entities.find(e=>e.id===found.record!.id)||(referential&&this.lastList?.entities.find(e=>e.id===found.record!.id))):undefined;
    if(!selected&&sameSection&&object(initial.data,'data').id===found.record?.id)selected=entityOf(found.record!);
    if(!selected&&previousKind===kind&&previous.length===1&&/\b(ese|esa|este|esta|mismo|misma)\b/.test(adminLanguage(source)))selected=entities.find(e=>e.id===previous[0].id);
    if(!selected&&query){const matches=entities.filter(e=>adminLanguage(e.name)===adminLanguage(query)||e.id===query||e.email===query);if(matches.length===1)selected=matches[0];}
    if(!selected){this.lastList={kind,entities};this.emit({phase:'choosing',choices:entities,question:entities.length?'¿Sobre cuál de estos registros trabajamos?':'No encontré ese registro en la consulta autorizada. Podés buscarlo por nombre o identificador.',selected:[]});this.say(entities.length?'Mostrame cuál: estos son los registros disponibles en la consulta. Si marcás varios, cada resultado se verificará por separado.':'No encontré un registro verificable con ese dato. Probá con otro nombre.');return;}
    this.targets=[selected];if(tool.read){await this.read(tool);return;}this.contexts=[await operationContext(this.api,id,selected)];
   }
   this.seedKnownValues();this.autofillTrial();await this.advance();
  }catch(e){this.emit({phase:'error',error:(e as Error).message});this.say((e as Error).message)}finally{this.pending=false;}
 }
 async searchTargets(query:string){if(!this.state.tool||this.pending||!this.authorize())return;const t=chatTool(this.state.tool)!;this.pending=true;this.emit({phase:'locating'});try{const found=await adminEntities(this.api,t.target,query);this.emit({phase:'choosing',choices:found.entities,selected:[],question:'Elegí el registro exacto de esta consulta.'})}catch(e){this.emit({phase:'error',error:(e as Error).message})}finally{this.pending=false;}}
 async choose(ids:string[]){
  if(this.pending||!this.state.tool||!this.authorize())return;const tool=chatTool(this.state.tool)!;if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!this.state.choices.some(c=>c.id===id)))throw Error('Elegí únicamente registros de la lista actual.');
  const bulk=['subscription','reservations','business_mail','block_user','incident','followup','request_state'].includes(tool.id);if(ids.length>(bulk?10:1)){this.say(bulk?'Trabajemos con un máximo de diez registros por propuesta.':'Esta operación requiere revisar un único registro a la vez.');return;}
  this.pending=true;this.emit({phase:'locating',armed:false,riskAccepted:false,selected:ids,plans:[]});
  try{this.targets=ids.map(id=>this.state.choices.find(c=>c.id===id)!);if(tool.read){await this.read(tool);return;}this.contexts=[];for(const target of this.targets)this.contexts.push(await operationContext(this.api,tool.id,target));this.seedKnownValues();this.autofillTrial();this.say('Vamos con '+this.targets.map(label).join(', ')+'.');await this.advance();}catch(e){this.emit({phase:'error',error:(e as Error).message});this.say((e as Error).message)}finally{this.pending=false;}
 }
 private seedKnownValues(){const tool=this.state.tool!,c=this.contexts[0],v={...this.state.values};if(!c)return;
  if(tool==='incident'){v.priority??=c.record.priority;if(v.state!=='resolved')v.resolution??=c.record.resolution||'';}
  if(tool==='followup')v.next_contact??=c.record.next_contact||'';
  if(['plan','commercial'].includes(tool))v.change_field??=Object.keys(v).find(k=>['price_uyu','staff_limit','mail_limit','whatsapp','tax_status','provider_daily_limit','security_reserve'].includes(k));
  if(tool==='plan'){for(const k of ['price_uyu','staff_limit','mail_limit'])v[k]??=c.record[k];for(const [key,val]of Object.entries(object(c.record,'features')))v['feature_'+key]??=Boolean(val);}
  if(tool==='commercial')for(const k of ['whatsapp','tax_status','provider_daily_limit','security_reserve'])v[k]??=c.record[k];
  this.emit({values:v});
 }
 private autofillTrial(){const v={...this.state.values};if(this.state.tool==='subscription'&&v.subscription_action==='trial'&&v.days&&(!v.note||v._autoNote)){v.note='Prueba gratuita de '+v.days+' días solicitada por el administrador.';v.amount_uyu=0;v._autoNote=true;this.emit({values:v});}}
 async answer(value:unknown){if(!this.state.field||this.pending||!this.authorize())return;const f=this.state.field;this.pending=true;try{const next=validateChatField(f,value),values={...this.state.values,[f.key]:next};if(f.key==='change_field')delete values[String(next)];if(f.key==='days'){delete values.until_day;delete this.dateTexts.until_day;}if(f.type==='date')this.dateTexts[f.key]=String(next);if(f.key==='note')delete values._autoNote;this.say(f.options?.find(o=>o.value===String(next))?.label||String(next),'user');this.emit({phase:'locating',values,plans:[],armed:false,riskAccepted:false,error:undefined});this.autofillTrial();await this.advance();}catch(e){this.say((e as Error).message)}finally{this.pending=false}}
 editableFields(){return this.contexts.length&&this.state.tool?operationFields(this.state.tool,this.contexts[0],this.state.values).filter(f=>f.key!=='confirm_slug'):[]}
 async reselectTargets(){if(this.locked()||!this.state.tool)return;const previous={...this.state.values};for(const key of ['keep_staff_ids','business_id','payment_id','confirm_slug'])delete previous[key];const tool=this.state.tool;await this.start(tool,'',previous);}
 async edit(key:string){if(this.locked()||!this.contexts.length||!this.state.tool)return;const f=operationFields(this.state.tool,this.contexts[0],this.state.values).find(f=>f.key===key);if(!f)return;this.emit({phase:'collecting',field:f,question:f.label,armed:false,riskAccepted:false,plans:[]});this.say(f.label)}
 private async advance(){
  const toolId=this.state.tool!;if(!this.contexts.length)return;let values={...this.state.values};for(const [key,text]of Object.entries(this.dateTexts)){const day=calendarDay(text,this.baseDay());if(day)values[key]=day;}
  
  const fields=operationFields(toolId,this.contexts[0],values),missing=fields.find(f=>{if(!(f.key in values)||values[f.key]===undefined)return true;try{validateChatField(f,values[f.key]);return false}catch{return true}});
  if(missing){this.emit({phase:'collecting',field:missing,question:missing.label,values,choices:[],toolChoices:[],error:undefined});this.say(missing.label);return;}
  try{
   // Refresh every target before sealing the proposal, not only when the screen was opened.
   const next:OperationContext[]=[];for(const target of this.targets)next.push(await operationContext(this.api,toolId,target));this.contexts=next;
   const extra=operationFields(toolId,next[0],values).find(f=>!(f.key in values));if(extra){this.emit({phase:'collecting',field:extra,question:extra.label});this.say(extra.label);return;}
   const plans=next.map(c=>{const local={...values};for(const[key,text]of Object.entries(this.dateTexts)){const day=calendarDay(text,regionalDay(this.now(),c.record as RegionalBusiness));if(!day)throw Error('Necesito precisar la fecha de '+c.entity.name);local[key]=day;}return prepareAdminWrite(toolId,c,local,this.uuid(),this.actor,this.now())});this.quotedAt=this.now().valueOf();
   this.emit({phase:'review',field:undefined,question:undefined,choices:[],toolChoices:[],values,plans:deepFreeze(plans),ticket:this.uuid(),armed:false,riskAccepted:false,error:undefined});this.say(plans.length===1?'Ya tengo la propuesta. Revisá el registro, el período y los efectos antes de confirmar.':'Preparé '+plans.length+' operaciones. Se guardan y verifican una por una; si alguna falla, las siguientes se detienen.');
  }catch(e){this.emit({phase:'error',field:undefined,error:(e as Error).message,armed:false});this.say((e as Error).message)}
 }
 private async read(tool:AdminChatTool){const state=adminLanguage(this.source),status=/pendiente|por habilitar/.test(state)?'pending':/suspendid/.test(state)?'suspended':/vencid/.test(state)?'expired':/habilitad|activ[oa]/.test(state)?'active':'';const d=await adminRead(this.api,tool.read!,tool.read==='diagnostic'?{business_id:this.targets[0].id}:{limit:'100',...(tool.read==='businesses'&&status?{status}:{}),...(targetSearch(this.source,tool.target)?{q:targetSearch(this.source,tool.target)}:{})});const listKind=({businesses:'business',users:'user',requests:'request',incidents:'incident',mail:'mail',settings:'plan'} as Record<string,TargetKind>)[tool.read!];if(listKind)this.lastList={kind:listKind,entities:(listKind==='plan'?rows(d,'plans'):rows(d)).map(entityOf)};this.emit({phase:'done',read:d,plans:[],field:undefined,choices:[],question:undefined});this.say('Consulté '+tool.title.toLocaleLowerCase()+'. Estos son los datos que devolvió el servidor; no realicé cambios.');}
 arm(ticket:string,value:boolean,riskAccepted=false){if(this.state.phase!=='review'||ticket!==this.state.ticket||this.pending||!this.authorize())return;this.emit({armed:value,riskAccepted})}
 async execute(ticket:string){
  if(this.pending||this.state.phase!=='review'||ticket!==this.state.ticket||!this.state.armed)return;
  if(!this.authorize())return;const high=this.state.plans.some(p=>['access','global','irreversible','delivery'].includes(chatTool(p.tool)!.risk));if(high&&!this.state.riskAccepted)return;
  if(this.now().valueOf()-this.quotedAt>5*60*1000){this.emit({phase:'error',armed:false,error:'La propuesta quedó desactualizada. Revisala nuevamente antes de ejecutar.'});return;}
  if(!this.options.executionAllowed()){this.say('La ejecución conversacional todavía no está habilitada en este entorno. La propuesta no se ejecutó.');return;}
  this.pending=true;this.emit({phase:'executing',armed:false,riskAccepted:false,error:undefined,results:[]});
  try{for(const p of this.state.plans){
   this.check();const fresh=await operationContext(this.api,p.tool,p.entity);if(contextFingerprint(fresh)!==p.baseline)throw Object.assign(Error('Los datos cambiaron desde la propuesta. Revisalos de nuevo antes de confirmar; no ejecuté este paso.'),{status:409});
   if(this.attempted.has(p.requestId))throw Error('Esa escritura ya fue enviada. Solo se permite comprobar su resultado.');
   this.currentWrite=p;this.attempted.add(p.requestId);let receipt:Data;
   try{receipt=await this.api.write(p.route,p.payload,p.method);this.receipts.set(p.requestId,receipt)}catch(e){const status=(e as {status?:number}).status;if(!status||status>=500){this.emit({phase:'uncertain',error:'El servidor no confirmó la respuesta. No se repetirá la escritura; comprobemos qué quedó guardado.'});return;}this.currentWrite=undefined;throw e}
   this.emit({phase:'verifying'});const result=await verifyAdminWrite(this.api,p,this.actor,receipt);this.check();if(!result.verified){this.emit({phase:'uncertain',error:result.message});return;}
   this.emit({results:[...this.state.results,{id:p.entity.id,name:p.entity.name,message:result.message,verified:true}],phase:'executing'});this.currentWrite=undefined;
  }this.emit({phase:'done'});this.say(this.state.results.length===1?this.state.results[0].message:'Las '+this.state.results.length+' operaciones quedaron guardadas y verificadas.');this.options.onVerified?.();
  }catch(e){this.emit({phase:this.currentWrite?'uncertain':'error',error:(e as Error).message});this.say((this.state.results.length?this.state.results.length+' operaciones ya están verificadas. ':'')+(e as Error).message+' No continué con los siguientes registros.');}finally{this.pending=false;}
 }
 async checkResult(){if(this.pending||this.state.phase!=='uncertain'||!this.currentWrite||!this.authorize())return;this.pending=true;this.emit({phase:'verifying'});try{const p=this.currentWrite,result=await verifyAdminWrite(this.api,p,this.actor,this.receipts.get(p.requestId));this.check();if(!result.verified){this.emit({phase:'uncertain',error:result.message});return;}this.emit({results:[...this.state.results,{id:p.entity.id,name:p.entity.name,message:result.message,verified:true}]});this.currentWrite=undefined;const all=this.state.results.length===this.state.plans.length;this.emit({phase:all?'done':'error',error:all?undefined:'Este paso quedó verificado. Los pasos restantes siguen sin ejecutar; revisalos antes de continuar.'});this.say(result.message);this.options.onVerified?.();}catch(e){this.emit({phase:'uncertain',error:(e as Error).message})}finally{this.pending=false;}}
 async reviewAgain(){if(this.locked()||!this.state.tool)return;const complete=new Set(this.state.results.filter(r=>r.verified).map(r=>r.id));this.targets=this.targets.filter(t=>!complete.has(t.id));if(!this.targets.length){this.emit({phase:'done'});return;}await this.advance()}
}
