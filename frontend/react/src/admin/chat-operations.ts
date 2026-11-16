// Uses existing administrative contracts; never bypasses server authorization.
import {object,rows,string,number,type Data,type AdminApi} from './api';
import {chatTool,type ChatField,type TargetKind} from './chat-catalogue';
import {today,plusDate} from '../domain/format';
import {region,regionalDay,type RegionalBusiness} from '../domain/region';
import {subscriptionDay} from '../subscription/model';
export interface ChatEntity extends Data{id:string;name:string}
export interface OperationContext{entity:ChatEntity;record:Data;settings?:Data;retention?:Data;preview?:Data;admins?:Data[];business?:Data}
export interface PreparedAdminWrite{tool:string;entity:ChatEntity;route:string;method:'POST'|'PATCH';payload:Data;expected:Data;baseline:string;context:OperationContext;summary:{label:string;value:string}[];warning:string;requestId:string}
const select=(key:string,label:string,data:Data[],value='id',caption='name'):ChatField=>({key,label,type:'select',options:data.map(x=>({value:string(x,value),label:string(x,caption)||string(x,value)}))});
export const entityOf=(r:Data):ChatEntity=>({...r,id:string(r,'id')||string(r,'code'),name:string(r,'name')||string(r,'subject')||string(r,'email')||string(r,'code')||string(r,'business_name')||string(r,'id')});
const query=(section:string,params:Record<string,string>={})=>'/api/admin/control/'+section+(Object.keys(params).length?'?'+new URLSearchParams(params):'');
const validRead=(d:Data)=>{if(typeof d.checked_at!=='string'||!Number.isFinite(Date.parse(d.checked_at)))throw Error('La consulta no tiene una fecha verificable.');return d};
export async function adminRead(api:AdminApi,section:string,params:Record<string,string>={}){return validRead(await api.read(query(section,params)))}
export async function adminEntities(api:AdminApi,kind:TargetKind,search=''){
 const key=kind==='business'||kind==='payment'?'businesses':kind==='user'?'users':kind==='request'?'requests':kind==='incident'?'incidents':kind==='mail'?'mail':kind==='plan'?'settings':'overview';
 const response=await adminRead(api,key,{...(search&&['businesses','users','requests'].includes(key)?{q:search}:{}),limit:'100'});
 return {entities:(kind==='plan'?rows(response,'plans'):rows(response)).map(entityOf),response};
}
export async function operationContext(api:AdminApi,toolId:string,entity:ChatEntity):Promise<OperationContext>{
 const t=chatTool(toolId);if(!t)throw Error('Herramienta no disponible.');let record:Data={};const c:OperationContext={entity,record};
 if(['business','payment'].includes(t.target)){const b=await adminRead(api,'business',{business_id:entity.id});record=object(b,'data');if(record.id!==entity.id)throw Error('El negocio no coincide con el elegido.');c.business=record;}
 else if(t.target==='global'){if(['retention_policy','mail_archive'].includes(toolId)){c.retention=await adminRead(api,'retention');record=c.retention}else if(toolId==='commercial'){const d=await adminRead(api,'settings');record=object(d,'settings')}else record=object(await adminRead(api,'overview'),'settings');}
 else {const data=await adminEntities(api,t.target,t.target==='user'?entity.id:'');record=data.entities.find(x=>x.id===entity.id)||{};if(!record.id)throw Error('El registro ya no está en la lista autorizada. Buscalo de nuevo.');}
 if(record.business_id&&t.target!=='business'&&t.target!=='payment'){const related=object(await adminRead(api,'business',{business_id:String(record.business_id)}),'data');if(related.id!==record.business_id)throw Error('La relación con el negocio no coincide.');c.business=related;record={...record,country:related.country,timezone:related.timezone,currency:related.currency,locale:related.locale};}
 if(c.business){const p=c.business;if(!['UY','PA'].includes(String(p.country))||p.timezone!==(p.country==='PA'?'America/Panama':'America/Montevideo')||p.currency!==(p.country==='PA'?'USD':'UYU'))throw Error('El contrato administrativo de este servidor todavía no informa un perfil regional verificable. La operación queda bloqueada hasta actualizar esa lectura.');}
 c.record=record;
 if(['subscription','plan','commercial'].includes(toolId)){c.settings=await adminRead(api,'settings');if(t.target==='plan'){record=rows(c.settings,'plans').find(p=>p.code===entity.id)||{};if(!record.code)throw Error('Ese plan no está en el catálogo actual.');c.record=record;}}
 if(toolId==='incident_create'){const users=await adminRead(api,'users',{limit:'100'});c.admins=rows(users).filter(x=>x.platform_admin&&!x.blocked)}
 if(toolId==='business_delete'){const d=await adminRead(api,'business_delete_preview',{id:entity.id});c.preview=object(d,'data');if(c.preview.id!==entity.id||!c.preview.execution_enabled)throw Error(string(c.preview,'blocker')||'La eliminación no está habilitada por el servidor.');}
 return c;
}
export function contextFingerprint(c:OperationContext){
 const b=c.record;
 // Exclude volatile counters and presentation timestamps, retain every write-relevant precondition.
 return JSON.stringify({id:c.entity.id,record:Object.fromEntries(['id','code','name','slug','country','timezone','plan','is_active','subscription_status','subscription_started_at','paid_until','trial_until','cancel_at_period_end','control_revision','reservation_scope','mail_paused','blocked','memberships','revision','state','priority','resolution','note','next_contact','kind','attempts','provider_id','last_error','price_uyu','staff_limit','mail_limit','features','expected_revision','whatsapp','tax_status','provider_daily_limit','security_reserve','operational_mail_paused','policy_days','eligible'].filter(k=>k in b).map(k=>[k,b[k]])),staff:rows(b,'active_staff').map(x=>x.id),settingsRevision:object(c.settings||{},'settings').revision,retentionRevision:c.retention?.revision,preview:c.preview?{token:c.preview.token,counts:c.preview.counts,execution_enabled:c.preview.execution_enabled}:undefined});
}
const optionsBoolean=(key:string,label:string):ChatField=>({key,label,type:'select',options:[{value:'true',label:'Sí'},{value:'false',label:'No'}]});
export function operationFields(toolId:string,c:OperationContext,v:Data):ChatField[]{
 const t=chatTool(toolId);if(!t)return[];let fields=t.fields.map(f=>({...f}));
 if(toolId==='subscription'){
  const op=String(v.subscription_action||'');fields=fields.filter(f=>f.key!=='days'&&f.key!=='note');
  if(['trial','activate','renew'].includes(op)){
   if(!v.until_day)fields.push({key:'days',label:'¿Cuántos días de acceso? También podés indicar «hasta» y una fecha.',type:'number',min:1,max:1825});
   if(['activate','renew'].includes(op)){fields.push(select('plan','¿Qué plan habilitamos?',rows(c.settings||{},'plans').filter(p=>['individual','negocio','pro'].includes(string(p,'code'))),'code'));if(op==='activate')fields.push({key:'starts_day',label:'¿Desde qué fecha empieza el período?',type:'date'});fields.push({key:'amount_uyu',label:'¿Qué importe en UYU comprobaste? Indicá 0 si es una cortesía.',type:'number',min:0,max:10000000});if(Number(v.amount_uyu)>0)fields.push({key:'reference',label:'¿Qué referencia de transferencia comprobaste?',type:'text',min:1,max:160});}
   const planCode=op==='trial'?'trial':String(v.plan||''),p=rows(c.settings||{},'plans').find(p=>p.code===planCode),staff=rows(c.record,'active_staff');
   if(op!=='trial'&&p&&staff.length>number(p,'staff_limit'))fields.push({key:'keep_staff_ids',label:'El plan permite '+number(p,'staff_limit')+' profesionales. ¿Cuáles conservamos activos? Los excluidos no pueden tener reservas futuras.',type:'multi',min:1,max:number(p,'staff_limit'),options:staff.map(x=>({value:string(x,'id'),label:string(x,'name')}))});
  }
  fields.push({key:'note',label:'¿Qué motivo o evidencia dejamos en el historial?',type:'textarea',min:5,max:500});
 }
 if(toolId==='remove_membership')fields=fields.map(f=>f.key==='business_id'?select('business_id','¿De qué negocio retiramos la membresía?',rows(c.record,'memberships'),'business_id','business_name'):f);
 if(toolId==='incident_create')fields=fields.map(f=>f.key==='assignee'?select('assignee','¿A qué administrador asignamos el caso?',c.admins||[]):f);
 if(toolId==='incident'&&v.state!=='resolved')fields=fields.filter(f=>f.key!=='resolution');
 if(toolId==='verify_payment')fields.unshift(select('payment_id','¿Qué cobro comprobaste fuera de ATRY?',rows(c.record,'license_history').filter(e=>['activate','renew'].includes(string(e,'action'))&&number(e,'amount_uyu')>0).map(e=>({...e,name:string(e,'reference')+' · '+number(e,'amount_uyu')+' UYU · '+string(e,'created_at')}))));
 if(toolId==='plan'){const features=object(c.record,'features');for(const key of Object.keys(features).filter(k=>/^[a-z_]+$/.test(k)&&!['constructor','prototype','__proto__'].includes(k)))fields.splice(fields.length-1,0,optionsBoolean('feature_'+key,'¿Habilitamos «'+key+'» para todos los negocios de este plan?'));}
 if(['plan','commercial'].includes(toolId)&&!v.change_field)fields.unshift({key:'change_field',label:'¿Qué dato querés modificar? Los demás valores se conservan.',type:'select',options:fields.filter(f=>f.key!=='reason').map(f=>({value:f.key,label:f.label}))});
 return fields;
}
export function validateChatField(f:ChatField,value:unknown){
 if(f.optional&&(value===''||value===null))return'';
 if(f.type==='multi'){if(!Array.isArray(value)||new Set(value).size!==value.length||value.length<(f.min||0)||value.length>(f.max??100)||value.some(v=>!f.options?.some(x=>x.value===v)))throw Error('Elegí únicamente los registros mostrados, dentro del límite indicado.');return value;}
 if(f.type==='select'){const s=String(value);if(!f.options?.some(o=>o.value===s))throw Error('Elegí una de las opciones disponibles.');return ['true','false'].includes(s)?s==='true':s;}
 if(f.type==='number'){const n=Number(value);if(value===''||!Number.isSafeInteger(n)||n<(f.min??0)||n>(f.max??Number.MAX_SAFE_INTEGER))throw Error('Indicá un número entero entre '+(f.min??0)+' y '+(f.max??Number.MAX_SAFE_INTEGER)+'.');return n;}
 const s=String(value??'').trim();if(f.type==='date'){if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s+'T12:00Z'))||new Date(s+'T12:00Z').toISOString().slice(0,10)!==s)throw Error('Necesito una fecha válida.');return s;}
 if(s.length<(f.min??(f.optional?0:1))||s.length>(f.max??1000))throw Error('El texto debe tener entre '+(f.min??1)+' y '+(f.max??1000)+' caracteres.');return s;
}
const truth=(x:unknown)=>x===true||x===1;
export function prepareAdminWrite(toolId:string,c:OperationContext,v:Data,requestId:string,actor:string,now=new Date()):PreparedAdminWrite{
 const tool=chatTool(toolId);if(!tool||tool.read)throw Error('No es una escritura disponible.');
 for(const f of operationFields(toolId,c,v)){if(!(f.key in v))throw Error('Falta completar '+f.label);validateChatField(f,v[f.key]);}
 const payload:Data={request_id:requestId},expected:Data={},summary:{label:string;value:string}[]=[{label:'Registro',value:c.entity.name},{label:'Identificador',value:c.entity.id}];let id=c.entity.id,route='',method:'POST'|'PATCH'='POST';const b=c.record;
 if(toolId==='subscription'){
  const op=String(v.subscription_action);payload.subscription_action=op;payload.note=String(v.note);expected.subscription_status=({trial:'trialing',activate:'active',renew:'active',suspend:'suspended'})[op as 'trial'];
  if(['activate','renew'].includes(op)){if(b.country==='PA')throw Error('La contratación paga de Panamá sigue bloqueada; se conservan las pruebas técnicas y la administración del acceso existente.');payload.plan=v.plan;payload.amount_uyu=v.amount_uyu;payload.reference=v.reference||'';expected.plan=v.plan;if(op==='activate')payload.starts_day=v.starts_day;}
  if(op==='trial'){if(b.country==='PA'&&b.plan!=='trial')throw Error('El servidor todavía no permite convertir ese plan de Panamá a una prueba. Se conserva el plan actual.');payload.amount_uyu=0;expected.plan='trial';const trial=rows(c.settings||{},'plans').find(p=>p.code==='trial');if(!trial||rows(b,'active_staff').length>number(trial,'staff_limit'))throw Error('La prueba requiere revisar primero la capacidad del equipo. No voy a desactivar profesionales implícitamente.');}
  if(['trial','activate','renew'].includes(op)){
   const localToday=regionalDay(now,b as RegionalBusiness),start=String(v.starts_day||(op==='renew'?(b.paid_until?regionalDay(new Date(String(b.paid_until)),b as RegionalBusiness):''):'')||localToday),base=start<localToday?localToday:start;
   const until=String(v.until_day||plusDate(base,Number(v.days)-1));validateChatField({key:'until_day',label:'Vencimiento',type:'date'},until);if(v.until_day&&v.days&&until!==plusDate(base,Number(v.days)-1))throw Error('La duración y la fecha final no coinciden. Indicá cuál querés conservar.');if(until<base||until>plusDate(localToday,5*366))throw Error('El período debe finalizar en una fecha futura válida, dentro de cinco años.');
   payload.until_day=until;expected[op==='trial'?'trial_until_day':'paid_until_day']=until;expected.is_active=true;
   if(v.keep_staff_ids)payload.keep_staff_ids=v.keep_staff_ids;
   summary.push({label:'Período',value:base+' al '+until+' · '+region(b as RegionalBusiness).timezone},{label:'Plan',value:({trial:'Prueba gratuita',individual:'Individual',negocio:'Negocio',pro:'Pro'} as Record<string,string>)[String(expected.plan||payload.plan)]||String(expected.plan||payload.plan)},{label:'Importe declarado',value:String(payload.amount_uyu)+' UYU'+(op==='trial'?' · prueba gratuita':'')});
   if(v.keep_staff_ids)summary.push({label:'Profesionales que permanecen activos',value:rows(b,'active_staff').filter(s=>(v.keep_staff_ids as string[]).includes(String(s.id))).map(s=>String(s.name)).join(', ')});
  }
  if(op==='cancel'){delete expected.subscription_status;expected.subscription_status=b.subscription_status;expected.paid_until=b.paid_until;expected.trial_until=b.trial_until;}
  if(op==='restore'){expected.subscription_status=Date.parse(string(b,'paid_until'))>now.valueOf()?'active':Date.parse(string(b,'trial_until'))>now.valueOf()?'trialing':'expired';expected.is_active=true;if(expected.subscription_status==='expired')throw Error('El período ya venció; primero se necesita una renovación.');}
  summary.push({label:'Operación',value:({trial:'Habilitar prueba gratuita',activate:'Habilitar período contratado',renew:'Renovar período',cancel:'Baja al vencimiento',suspend:'Suspender acceso inmediatamente',restore:'Restablecer acceso vigente'} as Record<string,string>)[op]||op},{label:'Motivo',value:String(v.note)});route='/api/admin/businesses/'+encodeURIComponent(id);method='PATCH';
 }else if(toolId==='plan'){
  const features=object(b,'features');payload.features=Object.fromEntries(Object.keys(features).map(k=>[k,v['feature_'+k]??features[k]]));for(const k of ['price_uyu','staff_limit','mail_limit'])payload[k]=v[k];payload.expected_revision=b.expected_revision??object(c.settings||{},'settings').revision;Object.assign(expected,payload);delete expected.request_id;delete expected.expected_revision;route='/api/admin/plans/'+encodeURIComponent(id);method='PATCH';
 }else if(toolId==='commercial'){
  for(const k of ['whatsapp','tax_status','provider_daily_limit','security_reserve'])payload[k]=v[k];const phone=String(v.whatsapp).replace(/[ ()-]/g,'').replace(/^\+/,'');if(!/^[1-9][0-9]{7,14}$/.test(phone))throw Error('Indicá un WhatsApp internacional válido con código de país.');payload.whatsapp=phone;if(Number(payload.security_reserve)>=Number(payload.provider_daily_limit))throw Error('La reserva debe ser menor que la capacidad diaria comprobada.');payload.expected_revision=b.revision;Object.assign(expected,payload);delete expected.request_id;delete expected.expected_revision;route='/api/admin/commercial';method='PATCH';
 }else{
  for(const f of operationFields(toolId,c,v))if(f.key!=='payment_id')payload[f.key]=v[f.key];
  if(['reservations','business_mail'].includes(toolId))payload.revision=b.control_revision;
  if(['global_mail','incident','followup'].includes(toolId))payload.revision=number(b,'revision');
  if(['retention_policy','mail_archive'].includes(toolId))payload.revision=c.retention?.revision;
  if(toolId==='business_delete'){if(v.confirm_slug!==c.preview?.slug)throw Error('El identificador escrito no coincide con el negocio.');payload.preview_token=c.preview!.token;}
  if(toolId==='incident_create'){payload.business_id=c.entity.id;id='new';}
  if(toolId==='remove_membership'&&!rows(b,'memberships').some(m=>m.business_id===v.business_id))throw Error('Esa membresía no pertenece a la cuenta seleccionada.');
  if(toolId==='block_user'&&truth(v.blocked)&&c.entity.id===actor)throw Error('No podés bloquear tu propia cuenta.');
  if(toolId==='mail_cancel'&&(!['queued','retry','quota_exhausted'].includes(string(b,'state'))||['auth','security','password_reset','invitation'].includes(string(b,'kind'))))throw Error('No es seguro cancelar ese correo.');
  if(toolId==='mail_retry'&&(b.state!=='failed'||b.provider_id||!['BREVO_QUOTA','BREVO_HTTP_429','BREVO_HTTP_400','BREVO_HTTP_401','BREVO_HTTP_403'].includes(string(b,'last_error'))))throw Error('No se puede reintentar un envío sin rechazo confirmado del proveedor.');
  if(toolId==='verify_payment'){if(!rows(b,'license_history').some(e=>e.id===v.payment_id&&number(e,'amount_uyu')>0))throw Error('El cobro elegido no corresponde a ese negocio.');id=String(v.payment_id);}
  if(toolId==='reservations')expected.reservation_scope=v.scope;
  if(toolId==='business_mail')expected.mail_paused=v.paused;
  if(toolId==='global_mail')expected.operational_mail_paused=v.paused;
  if(toolId==='block_user')expected.blocked=v.blocked;
  if(toolId==='incident_create')for(const k of ['state','priority','category','assignee'])expected[k]=payload[k];
  if(toolId==='incident'){expected.state=v.state;expected.priority=v.priority;if(v.state==='resolved')expected.resolution=v.resolution;}
  if(toolId==='followup'){expected.note=v.note;expected.next_contact=v.next_contact||null;}
  if(toolId==='request_state')expected.state=v.state;
  if(toolId==='retention_policy')expected.mail_terminal_days=v.days;
  if(['deletion_request','business_deletion_request'].includes(toolId)){payload.type=toolId==='business_deletion_request'?'business':'user';expected.state='policy_review';expected.execution_enabled=false;}
  if(toolId==='verify_payment'){expected.verified_by_operator=actor;expected.automatic_bank_check=false;}
  if(toolId==='business_delete'){expected.deleted=true;expected.accounts_preserved=true;expected.counts=c.preview?.counts;summary.push({label:'Registros incluidos en la eliminación',value:JSON.stringify(c.preview?.counts||{})});}
  route='/api/admin/control/'+(toolId==='business_deletion_request'?'deletion_request':toolId)+'/'+encodeURIComponent(id);
 }
 if(toolId==='mail_archive')summary.push({label:'Contenido elegible según la consulta',value:String(c.retention?.eligible??'Revisar en datos y almacenamiento')+' · máximo 100 registros'});
 if(toolId!=='subscription'){payload.reason=String(v.reason);for(const [k,val]of Object.entries(payload))if(!['request_id','preview_token','expected_revision','revision','reason'].includes(k))summary.push({label:operationFields(toolId,c,v).find(f=>f.key===k)?.label||k,value:typeof val==='object'?JSON.stringify(val):String(val)});summary.push({label:'Motivo / evidencia',value:String(v.reason)});}
 return {tool:toolId,entity:c.entity,route,method,payload,expected,context:c,baseline:contextFingerprint(c),summary,warning:tool.effect+(toolId==='subscription'&&v.subscription_action==='trial'&&b.paid_until?' La prueba reemplaza el período contratado actual.':''),requestId};
}
const subset=(actual:Data,wanted:Data)=>Object.entries(wanted).every(([k,v])=>Object.prototype.hasOwnProperty.call(actual,k)&&(typeof v==='boolean'?truth(actual[k])===v:v&&typeof v==='object'?JSON.stringify(actual[k])===JSON.stringify(v):actual[k]===v||(v===null&&actual[k]==null)));
/** Readbacks never retry a write. Missing evidence leaves an uncertain outcome. */
export async function verifyAdminWrite(api:AdminApi,p:PreparedAdminWrite,actor:string,receipt?:Data):Promise<{verified:boolean;message:string;evidence?:Data}>{
 const fail={verified:false,message:'La operación no tiene una verificación completa. No se va a repetir automáticamente.'};
 if(['plan','commercial'].includes(p.tool)){
  if(!receipt?.ok)return fail;const current=await operationContext(api,p.tool,p.entity);if(!subset(current.record,p.expected))return fail;return{verified:true,message:'Los valores guardados coinciden con la relectura del servidor.',evidence:current.record};
 }
 const operationId=string(receipt||{},'operation_id')||string(receipt||{},'event_id'),audit=await adminRead(api,'audit',{...(operationId?{q:operationId}:p.tool==='incident_create'?{}:{q:p.entity.id}),actor,limit:'100'});
 const event=rows(audit).find(e=>e.actor_id===actor&&e.request_key===p.requestId&&(!operationId||e.id===operationId));if(!event)return fail;
 const expectedAction=p.tool==='subscription'?'subscription.'+p.payload.subscription_action:p.tool==='business_delete'?'business.deleted':p.tool==='business_deletion_request'?'deletion_request':p.tool;
 if(event.action!==expectedAction)return fail;if(p.tool==='incident_create'&&event.business_id!==p.entity.id)return fail;
 if(!['incident_create','business_delete'].includes(p.tool)&&event.entity_id!==(p.tool==='verify_payment'?p.payload.payment_id||p.route.split('/').at(-1):p.entity.id))return fail;
 const after=object(event,'after_state');
 if(p.tool==='subscription'){
  const b=object(await adminRead(api,'business',{business_id:p.entity.id}),'data'),wanted={...p.expected};
  for(const key of ['trial_until_day','paid_until_day'])if(wanted[key]){if(subscriptionDay(string(b,key.replace('_day','')),b as RegionalBusiness)!==wanted[key])return fail;delete wanted[key];}
  if(!subset(b,wanted))return fail;if(p.payload.subscription_action==='cancel'&&after.cancel_at_period_end!==true)return fail;if(!rows(b,'license_history').some(e=>e.id===event.id))return fail;
  return{verified:true,message:p.payload.subscription_action==='cancel'?'Baja registrada y verificada. Conserva el acceso hasta el vencimiento del período vigente.':'Habilitación guardada y verificada en el negocio.',evidence:b};
 }
 if(!subset(after,p.expected))return fail;if(p.tool==='business_delete'){const remaining=(await adminEntities(api,'business',p.entity.id)).entities;if(remaining.some(b=>b.id===p.entity.id))return fail;}
 if(p.tool==='revoke_sessions'||p.tool==='remove_membership'){
  const user=(await adminEntities(api,'user',p.entity.id)).entities.find(u=>u.id===p.entity.id);if(!user)return fail;if(p.tool==='revoke_sessions'&&number(user,'sessions')!==0)return fail;if(p.tool==='remove_membership'&&rows(user,'memberships').some(m=>m.business_id===p.payload.business_id))return fail;
 }
 if(['reservations','business_mail','block_user','incident','followup','request_state'].includes(p.tool)){const next=await operationContext(api,p.tool,p.entity);if(!subset(next.record,p.expected))return fail;}
 if(p.tool==='global_mail'){const current=object(await adminRead(api,'overview'),'settings');if(!subset(current,p.expected))return fail;}
 if(p.tool==='retention_policy'){const current=await adminRead(api,'retention');if(current.policy_days!==p.payload.days)return fail;}
 if(p.tool==='mail_cancel'||p.tool==='mail_retry'){const current=await operationContext(api,p.tool,p.entity);if(p.tool==='mail_cancel'&&current.record.state!=='skipped')return fail;if(p.tool==='mail_retry'&&!['retry','processing','provider_accepted','delivered','delivery_unknown','quota_exhausted','failed'].includes(string(current.record,'state')))return fail;}
 if(p.tool==='mail_archive'&&(!Number.isInteger(after.redacted_jobs)||Number(after.redacted_jobs)<0||Number(after.redacted_jobs)>100||after.dedupe_and_quota_preserved!==true))return fail;
 return{verified:true,message:['deletion_request','business_deletion_request'].includes(p.tool)?'Solicitud registrada para revisión. No se eliminó información.':p.tool==='mail_retry'?'Reintento registrado y verificado; esto no confirma la entrega del correo.':'Operación guardada y verificada en el servidor.',evidence:event};
}
