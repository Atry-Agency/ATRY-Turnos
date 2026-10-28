import {normalizeLanguage} from './language';
import {plusDate,today} from '../../domain/format';
const days=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
/** Calendar dates are Montevideo local dates; conversion to UTC stays in the existing adapter. */
export function calendarDay(text:string,base=today()):string{
 const s=normalizeLanguage(text).replace(/(?:de|por) la manana/g,'');
 const iso=s.match(/\b(\d{4}-\d{2}-\d{2})\b/),local=s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);const value=iso?.[1]||(local?local[3]+'-'+local[2].padStart(2,'0')+'-'+local[1].padStart(2,'0'):'');
 if(value){const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===value?value:'';}
 if(/\bayer\b/.test(s))return plusDate(base,-1);if(/pasado manana/.test(s))return plusDate(base,2);if(/\bmanana\b/.test(s))return plusDate(base,1);if(/\bhoy\b/.test(s))return base;
 const current=new Date(base+'T12:00:00Z').getUTCDay(),day=days.findIndex(w=>new RegExp('\\b'+w+'\\b').test(s));
 if(day>=0){let delta=(day-current+7)%7;if(/que viene|proximo/.test(s)&&delta===0)delta=7;return plusDate(base,delta);}
 const monday=plusDate(base,-((current+6)%7));if(/proxima semana|semana que viene/.test(s))return plusDate(monday,7);if(/esta semana/.test(s))return monday;return '';
}
export type PeriodResolution={values?:{starts_at:string;ends_at:string};question?:string;day?:string};
export function resolvePeriod(text:string,base=today(),contextDay=''):PeriodResolution{
 const s=normalizeLanguage(text),day=calendarDay(s,base)||contextDay;
 const range=s.match(/\bdesde (.+?) hasta (.+)$/);if(range){const from=calendarDay(range[1],base),to=calendarDay(range[2],base);if(from&&to&&!/\d{1,2}:\d{2}/.test(s)){if(to<from)return{question:'El final es anterior al inicio. ¿Qué fechas querés usar?'};return{values:{starts_at:from+'T00:00',ends_at:plusDate(to,1)+'T00:00'}};}}
 if(/(?:esta semana|proxima semana|semana que viene)/.test(s)&&!days.some(d=>s.includes(d)))return day?{values:{starts_at:day+'T00:00',ends_at:plusDate(day,7)+'T00:00'}}:{};
 if(!/todo el dia|dia completo/.test(s)&&/medio dia|mediodia|de tarde|por la tarde|de manana|por la manana/.test(s))return{day,question:'¿Qué horario exacto querés bloquear? No voy a asumir tus horas de trabajo.'};
 if(/todo el dia|dia completo|no trabajo|no atiendo|dias? libres?/.test(s)&&day)return{values:{starts_at:day+'T00:00',ends_at:plusDate(day,1)+'T00:00'}};

 return{day};
}
