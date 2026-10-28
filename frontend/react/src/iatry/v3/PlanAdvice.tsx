import type {PlanAdviceResult} from './plan-advisor';
import {taxLabel} from '../../subscription/model';
import './plan-advice.css';
/** Presentation only: navigating never requests a plan, payment or external contact. */
export function PlanAdvice({advice}:{advice:PlanAdviceResult}){
 if(advice.kind!=='recommendation')return <p className="iatry-plan-advice-note">{advice.message}</p>;
 return <section className="iatry-plan-advice" aria-label="Sugerencia de plan"><span className="iatry-plan-advice-label">PARA TU PRÓXIMO PASO</span><h3>{advice.title}</h3><p>{advice.reason}</p><p>{advice.message}</p>{advice.priceUyu!==undefined&&<p className="iatry-plan-advice-price">{new Intl.NumberFormat('es-UY',{style:'currency',currency:'UYU',maximumFractionDigits:0}).format(advice.priceUyu)} <span>UYU / mes</span></p>}{advice.priceUyu!==undefined&&<small>{taxLabel(advice.taxStatus||'pending')}</small>}<a href={advice.href}>Comparar planes <span aria-hidden="true">→</span></a><small>Tu plan sigue igual. La solicitud y la habilitación se coordinan desde Mi plan y acceso. Las operaciones pendientes de IAtry conservan sus restricciones.</small></section>;
}
