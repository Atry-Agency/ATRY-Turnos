import {phaseOneTools} from './phase-one';
import {phaseOneReleaseApproved,productionAllowed} from './production-policy';
const serviceValidationTools=['services.create','services.price','services.hide'];
import {cloudIncompatibilities,isCloudProfile} from './cloud-compatibility';
import {scopeKey} from '../../services/contracts';
import type {Capability,ToolContext} from './contracts';
export function available(tool:Capability,ctx:Pick<ToolContext,'port'|'scope'|'alive'> & Partial<Pick<ToolContext,'environment'>>){return (ctx.environment!=='phase-one-local'||phaseOneTools.includes(tool.id))&&(ctx.environment!=='reservation-validation'||['notifications.preferences','bookings.create','bookings.reschedule','bookings.cancelled'].includes(tool.id))&&(ctx.environment!=='operation-validation'||['services.create','services.price','services.duration','services.hide','customers.create','customers.update','schedule.absence'].includes(tool.id))&&productionAllowed(tool,{scope:ctx.scope,environment:ctx.environment||'local',port:ctx.port})&&(ctx.environment!=='customer-validation'||['customers.create','customers.update'].includes(tool.id))&&(ctx.environment!=='service-validation'||serviceValidationTools.includes(tool.id))&&!(isCloudProfile(ctx.environment||'')&&cloudIncompatibilities[tool.id])&&ctx.alive()&&tool.roles.includes(ctx.scope.role)&&(!tool.minimumPlan||({individual:0,negocio:1,pro:2}[ctx.port.business().plan as 'pro']??-1)>=(tool.minimumPlan==='pro'?2:1))&&(!tool.feature||ctx.port.capability(tool.feature))&&(tool.kind==='read'||ctx.scope.accessEnabled||tool.kind==='cancel')}
export function assertAccess(tool:Capability,ctx:ToolContext,write=false){
 if(write&&['connected','supabase-readonly','demo'].includes(ctx.environment)&&!(ctx.environment==='connected'&&phaseOneReleaseApproved))throw Error('Las escrituras requieren una validación y habilitación específica. No se modificó Supabase.');
 if(!productionAllowed(tool,ctx))throw Error('Esta capacidad aún no está validada para esta sesión de Supabase. No se consultó ni modificó Supabase.');
 if(isCloudProfile(ctx.environment)&&cloudIncompatibilities[tool.id])throw Error(cloudIncompatibilities[tool.id]);
 if(!available(tool,ctx)||scopeKey(ctx.scope)!==scopeKey(ctx.port.scope()))throw Error('El usuario, negocio, rol o permiso cambió. Volvé a empezar.');
}
