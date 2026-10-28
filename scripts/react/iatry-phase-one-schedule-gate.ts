// Finite private experiment authorized on 2026-10-28. No production grant.
import {parseWindows,weeklyWindows} from '../../frontend/react/src/scheduling/model';
export const trial={project:'https://djoxdtloqwbrhgtgencc.supabase.co',business:'374cd00d-3e37-497f-9292-9bb959c1ef88',staff:'35c53427-98ad-4f28-b0c1-c5cc5f82ae14'};
export const original=Array.from({length:6},(_,i)=>({weekday:i+1,start_min:540,end_min:1080}));
export const split=original.flatMap(w=>w.weekday===3?[{...w,end_min:780},{...w,start_min:840}]:[w]);
export const absence=(multi:boolean)=>({staff_id:trial.staff,starts_at:multi?'2026-11-20T03:00:00.000Z':'2026-11-18T03:00:00.000Z',ends_at:multi?'2026-11-23T03:00:00.000Z':'2026-11-19T03:00:00.000Z',reason:multi?'IAtry · Vacaciones controladas 2026-11-20':'IAtry · Día completo controlado 2026-11-18'});
const stable=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const ordered=(v:any[])=>[...v].sort((a,b)=>a.weekday-b.weekday||a.start_min-b.start_min);
export function createGate(request:any,project:string,current:any,authorized=false){
 const owner=current();if(project!==trial.project||owner?.businessId!==trial.business||owner?.role!=='owner')throw Error('Solo propietario de Pelu.');const scope=stable(owner),base='/api/business/'+trial.business;let index=0,busy=false,stopped=false;const evidence:any[]=[];
 const check=()=>{if(stable(current())!==scope)throw Error('La sesión cambió.');};const read=async(tail:string)=>{check();const r=await request(base+tail,{fresh:true});check();return r;};
 const week=async()=>{const hours=await read('/staff/'+trial.staff+'/hours'),rules=await read('/scheduling');return ordered(weeklyWindows(parseWindows(hours),parseWindows(rules.breaks||[]),trial.staff));};
 return {state:()=>({index,busy,stopped,done:index===4}),evidence:()=>evidence,
 async request(route:string,options:any={}){check();const method=options.method||'GET';if(method==='GET'){if(!['/staff','/scheduling','/time-off','/staff/'+trial.staff+'/hours'].some(t=>route===base+t))throw Error('Lectura fuera del ensayo.');return read(route.slice(base.length));}
 if(!authorized||busy||stopped||index===4)throw Error('Ensayo cerrado u ocupado.');const weekly=index<2,want=weekly?{windows:index===0?split:original}:absence(index===3),payload=JSON.parse(options.body||'{}');
 if(method!==(weekly?'PUT':'POST')||route!==base+(weekly?'/staff/'+trial.staff+'/hours':'/time-off')||stable(weekly?{windows:ordered(payload.windows||[])}:payload)!==stable(weekly?{windows:ordered((want as any).windows)}:want))throw Error('Operación distinta de la autorizada.');
 busy=true;let sent=false;try{
 const people=await read('/staff');if(!people.some((p:any)=>p.id===trial.staff&&p.active))throw Error('Profesional no activo.');
 if(stable(await week())!==stable(ordered(index===1?split:original)))throw Error('Cambió la semana. No escribir.');
 const before=await read('/time-off');if(!Array.isArray(before))throw Error('Lectura inválida.');if(!weekly&&before.some((r:any)=>r.staff_id===trial.staff&&Date.parse(r.ends_at)>Date.parse((want as any).starts_at)&&Date.parse(r.starts_at)<Date.parse((want as any).ends_at)))throw Error('Hay una ausencia superpuesta.');
 check();sent=true;const response=await request(route,options);check();let actual:any;
 if(weekly){actual=await week();if(stable(actual)!==stable(ordered((want as any).windows)))throw Error('Semana no verificada. No repetir.');if(stable(before)!==stable(await read('/time-off')))throw Error('Cambió otro registro.');}
 else{const after=await read('/time-off');actual=after.find((r:any)=>r.id===response?.id);if(!actual||actual.business_id!==trial.business||actual.staff_id!==trial.staff||actual.reason!==(want as any).reason||Date.parse(actual.starts_at)!==Date.parse((want as any).starts_at)||Date.parse(actual.ends_at)!==Date.parse((want as any).ends_at)||stable(before)!==stable(after.filter((r:any)=>r.id!==actual.id)))throw Error('Ausencia no verificada. No repetir.');}
 evidence.push({step:index+1,response,readback:actual});index++;return response;
 }catch(e){if(sent)stopped=true;throw e;}finally{busy=false;}}
 };
}
