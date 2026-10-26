import {useEffect,useState,type RefObject} from 'react';
/** The assistant becomes modal only on compact screens; desktop keeps its side rail. */
export function useMobileSheet(root:RefObject<HTMLElement|null>,open:boolean,panelId='iatry-v2-panel'){
 const [compact,setCompact]=useState(()=>matchMedia('(max-width:767px)').matches);
 useEffect(()=>{const query=matchMedia('(max-width:767px)'),change=()=>setCompact(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change)},[]);
 const modal=open&&compact;
 useEffect(()=>{
  const section=root.current;if(!modal||!section)return;
  const previous=new Map<HTMLElement,boolean>();
  // Isolate siblings along the portal's ancestor path, without making the assistant inert.
  let node:HTMLElement=section;
  while(node.parentElement){for(const sibling of node.parentElement.children){if(sibling instanceof HTMLElement&&sibling!==node&&!sibling.hasAttribute('data-iatry-mobile-backdrop')&&!['SCRIPT','STYLE','LINK'].includes(sibling.tagName)){previous.set(sibling,sibling.inert);sibling.inert=true}}node=node.parentElement;if(node===document.body)break}
  const scrollParents=new Map<HTMLElement,string>();let parent=section.parentElement;while(parent&&parent!==document.body){const css=getComputedStyle(parent);if(/auto|scroll/.test(css.overflowY)){scrollParents.set(parent,parent.style.overflow);parent.style.overflow='hidden'}parent=parent.parentElement}
  const html=document.documentElement,htmlOverflow=html.style.overflow;html.style.overflow='hidden';
  const body=document.body,style={position:body.style.position,top:body.style.top,width:body.style.width,overflow:body.style.overflow},scroll=window.scrollY;
  Object.assign(body.style,{position:'fixed',top:`-${scroll}px`,width:'100%',overflow:'hidden'});
  const viewport=window.visualViewport;
  const resize=()=>{section.style.setProperty('--iatry-viewport-height',`${viewport?.height??window.innerHeight}px`);section.style.setProperty('--iatry-viewport-top',`${viewport?.offsetTop??0}px`)};
  resize();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);
  const panel=()=>section.querySelector<HTMLElement>('#'+panelId);
  // iOS can transfer a pan to an ancestor even with overscroll-behavior/inert.
  // Cancel only a gesture which no scrollable descendant of the panel can consume.
  const canScroll=(target:EventTarget|null,delta:number,horizontal:boolean)=>{
   const box=panel();let node=target instanceof Element?target:null;
   if(!box||!node||!box.contains(node))return false;
   while(node&&box.contains(node)){
    if(node instanceof HTMLElement){const css=getComputedStyle(node),overflow=horizontal?css.overflowX:css.overflowY,position=horizontal?node.scrollLeft:node.scrollTop,max=horizontal?node.scrollWidth-node.clientWidth:node.scrollHeight-node.clientHeight;
     if(/auto|scroll|overlay/.test(overflow)&&max>1&&(delta<0?position>1:position<max-1))return true;
    }
    node=node.parentElement;
   }
   return false;
  };
  let touch:{x:number;y:number}|null=null;
  const touchstart=(event:TouchEvent)=>{touch=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null};
  const touchmove=(event:TouchEvent)=>{if(event.touches.length!==1||!touch)return;const next=event.touches[0],dx=touch.x-next.clientX,dy=touch.y-next.clientY;touch={x:next.clientX,y:next.clientY};if(Math.abs(dx)+Math.abs(dy)<2)return;if(event.target instanceof Element&&event.target.closest('input[type=range]')&&panel()?.contains(event.target))return;const horizontal=Math.abs(dx)>Math.abs(dy);if(!canScroll(event.target,horizontal?dx:dy,horizontal)&&event.cancelable)event.preventDefault()};
  const wheel=(event:WheelEvent)=>{if(event.ctrlKey)return;const horizontal=Math.abs(event.deltaX)>Math.abs(event.deltaY);if(!canScroll(event.target,horizontal?event.deltaX:event.deltaY,horizontal)&&event.cancelable)event.preventDefault()};
  document.addEventListener('touchstart',touchstart,{capture:true,passive:true});
  document.addEventListener('touchmove',touchmove,{capture:true,passive:false});
  document.addEventListener('wheel',wheel,{capture:true,passive:false});

  let focused=false;const focusInitial=()=>{const close=panel()?.querySelector<HTMLElement>('[aria-label="Cerrar IAtry"]');if(close&&!focused){focused=true;close.focus({preventScroll:true});observer.disconnect()}};const observer=new MutationObserver(focusInitial);observer.observe(section,{childList:true,subtree:true});focusInitial();
  const focusables=()=>Array.from(panel()?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]')||[]).filter(el=>el.getClientRects().length&&!el.closest('[hidden],[inert]'));
  const keydown=(event:KeyboardEvent)=>{if(event.key!=='Tab')return;const elements=focusables();event.preventDefault();if(!elements.length){panel()?.focus();return}const index=elements.indexOf(document.activeElement as HTMLElement),next=index<0?(event.shiftKey?elements.length-1:0):(index+(event.shiftKey?-1:1)+elements.length)%elements.length;elements[next].focus({preventScroll:true})};
  document.addEventListener('keydown',keydown);
  return()=>{document.removeEventListener('touchstart',touchstart,true);document.removeEventListener('touchmove',touchmove,true);document.removeEventListener('wheel',wheel,true);scrollParents.forEach((overflow,node)=>{node.style.overflow=overflow});html.style.overflow=htmlOverflow;observer.disconnect();document.removeEventListener('keydown',keydown);viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);previous.forEach((inert,el)=>{el.inert=inert});Object.assign(body.style,style);window.scrollTo({top:scroll,behavior:'instant'});section.style.removeProperty('--iatry-viewport-height');section.style.removeProperty('--iatry-viewport-top')};
 },[modal,root,panelId]);
 return modal;
}
