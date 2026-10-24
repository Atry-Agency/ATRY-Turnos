/** Presentation of existing weekly rules; the API validates conflicts and saves atomically. */
export interface Window {weekday:number;start_min:number;end_min:number;staff_id?:string}
export const weekDays=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
export const weekOrder=[1,2,3,4,5,6,0];
export const minuteLabel=(n:number)=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
export function weeklyWindows(hours:Window[],breaks:Window[]=[],staffId?:string){
 const result:Window[]=[];
 for(const hour of hours.filter(h=>!staffId||!h.staff_id||h.staff_id===staffId)){
  let spans=[[hour.start_min,hour.end_min]];
  for(const gap of breaks.filter(b=>(!staffId||b.staff_id===staffId)&&b.weekday===hour.weekday))spans=spans.flatMap(([start,end])=>gap.end_min<=start||gap.start_min>=end?[[start,end]]:[[start,Math.max(start,gap.start_min)],[Math.min(end,gap.end_min),end]].filter(([a,b])=>a<b));
  result.push(...spans.map(([start_min,end_min])=>({weekday:hour.weekday,start_min,end_min})));
 }
 return result.sort((a,b)=>a.weekday-b.weekday||a.start_min-b.start_min);
}
export function parseWindows(v:unknown):Window[]{if(!Array.isArray(v)||v.some(h=>!h||!Number.isInteger(h.weekday)||h.weekday<0||h.weekday>6||!Number.isFinite(h.start_min)||!Number.isFinite(h.end_min)))throw Error('No se recibieron horarios válidos.');return v}
export interface DayDraft {enabled:boolean;spans:{start:string;end:string}[]}
export function decodeDraft(days:DayDraft[]):Window[]{
 const windows:Window[]=[];const toMinute=(v:string)=>{if(!/^\d{2}:\d{2}$/.test(v))throw Error('Completá el inicio y el fin de cada tramo.');return Number(v.slice(0,2))*60+Number(v.slice(3))};
 for(const weekday of weekOrder)if(days[weekday].enabled){const spans=days[weekday].spans.map(row=>({weekday,start_min:toMinute(row.start),end_min:toMinute(row.end)||1440})).sort((a,b)=>a.start_min-b.start_min);if(!spans.length||spans.length>6)throw Error('Agregá entre 1 y 6 tramos por día de atención.');for(let i=0;i<spans.length;i++)if(spans[i].start_min>=spans[i].end_min||(i&&spans[i].start_min<spans[i-1].end_min))throw Error(`Revisá ${weekDays[weekday]}: los tramos deben terminar después de comenzar y no superponerse.`);windows.push(...spans)}return windows;
}
