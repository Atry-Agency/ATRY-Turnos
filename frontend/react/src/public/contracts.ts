export interface PublicBusiness{id:string;slug:string;name:string;plan:string;description?:string;sector?:string;city?:string;address?:string;logo_url?:string;theme_config?:unknown;max_days:number;cancel_notice_hours:number;multi_service_enabled?:number|boolean}
export interface PublicService{id:string;name:string;description:string;duration_min:number;price_uyu:number}
export interface PublicPerson{id:string;name:string;service_ids:string[]}
export interface PublicCatalog{business:PublicBusiness;services:PublicService[];staff:PublicPerson[];bookable:boolean;waitlist_enabled?:boolean}
export interface PublicSlot{start:string;staff_id:string;time:string}
export interface Receipt{status:string;business_name?:string;service_name?:string;staff_name?:string;starts_at:string;price_uyu:number;customer_name?:string;manage_token?:string;cancel_notice_hours:number;visit?:boolean}
export function publicCatalog(v:unknown):PublicCatalog{const p=v as PublicCatalog;if(!p?.business||!['id','slug','name','plan'].every(k=>typeof p.business[k as 'id']==='string')||!Array.isArray(p.services)||!Array.isArray(p.staff))throw Error('No se recibió la página de reservas.');return p}
export function publicSlots(v:unknown):PublicSlot[]{const x=v as {slots:PublicSlot[]};if(!Array.isArray(x?.slots)||x.slots.some(s=>!s||!['start','staff_id','time'].every(k=>typeof s[k as 'start']==='string')))throw Error('No se recibió disponibilidad válida.');return x.slots}
export function receiptValue(v:unknown):Receipt{const b=v as Receipt;if(!b||typeof b.status!=='string'||typeof b.starts_at!=='string')throw Error('No se recibió una reserva válida.');return b}
