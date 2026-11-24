import type {AppPort} from '../app/port';
import {Icon} from '../ui/Icon';
import {money} from '../domain/format';
import {commercialLabels} from '../subscription/model';
import {number,object,string,type Data} from './api';
import {ActionButton,type OpenAction} from './Shared';

/** Presentation only: the existing plan record and edit action remain authoritative. */
export function PlanCards({plans,port,open}:{plans:Data[];port:AppPort;open:OpenAction}){
 if(!plans.length)return <div className="cc-empty">No hay planes disponibles en esta consulta.</div>;
 return <div className="cc-plan-grid">{plans.map(p=><article className="cc-plan-card" key={string(p,'code')} aria-label={string(p,'name')}>
  <header><h3>{string(p,'name')}</h3><p className="cc-plan-price"><strong>{money(number(p,'price_uyu'))}</strong><span>UYU / mes</span></p></header>
  <dl className="cc-plan-limits"><div><dt>Profesionales</dt><dd>{number(p,'staff_limit')}</dd></div><div><dt>Correos / ciclo</dt><dd>{number(p,'mail_limit')}</dd></div></dl>
  <ul className="cc-plan-features" aria-label="Capacidades independientes">{['statistics','advanced','exports'].map(key=>{const enabled=Boolean(object(p,'features')[key]);return <li key={key} data-enabled={enabled}><Icon name={enabled?'check':'x'} port={port}/><span>{commercialLabels[key]}</span><span className="cc-plan-feature-state">{enabled?'Sí':'No'}</span></li>})}</ul>
  <ActionButton kind="plan" id={string(p,'code')} label="Ajustar plan" extra={{plan:p}} open={open}/>
 </article>)}</div>;
}
