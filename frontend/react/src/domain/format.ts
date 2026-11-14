import {regionalMoney} from './region';
import {regionalDay,regionalDateTime,localInstant,type RegionalBusiness} from './region';
export const initials=(name:string)=>String(name||'A').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
export const localDateTime=(iso:string,business:RegionalBusiness={})=>regionalDateTime(iso,business).replace('T',' · ');
export const statusLabels:Record<string,string>={confirmed:'Confirmado',pending:'Pendiente',completed:'Completado',cancelled:'Cancelado',no_show:'No asistió',active:'Activo',trialing:'Prueba',past_due:'Pago pendiente',suspended:'Suspendido'};

export const today=(business:RegionalBusiness={})=>regionalDay(new Date(),business);
export const money=(value:number)=>'$'+Number(value||0).toLocaleString('es-UY');
export const dateDisplay=(iso:string)=>iso?new Intl.DateTimeFormat('es-UY',{weekday:'short',day:'numeric',month:'short'}).format(new Date(iso+'T12:00:00Z')):'';
export const plusDate=(day:string,n:number)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
/** Compatibility wrapper for existing Uruguay-only callers. New callers pass business explicitly. */
export function parseMontevideo(value:string){return localInstant(value)}

export function recordMoney(value:{currency?:string;price_minor?:number;price_uyu?:number}){if(value.currency==='USD'){if(!Number.isSafeInteger(value.price_minor))throw Error('Falta el importe exacto en USD.');return regionalMoney(value.price_minor!,{country:'PA'});}if(value.currency&&value.currency!=='UYU')throw Error('Moneda no admitida.');return money(value.price_uyu||0)}
