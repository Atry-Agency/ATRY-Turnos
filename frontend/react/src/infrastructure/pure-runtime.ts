import '../domain/theme';
import '../../../../web/visit-core.js';
import '../../../../web/visit-demo.js';
import '../../../../web/whatsapp-core.js';
import '../../../../web/whatsapp-demo.js';
import '../../../../web/staff-photo-core.js';
import '../../../../web/read-cache.js';
import '../../../../web/demo.js';
import type {WhatsAppCore} from '../app/port';
export interface RequestOptions{method?:string;body?:string;fresh?:boolean;headers?:Record<string,string>}
export interface DemoRuntime{enabled:boolean;number:number;request?:(route:string,options?:RequestOptions)=>Promise<unknown>;loginPlan?:(email:string)=>number;showcase?:{apply(input:unknown):unknown}|null}
export interface ReadCache{clear:()=>void;read<T>(route:string,load:()=>Promise<T>,options?:{namespace?:string;fresh?:boolean}):Promise<T>}
interface StaffPhotoCore{bytes:(image:string)=>Uint8Array;path:(businessId:string,staffId:string,revision:string)=>string;validPath:(value:string,businessId:string,staffId:string)=>boolean}
declare global{interface Window{ATRY_DEMO?:DemoRuntime;AtryWhatsApp:WhatsAppCore;AtryStaffPhoto:StaffPhotoCore;createAtryReadCache:()=>ReadCache;ATRY_CONFIG?:RuntimeConfig}}
export interface RuntimeConfig{backend?:'supabase'|'preview'|'local';verificationOnly?:boolean;supabaseUrl?:string;supabaseKey?:string;turnstileSiteKey?:string;[key:string]:unknown}
export const pureRuntime={demo:window.ATRY_DEMO,whatsapp:window.AtryWhatsApp,photos:window.AtryStaffPhoto,createReadCache:window.createAtryReadCache};
