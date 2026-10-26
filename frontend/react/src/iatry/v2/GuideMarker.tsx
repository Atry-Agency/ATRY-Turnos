import {useEffect,useId,useState} from 'react';
import {createPortal} from 'react-dom';
import {autoUpdate,flip,offset,shift,useFloating} from '@floating-ui/react-dom';
export function usable(node:HTMLElement|undefined):node is HTMLElement{return Boolean(node?.isConnected&&node.getClientRects().length&&!node.matches(':disabled,[aria-disabled=true]'))}
export function GuideMarker({target,text,reduced,onUnavailable}:{target:HTMLElement;text:string;reduced:boolean;onUnavailable:()=>void}){
 const id=useId(),[safe,setSafe]=useState(false);
 const {refs,floatingStyles}=useFloating({elements:{reference:target},strategy:'fixed',placement:'top',middleware:[offset(9),flip(),shift({padding:12})],whileElementsMounted:(a,b,update)=>autoUpdate(a,b,update,{animationFrame:false})});
 useEffect(()=>{if(!usable(target)){onUnavailable();return}target.classList.add('iatry-v2-target');const oldTab=target.getAttribute('tabindex');if(!target.matches('button,input,textarea,select,a[href],[tabindex]'))target.setAttribute('tabindex','-1');const old=target.getAttribute('aria-describedby')||'';target.setAttribute('aria-describedby',[...old.split(/\s+/).filter(Boolean),id].join(' '));
 const typing=document.activeElement?.matches('input,textarea,select,[contenteditable=true]');if(!typing){if(!target.matches('input,textarea,select')||!matchMedia('(pointer:coarse)').matches)target.focus({preventScroll:true});target.scrollIntoView({block:'nearest',behavior:reduced?'instant':'smooth'})}
 const check=()=>{if(!usable(target))onUnavailable()};window.addEventListener('resize',check);return()=>{target.classList.remove('iatry-v2-target');if(oldTab===null)target.removeAttribute('tabindex');else target.setAttribute('tabindex',oldTab);const ids=(target.getAttribute('aria-describedby')||'').split(/\s+/).filter(x=>x&&x!==id).join(' ');if(ids)target.setAttribute('aria-describedby',ids);else target.removeAttribute('aria-describedby');window.removeEventListener('resize',check)};
 // Preference/visibility changes must not refocus or scroll a control during work.
 },[target,id]);
 useEffect(()=>{const check=()=>{const marker=refs.floating.current;if(!marker)return;const a=marker.getBoundingClientRect(),nodes=document.querySelectorAll('button,input,textarea,select,a[href]');setSafe(!Array.from(nodes).some(n=>{if(n===target||marker.contains(n))return false;const b=n.getBoundingClientRect();return b.width>0&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top}))};check()},[floatingStyles.transform,refs.floating,target]);
 return <><span id={id} className="sr-only">{text}</span>{createPortal(<span ref={refs.setFloating} style={{...floatingStyles,visibility:safe?'visible':'hidden'}} className="iatry-v2-marker" aria-hidden="true">Acá es · IAtry</span>,document.body)}</>;
}
