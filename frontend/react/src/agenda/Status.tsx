import {statusNames} from './model';
export function AgendaStatus({status}:{status:string}){return <span className={'ag-status ag-status--'+status}><span aria-hidden="true"/>{statusNames[status]||status}</span>}
