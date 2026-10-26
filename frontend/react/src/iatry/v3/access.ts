import {serviceValidation} from './service-validation';
import {cloudIncompatibilities,isCloudProfile} from './cloud-compatibility';
import {scopeKey} from '../../services/contracts';
import type {Capability,ToolContext} from './contracts';
export function available(tool:Capability,ctx:Pick<ToolContext,'port'|'scope'|'alive'> & Partial<Pick<ToolContext,'environment'>>){return (ctx.environment!=='service-validation'||(serviceValidation.tools as readonly string[]).includes(tool.id))&&!(isCloudProfile(ctx.environment||'')&&cloudIncompatibilities[tool.id])&&ctx.alive()&&tool.roles.includes(ctx.scope.role)&&(!tool.minimumPlan||({individual:0,negocio:1,pro:2}[ctx.port.business().plan as 'pro']??-1)>=(tool.minimumPlan==='pro'?2:1))&&(!tool.feature||ctx.port.capability(tool.feature))&&(tool.kind==='read'||ctx.scope.accessEnabled||tool.kind==='cancel')}
export function assertAccess(tool:Capability,ctx:ToolContext,write=false){
 if(ctx.environment==='connected')throw Error('Las herramientas experimentales solo están habilitadas en la demo y el backend local. No se consultó ni modificó Supabase.');
 if(isCloudProfile(ctx.environment)&&cloudIncompatibilities[tool.id])throw Error(cloudIncompatibilities[tool.id]);
 if(!available(tool,ctx)||scopeKey(ctx.scope)!==scopeKey(ctx.port.scope()))throw Error('El usuario, negocio, rol o permiso cambió. Volvé a empezar.');
}
