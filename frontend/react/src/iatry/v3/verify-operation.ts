import {parseWindows,weeklyWindows} from '../../scheduling/model';
import type {Capability,Plan,ToolContext} from './contracts';
const equal=(a:unknown,b:unknown)=>Array.isArray(a)&&Array.isArray(b)?JSON.stringify([...a].sort())===JSON.stringify([...b].sort()):typeof a==='string'&&typeof b==='string'&&/^\d{4}-\d\d-\d\dT/.test(a)&&/^\d{4}-\d\d-\d\dT/.test(b)?Number.isFinite(Date.parse(a))&&Date.parse(a)===Date.parse(b):typeof a==='boolean'||typeof b==='boolean'?Number(a)===Number(b):String(a??'')===String(b??'');
/** Fresh authorized reads, not an echoed command response, decide whether a write is verified. */
export async function verifyOperation(ctx:ToolContext,tool:Capability,plan:Plan,response:unknown){
 const payload=plan.payload as Record<string,unknown>;
 if(tool.id==='schedule.day'){
  const staff=plan.tail.split('/')[2],hours=await ctx.read('/staff/'+staff+'/hours',parseWindows,true),rules=await ctx.read('/scheduling',v=>v as {breaks:unknown},true),actual=weeklyWindows(hours,parseWindows(rules.breaks||[]),staff),expected=weeklyWindows(parseWindows(payload.windows));
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('La relectura no confirma los tramos semanales. Revisá horarios antes de repetir.');
  return{id:staff,windows:actual,confirmed_readback:true};
 }
 const id=(response as {id?:string})?.id,expectedId=plan.method==='POST'?undefined:plan.tail.split('/').at(-1);
 if(!id||expectedId&&id!==expectedId)throw Error('Falta el identificador esperado del registro guardado.');
 const tail=tool.id.startsWith('services.')?'/services':tool.id.startsWith('customers.')?'/customers':'/time-off',rows=await ctx.read(tail,v=>v,true);
 const actual=Array.isArray(rows)?rows.find(r=>r.id===id):undefined;
 if(!actual||actual.business_id&&actual.business_id!==ctx.scope.businessId)throw Error('La relectura no encontró el registro en el negocio activo.');
 for(const [key,value]of Object.entries(payload)){
  if(key==='staff_ids'&&tool.id.startsWith('services.')){const people=await ctx.read('/staff',v=>v,true);if(!Array.isArray(people))throw Error('No pude verificar las asignaciones.');const assigned=people.filter(p=>Array.isArray(p.service_ids)&&p.service_ids.includes(id)).map(p=>p.id);if(!equal(assigned,value))throw Error('Las asignaciones guardadas no coinciden con la propuesta.');}
  else if(!equal(actual[key],value))throw Error('La relectura no confirma '+key+'. Revisá el registro antes de repetir.');
 }
 return{...actual,confirmed_readback:true};
}
