import {useEffect,useId,useRef,useState} from 'react';
import type {Field,Values} from './contracts';
export function Question({field,onAnswer,busy}:{field:Field;onAnswer:(value:Values[string])=>void;busy:boolean}){
 const [value,setValue]=useState<Values[string]>(field.value??''),id=useId(),input=useRef<HTMLInputElement|HTMLSelectElement|null>(null);
 useEffect(()=>{input.current?.focus({preventScroll:true})},[]);
 const required=field.required&&field.type!=='checkbox';
 return <form className="iatry-operation-question" onSubmit={e=>{e.preventDefault();onAnswer(value)}}>
  <label className="iatry-operation-prompt" htmlFor={id}>{field.label}</label>
  {field.hint&&<p id={id+'-hint'}>{field.hint}</p>}
  {field.type==='multiple'?<fieldset id={id} className="iatry-operation-choices"><legend className="sr-only">{field.label}</legend>{field.options?.map(option=><label key={option.value}><input type="checkbox" value={option.value} checked={Array.isArray(value)&&value.includes(option.value)} disabled={busy} onChange={e=>{const selected=Array.isArray(value)?value:[];setValue(e.target.checked?[...selected,option.value]:selected.filter(x=>x!==option.value))}}/><span>{option.label}</span></label>)}</fieldset>
  :field.type==='select'?<select ref={node=>{input.current=node}} id={id} name={field.key} required={required} value={String(value)} disabled={busy} onChange={e=>setValue(e.target.value)}><option value="">Elegí una opción</option>{field.options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>
  :field.type==='checkbox'?<label className="checkline"><input ref={node=>{input.current=node}} id={id} name={field.key} type="checkbox" checked={Boolean(value)} disabled={busy} onChange={e=>setValue(e.target.checked)}/>Sí</label>
  :<input ref={node=>{input.current=node}} id={id} name={field.key} type={field.type} required={required} min={field.min} max={field.max} maxLength={field.maxLength??2000} value={String(value)} disabled={busy} autoComplete="off" onChange={e=>setValue(e.target.value)}/>}
  {(field.type==='select'||field.type==='multiple')&&!field.options?.length&&<p role="status">No hay opciones autorizadas disponibles. Podés volver o cancelar.</p>}
  <button type="submit" className="btn sm" disabled={busy||(field.type==='select'&&field.required&&!field.options?.length)}>Continuar</button>
 </form>;
}
