import {businessNavigation,settingsSections} from '../../app/navigation';
import type {BusinessContext} from '../../app/port';
import type {IatryDestination} from '../navigation';
const areas:Record<string,[string,string]>={Servicios:['servicios','Servicios'],Equipo:['equipo','Equipo'],Horarios:['disponibilidad','Horarios'],Clientes:['clientes','Clientes'],Agenda:['agenda','Agenda'],'Turnos fijos':['turnos-fijos','Turnos fijos'],'Lista de espera':['lista-espera','Lista de espera'],Comunicaciones:['comunicacion','Comunicaciones'],Configuración:['configuracion/general','Datos generales'],'Apariencia e identidad':['configuracion/apariencia','Apariencia e identidad'],'Inicio y estadísticas':['inicio','Inicio'],'Planes y permisos':['suscripcion','Mi plan'],'Página pública':['configuracion/publicacion','Página pública'],'Ayuda y soporte':['soporte','Ayuda y soporte']};
/** A manual shortcut inherits the same navigation visibility as the current role and plan. */
export function helpDestination(area:string,business:BusinessContext,capability:(feature:string)=>boolean):{label:string;destination:IatryDestination}|undefined{
 const value=areas[area];if(!value)return;
 const allowed=new Set([...businessNavigation(business,capability).map(([id])=>id),...settingsSections(business.role,capability).flatMap(group=>group.items.map(([id])=>id))]);
 if(!allowed.has(value[0]))return;
 return{label:'Ir a '+value[1],destination:{route:'/app/'+value[0]}};
}
