import type {Capability,ToolContext} from './contracts';
/** Evidence is intentionally narrower than local compatibility. Never controlled by URL/localStorage. */
export const productionProject='https://djoxdtloqwbrhgtgencc.supabase.co';
export const validationBusiness='374cd00d-3e37-497f-9292-9bb959c1ef88';
export const auditedReadTools=['services.list','team.list','customers.search','customers.history','business.statistics'] as const;
// Filled only after normal-session, cloud-adapter, real-server validation. No write grants.
export const verifiedProductionReads:readonly string[]=Object.freeze(['services.list','team.list','customers.search','customers.history','business.statistics']);
export function productionAllowed(tool:Capability,ctx:Pick<ToolContext,'scope'|'environment'>){
 if(!['connected','supabase-readonly'].includes(ctx.environment))return true;
 if(typeof window!=='undefined'&&window.ATRY_CONFIG?.supabaseUrl!==productionProject)return false;
 const ids:readonly string[]=ctx.environment==='supabase-readonly'?auditedReadTools:verifiedProductionReads;
 return ctx.scope.businessId===validationBusiness&&ctx.scope.role==='owner'&&tool.kind==='read'&&ids.includes(tool.id);
}
/** Defense in depth: the live engine cannot use a nominal GET to materialize recurring bookings. */
export function assertProductionRead(tail:string,ctx:Pick<ToolContext,'scope'|'environment'>){
 if(!['connected','supabase-readonly'].includes(ctx.environment))return;
 if(ctx.scope.businessId!==validationBusiness||ctx.scope.role!=='owner'||!(/^\/(services|staff|statistics)$/.test(tail)||/^\/customers(?:\?q=[^#]*|\/[A-Za-z0-9_-]+\/history)?$/.test(tail)))throw Error('Consulta pendiente de validación real. No se consultó Supabase.');
}
