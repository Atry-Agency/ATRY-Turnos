import {useLayoutEffect,useRef} from 'react';
/** Presentation only: never delays updates, reads data or changes focus/scroll. */
export function useContentMotion<T extends HTMLElement>(key:string,enter=false){
 const ref=useRef<T>(null),first=useRef(true);
 useLayoutEffect(()=>{
  const initial=first.current;first.current=false;
  const node=ref.current,preference=matchMedia('(prefers-reduced-motion: reduce)');
  if(!node||initial&&!enter||preference.matches||node.closest('[data-motion-off]')||typeof node.animate!=='function')return;
  const animation=node.animate([{opacity:.72,transform:'translateY(3px)'},{opacity:1,transform:'none'}],{duration:160,easing:'cubic-bezier(.2,.7,.25,1)'});
  const stop=()=>animation.cancel();preference.addEventListener('change',stop);
  return()=>{stop();preference.removeEventListener('change',stop)};
 },[key,enter]);return ref;
}
