import {region,type RegionalBusiness} from '../domain/region';
export interface FinanceAccount{id:string;name:string;kind:'cash'|'bank';balance_minor:string}
export interface FinanceMethod{id:string;name:string;account_id:string;cash:boolean}
export interface CashSession{id:string;account_id:string;account_name:string;opened_at:string;closed_at:string|null;revision:string;opening_minor:string;expected_minor:string;counted_minor:string|null;difference_minor:string|null;close_note:string|null;opened_by_name:string}
export interface FinanceBooking{id:string;starts_at:string;status:string;customer_name:string;service_name:string;staff_name:string;price_minor:string;currency:string;charge_id:string|null;pending_minor:string|null}
export interface FinanceCharge{id:string;booking_id:string;customer_id:string;customer_name:string;service_name:string;staff_name:string;service_at:string;status:string;amount_minor:string;paid_minor:string;adjustment_minor:string;pending_minor:string}
export interface FinanceEvent{id:string;kind:string;amount_minor:string;delta_minor:string;currency:string;method_name:string;method_id:string;account_id:string;session_id:string|null;account_name:string;account_kind:string;note:string;created_at:string;customer_name:string;service_name:string;booking_id:string;charge_id:string|null;related_event_id:string|null;original_kind:string;reversed:boolean;refunded_minor:string;correctable:boolean}
export interface CloseoutHistory{id:string;work_day:string;created_at:string;actor_name:string;currency:string;net_minor:string;receipt_count:number;entry_count:number;cash_closed:boolean;opening_recovered:boolean;exceptions:{booking_id:string;customer_name:string;service_name:string;reason:string}[]}
export interface FinanceData{draft_scope?:string;suggested_days?:{day:string}[];closeouts?:CloseoutHistory[];initialized:boolean;started_at:string|null;revision:string;currency:string;timezone:string;from:string;to:string;can_write:boolean;permissions:string[];totals:{receipts_minor:string;income_minor:string;expenses_minor:string;refunds_minor:string;net_minor:string};pending_minor:string;completed_minor:string;events:FinanceEvent[];next_cursor:{cursor_at:string;cursor_id:string}|null;accounts:FinanceAccount[];methods:FinanceMethod[];sessions:CashSession[];charges:FinanceCharge[];bookings:FinanceBooking[];daily:{day:string;net_minor:string}[];checked_at:string}
const integer=(v:unknown):v is string=>typeof v==='string'&&/^-?\d+$/.test(v);
export function decodeFinance(value:unknown):FinanceData{
 const fail=()=>{throw Error('El contrato financiero no coincide con esta versión.');};
 const object=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
 const natural=(v:unknown)=>integer(v)&&/^[0-9]+$/.test(v);
 const strings=(v:Record<string,unknown>,keys:string[])=>keys.every(k=>typeof v[k]==='string');
 if(!object(value))return fail();const x=value as unknown as FinanceData;
 if(typeof x.initialized!=='boolean'||typeof x.can_write!=='boolean'||!['UYU','USD'].includes(x.currency)||!natural(x.revision)||!natural(x.pending_minor)||!natural(x.completed_minor)||!object(x.totals)||!['receipts_minor','income_minor','expenses_minor','refunds_minor','net_minor'].every(k=>integer((x.totals as unknown as Record<string,unknown>)[k]))||!Array.isArray(x.permissions)||!x.permissions.every(p=>['read','collect','cash','refund','settings'].includes(p))||!strings(value,['timezone','from','to','checked_at']))return fail();
 for(const key of ['events','accounts','methods','sessions','charges','bookings','daily'] as const)if(!Array.isArray(x[key])||!x[key].every(object))return fail();
 for(const rows of [x.events,x.accounts,x.methods,x.sessions,x.charges,x.bookings])for(const row of rows)if(typeof row.id!=='string'||!row.id)return fail();
 for(const e of x.events)if(!natural(e.amount_minor)||!integer(e.delta_minor)||!natural(e.refunded_minor)||e.currency!==x.currency||!Object.hasOwn(eventNames,e.kind)||typeof e.correctable!=='boolean'||typeof e.reversed!=='boolean'||!strings(e as unknown as Record<string,unknown>,['created_at','method_name','customer_name','note']))return fail();
 for(const c of x.charges)if(![c.amount_minor,c.paid_minor,c.pending_minor].every(natural)||!integer(c.adjustment_minor)||!strings(c as unknown as Record<string,unknown>,['booking_id','customer_name','service_name','staff_name','status']))return fail();
 for(const a of x.accounts)if(!integer(a.balance_minor)||!['cash','bank'].includes(a.kind)||typeof a.name!=='string')return fail();
 for(const m of x.methods)if(typeof m.name!=='string'||typeof m.cash!=='boolean'||!x.accounts.some(a=>a.id===m.account_id))return fail();
 for(const s of x.sessions)if(!natural(s.opening_minor)||!natural(s.expected_minor)||!natural(s.revision)||s.counted_minor!==null&&!natural(s.counted_minor)||s.difference_minor!==null&&!integer(s.difference_minor)||!strings(s as unknown as Record<string,unknown>,['account_id','account_name','opened_at','opened_by_name'])||(s.closed_at!==null&&(typeof s.closed_at!=='string'||s.counted_minor===null||s.difference_minor===null)))return fail();
 for(const b of x.bookings)if(!natural(b.price_minor)||b.pending_minor!==null&&!natural(b.pending_minor)||b.currency!==x.currency||!strings(b as unknown as Record<string,unknown>,['starts_at','customer_name','service_name','staff_name']))return fail();
 for(const d of x.daily)if(typeof d.day!=='string'||!integer(d.net_minor))return fail();
 if(x.next_cursor!==null&&(!object(x.next_cursor)||!strings(x.next_cursor,['cursor_at','cursor_id'])))return fail();
 if(x.closeouts!==undefined&&(!Array.isArray(x.closeouts)||!x.closeouts.every(c=>c&&typeof c.id==='string'&&integer(c.net_minor)&&c.currency===x.currency&&Array.isArray(c.exceptions))))return fail();
 return x;
}
/** Signed and exact, including aggregates beyond JavaScript safe integers. */
export function financeMoney(value:string,business:RegionalBusiness){if(!integer(value))throw Error('Importe inválido.');const n=BigInt(value),abs=n<0n?-n:n,r=region(business),parts=new Intl.NumberFormat(r.locale,{style:'currency',currency:r.currency,currencyDisplay:'code',minimumFractionDigits:2,maximumFractionDigits:2}).formatToParts(abs/100n);return(n<0n?'−':'')+parts.map(p=>p.type==='fraction'?String(abs%100n).padStart(2,'0'):p.value).join('')}
export function inputMinor(value:string){const s=value.trim().replace(',','.');if(!/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/.test(s))throw Error('Ingresá un importe con hasta dos decimales.');const[a,b='']=s.split('.');return (BigInt(a)*100n+BigInt(b.padEnd(2,'0'))).toString()}
export function amountInput(minor:string){const n=BigInt(minor);return `${n/100n}.${String(n%100n).padStart(2,'0')}`}
export const eventNames:Record<string,string>={receipt:'Cobro de reserva',income:'Otro ingreso',expense:'Gasto',refund:'Devolución',reversal:'Corrección de registro',opening:'Apertura',variance:'Diferencia de arqueo',discount:'Descuento',courtesy:'Cortesía'};
