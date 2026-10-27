import type {Instruction} from './instructions';
import type {StepProgress} from './contracts';
const labels:Record<StepProgress,string>={pending:'Pendiente',active:'En curso',done:'Completado',error:'No completado',uncertain:'Resultado sin verificar'};
export function InstructionPlan({instruction,progress,busy,onChoose,onStart,onDismiss}:{instruction:Instruction;progress:StepProgress[];busy:boolean;onChoose:(index:number)=>void;onStart:(index:number)=>void;onDismiss:()=>void}){
 const halted=progress.some(p=>p==='error'||p==='uncertain');
 return <section className="iatry-instruction" aria-label="Interpretación de la instrucción"><h3>{instruction.clarification?'Aclaremos esto':instruction.steps.length>1?'Tu plan, paso a paso':'Esto es lo que entendí'}</h3>
 {instruction.notes.map((note,i)=><p key={i}>{note}</p>)}
 {instruction.clarification?<><p>{instruction.clarification.question}</p><div className="actions">{instruction.clarification.choices.map((choice,i)=><button className="btn secondary sm" type="button" key={i} disabled={busy||choice.steps.some(s=>!s.enabled)} onClick={()=>onChoose(i)}>{choice.label}{choice.steps.some(s=>!s.enabled)?' · pendiente de habilitación':''}</button>)}</div></>:<ol>{instruction.steps.map((step,i)=><li key={i}><strong>{step.title}</strong><span>{step.enabled?labels[progress[i]||'pending']:'Pendiente de validación para esta sesión'}</span><p>{step.effect}</p>{!progress[i]||progress[i]==='pending'?<button type="button" className="btn secondary sm" disabled={busy||!step.enabled||halted||progress.some(p=>p==='active')||instruction.steps.slice(0,i).some((_,j)=>progress[j]!=='done')} onClick={()=>onStart(i)}>{step.enabled?'Preparar este paso':'No habilitado'}</button>:null}</li>)}</ol>}
 {halted&&<p role="status">El plan se detuvo. Los pasos completados se conservan; los pendientes no se ejecutaron. No reintentaré automáticamente.</p>}
 <button type="button" className="iatry-v2-text" disabled={busy} onClick={onDismiss}>Descartar plan</button></section>;
}
