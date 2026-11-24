import type {ReactNode} from 'react';
import {PanelIcon} from '../v3/PanelIcon';
import './response-card.css';

/** Structured information only. Callers retain routing, permissions and execution state. */
export function ResponseCard({title,icon='info',description,children,className='',label}:{title:string;icon?:string;description?:string;children:ReactNode;className?:string;label?:string}){
 return <section className={'iatry-response '+className} aria-label={label||title}>
  <ResponseHeading title={title} icon={icon} description={description}/>
  <div className="iatry-response-content">{children}</div>
 </section>;
}
export function ResponseHeading({title,icon='info',description}:{title:string;icon?:string;description?:string}){
 return <header className="iatry-response-heading"><span className="iatry-response-symbol"><PanelIcon name={icon}/></span><div><h3>{title}</h3>{description&&<p>{description}</p>}</div></header>;
}
export function destinationIcon(route=''){
 if(/agenda|turnos-fijos/.test(route))return 'calendar';
 if(/disponibilidad/.test(route))return 'clock';
 if(/clientes|equipo|accesos|cuenta/.test(route))return 'users';
 if(/servicios/.test(route))return 'service';
 if(/estadisticas|insights/.test(route))return 'chart';
 if(/configuracion/.test(route))return 'settings';
 return 'info';
}
