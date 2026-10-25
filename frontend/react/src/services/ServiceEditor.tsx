import {useRef,useState} from 'react';
import {Button,TextField} from '../ui/primitives';
import {Icon} from '../ui/Icon';
import type {FeaturePort,Staff,ServicePayload} from './contracts';
import {numericFields,toPayload,type Draft} from './form';
export function ServiceEditor({initial,staff,port,id,busy,onDraft,onSave}:{initial:Draft;staff:Staff[];port:FeaturePort;id?:string;busy:boolean;onDraft:(draft:Draft)=>void;onSave:(payload:ServicePayload)=>Promise<void>}){
 const [draft,setDraft]=useState(initial),[error,setError]=useState('');const saving=useRef(false);
 const change=(next:Draft)=>{setDraft(next);onDraft(next)};
 return <form data-react-form={id?'update-service':'create-service'} data-id={id} className="form-grid" onSubmit={async e=>{e.preventDefault();e.stopPropagation();if(saving.current||busy)return;try{const payload=toPayload(draft);saving.current=true;setError('');await onSave(payload)}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el servicio.')}finally{saving.current=false}}}>
  <TextField id="f-name" label="Nombre del servicio" name="name" value={draft.name} required minLength={2} onChange={e=>change({...draft,name:e.target.value})} readOnly={busy}/>
  {numericFields.map(([key,label,min,max])=><TextField key={key} id={'f-'+key} label={label} name={key} value={draft[key]} type="number" required={key==='price_uyu'||key==='duration_min'} min={min} max={max} step={1} onChange={e=>change({...draft,[key]:e.target.value})} readOnly={busy}/>)}
  <div className="field form-full"><label htmlFor="f-description">Descripción</label><textarea id="f-description" name="description" value={draft.description} onChange={e=>change({...draft,description:e.target.value})} readOnly={busy}/></div>
  <div className="field form-full"><label>Profesionales que ofrecen el servicio</label><div className="subtle-card stack">{staff.length?staff.map(person=><label key={person.id} className="checkline"><input type="checkbox" name="staff_ids" value={person.id} checked={draft.staff_ids.includes(person.id)} disabled={busy} onChange={e=>change({...draft,staff_ids:e.target.checked?[...draft.staff_ids,person.id]:draft.staff_ids.filter(id=>id!==person.id)})}/>{' '+person.name}</label>):<span className="small muted">Aún no hay profesionales.</span>}</div></div>
  <div className="form-full hint-block">Los porcentajes de seña se configuran aquí, pero el cobro online todavía no está conectado.</div>
  {error&&<p className="form-full small" role="alert">{error}</p>}
  <div className="form-full"><Button full type="submit" disabled={busy}>{busy?<><span className="spin"/> Guardando...</>:<><Icon name="check" port={port}/> Guardar servicio</>}</Button></div>
 </form>;
}
