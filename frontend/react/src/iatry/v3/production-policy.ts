import {phaseOneTools} from './phase-one';
import type {Capability,ToolContext} from './contracts';
/** Evidence is intentionally narrower than local compatibility. Never controlled by URL/localStorage. */
export const productionProject='https://djoxdtloqwbrhgtgencc.supabase.co';
export const validationBusiness='374cd00d-3e37-497f-9292-9bb959c1ef88';
export const auditedReadTools=['services.list','team.list','customers.search','customers.history','business.statistics'] as const;
// Filled only after normal-session, cloud-adapter, real-server validation. No write grants.
export const verifiedProductionReads:readonly string[]=Object.freeze(['services.list','team.list','customers.search','customers.history','business.statistics']);
// Release switch is code-owned: never read from URL, runtime config or localStorage.
// Owner plan expansion explicitly approved; manager/staff remain blocked.
export const phaseOneReleaseApproved=true;
export const phaseOneReleaseTools=phaseOneTools;
export const productionOwnerPlans=Object.freeze(['individual','negocio','pro'] as const);
export const productionRollback='15ac08b137791405e2588bec1445abece3bea19b';
export const productionToolsByPlan=Object.freeze({individual:phaseOneTools.filter(id=>id!=='business.statistics'),negocio:phaseOneTools,pro:phaseOneTools});
export const phaseOneReadTools:readonly string[]=Object.freeze(['services.list','customers.search','customers.history','schedule.read','schedule.blocks','team.list','business.statistics']);
type ReleaseContext=Pick<ToolContext,'scope'|'environment'>&Partial<Pick<ToolContext,'port'>>;
export function phaseOneReleaseScope(ctx:ReleaseContext){const business=ctx.port?.business();return ctx.scope.role==='owner'&&business?.id===ctx.scope.businessId&&productionOwnerPlans.includes(business.plan as typeof productionOwnerPlans[number]);}
export function phaseOneReleaseEligible(tool:Capability,ctx:ReleaseContext){return phaseOneReleaseScope(ctx)&&phaseOneTools.includes(tool.id)&&!(ctx.port?.business().plan==='individual'&&tool.id==='business.statistics');}
const phaseOneReadRoute=(tail:string)=>/^\/(services|staff|statistics|scheduling|time-off)$/.test(tail)||/^\/staff\/[A-Za-z0-9_-]+\/hours$/.test(tail)||/^\/customers(?:\?q=[^#]*|\/[A-Za-z0-9_-]+\/history)?$/.test(tail);
export function productionAllowed(tool:Capability,ctx:ReleaseContext){
 if(ctx.environment==='phase-one-local'&&typeof window!=='undefined'&&(window.ATRY_CONFIG?.backend!=='local'||!['localhost','127.0.0.1'].includes(location.hostname)))return false;
 if(ctx.environment==='demo')return tool.kind==='read'&&verifiedProductionReads.includes(tool.id);
 if(!['connected','supabase-readonly'].includes(ctx.environment))return true;
 if(typeof window!=='undefined'&&window.ATRY_CONFIG?.supabaseUrl!==productionProject)return false;
 if(ctx.environment==='connected'&&phaseOneReleaseApproved)return phaseOneReleaseEligible(tool,ctx);
 const ids:readonly string[]=ctx.environment==='supabase-readonly'?auditedReadTools:verifiedProductionReads;
 return ctx.scope.businessId===validationBusiness&&ctx.scope.role==='owner'&&tool.kind==='read'&&ids.includes(tool.id);
}
/** Defense in depth: the live engine cannot use a nominal GET to materialize recurring bookings. */
export function assertProductionRead(tail:string,ctx:ReleaseContext){
 if(ctx.environment==='connected'&&phaseOneReleaseApproved){if(!phaseOneReleaseScope(ctx)||!phaseOneReadRoute(tail)||(ctx.port?.business().plan==='individual'&&tail==='/statistics'))throw Error('Consulta fuera de las capacidades homologadas.');return;}
 if(ctx.environment==='phase-one-local'){if(!(/^\/(services|staff|statistics|scheduling|time-off)$/.test(tail)||/^\/staff\/[A-Za-z0-9_-]+\/hours$/.test(tail)||/^\/customers(?:\?q=[^#]*|\/[A-Za-z0-9_-]+\/history)?$/.test(tail)))throw Error('Esta lectura queda fuera de la primera etapa local.');return;}
 if(!['connected','supabase-readonly','demo'].includes(ctx.environment))return;
 if((ctx.environment!=='demo'&&(ctx.scope.businessId!==validationBusiness||ctx.scope.role!=='owner'))||!(/^\/(services|staff|statistics)$/.test(tail)||/^\/customers(?:\?q=[^#]*|\/[A-Za-z0-9_-]+\/history)?$/.test(tail)))throw Error('Consulta pendiente de validación real. No se consultó Supabase.');
}
