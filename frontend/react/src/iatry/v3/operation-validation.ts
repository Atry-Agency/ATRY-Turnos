/** Private finite cloud experiment. Never imported by the production entry. */
import {productionProject,validationBusiness} from './production-policy';
import {scopeKey,type Scope} from '../../services/contracts';
export const operationTrial={serviceName:'IAtry · Servicio operativo controlado 2026-10-27',description:'Ensayo operativo de IAtry; sin atención al público',customerName:'IAtry · Cliente operativo controlado 2026-10-27',email:'iatry-operativo-20261027@example.invalid',notes:'Ensayo operativo de IAtry',updatedNotes:'Ficha creada y editada; verificación operativa de IAtry',staffId:'35c53427-98ad-4f28-b0c1-c5cc5f82ae14',startsAt:'2026-11-16T16:00:00.000Z',endsAt:'2026-11-16T17:00:00.000Z',reason:'IAtry · Descanso controlado 2026-11-16'} as const;
export type TrialGroup='services-customers'|'absence';
type Row=Record<string,unknown>&{id:string};
type Request=(route:string,options?:{method?:string;body?:string;fresh?:boolean})=>Promise<unknown>;
const stable=(value:unknown):string=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const matchesValue=(key:string,a:unknown,b:unknown)=>key==='marketing_consent'?Number(a)===Number(b):['starts_at','ends_at'].includes(key)?typeof a==='string'&&typeof b==='string'&&Number.isFinite(Date.parse(a))&&Date.parse(a)===Date.parse(b):stable(a)===stable(b);
const service=(price:number,duration:number)=>({name:operationTrial.serviceName,description:operationTrial.description,price_uyu:price,duration_min:duration,deposit_percent:0,buffer_before_min:0,buffer_after_min:0,staff_ids:[]});
const customer=(notes:string)=>({name:operationTrial.customerName,email:operationTrial.email,phone:'',notes,marketing_consent:false});
export function createOperationValidation(request:Request,project:string,current:()=>Scope|null,group:TrialGroup,authorized=false){
 const initial=current();if(project!==productionProject||!initial||initial.businessId!==validationBusiness||initial.role!=='owner'||!initial.accessEnabled)throw Error('Ensayo exclusivo del propietario habilitado de Pelu.');
 const key=scopeKey(initial),base='/api/business/'+validationBusiness;let index=0,busy=false,stopped=false,serviceId='',customerId='';const evidence:{operation:string;id:string;response:unknown;readback:Row}[]=[];
 const steps=group==='services-customers'?['services.create','services.price','services.duration','services.hide','customers.create','customers.update']:['schedule.absence'];
 const check=()=>{if(scopeKey(current())!==key)throw Error('La sesión, rol o negocio cambió. Ensayo detenido.')};
 const list=async(tail:string)=>{check();const rows=await request(base+tail,{fresh:true}).catch(error=>{const code=String(error?.code||'');throw Error('No pude leer '+tail+( /^[A-Z_0-9]+$/.test(code)?' ('+code+')':'')+'. No se ejecutó una escritura. '+String(error?.message||''))});check();if(!Array.isArray(rows)||rows.some(r=>typeof r?.id!=='string'||r.business_id&&r.business_id!==validationBusiness))throw Error('Relectura fuera del negocio o inválida.');return rows as Row[]};
 return{tools:steps,state:()=>({index,busy,stopped,done:index===steps.length,serviceId,customerId,authorized}),evidence:()=>evidence,
 async request(route:string,options:{method?:string;body?:string;fresh?:boolean}={}){check();const method=options.method||'GET';
  const reads=group==='services-customers'?['/services','/staff','/customers']:['/staff','/time-off'];
  if(method==='GET'){if(!reads.some(t=>route===base+t))throw Error('Lectura no autorizada en este ensayo.');return list(route.slice(base.length))}
  if(!authorized)throw Error('Falta autorización específica del titular para estas escrituras reales.');
  if(busy||stopped||index>=steps.length)throw Error('El ensayo está ocupado o cerrado. No se repetirá una escritura.');
  const id=steps[index],payload=JSON.parse(options.body||'{}');let tail:string,want:Record<string,unknown>,recordId='',create=false;
  if(id.startsWith('services.')){tail='/services';recordId=serviceId;create=index===0;want=index===3?{active:0}:service(index===0?0:1,index<2?15:20)}
  else if(id.startsWith('customers.')){tail='/customers';recordId=customerId;create=id==='customers.create';want=customer(create?operationTrial.notes:operationTrial.updatedNotes)}
  else{tail='/time-off';create=true;want={staff_id:operationTrial.staffId,starts_at:operationTrial.startsAt,ends_at:operationTrial.endsAt,reason:operationTrial.reason}}
  if(method!==(create?'POST':'PATCH')||route!==base+tail+(create?'':'/'+recordId)||stable(payload)!==stable(want))throw Error('El registro o los valores no coinciden con la autorización.');
  busy=true;let sent=false;
  try{if(tail==='/time-off'){const people=await list('/staff');if(!people.some(p=>p.id===operationTrial.staffId&&Number(p.active)===1))throw Error('El profesional autorizado no está activo.');}
   const before=await list(tail),matches=before.filter(r=>tail==='/services'?r.name===operationTrial.serviceName:tail==='/customers'?r.name===operationTrial.customerName||r.email===operationTrial.email:r.reason===operationTrial.reason);
   if(tail==='/time-off'&&before.some(r=>r.staff_id===operationTrial.staffId&&Date.parse(String(r.starts_at))<Date.parse(operationTrial.endsAt)&&Date.parse(String(r.ends_at))>Date.parse(operationTrial.startsAt)))throw Error('Ya hay un bloqueo en ese período.');
   if(create?matches.length>0:matches.length!==1||matches[0].id!==recordId)throw Error('El registro ya existe o cambió. No se repite el ensayo.');
   if(!create){const expected=id==='services.price'?service(0,15):id==='services.duration'?service(1,15):id==='services.hide'?service(1,20):customer(operationTrial.notes);const row=matches[0];if(Object.entries(expected).some(([k,v])=>!matchesValue(k,row[k],v))||id.startsWith('services.')&&Number(row.active)!==1)throw Error('El registro no conserva el estado previo autorizado.')}
   check();sent=true;const response=await request(route,options) as Row;check();if(!response||typeof response.id!=='string'||recordId&&response.id!==recordId)throw Error('Identificador de Supabase inesperado.');
   const rows=await list(tail),actual=rows.find(r=>r.id===response.id);if(!actual||Object.entries(want).some(([k,v])=>!matchesValue(k,actual[k],v)))throw Error('La relectura no confirma los valores autorizados.');
   const others=(rs:Row[])=>rs.filter(r=>r.id!==actual.id).sort((a,b)=>a.id.localeCompare(b.id));if(stable(others(before))!==stable(others(rows)))throw Error('Cambió otro registro o hubo concurrencia. Ensayo detenido.');
   if(tail==='/services')serviceId=actual.id;if(tail==='/customers')customerId=actual.id;evidence.push({operation:id,id:actual.id,response,readback:actual});index++;return{...actual,confirmed_readback:true,validation_readback:true};
  }catch(error){if(sent)stopped=true;throw error}finally{busy=false}
 }};
}
