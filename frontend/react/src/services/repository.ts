import type {Service} from '../contracts';
import {canManage,scopeKey,type Catalog,type LegacyPort,type Scope,type ServicePayload,type Staff} from './contracts';
import {StaleScopeError} from '../infrastructure/errors';
export {StaleScopeError} from '../infrastructure/errors';
function record(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null}
export function parseCatalog(services:unknown,staff:unknown):Catalog{
 if(!Array.isArray(services)||!Array.isArray(staff)||!services.every(s=>record(s)&&typeof s.id==='string'&&typeof s.name==='string'&&[0,1,false,true].includes(s.active as number)&&['price_uyu','duration_min','deposit_percent','buffer_before_min','buffer_after_min'].every(k=>typeof s[k]==='number'&&Number.isFinite(s[k]))&&(s.description==null||typeof s.description==='string'))||!staff.every(s=>record(s)&&typeof s.id==='string'&&typeof s.name==='string'&&[0,1,false,true].includes(s.active as number)&&Array.isArray(s.service_ids)&&s.service_ids.every((x:unknown)=>typeof x==='string')))throw Error('La respuesta de Servicios no tiene el formato esperado. Reintentá.');
 return structuredClone({services:services as Service[],staff:staff as Staff[]});
}
export function createServicesRepository(port:LegacyPort,scope:Scope){
 let disposed=false,generation=0;
 const check=(expected=generation)=>{if(disposed||expected!==generation||scopeKey(port.scope())!==scopeKey(scope))throw new StaleScopeError();if(!canManage(scope))throw Object.assign(Error('No tenés permiso o acceso habilitado para gestionar servicios.'),{status:403});};
 const base=`/api/business/${encodeURIComponent(scope.businessId)}/services`;
 let pending:Promise<Catalog>|null=null;let writing=false;
 return {
  activate:()=>{disposed=false},
  dispose:()=>{disposed=true;generation++;pending=null},
  current:()=>!disposed&&scopeKey(port.scope())===scopeKey(scope),
  load(fresh=false):Promise<Catalog>{
   try{check()}catch(e){return Promise.reject(e)}
   if(pending)return pending;
   const version=generation;const request=Promise.all([port.request(base,{fresh}),port.request(`/api/business/${encodeURIComponent(scope.businessId)}/staff`,{fresh})]).then(([services,staff])=>{check(version);const catalog=parseCatalog(services,staff);port.publish(scope,catalog);return catalog}).finally(()=>{if(pending===request)pending=null});pending=request;return request;
  },
  async save(payload:ServicePayload|{active:number},id?:string){
   check();const version=generation;if(writing)throw Error('Ya hay una operación en curso.');writing=true;
   try{await port.request(base+(id?'/'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',body:JSON.stringify(payload)});check(version);}finally{writing=false;}
  }
 };
}
