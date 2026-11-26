import {useEffect,useLayoutEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {useFloating,offset,flip,shift,autoUpdate} from '@floating-ui/react-dom';
import {Icon} from '../ui/Icon';
import type {AppPort} from '../app/port';
import './agenda-overlays.css';
/** Transient controls never enter calendar layout. Compact screens use a native modal sheet. */
export function AgendaOverlay({id,title,trigger,onClose,port,children}:{id:string;title:string;trigger:RefObject<HTMLButtonElement|null>;onClose:()=>void;port:AppPort;children:ReactNode}){
 const sheet=useRef<HTMLDialogElement>(null);
 const [compact,setCompact]=useState(()=>matchMedia('(max-width:600px)').matches),close=useRef(onClose);close.current=onClose;
 const {refs,floatingStyles,update}=useFloating({elements:{reference:trigger.current},placement:'bottom-end',strategy:'fixed',middleware:[offset(8),flip(),shift({padding:12})],whileElementsMounted:autoUpdate});
 useEffect(()=>{const q=matchMedia('(max-width:600px)'),change=()=>setCompact(q.matches);q.addEventListener('change',change);return()=>q.removeEventListener('change',change)},[]);
 useLayoutEffect(()=>{
  if(compact)return;const node=refs.floating.current as HTMLElement|null;if(!node)return;
  node.showPopover();void update();node.querySelector<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled)')?.focus({preventScroll:true});
  let escaped=false;const keyboard=(e:KeyboardEvent)=>{if(e.key==='Escape')escaped=true};
  const toggle=(e:Event)=>{if((e as ToggleEvent).newState!=='closed')return;const button=trigger.current;close.current();if(escaped)requestAnimationFrame(()=>button?.isConnected&&button.focus({preventScroll:true}))};
  document.addEventListener('keydown',keyboard,true);node.addEventListener('toggle',toggle);
  return()=>{document.removeEventListener('keydown',keyboard,true);node.removeEventListener('toggle',toggle);if(node.matches(':popover-open'))node.hidePopover()};
 },[compact,refs.floating,update,trigger]);
 useLayoutEffect(()=>{if(!compact||!sheet.current)return;const node=sheet.current;node.showModal();return()=>{if(node.open)node.close()}},[compact]);
 const dismiss=()=>{const button=trigger.current,node=refs.floating.current as HTMLElement|null;if(sheet.current?.open)sheet.current.close();if(node?.matches(':popover-open'))node.hidePopover();close.current();button?.focus({preventScroll:true});requestAnimationFrame(()=>button?.isConnected&&button.focus({preventScroll:true}))};
 const header=<header><strong>{title}</strong><button type="button" aria-label={'Cerrar '+title.toLowerCase()} onClick={dismiss}><Icon name="x" port={port}/></button></header>;
 if(compact)return <dialog ref={sheet} id={id} className="ag-overlay ag-overlay-sheet" aria-label={title} onCancel={e=>{e.preventDefault();dismiss()}} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dismiss()}}>{header}<div className="ag-overlay-content">{children}</div></dialog>;
 return <div ref={refs.setFloating} id={id} popover="auto" className="ag-overlay" style={floatingStyles} role="dialog" aria-label={title} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss()}}}>{header}{children}</div>;
}
