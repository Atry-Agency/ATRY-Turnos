import {useEffect,useState,type RefObject} from 'react';
/** The assistant becomes modal only on compact screens; desktop keeps its side rail. */
export function useMobileSheet(root:RefObject<HTMLElement|null>,open:boolean){
 const [compact,setCompact]=useState(()=>matchMedia('(max-width:767px)').matches);
 useEffect(()=>{const query=matchMedia('(max-width:767px)'),change=()=>setCompact(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change)},[]);
 const modal=open&&compact;
 useEffect(()=>{
  const section=root.current;if(!modal||!section)return;
  const previous=new Map<HTMLElement,boolean>();
  // Isolate siblings along the portal's ancestor path, without making the assistant inert.
  let node:HTMLElement=section;
  while(node.parentElement){for(const sibling of node.parentElement.children){if(sibling instanceof HTMLElement&&sibling!==node&&!sibling.hasAttribute('data-iatry-mobile-backdrop')&&!['SCRIPT','STYLE','LINK'].includes(sibling.tagName)){previous.set(sibling,sibling.inert);sibling.inert=true}}node=node.parentElement;if(node===document.body)break}
  const body=document.body,style={position:body.style.position,top:body.style.top,width:body.style.width,overflow:body.style.overflow},scroll=window.scrollY;
  Object.assign(body.style,{position:'fixed',top:`-${scroll}px`,width:'100%',overflow:'hidden'});
  const viewport=window.visualViewport;
  const resize=()=>{section.style.setProperty('--iatry-viewport-height',`${viewport?.height??window.innerHeight}px`);section.style.setProperty('--iatry-viewport-top',`${viewport?.offsetTop??0}px`)};
  resize();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);
  const panel=()=>section.querySelector<HTMLElement>('#iatry-v2-panel');
  let focused=false;const focusInitial=()=>{const close=panel()?.querySelector<HTMLElement>('[aria-label="Cerrar IAtry"]');if(close&&!focused){focused=true;close.focus({preventScroll:true});observer.disconnect()}};const observer=new MutationObserver(focusInitial);observer.observe(section,{childList:true,subtree:true});focusInitial();
  const focusables=()=>Array.from(panel()?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]')||[]).filter(el=>el.getClientRects().length&&!el.closest('[hidden],[inert]'));
  const keydown=(event:KeyboardEvent)=>{if(event.key!=='Tab')return;const elements=focusables();event.preventDefault();if(!elements.length){panel()?.focus();return}const index=elements.indexOf(document.activeElement as HTMLElement),next=index<0?(event.shiftKey?elements.length-1:0):(index+(event.shiftKey?-1:1)+elements.length)%elements.length;elements[next].focus({preventScroll:true})};
  document.addEventListener('keydown',keydown);
  return()=>{observer.disconnect();document.removeEventListener('keydown',keydown);viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);previous.forEach((inert,el)=>{el.inert=inert});Object.assign(body.style,style);window.scrollTo({top:scroll,behavior:'instant'});section.style.removeProperty('--iatry-viewport-height');section.style.removeProperty('--iatry-viewport-top')};
 },[modal,root]);
 return modal;
}
