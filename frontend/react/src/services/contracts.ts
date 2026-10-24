import type {Service,SessionScope} from '../contracts';
export interface Staff {id:string; name:string; active:number|boolean; service_ids:string[]}
export interface Scope extends SessionScope {sector:string; accessEnabled:boolean; sessionVersion:number}
export interface Catalog {services:Service[];staff:Staff[]}
export interface ServicePayload {name:string;description:string;price_uyu:number;duration_min:number;deposit_percent:number;buffer_before_min:number;buffer_after_min:number;staff_ids:string[]}
export interface LegacyPort {
 scope():Scope|null;
 request(route:string,opts?:{method?:string;body?:string;fresh?:boolean}):Promise<unknown>;
 publish(scope:Scope,catalog:Catalog):void;
 createHost(view?:string,title?:string):HTMLElement;
 icon(name:string):string;
 serviceIcon(sector:string,name:string):string;
 notify(message:string,error?:boolean):void;
}
export interface Extension {
 show(view?:string):Promise<void>;
 activeRoute?():string|null;
 beforePage():void;
 beforeLeave():Promise<boolean>;
 signedOut():void;
}
export const scopeKey=(s:Scope|null)=>s?`${s.sessionVersion}|${s.userId}|${s.businessId}|${s.role}|${s.accessEnabled}`:'';
export const canManage=(s:Scope)=>['owner','manager'].includes(s.role)&&s.accessEnabled;
