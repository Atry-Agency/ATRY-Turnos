export interface Service {
 id:string; name:string; description?:string; active:number|boolean;
 price_uyu:number; duration_min:number; deposit_percent:number;
 buffer_before_min:number; buffer_after_min:number;
}
// Shared extension contracts. Services uses a validated repository over the existing API transport.
export interface SessionScope { userId:string; businessId:string; role:'owner'|'manager'|'staff' }
export interface ApiPort { request<T>(scope:SessionScope,route:string,options?:{method?:string;body?:string}):Promise<T>; invalidate(scope:SessionScope):void }
export interface IAtryContext { screen:string; businessId:string; role:SessionScope['role']; capabilities:Readonly<Record<string,boolean>> }
export interface IAtryPort { contextChanged(context:IAtryContext):void; dispose():void }
