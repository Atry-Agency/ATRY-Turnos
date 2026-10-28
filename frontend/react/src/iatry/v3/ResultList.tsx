import {useEffect,useState} from 'react';
import {OperationPreview} from '../shared/OperationCard';
import type {Result} from './contracts';
import './result-list.css';
export function ResultList({result,kind,onSelect}:{result:Result;kind:'service'|'customer'|'booking'|'record';onSelect:(id:string)=>boolean}){
 const [selected,setSelected]=useState<number>(),[limit,setLimit]=useState(5);
 useEffect(()=>{setSelected(undefined);setLimit(5)},[result]);
 const items=result.items||[],item=selected===undefined?undefined:items[selected];
 return <><ol className="iatry-result-list" aria-label="Resultados de la consulta">{items.slice(0,limit).map((row,i)=><li key={row.id||i}><button type="button" aria-expanded={selected===i} onClick={()=>{if(row.id)onSelect(row.id);setSelected(selected===i?undefined:i)}}><span className="iatry-result-number" aria-hidden="true">{i+1}</span><span><strong>{row.title}</strong>{row.detail&&<small>{row.detail}</small>}</span><span className="iatry-result-chevron" aria-hidden="true">{selected===i?'−':'›'}</span></button></li>)}</ol>{items.length>limit&&<button type="button" className="iatry-v2-text" onClick={()=>setLimit(n=>n+10)}>Ver más resultados ({items.length-limit})</button>}{item&&<div className="iatry-result-detail"><OperationPreview facts={{title:item.title,kind,rows:item.detail?[{label:'Información consultada',value:item.detail}]:[]}} status="Información consultada"/></div>}</>;
}
