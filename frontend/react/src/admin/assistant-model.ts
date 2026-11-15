import {normalizeLanguage} from '../iatry/v3/language';
import {object,rows,string,type Data} from './api';
import type {Action} from './Shared';
import type {Section} from './model';

export interface AdminContext {section:Section;data:Data;administrator:boolean}
export interface AdminProposal {title:string;detail:string;action?:Action;route?:string;stamp:string;target?:string}
export interface AdminReply {text:string;preservePending?:boolean;proposal?:AdminProposal;choices?:{id:string;label:string}[]}
export const adminDestinations=[
 ['negocios','Negocios y suscripciones','negocio|suscripcion|plan|habilitacion|renovacion'],
 ['usuarios','Usuarios y accesos','usuario|cuenta|membresia|sesion|acceso'],
 ['comercial','Solicitudes y cobros','solicitud|cobro|pago|finanza|transferencia'],
 ['correos','Correos y automatizaciones','correo|mail|envio'],
 ['soporte','Soporte e incidencias','soporte|incidencia|reporte'],
 ['sistema','Diagnóstico de plataforma','sistema|diagnostico|automatizacion'],
 ['datos','Datos y almacenamiento','almacenamiento|retencion|archivo'],
 ['auditoria','Seguridad y auditoría','auditoria|historial|seguridad'],
 ['configuracion','Configuración comercial','configuracion|precio comercial']
] as const;
export const adminStamp=(c:AdminContext)=>JSON.stringify([c.section,c.data]);
const normalize=(s:string)=>normalizeLanguage(s).replace(/[^a-z0-9@._ -]/g,' ').replace(/\s+/g,' ').trim();
const nouns:Record<string,string>={negocios:'negocio',usuarios:'cuenta',comercial:'solicitud',soporte:'incidencia',correos:'correo'};
function identify(c:AdminContext,text:string,selected?:string){
 const detail=object(c.data,'data'),list=detail.id?[detail]:rows(c.data),n=normalize(text);
 // Explicit unique ID/name/email, or ordinal inside this exact loaded list only.
 const named=list.filter(r=>[r.id,r.name,r.business_name,r.email,r.code,r.subject].some(v=>typeof v==='string'&&v.trim()&&(' '+n+' ').includes(' '+normalize(v)+' ')));
 if(named.length===1)return {record:named[0]};
 if(named.length>1){const chosen=selected&&/\b(ese|esa|mismo|misma)\b/.test(n)?named.find(x=>x.id===selected):undefined;return chosen?{record:chosen}:{ambiguous:true,list:named}};
 const ord=n.match(/\b(primero|primer|primera|segundo|segunda|tercero|tercer|tercera|ultimo|ultima)\b/)||n.match(/\b(?:numero|nro|registro) (\d+)\b/);
 if(ord){const word=ord[1],i=/^prim/.test(word)?0:/^seg/.test(word)?1:/^terc/.test(word)?2:/^ult/.test(word)?list.length-1:Number(word)-1;return {record:list[i],list};}
 if(selected&&/\b(ese|esa|mismo|misma|anterior)\b/.test(n))return {record:list.find(x=>x.id===selected),list};
 // A detail page identifies the business, but a list with one result still needs a reference.
 return {record:detail.id?detail:undefined,list};
}
/** Interpretation only. No transport, writes, invented IDs, plan changes or textual confirmation. */
export function adminReply(source:string,c:AdminContext,selected?:string):AdminReply{
 if(!c.administrator)return {text:'Este asistente requiere una sesión administrativa autorizada.'};
 if(typeof c.data.checked_at!=='string'||!Number.isFinite(Date.parse(c.data.checked_at)))return {text:'Primero necesitamos una consulta administrativa válida. Actualizá la sección.'};
 const n=normalize(source),stamp=adminStamp(c),propose=(title:string,detail:string,action:Action,target:string):AdminReply=>({text:'Te preparo el siguiente paso. Revisá el alcance antes de abrir la confirmación.',proposal:{title,detail,action,stamp,target}});
 if(!n)return {text:'Contame qué necesitás revisar en la plataforma.'};
 if(/^(confirmo|confirmar|si|dale|ofi|de una|ejecuta|ejecutar)$/.test(n))return {preservePending:true,text:'La confirmación se realiza en el formulario de la operación, con sus datos y su alcance. Este mensaje no ejecuta cambios.'};
 if(/\b(elimin|borr|anonimiz|limpi|reenvi|reintent|enviar|manda)\w*/.test(n))return {text:'Esta tarea puede eliminar información o generar envíos. Revisala desde su sección: IAtry no la ejecuta ni la confirma por chat.'};
 if(/\b(resumen|como viene|que requiere|que hay pendiente)\b/.test(n)&&c.section==='inicio'){
  const b=object(c.data,'businesses'),m=object(c.data,'mail');
  const values=[['Negocios habilitados',b.active],['Por habilitar',b.pending],['Solicitudes abiertas',c.data.requests],['Incidencias abiertas',c.data.incidents],['Correos fallidos',m.failed]].filter(([,v])=>typeof v==='number');
  return {text:values.length?values.map(([k,v])=>k+': '+v).join(' · ')+'. Datos de la consulta visible; podés actualizarlos desde el panel.':'No hay un resumen verificable en esta consulta. Actualizá la sección.'};
 }
 const subscriptions=/\b(renov\w*|habilit\w*|activ\w*|suscri\w*|suspend\w*|restablec\w*|baja)\b/.test(n),diagnostic=/\b(diagnosti\w*)\b/.test(n),incident=/\b(gestiona\w*|resolv\w*|revisa\w*)\b/.test(n)&&/incidencia/.test(n),followup=/\b(seguimiento|estado comercial)\b/.test(n),user=/\b(bloquea\w*|desbloquea\w*|revoca\w*)\b/.test(n);
 if(subscriptions||diagnostic||incident||followup||user){
  const needed=subscriptions||diagnostic?'negocios':incident?'soporte':followup?'comercial':'usuarios';
  if(c.section!==needed)return {text:'Primero abramos la lista autorizada para identificar el registro exacto.',proposal:{title:adminDestinations.find(x=>x[0]===needed)![1],detail:'Consultar y elegir el registro; todavía no se prepara ninguna escritura.',route:'/admin/'+needed,stamp}};
  const found=identify(c,n,selected),r=found.record;
  if(!r||found.ambiguous)return {text:'¿Qué '+(nouns[c.section]||'registro')+' querés gestionar? Elegí uno de esta lista; no voy a suponer su identidad.',choices:(found.list||[]).slice(0,25).map(r=>({id:string(r,'id'),label:string(r,'name')||string(r,'subject')||string(r,'email')||string(r,'code')||string(r,'id')}))};
  const id=string(r,'id'),target=string(r,'name')||string(r,'subject')||string(r,'email')||string(r,'code')||id;
  if(!id)return {text:'Falta un identificador comprobable. Actualizá la sección antes de continuar.'};
  if(subscriptions||diagnostic){if(!object(c.data,'data').id)return {text:'Abramos su ficha actualizada para revisar el período, el plan y los efectos antes de hacer cambios.',proposal:{title:target,detail:'Abrir la ficha autorizada del negocio. No cambia su suscripción.',route:'/admin/negocios/'+encodeURIComponent(id),stamp,target:id}};
   return propose(diagnostic?'Diagnóstico de '+target:'Suscripción de '+target,diagnostic?'Consultar las comprobaciones existentes. No crea reservas.':'Completar plan, período, importe y motivo en el formulario existente. Renovación, baja y suspensión mantienen sus reglas actuales.',{kind:diagnostic?'diagnostic':'subscription',id},id);}
  if(incident)return propose('Gestionar '+target,'Revisar estado, prioridad y evidencia en el formulario de incidencias.',{kind:'incident',id},id);
  if(followup)return propose('Seguimiento de '+target,'Completar el seguimiento comercial. No verifica pagos ni activa planes.',{kind:'followup',id},id);
  if(user){const revoke=/revoca/.test(n),unblock=/desbloquea/.test(n);if(!revoke&&Boolean(r.blocked)===!unblock)return {text:unblock?'La cuenta figura habilitada; no preparé ningún cambio.':'La cuenta ya figura bloqueada; no preparé ningún cambio.'};
   return propose(revoke?'Revocar sesiones de '+target:(unblock?'Restablecer':'Bloquear')+' acceso de '+target,'Requiere motivo y confirmación explícita en el formulario. Puede afectar el acceso de la cuenta a sus negocios.',{kind:revoke?'revoke_sessions':'block_user',id,...(!revoke?{extra:{blocked:!unblock}}:{})},id);}
 }
 if(/\b(registr\w*|crea\w*|nueva)\b/.test(n)&&/incidencia/.test(n))return propose('Registrar incidencia','Elegir negocio, responsable y descripción en el formulario existente. No ejecuta una reparación.',{kind:'incident_create',id:'new'},'new');
 const destinations=adminDestinations.filter(([, ,pattern])=>new RegExp('\\b(?:'+pattern+')\\w*\\b').test(n));
 if(destinations.length===1){const [key,title]=destinations[0];return {text:'Vamos a revisar esa sección con tu sesión administrativa.',proposal:{title,detail:'Consultar los datos disponibles y elegir la tarea. No realiza cambios.',route:'/admin/'+key,stamp}};}
 return {text:'Podemos revisar negocios y suscripciones, usuarios, cobros, incidencias o diagnósticos. Decime qué querés resolver. Los cambios se completan y confirman en su formulario; no ejecuto tareas ambiguas.'};
}
export function proposalCurrent(proposal:AdminProposal,c:AdminContext){return c.administrator&&proposal.stamp===adminStamp(c)}
/** Short references inherit only the pending task, never old names, IDs or parameters. */
export function adminFollowUp(source:string,previous:string){
 const n=normalize(source);
 if(!/^(?:(?:no |mejor )?(?:el |la |al |del )?(?:primero|primer|primera|segundo|segunda|tercero|tercer|tercera|ultimo|ultima|ese|esa|ese mismo|esa misma|anterior)|(?:numero|nro|registro) \d+)$/.test(n))return source;
 const p=normalize(previous),patterns:[RegExp,string][]=[[/\b(renov\w*|habilit\w*|activ\w*|suscri\w*|suspend\w*|restablec\w*)\b/,'gestionar suscripcion'],[/\bdiagnosti\w*\b/,'diagnostico'],[/\bincidencia\b/,'gestionar incidencia'],[/\bseguimiento\b/,'seguimiento'],[/\bdesbloquea\w*\b/,'desbloquear cuenta'],[/\bbloquea\w*\b/,'bloquear cuenta'],[/\brevoca\w*\b/,'revocar sesiones']];
 const task=patterns.find(([pattern])=>pattern.test(p));return task?task[1]+' '+n:source;
}
