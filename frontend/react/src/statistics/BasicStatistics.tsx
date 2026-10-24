import type {AppPort} from '../app/port';
import type {Scope} from '../services/contracts';
import type {ScreenController} from '../services/ServicesScreen';
import {useResource} from '../infrastructure/useResource';
import {PageHeader} from '../ui/layout';
import {Feedback} from '../ui/primitives';
interface Statistics {total:number;completed:number;cancelled:number}
const decode=(value:unknown):Statistics=>{const x=value as Statistics;if(!x||!['total','completed','cancelled'].every(k=>Number.isFinite(x[k as keyof Statistics])))throw Error('No se recibieron estadísticas válidas.');return x};
export function BasicStatistics({port,scope,control}:{port:AppPort;scope:Scope;control:(value:ScreenController|null)=>void}){const state=useResource(port,scope,'/statistics',decode,control);return <><PageHeader title="Estadísticas" subtitle="Resumen básico de los últimos 30 días."/>{state.error&&<Feedback error retry={()=>void state.reload()}>{state.error}</Feedback>}{state.data?<div className="grid3" data-react-statistics>{[['Reservas',state.data.total],['Completadas',state.data.completed],['Canceladas',state.data.cancelled]].map(([label,n])=><article className="metric" key={label}><h3>{label}</h3><strong>{n}</strong></article>)}</div>:state.loading&&<Feedback>Cargando estadísticas…</Feedback>}</>}
