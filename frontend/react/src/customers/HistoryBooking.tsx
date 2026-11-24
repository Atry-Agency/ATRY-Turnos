import type {HistoryRow} from './contracts';
import type {FeaturePort} from '../services/contracts';
import {localDateTime,statusLabels} from '../domain/format';
export function HistoryBooking({row,port,onOpen}:{row:HistoryRow;port:FeaturePort;onOpen?:(row:HistoryRow)=>void}){
 const content=<><span className="grow"><strong className="small">{row.service_name}</strong><span className="tiny muted customer-history-time">{localDateTime(row.starts_at,port.scope()||{})+' · '+(row.staff_name||'')}</span></span><span className={'badge '+row.status}>{statusLabels[row.status]||'Estado sin identificar'}</span></>;
 return onOpen?<button type="button" className="activity customer-history-booking" aria-label={'Abrir turno de '+row.service_name+' · '+localDateTime(row.starts_at,port.scope()||{})} onClick={()=>onOpen(row)}>{content}</button>:<div className="activity">{content}</div>;
}
