import {useLayoutEffect,useRef,type RefObject} from 'react';
import type {Booking} from './model';
/** Observe confirmed resource snapshots only; never proposes or executes booking changes. */
export function useBookingFeedback(root:RefObject<HTMLDivElement|null>,bookings:Booking[]|undefined,range:string){
 const previous=useRef<{range:string;items:Map<string,string>}|null>(null);
 useLayoutEffect(()=>{
  if(!bookings)return;
  const items=new Map(bookings.map(b=>[b.id,JSON.stringify([b.starts_at,b.ends_at,b.status,b.staff_id,b.service_id])])),before=previous.current;previous.current={range,items};
  const preference=matchMedia('(prefers-reduced-motion: reduce)');if(!before||before.range!==range||preference.matches)return;
  const layers:HTMLElement[]=[],animations:Animation[]=[];
  for(const node of root.current?.querySelectorAll<HTMLElement>('[data-booking-id]')||[]){const id=node.dataset.bookingId!;if(!items.has(id)||before.items.get(id)===items.get(id))continue;const layer=document.createElement('span');layer.className='ag-updated-feedback';layer.setAttribute('aria-hidden','true');node.append(layer);layers.push(layer);const a=layer.animate([{opacity:.16},{opacity:0}],{duration:450,easing:'ease-out'});animations.push(a);void a.finished.then(()=>layer.remove(),()=>layer.remove())}
  const stop=()=>{animations.forEach(a=>a.cancel());layers.forEach(n=>n.remove())};preference.addEventListener('change',stop);return()=>{stop();preference.removeEventListener('change',stop)};
 },[bookings,range,root]);
}
