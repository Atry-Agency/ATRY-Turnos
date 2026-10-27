import {productionProject,validationBusiness} from './production-policy';
import {scopeKey,type Scope} from '../../services/contracts';
export const customerValidation={name:'IAtry · Cliente controlado 2026-10-26',email:'iatry-cliente-20261026@example.invalid',notes:'Prueba controlada de IAtry',updatedNotes:'Creación y edición verificadas por IAtry'} as const;
type Row=Record<string,unknown>&{id:string};
type Request=(route:string,options?:{method?:string;body?:string;fresh?:boolean})=>Promise<unknown>;
export function createCustomerValidation(request:Request,project:string,current:()=>Scope|null){
 const initial=current();if(project!==productionProject||!initial||initial.role!=='owner'||initial.businessId!==validationBusiness)throw Error('La prueba requiere al propietario de Pelu en el proyecto autorizado.');
 const key=scopeKey(initial),base='/api/business/'+validationBusiness;let phase='ready',id='',busy=false;const evidence:{operation:string;response:Row;readback:Row}[]=[];
 const check=()=>{if(scopeKey(current())!==key)throw Error('La sesión cambió; el ensayo está detenido.')};
 const list=async()=>{check();const rows=await request(base+'/customers',{fresh:true});check();if(!Array.isArray(rows))throw Error('Lectura de clientes inválida.');return rows as Row[]};
 const expected=(notes:string)=>({name:customerValidation.name,email:customerValidation.email,phone:'',notes,marketing_consent:false});
 const match=(row:Row,notes:string)=>Object.entries(expected(notes)).every(([k,v])=>k==='marketing_consent'?Number(row[k])===0:row[k]===v)&&row.business_id===validationBusiness;
 return{state:()=>({phase,id,busy}),evidence:()=>evidence,async request(route:string,options:{method?:string;body?:string;fresh?:boolean}={}){
  check();const method=options.method||'GET';if(method==='GET'){if(route!==base+'/customers'&&!route.startsWith(base+'/customers?q='))throw Error('Lectura fuera de la prueba autorizada.');return request(route,{fresh:true})}
  if(busy||!['ready','created'].includes(phase))throw Error('El ensayo está cerrado; no se repetirá una escritura.');
  const create=phase==='ready',notes=create?customerValidation.notes:customerValidation.updatedNotes,payload=JSON.parse(options.body||'{}'),want=expected(notes);
  if(route!==base+'/customers'+(create?'':'/'+id)||method!==(create?'POST':'PATCH')||Object.keys(payload).length!==Object.keys(want).length||Object.entries(want).some(([k,v])=>payload[k]!==v))throw Error('La operación difiere de la autorización de clientes.');
  busy=true;let sent=false;
  try{const before=await list(),matching=before.filter(x=>x.name===customerValidation.name||x.email===customerValidation.email);
   if(create?matching.length!==0:matching.length!==1||matching[0].id!==id||!match(matching[0],customerValidation.notes))throw Error('La ficha ya existe o cambió. No se modificó ningún registro.');
   check();sent=true;const response=await request(route,options) as Row;check();if(typeof response?.id!=='string'||(id&&response.id!==id)||!match(response,notes))throw Error('Respuesta de Supabase inesperada.');id=response.id;
   const after=await list(),row=after.find(x=>x.id===id);if(!row||!match(row,notes)||JSON.stringify(before.filter(x=>x.id!==id))!==JSON.stringify(after.filter(x=>x.id!==id)))throw Error('La relectura no confirma exclusivamente el cambio autorizado.');
   evidence.push({operation:create?'create':'notes',response,readback:row});phase=create?'created':'done';return{...row,validation_readback:true};
  }catch(error){if(sent)phase='stopped';throw error}finally{busy=false}
 }};
}
