import type {Assistance} from './assistance';
import {GuidanceLink} from './GuidanceLink';
export function AssistanceCard({answer,onAsk}:{answer:Assistance;onAsk:(source:string)=>void}){
 return <section className="iatry-assistance stack" aria-label="Ayuda sobre el producto"><h3>{answer.title}</h3><p>{answer.text}</p>{answer.steps.length>0&&<ol>{answer.steps.map(step=><li key={step}>{step}</li>)}</ol>}<div className="actions">{answer.links.map(link=><GuidanceLink key={link.label} destination={link.destination}>{link.label}</GuidanceLink>)}</div>{answer.related.length>0&&<div className="stack"><span className="small muted">Podemos seguir con esto</span><div className="actions">{answer.related.map(prompt=><button type="button" className="iatry-v2-text" key={prompt} onClick={()=>onAsk(prompt)}>{prompt}</button>)}</div></div>}</section>;
}
