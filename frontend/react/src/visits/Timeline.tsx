import type {RegionalBusiness} from '../domain/region';
import {recordMoney} from '../domain/format';
import {money,localDateTime} from '../domain/format';
import {statusNames} from '../agenda/model';
import type {VisitLeg} from './contracts';
export function Timeline({legs,business={}}:{legs:VisitLeg[];business?:RegionalBusiness}){return <ol className="visit-timeline">{legs.map((l,i)=><li key={l.id||i}><span>{i+1}</span><div><strong>{l.service_name}</strong><small>{l.staff_name+' · '+localDateTime(l.starts_at,business).slice(-5)+'–'+localDateTime(l.ends_at,business).slice(-5)+(l.status?' · '+(statusNames[l.status]||l.status):'')}</small></div><b>{recordMoney(l)}</b></li>)}</ol>}
