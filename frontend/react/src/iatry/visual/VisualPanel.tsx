import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useMobileSheet} from './useMobileSheet';
import {LiquidAvatar} from './LiquidAvatar';
import {PanelIcon} from './PanelIcon';
import {Pearl} from './Pearl';
import './panel-base.css';
import './panel.css';
interface Choice{view:string;title:string;text:string}
interface Props{guided?:boolean;suspended:boolean;name:string;view:string;scopeKey:string;choices:Choice[];guide:ReactNode;guideId?:string;energy?:string;motionOff:boolean;suggestionsOff:boolean;onMotion:()=>void;onSuggestions:()=>void;onPick:(view:string)=>void}
const labels:Record<string,string>={servicios:'Crear un servicio',disponibilidad:'Organizar mis horarios',configuracion:'Personalizar mi negocio','configuracion-inicial':'Primeros pasos',comunicacion:'Configurar WhatsApp'};
const descriptions:Record<string,string>={servicios:'Te muestro dónde configurar tus servicios',disponibilidad:'Revisemos los días y tramos de atención',configuracion:'Nombre y datos para que te reconozcan','configuracion-inicial':'Recorramos la configuración inicial',comunicacion:'Preparar un mensaje no confirma su envío'};
const normalize=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
/** Presentation only: receives the existing guide as children. No transport, tool catalogue or executor. */
export function VisualPanel({guided=false,suspended,name,view,scopeKey,choices,guide,guideId,energy,motionOff,suggestionsOff,onMotion,onSuggestions,onPick}:Props){
 const [activated,setActivated]=useState(false),[open,setOpen]=useState(false),[minimized,setMinimized]=useState(false),[exiting,setExiting]=useState(false),[query,setQuery]=useState(''),[exploring,setExploring]=useState(false),[reduced,setReduced]=useState(false),[hidden,setHidden]=useState(document.hidden);
 const root=useRef<HTMLElement>(null),dock=useRef<HTMLButtonElement>(null),intent=useRef<HTMLInputElement>(null),off=motionOff||reduced||hidden;
 const expanded=open&&!minimized&&!suspended,lastAutoGuide=useRef('');
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches),visibility=()=>setHidden(document.hidden);change();media.addEventListener('change',change);document.addEventListener('visibilitychange',visibility);return()=>{media.removeEventListener('change',change);document.removeEventListener('visibilitychange',visibility)}},[]);
 useEffect(()=>{setOpen(false);setMinimized(false);setQuery('');setExploring(false)},[view,scopeKey]);
 useEffect(()=>{const key=scopeKey+'|'+view+'|'+guideId;if(guideId&&lastAutoGuide.current!==key){lastAutoGuide.current=key;setActivated(true);setOpen(true);setMinimized(false)}},[guideId,view,scopeKey]);
 useEffect(()=>{if(guided&&matchMedia('(max-width:767px)').matches)setMinimized(true)},[guided,guideId,view,scopeKey]);
 useEffect(()=>{const stage=document.querySelector<HTMLElement>('[data-iatry-visual-stage]');if(expanded)stage?.setAttribute('data-assistant-open','true');else stage?.removeAttribute('data-assistant-open');return()=>stage?.removeAttribute('data-assistant-open')},[expanded]);
 useEffect(()=>{if(!expanded)return;const frame=requestAnimationFrame(()=>{if(!guide&&!matchMedia('(max-width:767px)').matches)intent.current?.focus({preventScroll:true})});return()=>cancelAnimationFrame(frame)},[expanded,guideId]);
 useEffect(()=>{if(!expanded)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!document.querySelector('.modal-mask,dialog[open]')){e.preventDefault();close()}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[expanded,off]);
 useEffect(()=>{if(!exiting)return;const timer=setTimeout(()=>setExiting(false),off?0:220);return()=>clearTimeout(timer)},[exiting,off]);
 function close(){setExiting(!off);setOpen(false);setMinimized(false);dock.current?.focus({preventScroll:true})}
 function minimize(){setMinimized(true);dock.current?.focus({preventScroll:true})}
 function request(){setActivated(true);setExiting(false);setMinimized(false);setOpen(true)}
 const modal=useMobileSheet(root,expanded);
 const ordered=[view,'servicios','disponibilidad','configuracion','configuracion-inicial','comunicacion'].filter((v,i,a)=>a.indexOf(v)===i).flatMap(v=>choices.filter(c=>c.view===v));
 const visible=(query.trim()?ordered.filter(c=>normalize([labels[c.view],c.title,c.text].join(' ')).includes(normalize(query.trim()))):ordered).slice(0,exploring?choices.length:3);
 return <>{modal&&createPortal(<div data-iatry-mobile-backdrop aria-hidden="true" onPointerDown={event=>event.preventDefault()}/>,document.body)}<section ref={root} hidden={suspended} className={'iatry-context iatry-v2 iatry-v3 iatry-visual-only'+(!expanded?' iatry-rest':'')} data-iatry-state={exiting?'leaving':'idle'} data-energy-state={exiting?'farewell':expanded?energy||'interaction':'rest'} data-motion-off={off||undefined} aria-label="IAtry, asistente contextual">
 <div className="iatry-v2-dock"><button ref={dock} type="button" className="iatry-call" aria-expanded={expanded} aria-controls="iatry-visual-panel" onClick={()=>expanded?close():request()}><LiquidAvatar/><span><strong>IAtry</strong><small>{minimized?'Retomar conversación':expanded?'Estoy con vos':'Pedir ayuda'}</small></span></button></div>
 {(activated||exiting)&&<div id="iatry-visual-panel" className="iatry-v2-panel" role="dialog" aria-modal={modal||undefined} tabIndex={modal?-1:undefined} aria-label="IAtry, ayuda contextual" hidden={!expanded&&!exiting} data-exiting={exiting||undefined}>
 <header className="iatry-v2-top"><span className="iatry-v2-eyebrow"><LiquidAvatar/>IAtry</span><div className="iatry-window-controls"><button type="button" aria-label="Minimizar IAtry" onClick={minimize}><PanelIcon name="minus"/></button><button type="button" aria-label="Cerrar IAtry" onClick={close}><PanelIcon name="close"/></button></div></header>
 {guide?<div className="iatry-visual-guide-body">{guide}</div>:<><div className="iatry-panel-intro"><Pearl/><h2>{name?'Hola, '+name+'.':'Hola.'}<span>¿Qué hacemos hoy?</span></h2><p>Te acompaño a gestionar tu negocio de forma más rápida y simple.</p></div>
 <form role="search" className="iatry-intent-form" onSubmit={e=>{e.preventDefault();root.current?.querySelector<HTMLButtonElement>('[data-iatry-guide]')?.focus()}}><PanelIcon name="search"/><label className="sr-only" htmlFor="iatry-visual-search">Buscar ayuda</label><input ref={intent} id="iatry-visual-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Decime qué necesitás…" autoComplete="off"/><button type="submit" className="iatry-search-submit" disabled={!query.trim()} aria-label="Ver ayudas relacionadas"><PanelIcon name="arrow"/></button></form>
 <div className="iatry-suggestion-menu">{visible.map(choice=><button type="button" key={choice.view} data-iatry-guide={choice.view} onClick={()=>onPick(choice.view)}><span className="iatry-suggestion-icon"><PanelIcon name={choice.view==='servicios'?'service-create':choice.view==='disponibilidad'?'clock':'store'}/></span><span className="iatry-suggestion-copy"><strong>{labels[choice.view]||choice.title}</strong><small>{descriptions[choice.view]||choice.text}</small></span><PanelIcon name="chevron"/></button>)}</div>
 {!visible.length&&<p role="status">No encontré esa ayuda. Probá «servicios», «horarios» o explorá las funciones disponibles.</p>}
 <button type="button" className="iatry-v2-text iatry-explore" onClick={()=>{setExploring(!exploring);setQuery('')}}><PanelIcon name="grid"/>{exploring?'Volver a la conversación':'Explorar funciones'}<PanelIcon name="arrow"/></button></>}
 <details className="iatry-v2-preferences"><summary>Preferencias de IAtry</summary><div className="actions"><button type="button" className="btn secondary sm" aria-pressed={!suggestionsOff} onClick={onSuggestions}>{suggestionsOff?'Activar sugerencias':'Desactivar sugerencias proactivas'}</button><button type="button" className="btn secondary sm" aria-pressed={!motionOff} onClick={onMotion}>{motionOff?'Activar movimiento':'Pausar movimiento'}</button></div><p className="small muted">Preferencias de este navegador, para tu usuario, negocio y rol.</p></details>
 </div>}</section></>
}
