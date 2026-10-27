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
 return 'Esto es lo que entendí. Revisemos juntos el próximo paso.';
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
 return 'No disponible en esta conexión. Entendí la solicitud, pero no voy a ejecutar este cambio.';
}
