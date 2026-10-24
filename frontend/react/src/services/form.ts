import type {Service} from '../contracts';
import type {ServicePayload,Staff} from './contracts';
export const numericFields=[
 ['price_uyu','Precio en pesos uruguayos',0,undefined],['duration_min','Duración (minutos)',5,720],['deposit_percent','Seña estimada (%)',0,100],['buffer_before_min','Preparación previa (min)',0,180],['buffer_after_min','Tiempo posterior (min)',0,180]
] as const;
export interface Draft {name:string;description:string;price_uyu:string;duration_min:string;deposit_percent:string;buffer_before_min:string;buffer_after_min:string;staff_ids:string[]}
export function initialDraft(service:Service|null,staff:Staff[]):Draft{return {name:service?.name||'',description:service?.description||'',price_uyu:String(service?.price_uyu??500),duration_min:String(service?.duration_min??30),deposit_percent:String(service?.deposit_percent??0),buffer_before_min:String(service?.buffer_before_min??0),buffer_after_min:String(service?.buffer_after_min??0),staff_ids:service?staff.filter(s=>s.service_ids.includes(service.id)).map(s=>s.id):staff.map(s=>s.id)}}
// Form constraints mirror the current HTTP contract. Availability/future-booking/plan rules remain backend-owned.
export function toPayload(d:Draft):ServicePayload{
 if(d.name.length<2)throw Error('Revisá el nombre y la descripción del servicio.');
 const payload:ServicePayload={name:d.name,description:d.description,staff_ids:[...d.staff_ids],price_uyu:0,duration_min:0,deposit_percent:0,buffer_before_min:0,buffer_after_min:0};
 for(const [key,label,min,max] of numericFields){const n=Number(d[key]);if((['price_uyu','duration_min'].includes(key)&&!d[key].trim())||!Number.isInteger(n)||n<min||(max!==undefined&&n>max))throw Error(`${label}: ingresá un entero ${max===undefined?`mayor o igual a ${min}`:`entre ${min} y ${max}`}.`);payload[key]=n;}return payload;
}
