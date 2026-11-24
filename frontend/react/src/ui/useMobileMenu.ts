import {useEffect,useRef,useState,type Dispatch,type RefObject,type SetStateAction} from 'react';

const mobileQuery='(max-width:1000px)';
/** Modal semantics only while the responsive drawer is open; desktop remains a normal sidebar. */
export function useMobileMenu(open:boolean,setOpen:Dispatch<SetStateAction<boolean>>,sidebar:RefObject<HTMLElement|null>,trigger:RefObject<HTMLButtonElement|null>){
 const [mobile,setMobile]=useState(()=>window.matchMedia(mobileQuery).matches);
 const active=mobile&&open,close=useRef(()=>setOpen(false));
 close.current=()=>setOpen(false);
 useEffect(()=>{
  const query=window.matchMedia(mobileQuery);
  const change=()=>{setMobile(query.matches);if(!query.matches)setOpen(false)};
  query.addEventListener('change',change);
  return()=>query.removeEventListener('change',change);
 },[setOpen]);
 useEffect(()=>{
  if(!active||!sidebar.current)return;
  const panel=sidebar.current;
  const focusable=()=>Array.from(panel.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex="0"]')).filter(node=>!node.matches(':disabled,[inert],[aria-hidden=true]')&&node.getClientRects().length);
  focusable()[0]?.focus({preventScroll:true});
  // Isolate the rest of the app, including notices and portal siblings. Never hide an ancestor of the drawer.
  const isolated:{element:HTMLElement;inert:boolean;hidden:string|null}[]=[];
  for(let branch:HTMLElement=panel;branch.parentElement&&branch!==document.body;branch=branch.parentElement){
   for(const sibling of Array.from(branch.parentElement.children)){
    if(sibling===branch||!(sibling instanceof HTMLElement)||sibling.hasAttribute('data-sidebar-backdrop')||sibling.matches('script,style,link'))continue;
    isolated.push({element:sibling,inert:sibling.inert,hidden:sibling.getAttribute('aria-hidden')});
    sibling.inert=true;sibling.setAttribute('aria-hidden','true');
   }
  }
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();close.current();return}
   if(event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey)return;
   const nodes=focusable(),index=nodes.indexOf(document.activeElement as HTMLElement);
   event.preventDefault();
   // Safari may skip buttons in its default Tab order. Traverse the same usable controls in both engines.
   const next=event.shiftKey?(index<=0?nodes.length-1:index-1):(index+1)%nodes.length;
   nodes[next]?.focus();
  };
  document.addEventListener('keydown',key);
  return()=>{
   document.removeEventListener('keydown',key);
   for(const {element,inert,hidden}of isolated){element.inert=inert;if(hidden===null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',hidden)}
   const button=trigger.current;
   // A successful navigation already focuses the destination heading; do not steal that focus.
   if(panel.contains(document.activeElement)||document.activeElement===document.body){if(button?.isConnected&&button.getClientRects().length)button.focus({preventScroll:true})}
  };
 },[active,sidebar,trigger]);
 return{modal:active,hidden:mobile&&!open};
}
