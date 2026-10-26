/** One authorized experiment. This is not a production feature switch. */
export const serviceValidation={project:'https://djoxdtloqwbrhgtgencc.supabase.co',business:'374cd00d-3e37-497f-9292-9bb959c1ef88',name:'IAtry · Validación controlada 2026-10-26',description:'Prueba controlada de IAtry; sin atención al público',tools:['services.create','services.price','services.hide']} as const;
type Row=Record<string,unknown>&{id:string};
type Request=(route:string,options?:{method?:string;body?:string;fresh?:boolean})=>Promise<unknown>;
export function createServiceValidation(request:Request,project:string,current:()=>{businessId:string;role:string;userId:string}|null){
 if(project!==serviceValidation.project)throw Error('Proyecto de validación incorrecto.');
 const initial=current(),owner=initial?Object.freeze({...initial}):null;if(!owner||owner.businessId!==serviceValidation.business||owner.role!=='owner')throw Error('La prueba requiere al propietario de Pelu.');
 const base='/api/business/'+serviceValidation.business;
 let phase:'ready'|'created'|'priced'|'done'|'stopped'='ready',busy=false,id:string|undefined;
 const evidence:{operation:string;response:unknown;readback:Row}[]=[];
 const check=()=>{const now=current();if(!now||now.userId!==owner.userId||now.businessId!==owner.businessId||now.role!=='owner')throw Error('La sesión o el negocio autorizado cambió.')};
 const list=async()=>{check();const value=await request(base+'/services',{fresh:true});check();if(!Array.isArray(value))throw Error('Catálogo inválido.');return value as Row[]};
 function fail(message:string):never{throw Error(message)}
 const exact=(payload:Record<string,unknown>,price:number)=>{
  const expected:Record<string,unknown>={name:serviceValidation.name,description:serviceValidation.description,duration_min:15,price_uyu:price,deposit_percent:0,buffer_before_min:0,buffer_after_min:0,staff_ids:[]};
  if(Object.keys(payload).length!==Object.keys(expected).length||Object.entries(expected).some(([key,value])=>JSON.stringify(value)!==JSON.stringify(payload[key])))fail('El contenido difiere de los datos autorizados.');
 };
 return {state:()=>({phase,id,busy}),evidence:()=>evidence,
 async request(route:string,options:{method?:string;body?:string;fresh?:boolean}={}){
  check();const method=options.method||'GET';
  if(method==='GET'){if(![base+'/services',base+'/staff'].includes(route))fail('Lectura fuera del catálogo autorizado.');return request(route,{...options,fresh:true})}
  if(busy||phase==='done'||phase==='stopped')fail('La prueba está bloqueada; no se repetirá una escritura.');
  const payload=JSON.parse(options.body||'{}') as Record<string,unknown>;
  const operation=phase==='ready'?'create':phase==='created'?'price':'hide';
  if(operation==='create'){if(route!==base+'/services'||method!=='POST')fail('Solo se autorizó crear el servicio de prueba.');exact(payload,0)}
  else{if(!id||route!==base+'/services/'+id||method!=='PATCH')fail('No se autorizó modificar ese servicio.');if(operation==='price')exact(payload,1);else if(JSON.stringify(payload)!=='{"active":0}')fail('Solo se autorizó ocultar el servicio de prueba.')}
  busy=true;let sent=false;
  try{
   const before=await list(),matches=before.filter(row=>row.name===serviceValidation.name);
   if(operation==='create'&&matches.length)fail('El servicio de prueba ya existe. No se creará ni modificará otro.');
   if(operation!=='create'&&(matches.length!==1||matches[0].id!==id||Number(matches[0].price_uyu)!==(operation==='price'?0:1)||Number(matches[0].active)!==1))fail('El servicio cambió; se detuvo la prueba.');
   check();sent=true;const response=await request(route,options);check();
   const returned=response as {id?:unknown};if(typeof returned?.id!=='string'||(id&&returned.id!==id))fail('Supabase devolvió un identificador inesperado.');id=returned.id;
   const after=await list(),row=after.find(row=>row.id===id);if(!row)fail('No se pudo verificar el servicio guardado.');
   const expected={name:serviceValidation.name,description:serviceValidation.description,duration_min:15,price_uyu:operation==='create'?0:1,deposit_percent:0,buffer_before_min:0,buffer_after_min:0,active:operation==='hide'?0:1};
   if(Object.entries(expected).some(([key,value])=>row[key]!==value)||!Array.isArray(row.staff_ids)||row.staff_ids.length||row.business_id!==serviceValidation.business)fail('La lectura posterior no coincide con el cambio autorizado.');
   if(JSON.stringify(before.filter(r=>r.id!==id))!==JSON.stringify(after.filter(r=>r.id!==id)))fail('Se detectó un cambio concurrente en el catálogo. Se detuvo la prueba.');
   evidence.push({operation,response,readback:row});phase=operation==='create'?'created':operation==='price'?'priced':'done';
   return {...row,validation_readback:true};
  }catch(error){if(sent)phase='stopped';throw error}finally{busy=false}
 }
 };
}
