import type {Assistance} from './assistance';
import {ResponseCard,destinationIcon} from '../shared/ResponseCard';
import {PanelIcon} from './PanelIcon';
import {GuidanceLink} from './GuidanceLink';
export function AssistanceCard({answer,onAsk}:{answer:Assistance;onAsk:(source:string)=>void}){
 const icon=destinationIcon(answer.links[0]?.destination.route);
 return <ResponseCard className="iatry-assistance" label="Ayuda sobre el producto" title={answer.title} icon={icon} description={answer.text}>
  {answer.steps.length>0&&<ol className="iatry-response-steps">{answer.steps.map(step=><li key={step}><span>{step}</span></li>)}</ol>}
  {answer.links.length>0&&<div className="iatry-response-actions">{answer.links.map((link,index)=><GuidanceLink key={link.label} destination={link.destination} primary={index===0} className="iatry-response-action"><PanelIcon name={destinationIcon(link.destination.route)}/><span>{link.label}</span></GuidanceLink>)}</div>}
  {answer.related.length>0&&<section className="iatry-response-related" aria-label="Consultas relacionadas"><h4>También puedo ayudarte con</h4><div>{answer.related.map(prompt=><button type="button" className="iatry-response-option" key={prompt} onClick={()=>onAsk(prompt)}><span>{prompt}</span><PanelIcon name="chevron"/></button>)}</div></section>}
 </ResponseCard>;
}
