import {scopeKey,type LegacyPort,type Scope} from '../services/contracts';
import {StaleScopeError} from './errors';
/** Scope checks and invalidation only. Authorization and domain rules remain server-owned. */
export function scopedApi(port:LegacyPort,scope:Scope,{allowStaff=false,allowSupport=false,allowPlanRequests=false}:{allowStaff?:boolean;allowSupport?:boolean;allowPlanRequests?:boolean}={}){
 let generation=0,disposed=false,writing=false;
 const check=(version=generation)=>{if(disposed||version!==generation||scopeKey(port.scope())!==scopeKey(scope))throw new StaleScopeError();if(!['owner','manager'].includes(scope.role)&&!(allowStaff&&scope.role==='staff'))throw Object.assign(Error('No tenés permiso o acceso habilitado.'),{status:403})};
 const readRoute=async<T>(route:string,decode:(value:unknown)=>T,fresh=false)=>{check();if(!route.startsWith('/api/'))throw Error('Ruta de API inválida.');const version=generation;const value=await port.request(route,{fresh});check(version);return decode(value)};
 return {readRoute,activate(){disposed=false},dispose(){disposed=true;generation++},current:()=>!disposed&&scopeKey(port.scope())===scopeKey(scope),
  async read<T>(tail:string,decode:(value:unknown)=>T,fresh=false){check();const version=generation;const value=await port.request(`/api/business/${encodeURIComponent(scope.businessId)}${tail}`,{fresh});check(version);return decode(value)},
  async write<T>(tail:string,payload:T,method='POST'){check();if(!scope.accessEnabled&&!((allowSupport&&tail==='/support'&&method==='POST')||(allowPlanRequests&&((tail==='/plan-requests'&&method==='POST')||(/^\/plan-requests\/[A-Za-z0-9_-]+$/.test(tail)&&method==='PATCH')))))throw Object.assign(Error('Requiere habilitación o renovación de Atry.'),{status:403});if(writing)throw Error('Ya hay una operación en curso.');const version=generation;writing=true;try{const value=await port.request(`/api/business/${encodeURIComponent(scope.businessId)}${tail}`,{method,body:JSON.stringify(payload)});check(version);return value}finally{writing=false}}
 };
}
