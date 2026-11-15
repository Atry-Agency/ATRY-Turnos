import {region,type RegionalBusiness} from '../domain/region';
import {useRef,useState} from 'react';
import {Button,TextField} from '../ui/primitives';
import {Icon} from '../ui/Icon';
import type {FeaturePort,Staff,ServicePayload} from './contracts';
import {numericFields,toPayload,type Draft} from './form';
export function ServiceEditor({business={},initial,staff,port,id,busy,onDraft,onSave}:{business?:RegionalBusiness;initial:Draft;staff:Staff[];port:FeaturePort;id?:string;busy:boolean;onDraft:(draft:Draft)=>void;onSave:(payload:ServicePayload)=>Promise<void>}){
 const [draft,setDraft]=useState(initial),[error,setError]=useState('');const saving=useRef(false),advanced=useRef<HTMLDetailsElement>(null);const [advancedOpen,setAdvancedOpen]=useState(()=>numericFields.slice(2).some(([key])=>Number(initial[key])>0));
 const change=(next:Draft)=>{setDraft(next);onDraft(next)};
 return <form data-react-form={id?'update-service':'create-service'} data-id={id} className="form-grid service-editor" onInvalidCapture={e=>{if(advanced.current?.contains(e.target as Node)){advanced.current.open=true;setAdvancedOpen(true)}}} onSubmit={async e=>{e.preventDefault();e.stopPropagation();if(saving.current||busy)return;try{const payload=toPayload(draft,business);saving.current=true;setError('');await onSave(payload)}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el servicio.')}finally{saving.current=false}}}>
  <TextField id="f-name" fieldClassName="form-full" label="Nombre del servicio" name="name" value={draft.name} required minLength={2} onChange={e=>change({...draft,name:e.target.value})} readOnly={busy}/>
  {numericFields.filter(([key])=>key==='price_uyu'||key==='duration_min').map(([key,label,min,max])=><TextField key={key} id={'f-'+key} label={key==='price_uyu'&&region(business).currency==='USD'?'Precio (USD)':label} name={key} value={draft[key]} type="number" required={key==='price_uyu'||key==='duration_min'} min={min} max={max} step={key==='price_uyu'&&region(business).currency==='USD'?'0.01':1} onChange={e=>change({...draft,[key]:e.target.value})} readOnly={busy}/>)}
  <div className="field form-full"><label htmlFor="f-description">Descripción</label><textarea id="f-description" name="description" value={draft.description} onChange={e=>change({...draft,description:e.target.value})} readOnly={busy}/></div>
  <fieldset className="field form-full service-staff"><legend>Profesionales que ofrecen el servicio</legend><div className="subtle-card stack">{staff.length?staff.map(person=><label key={person.id} className="checkline"><input type="checkbox" name="staff_ids" value={person.id} checked={draft.staff_ids.includes(person.id)} disabled={busy} onChange={e=>change({...draft,staff_ids:e.target.checked?[...draft.staff_ids,person.id]:draft.staff_ids.filter(id=>id!==person.id)})}/>{' '+person.name}</label>):<span className="small muted">Aún no hay profesionales.</span>}</div></fieldset>

  <details ref={advanced} className="form-full service-advanced" open={advancedOpen} onToggle={e=>setAdvancedOpen(e.currentTarget.open)}><summary><Icon name="settings" port={port}/><span><strong>Seña y tiempos adicionales</strong><small>{[Number(draft.deposit_percent)>0?'Seña '+draft.deposit_percent+'%':'Sin seña',Number(draft.buffer_before_min)>0?'Preparación '+draft.buffer_before_min+' min':null,Number(draft.buffer_after_min)>0?'Limpieza '+draft.buffer_after_min+' min':null].filter(Boolean).join(' · ')+(Number(draft.buffer_before_min)===0&&Number(draft.buffer_after_min)===0?' · Sin tiempos adicionales':'')}</small></span><Icon name="chevron" port={port}/></summary><div className="form-grid service-advanced-fields">
  {numericFields.filter(([key])=>key!=='price_uyu'&&key!=='duration_min').map(([key,label,min,max])=><TextField key={key} id={'f-'+key} label={key==='price_uyu'&&region(business).currency==='USD'?'Precio (USD)':label} name={key} value={draft[key]} type="number" required={key==='price_uyu'||key==='duration_min'} min={min} max={max} step={key==='price_uyu'&&region(business).currency==='USD'?'0.01':1} onChange={e=>change({...draft,[key]:e.target.value})} readOnly={busy}/>)}
  <div className="form-full hint-block">Los porcentajes de seña se configuran aquí, pero el cobro online todavía no está conectado.</div>
  </div></details>
  {error&&<p className="form-full small" role="alert">{error}</p>}
  <div className="form-full"><Button full type="submit" disabled={busy}>{busy?<><span className="spin"/> Guardando...</>:<><Icon name="check" port={port}/> Guardar servicio</>}</Button></div>
 </form>;
}
