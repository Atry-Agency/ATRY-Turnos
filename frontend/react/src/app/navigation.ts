import {sectorIcon} from '../domain/icons';
import type {BusinessContext} from './port';
export const commercialRoutes:Record<string,string>={'turnos-fijos':'recurring',smartslots:'smartslots','lista-espera':'waitlist',insights:'advanced',estadisticas:'statistics',notificaciones:'operational_mail',accesos:'access'};
export const routeAllowed=(view:string,capability:(name:string)=>boolean)=>!commercialRoutes[view]||capability(commercialRoutes[view]);
export function businessNavigation(b:BusinessContext,capability:(name:string)=>boolean):string[][]{
 if(b.role==='staff')return [['agenda','calendar','Mi agenda'],['comunicacion','whatsapp','Comunicaciones']];
 const items=[['inicio','grid','Inicio'],['agenda','calendar','Agenda'],['turnos-fijos','repeat','Turnos fijos'],['lista-espera','waitlist','Lista de espera'],['servicios',sectorIcon((b as BusinessContext&{sector?:string}).sector),'Servicios'],['equipo','users','Equipo'],['disponibilidad','clock','Horarios'],['clientes','heart','Clientes']];
 if(capability('advanced'))items.push(['insights','chart','Estadísticas']);else if(capability('statistics'))items.push(['estadisticas','chart','Estadísticas']);
 if(capability('smartslots'))items.push(['smartslots','spark','Oportunidades de agenda']);
 items.push(['comunicacion','whatsapp','Comunicaciones'],['configuracion','settings','Configuración'],['soporte','help','Ayuda y soporte']);return items.filter(([view])=>routeAllowed(view,capability));
}
export function settingsNavigation(role:string,capability:(name:string)=>boolean){return [['comunicacion','whatsapp','Comunicación'],...(role==='staff'?[]:[['configuracion','shop','Negocio']]),...(capability('operational_mail')?[['notificaciones','bell','Notificaciones']]:[]),...(role==='owner'&&capability('access')?[['accesos','shield','Usuarios y accesos']]:[]),['suscripcion','wallet','Mi plan y acceso']]}
