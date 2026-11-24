import {useId,useLayoutEffect,useRef,useState} from 'react';

const statuses=[['confirmed','Confirmados'],['pending','Pendientes'],['completed','Completados'],['cancelled','Cancelados'],['no_show','Ausentes']];

/** Presentation only: keep the existing filter values, counts and change handler. */
export function PeriodStatusFilters({selected,counts,onChange}:{selected:string;counts:Record<string,number>;onChange:(status:string)=>void}){
 const ref=useRef<HTMLDivElement>(null),hint=useId(),[edges,setEdges]=useState({start:false,end:false});
 useLayoutEffect(()=>{
  const row=ref.current;if(!row)return;
  const measure=()=>{const start=row.scrollLeft>1,end=row.scrollWidth-row.clientWidth-row.scrollLeft>1;setEdges(old=>old.start===start&&old.end===end?old:{start,end})};
  const reveal=()=>{
   const active=row.querySelector<HTMLElement>('[aria-pressed=true]');
   if(active){const box=row.getBoundingClientRect(),item=active.getBoundingClientRect();
    if(item.left<box.left+8)row.scrollLeft-=box.left+8-item.left;
    else if(item.right>box.right-8)row.scrollLeft+=item.right-box.right+8;
   }
   measure();
  };
  const observer=new ResizeObserver(reveal);observer.observe(row);for(const button of row.children)observer.observe(button);
  row.addEventListener('scroll',measure,{passive:true});reveal();
  return()=>{observer.disconnect();row.removeEventListener('scroll',measure)};
 },[selected]);
 return <div className="ag-summary-frame" data-overflow-start={edges.start} data-overflow-end={edges.end}>
  <div ref={ref} className="ag-summary" role="group" aria-label="Resumen del período filtrado" aria-describedby={edges.start||edges.end?hint:undefined}>
   {statuses.map(([status,label])=><button key={status} aria-pressed={selected===status} onClick={()=>onChange(status)}><i className={'ag-state-dot ag-state-dot--'+status}/><span>{label}</span><strong>{counts[status]||0}</strong></button>)}
  </div>
  {(edges.start||edges.end)&&<p id={hint} className="ag-summary-hint">Deslizá para ver todos los estados</p>}
 </div>;
}
