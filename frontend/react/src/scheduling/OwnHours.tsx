import type {AppPort} from '../app/port';
import type {Scope} from '../services/contracts';
import type {ScreenController} from '../services/ServicesScreen';
import {useLoader} from '../infrastructure/useResource';
import {PageHeader,Empty} from '../ui/layout';
import {Feedback,Button} from '../ui/primitives';
import {weekDays,minuteLabel,parseWindows} from './model';
interface Person{id:string;name:string;active:number|boolean}
export function OwnHours({port,scope,control,onWeek}:{port:AppPort;scope:Scope;control:(value:ScreenController|null)=>void;onWeek:(staff:Person)=>void}){const state=useLoader(port,scope,'own-hours',async(api,fresh)=>{const people=await api.read('/staff',v=>{if(!Array.isArray(v)||v.some(x=>!x||typeof x.id!=='string'||typeof x.name!=='string'))throw Error('No se recibieron profesionales válidos.');return v as Person[]},fresh);const staff=people.find(x=>x.active)||people[0];return {staff,hours:staff?await api.read('/staff/'+encodeURIComponent(staff.id)+'/hours',parseWindows,fresh):[]}},control,true);return <>{state.error&&<Feedback error retry={()=>void state.reload()}>{state.error}</Feedback>}{state.data?<div data-react-own-hours>{state.data.staff?<><PageHeader title="Mi horario" subtitle="Tu semana de trabajo y disponibilidad."/><section className="card"><h2>{state.data.staff.name}</h2>{state.data.hours.map((h,i)=><p key={i}>{weekDays[h.weekday]+' · '+minuteLabel(h.start_min)+' a '+minuteLabel(h.end_min)}</p>)}<Button onClick={()=>onWeek(state.data!.staff)}>Editar jornada</Button></section></>:<Empty port={port}>No hay profesional configurado.</Empty>}</div>:state.loading&&<Feedback>Cargando horario…</Feedback>}</>}
