import type {Plan} from '../../subscription/contracts';
import {commercialLabels} from '../../subscription/model';

export type PlanNeed={kind:'staff';additional?:number;desiredTotal?:number}|{kind:'feature';key:string};
export interface AdvisorEntitlements {code:string;staff_count:number;staff_limit:number;features:Record<string,boolean>;access_enabled:boolean}
export interface PlanAdvisorInput {need:PlanNeed;role:string;blocker:'plan'|'role'|'homologation'|'unknown';entitlements:AdvisorEntitlements;plans:readonly Plan[];taxStatus?:string}
export type PlanAdviceResult=
 |{kind:'recommendation';title:string;message:string;planCode:string;planName:string;priceUyu?:number;taxStatus?:string;href:'#/app/suscripcion';reason:string}
 |{kind:'no-upgrade'|'unknown';message:string};
const ranks:Record<string,number>={individual:0,negocio:1,pro:2};
/** Pure, transport-free advice. A plan recommendation never grants a capability. */
export function advisePlan(input:PlanAdvisorInput):PlanAdviceResult {
 const {need,role,blocker,entitlements:e,plans}=input;
 if(blocker==='homologation')return{kind:'no-upgrade',message:'Esta operación todavía no está habilitada en IAtry. Cambiar de plan no la habilita.'};
 if(blocker==='role'||role!=='owner')return{kind:'no-upgrade',message:'Esta solicitud depende de los permisos de tu usuario. Consultalo con el propietario; cambiar de plan no modifica tu rol.'};
 if(blocker!=='plan')return{kind:'unknown',message:'Primero necesitamos confirmar qué impide esta solicitud.'};
 if(!e.access_enabled)return{kind:'no-upgrade',message:'Revisá primero el estado de acceso de tu negocio en Mi plan y acceso.'};
 if(!Number.isInteger(e.staff_count)||e.staff_count<0||!Number.isInteger(e.staff_limit)||e.staff_limit<1||!e.features||!(e.code in ranks))return{kind:'unknown',message:'No tengo información suficiente del plan vigente para recomendar un cambio.'};
 let reason:string,satisfies:(p:Pick<Plan,'staff_limit'|'features'>)=>boolean;
 if(need.kind==='staff'){
  const quantity=need.desiredTotal??need.additional;
  if((need.desiredTotal!==undefined&&need.additional!==undefined)||!Number.isInteger(quantity)||Number(quantity)<1)return{kind:'unknown',message:'¿Cuántos profesionales necesitás tener en total?'};
  const total=need.desiredTotal??(e.staff_count+Number(need.additional));
  if(total<=e.staff_limit)return{kind:'no-upgrade',message:'Tu plan ya tiene capacidad para esa cantidad de profesionales. No necesitás cambiarlo por este motivo.'};
  reason=`Necesitás espacio para ${total} profesionales activos; el límite actual es ${e.staff_limit}.`;
  satisfies=p=>Number.isInteger(p.staff_limit)&&p.staff_limit>=total;
 }else{
  if(!Object.hasOwn(commercialLabels,need.key))return{kind:'unknown',message:'No encuentro esa prestación en el contrato comercial disponible.'};
  if(e.features[need.key]===true)return{kind:'no-upgrade',message:'Tu plan ya incluye esta prestación. Revisemos sus permisos y disponibilidad antes de proponer un cambio.'};
  reason=`Buscás ${commercialLabels[need.key].toLocaleLowerCase('es-UY')}.`;
  satisfies=p=>p.features?.[need.key]===true;
 }
 const candidates=plans.filter(p=>p&&Object.hasOwn(ranks,p.code)&&ranks[p.code]>ranks[e.code]&&typeof p.name==='string'&&p.name.trim()&&p.features&&satisfies(p)).sort((a,b)=>ranks[a.code]-ranks[b.code]);
 const candidate=candidates[0];
 if(!candidate)return{kind:'unknown',message:'La oferta disponible no confirma un plan superior que cubra esta necesidad. Podés revisarlo con ATRY desde Mi plan y acceso.'};
 return{kind:'recommendation',title:`Podés dar este paso con ${candidate.name}`,message:`${candidate.name} es el plan mínimo de la oferta disponible que cubre esta necesidad. Podés comparar sus condiciones antes de solicitar un cambio.`,reason,planCode:candidate.code,planName:candidate.name,...(Number.isFinite(candidate.price_uyu)&&candidate.price_uyu>=0?{priceUyu:candidate.price_uyu}:{}),taxStatus:input.taxStatus,href:'#/app/suscripcion'};
}

/** A concrete product need, not a permission decision or an operational command. */
export function detectPlanNeed(source:string):PlanNeed|undefined {
 const text=source.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-UY').replace(/[^a-z0-9% ]/g,' ').replace(/\s+/g,' ').trim();
 if(!text||/\b(?:no quiero|no necesito|no agregues|sin agregar)\b/.test(text))return;
 const incorporation=/\b(?:agregar|agregame|agrega|incorporar|incorpora|sumar|suma|contratar|contrata|anadir|anadi|necesito|quiero)\b/.test(text);
 if(incorporation&&/\b(?:profesional(?:es)?|integrante(?:s)?|colaborador(?:es)?)\b/.test(text)){
  if(!/\b(?:agregar|agregame|agrega|incorporar|incorpora|sumar|suma|contratar|contrata|anadir|anadi|otro|otra|nuevos?|nuevas?|mas)\b/.test(text))return;
  const ordinal=text.match(/\b(segundo|tercero?|cuarto|quinto|sexto|septimo|octavo|noveno|decimo)\s+profesional\b/);
  if(ordinal){const totals:Record<string,number>={segundo:2,tercer:3,tercero:3,cuarto:4,quinto:5,sexto:6,septimo:7,octavo:8,noveno:9,decimo:10};return{kind:'staff',desiredTotal:totals[ordinal[1]]};}
  const quantity=text.match(/\b(\d{1,2}|un|uno|una|otro|otra|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:nuevos?\s+|mas\s+)?(?:profesional(?:es)?|integrante(?:s)?|colaborador(?:es)?)/);
  if(quantity){const words:Record<string,number>={un:1,uno:1,una:1,otro:1,otra:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};const additional=words[quantity[1]]??Number(quantity[1]);if(additional>0)return{kind:'staff',additional};}
  if(/\b(?:un|otro|nuevo) profesional\b/.test(text))return{kind:'staff',additional:1};
  return; // An unspecified plural needs clarification, never a guessed count.
 }
 if(!/\b(?:quiero|necesito|usar|utilizar|activar|habilitar|acceder|ver|consultar|exportar)\b/.test(text))return;
 const aliases:Array<[string,RegExp]>=[['resources',/\brecursos compartidos\b/],['advanced',/\bestadisticas avanzadas\b/],['statistics',/\bestadisticas(?: basicas)?\b/],['exports',/\b(?:exportar|exportaciones|exportacion)\b/],['recurring',/\b(?:turnos fijos|reservas recurrentes)\b/],['waitlist',/\blista de espera\b/],['smartslots',/\boportunidades de agenda\b/],['operational_mail',/\b(?:correos automaticos|recordatorios por correo)\b/],['access',/\busuarios y permisos\b/]];
 const hits=aliases.filter(([,pattern])=>pattern.test(text));
 if(hits.some(([key])=>key==='advanced')){const basic=hits.findIndex(([key])=>key==='statistics');if(basic>=0)hits.splice(basic,1);}
 if(hits.length===1)return{kind:'feature',key:hits[0][0]};
}
