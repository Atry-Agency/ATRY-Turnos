import type {AgendaPreferences} from '../agenda/model';
import type {WeeklyModel} from '../dashboard/WeeklyActivity';
import type {FeaturePort} from '../services/contracts';
import type {WhatsAppConfig} from '../communications/contracts';
import type {Customer} from '../customers/contracts';
export interface BusinessContext {id:string;name:string;slug:string;role:'owner'|'manager'|'staff';plan:string;staff_id?:string;address?:string;timezone?:string;slot_step_min?:number;phone?:string;is_active?:number|boolean;subscription_status?:string;subscription_started_at?:string|null;paid_until?:string|null;trial_until?:string|null}
export interface WhatsAppCore {templates:Record<string,string>;labels:Record<string,string>;variables:string[];phone:(phone:string,country?:string)=>string;render:(text:string,context:Record<string,string>)=>string;context:(business:BusinessContext,customer:Pick<Customer,'name'>,booking?:Record<string,unknown>,previous?:string,base?:string)=>Record<string,string>;link:(phone:string,message:string)=>string;settings:(input:unknown,plan:string)=>WhatsAppConfig}
export interface AppPort extends FeaturePort {
 agendaPreferences(patch?:Partial<AgendaPreferences>):AgendaPreferences;
 syncState():{pending:boolean;connected:boolean};
 session():{userId:string;version:number}|null;
 businesses():BusinessContext[];
 accountTab(value?:string):string;
 selectBusiness(id:string):void;
 organizationCreated(id:string):Promise<void>;
 passwordChanged():void;
 endSession():void;
 user():{id:string;name:string;email:string;platform_admin:number|boolean};
 weeklyModel(rows:{day:string;n:number}[],end:string):WeeklyModel|null;
 dayTitle(day:string):string;
 openActivity(day:string):void;
 resetAgendaToday():void;
 notificationContext():{planLabel:string;mailProvider:string;usage:null|{accepted:number;reserved:number;limit:number;cycle_end:string}};
 photoRequest(route:string,body?:unknown):Promise<unknown>;
 photoBytes(image:string):Uint8Array;
 applyBusiness(value:Record<string,unknown>):Promise<void>;
 settingsTab(value?:string):string;
 publicURL():string;
 refreshPermissions():Promise<void>;
 completedOnboarding():void;
 demo():boolean;
 privateEmployeeCatalog():boolean;
 business():BusinessContext;
 capability(name:string):boolean;
 dateAgenda():string;
 goAgenda(date:string):void;
 navigate(route:string):void;
 publishCustomers?(customers:Customer[]):void;
 whatsapp():WhatsAppCore;
 bookingIssues(data:Record<string,string>,services:unknown[],staff:unknown[]):Record<string,string>;
 exactContacts(customers:Customer[],email:string,phone:string):Customer[];
 contactKey(email:string,phone:string):string;
}
