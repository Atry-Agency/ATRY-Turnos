import {auditedReadTools,productionProject,validationBusiness} from './production-policy';
import {scopeKey,type Scope} from '../../services/contracts';
type Request=(route:string,options?:{method?:string;body?:string;fresh?:boolean})=>Promise<unknown>;
/** Private normal-session trial: no public/Edge routes, no writes, no materializing read RPCs. */
export function createReadonlyValidation(request:Request,project:string,current:()=>Scope|null){
 const initial=current();if(project!==productionProject||!initial||initial.role!=='owner'||initial.businessId!==validationBusiness)throw Error('La lectura requiere el proyecto autorizado y al propietario de Pelu.');
 const key=scopeKey(initial),base='/api/business/'+validationBusiness;let requests=0;
 return {tools:auditedReadTools,count:()=>requests,async request(route:string,options:{method?:string;body?:string;fresh?:boolean}={}){
  if(scopeKey(current())!==key)throw Error('La sesión cambió; se descartó la consulta.');
  const tail=route.startsWith(base)?route.slice(base.length):'';
  if((options.method||'GET')!=='GET'||options.body!==undefined||!(/^\/(services|staff|statistics)$/.test(tail)||/^\/customers(?:\?q=[^#]*|\/[A-Za-z0-9_-]+\/history)?$/.test(tail)))throw Error('Operación fuera del ensayo de solo lectura.');
  requests++;const result=await request(route,{fresh:true});if(scopeKey(current())!==key)throw Error('La sesión cambió; se descartó la respuesta.');return result;
 }};
}
