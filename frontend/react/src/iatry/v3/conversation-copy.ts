import type {Capability} from './contracts';
import type {Instruction,InstructionStep} from './instructions';
import {cloudIncompatibilities} from './cloud-compatibility';
/** Presentation only: explicit instruction values, no database reads or inferred record facts. */
export function instructionReply(instruction:Instruction){
 if(instruction.clarification)return 'Antes de seguir, quiero asegurarme de entenderte.';
 if(!instruction.understood)return 'No identifiqué una tarea con suficiente certeza. Contame qué querés hacer y lo vemos juntos.';
 if(instruction.steps.length>1)return 'Lo ordenamos paso a paso. Vas a revisar cada parte antes de seguir.';
 const id=instruction.steps[0]?.id;
 if(id==='services.create')return '¡Dale! Dejemos bien definido ese servicio para tu catálogo.';
 if(id?.startsWith('services.'))return id==='services.list'?'Querés ver los servicios de tu negocio.':'Veamos qué querés ajustar en tu catálogo.';
 if(id==='schedule.absence')return 'Vamos a ordenar ese tiempo en tu agenda. Primero dejemos claros el período y el profesional.';
 if(id?.startsWith('schedule.'))return 'Veamos cómo querés organizar tus horarios.';
 if(id==='customers.create')return 'Preparamos la ficha con los datos que nos des, sin inventar información.';
 if(id?.startsWith('customers.'))return 'Vamos a buscar la información del cliente dentro de lo que tu sesión permite.';
 if(id?.startsWith('bookings.'))return 'Veamos qué necesitás para ese turno, sin cambiar nada todavía.';
 return 'Lo vemos juntos. ¿Qué necesitás resolver primero?';
}
export function explicitProposal(step:InstructionStep,tool?:Capability){
 const details=Object.entries(step.seed.values).flatMap(([key,value])=>{const field=tool?.fields.find(f=>f.key===key);if(!field||value===''||Array.isArray(value)||typeof value==='boolean')return[];return[{label:field.label,value:String(value)}]});
 for(const [key,value]of Object.entries(step.seed.references)){const field=tool?.fields.find(f=>f.key===key);if(field)details.push({label:field.label,value:value==='@self'?'Tu profesional, por confirmar':value+' · por confirmar'})}
 const missing=tool?.fields.filter(f=>f.required&&!Object.hasOwn(step.seed.values,f.key)&&!Object.hasOwn(step.seed.references,f.key)&&f.value===undefined).map(f=>f.label)||[];
 return{details,missing};
}
export function unavailableReason(tool:Capability|undefined,role:string,plan:string){
 if(tool&&!tool.roles.includes(role as Capability['roles'][number]))return 'Tu rol no permite realizar esta tarea.';
 if(tool?.minimumPlan&&({individual:0,negocio:1,pro:2}[plan as 'pro']??-1)<(tool.minimumPlan==='pro'?2:1))return 'Esta tarea requiere un plan con esa función incluida.';
 if(tool&&cloudIncompatibilities[tool.id])return 'Esta tarea sigue bloqueada por una incompatibilidad pendiente de resolver.';
 return 'Todavía no puedo realizar esta tarea desde IAtry. No hice cambios.';
}

/** Wording only; counts are taken from the successful authorized response, never predicted. */
export function readReply(id:string,result:import('./contracts').Result){
 if(id==='business.statistics'){const n=(label:string)=>result.rows?.find(r=>r.label===label)?.value,total=n('Reservas'),done=n('Completadas'),cancelled=n('Canceladas');if([total,done,cancelled].every(x=>x!==undefined&&/^\d+$/.test(x)))return total==='0'?'Todavía no hay reservas registradas en los últimos 30 días.':'En los últimos 30 días registraste '+total+' reservas: '+done+' completadas y '+cancelled+' canceladas.';}
 if(id==='customers.search')return result.items?.length?'Encontré estas fichas. ¿Era quien buscabas?':'No encontré coincidencias. Podemos probar con otro nombre o contacto.';
 if(id==='customers.history')return result.items?.length?'Veamos las visitas registradas de este cliente.':'No encontré visitas en esta consulta.';
 if(id==='services.list')return result.items?.length?'Acá tenés los servicios que pude consultar de tu negocio.':'Todavía no aparecen servicios en esta consulta.';
 if(id==='team.list')return 'Este es el equipo que puedo consultar para tu negocio.';
 return result.message;
}
