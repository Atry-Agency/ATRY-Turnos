export type View='inicio'|'agenda'|'servicios'|'clientes'|'configuracion'|'configuracion-inicial';
export interface Scope {role:string;plan:string;access:boolean;statistics:boolean}
export interface Evidence {source:View;label:string;observedAt:number;counts:Record<string,number>;series?:{day:string;n:number}[];leader?:{name:string;count:number};filtered?:boolean}
export interface Insight {id:string;title:string;text:string;source:string;calculation:string;fingerprint:string}
export interface GuideStep {anchor:string;title:string;text:string;optional?:boolean;requiresAccess?:boolean}
export interface Topic {id:string;title:string;description:string;steps:GuideStep[]}
export const views:View[]=['inicio','agenda','servicios','clientes','configuracion','configuracion-inicial'];
export function supported(view:string,scope:Scope):view is View{return views.includes(view as View)&&(['owner','manager'].includes(scope.role)||scope.role==='staff'&&view==='agenda')}
