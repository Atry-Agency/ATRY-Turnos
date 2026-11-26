import {useLayoutEffect,useRef,useState} from 'react';
import type {AppPort} from '../app/port';
import {Icon} from '../ui/Icon';

const tabs=[['identity','Identidad','shop'],['themes','Temas','spark'],['components','Detalles','grid'],['public','Página pública','external']];
/** Preserve the existing buttons and selection model; reveal horizontal continuation and the active item. */
export function StudioTabs({active,onChange,port}:{active:string;onChange:(id:string)=>void;port:AppPort}){
 const previous=useRef<{left:number;top:number;width:number;height:number}|null>(null);
 const ref=useRef<HTMLElement>(null),[edges,setEdges]=useState({start:false,end:false});
 useLayoutEffect(()=>{
  const nav=ref.current;if(!nav)return;
  let live=true;
  const measure=()=>{
   const start=nav.scrollLeft>1,end=nav.scrollWidth-nav.clientWidth-nav.scrollLeft>1;
   setEdges(old=>old.start===start&&old.end===end?old:{start,end});
  };
  const reveal=()=>{
   const selected=nav.querySelector<HTMLElement>('[aria-pressed=true]');
   if(selected){const item=selected.getBoundingClientRect(),box=nav.getBoundingClientRect(),padding=8;
    if(item.left<box.left+padding)nav.scrollLeft-=box.left+padding-item.left;
    else if(item.right>box.right-padding)nav.scrollLeft+=item.right-box.right+padding;
   }
   measure();
  };
  const observer=new ResizeObserver(reveal);observer.observe(nav);
  nav.addEventListener('scroll',measure,{passive:true});reveal();
  void document.fonts.ready.then(()=>{if(live)reveal()});
  return()=>{live=false;observer.disconnect();nav.removeEventListener('scroll',measure)};
 },[active]);
 useLayoutEffect(()=>{const nav=ref.current,selected=nav?.querySelector<HTMLElement>('[aria-pressed=true]');if(!nav||!selected)return;const box=nav.getBoundingClientRect(),rect=selected.getBoundingClientRect(),next={left:rect.left-box.left+nav.scrollLeft,top:rect.top-box.top,width:rect.width,height:rect.height},old=previous.current;previous.current=next;if(!old||matchMedia('(prefers-reduced-motion: reduce)').matches||old.top!==next.top||nav.scrollWidth>nav.clientWidth)return;const layer=document.createElement('span');layer.className='ts-tab-motion';layer.setAttribute('aria-hidden','true');layer.style.cssText=`left:${next.left}px;top:${next.top}px;width:${next.width}px;height:${next.height}px`;nav.append(layer);const preference=matchMedia('(prefers-reduced-motion: reduce)'),a=layer.animate([{transform:`translateX(${old.left-next.left}px) scaleX(${old.width/next.width})`},{transform:'none'}],{duration:160,easing:'ease-out'});const stop=()=>{a.cancel();layer.remove()};preference.addEventListener('change',stop);void a.finished.then(()=>layer.remove(),()=>layer.remove());return()=>{stop();preference.removeEventListener('change',stop)}},[active]);
 return <div className="ts-tabs-frame" data-overflow-start={edges.start} data-overflow-end={edges.end}><nav ref={ref} className="ts-tabs" aria-label="Personalización">{tabs.map(([id,title,icon])=><button type="button" key={id} aria-pressed={active===id} onClick={()=>onChange(id)}><Icon name={icon} port={port}/>{title}</button>)}</nav></div>;
}
