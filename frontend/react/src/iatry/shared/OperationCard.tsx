import type {ReactNode} from 'react';
import {PanelIcon} from '../v3/PanelIcon';
import './operation-card.css';
/** Presentation only: callers supply authorized facts and own all execution state. */
export function OperationCard({title,status,children,kind='record'}:{title:string;status:string;children:ReactNode;kind?:string}){
 return <section className="iatry-operation-card" data-kind={kind}><header><strong>{title}</strong><span>{status}</span></header>{children}</section>;
}
export function ConfirmationReply({children}:{children:ReactNode}){
 return <div className="iatry-confirmation-reply"><span aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m5 10 3 3 7-7"/></svg></span><p>{children}</p></div>;
}
export type OperationFacts={title:string;kind:'service'|'customer'|'booking'|'period'|'record';rows:{label:string;value:string}[];interval?:{start:string;end:string;title:string}};
export function AgendaInterval({start,end,title,verified=false}:{start:string;end:string;title:string;verified?:boolean}){
 return <div className="iatry-agenda-interval" data-verified={verified}><div><time>{start}</time><span aria-hidden="true"/><time>{end}</time></div><section><PanelIcon name="clock"/><strong>{title}</strong><small>{verified?'Período verificado':'Vista previa del período'}</small></section></div>;
}
export function OperationPreview({facts,status,verified=false}:{facts:OperationFacts;status:string;verified?:boolean}){
 return <OperationCard title={facts.title} status={status} kind={facts.kind}><div className="iatry-operation-object" aria-hidden="true"><PanelIcon name={facts.kind==='service'?'service-create':facts.kind==='customer'?'users':facts.kind==='period'?'clock':'calendar'}/><span>{facts.kind==='period'?'Período de agenda':facts.kind==='booking'?'Reserva':facts.kind==='customer'?'Ficha de cliente':facts.kind==='service'?'Ficha de servicio':'Datos de la propuesta'}</span></div>{facts.interval&&<AgendaInterval {...facts.interval} verified={verified}/>}<dl>{facts.rows.filter(row=>!facts.interval||!['Desde','Hasta'].includes(row.label)).map((row,index)=><div key={index}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></OperationCard>;
}
