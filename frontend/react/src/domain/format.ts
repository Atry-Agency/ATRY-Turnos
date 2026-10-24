export const initials=(name:string)=>String(name||'A').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
export const localDateTime=(iso:string)=>new Date(Date.parse(iso)-10800000).toISOString().slice(0,16).replace('T',' · ');
export const statusLabels:Record<string,string>={confirmed:'Confirmado',pending:'Pendiente',completed:'Completado',cancelled:'Cancelado',no_show:'No asistió',active:'Activo',trialing:'Prueba',past_due:'Pago pendiente',suspended:'Suspendido'};

export const today=()=>new Date(Date.now()-10800000).toISOString().slice(0,10);
export const money=(value:number)=>'$'+Number(value||0).toLocaleString('es-UY');
export const dateDisplay=(iso:string)=>iso?new Intl.DateTimeFormat('es-UY',{weekday:'short',day:'numeric',month:'short'}).format(new Date(iso+'T12:00:00Z')):'';
export const plusDate=(day:string,n:number)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function parseMontevideo(value:string){if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw Error('Ingresá una fecha y hora válida');const d=new Date(value+':00-03:00');if(!Number.isFinite(d.getTime()))throw Error('Fecha inválida');return d.toISOString()}
