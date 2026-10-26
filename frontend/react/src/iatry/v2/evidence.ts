import {views,type Evidence,type Insight} from './contracts';
const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
// Accept only aggregates, never retain source rows, contacts, tokens or customer identifiers.
export function sanitizeEvidence(e:Evidence):Evidence|null{
 if(!e||!views.includes(e.source)||!Number.isFinite(e.observedAt)||typeof e.label!=='string')return null;
 const counts=Object.fromEntries(Object.entries(e.counts||{}).filter(([k,n])=>['today','total','cancelled','customers','returning'].includes(k)&&finite(n)));
 const series=Array.isArray(e.series)?e.series.filter(x=>x&&typeof x.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.day)&&Number.isFinite(Date.parse(x.day))&&new Date(x.day).toISOString().slice(0,10)===x.day&&finite(x.n)).slice(-90).map(x=>({day:x.day,n:x.n})):undefined;
 return {source:e.source,label:e.label.slice(0,200),observedAt:e.observedAt,counts,filtered:e.filtered===true,...(series?{series}:{}),...(e.leader&&finite(e.leader.count)&&typeof e.leader.name==='string'?{leader:{name:e.leader.name.slice(0,100),count:e.leader.count}}:{})};
}
export function insights(e:Evidence,statistics:boolean,today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Montevideo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())):Insight[]{
 const result:Insight[]=[],c=e.counts,add=(id:string,title:string,text:string,calculation:string)=>result.push({id,title,text,calculation,source:e.label,fingerprint:JSON.stringify([e.source,id,text,calculation])});
 if(e.source==='inicio'){
  if(finite(c.today))add('today','Tu día, a la vista',`${c.today} reservas registradas para hoy. Revisá la agenda antes de tomar decisiones sobre disponibilidad.`,`${c.today} = today_count del resumen cargado; no equivale a huecos disponibles.`);
  if(statistics&&finite(c.total)&&finite(c.cancelled)&&c.total>0&&c.cancelled<=c.total)add('cancellations','Cancelaciones registradas',`${c.cancelled} de ${c.total} reservas del período figuran canceladas (${Math.round(c.cancelled/c.total*100)}%). Podés revisar sus estados en Agenda.`,`${c.cancelled} ÷ ${c.total} × 100, redondeado. No atribuyo causas ni predigo cancelaciones.`);
  const series=[...(e.series||[])].filter(x=>x.day<today).sort((a,b)=>a.day.localeCompare(b.day)).slice(-14);
  if(statistics&&series.length===14&&new Set(series.map(x=>x.day)).size===14&&series.every((x,i)=>!i||Date.parse(x.day)-Date.parse(series[i-1].day)===86400000)){
   const a=series.slice(0,7).reduce((s,x)=>s+x.n,0),b=series.slice(7).reduce((s,x)=>s+x.n,0);if(a>0)add('evolution','Dos períodos comparables',`${b} reservas en las últimas 7 fechas completas observadas frente a ${a} en las 7 anteriores (${b>=a?'+':''}${Math.round((b-a)/a*100)}%).`,`${series[0].day} a ${series[6].day}: ${a}; ${series[7].day} a ${series[13].day}: ${b}. Diferencia ÷ período anterior × 100. Sin fechas omitidas ni día parcial.`);
  }
 }
 if(e.source==='agenda'){
  if(finite(c.total))add('agenda-count','Lo que estás mirando',`${c.total} reservas en la vista cargada${e.filtered?' con filtros activos':''}. Este conteo no representa toda la actividad del negocio.`,`${c.total} filas autorizadas visibles; los filtros de pantalla delimitan el conjunto.`);
  if(statistics&&e.leader&&e.leader.count>0)add('popular','Servicio destacado en esta vista',`${e.leader.name}: ${e.leader.count} reservas sin estado cancelado ni ausente en el conjunto visible. No es un ranking histórico del negocio.`,`${e.leader.count} filas con estado distinto de cancelled y no_show, agrupadas por identificador de servicio. En empate se muestra un servicio compartiendo el máximo.`);
 }
 if(e.source==='clientes'&&finite(c.customers)&&finite(c.returning)&&c.returning<=c.customers)add('returning','Clientes con historial',`${c.returning} de ${c.customers} clientes cargados tienen al menos 2 reservas registradas.`,`${c.returning} fichas con visits ≥ 2. Lista de hasta 100 resultados${e.filtered?', filtrada por búsqueda':''}; no es una tasa de retención ni prueba de asistencia.`);
 return result;
}
