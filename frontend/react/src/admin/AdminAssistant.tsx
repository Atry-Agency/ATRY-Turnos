import {OperationalAdminAssistant,adminChatEnabled} from './OperationalAdminAssistant';
import type {ScreenController} from '../services/ServicesScreen';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {AppPort} from '../app/port';
import {LiquidAvatar} from '../iatry/v3/LiquidAvatar';
import {socialIntent,createSocialResponder} from '../iatry/v3/social';
import {Button} from '../ui/primitives';
import {Icon} from '../ui/Icon';
import type {Data} from './api';
import type {Section} from './model';
import type {Action} from './Shared';
import {adminReply,adminStamp,proposalCurrent,adminFollowUp,type AdminReply,type AdminProposal} from './assistant-model';

type AdminMessage={who:'user'|'assistant';text:string};
// Memory stays in this tab and is keyed by the authenticated administrative session.
let conversation:{key:string;messages:AdminMessage[];open:boolean}|null=null;

function GuidedAdminAssistant({port,section,data,available,onNavigate,onOpen}:{port:AppPort;section:Section;data:Data;available:boolean;onNavigate:(route:string)=>Promise<void>;onOpen:(action:Action)=>Promise<void>}){
 const session=port.session(),sessionKey=JSON.stringify([port.user().id,session?.userId,session?.version]);
 const [open,setOpen]=useState(()=>conversation?.key===sessionKey?conversation.open:false),[query,setQuery]=useState(''),[messages,setMessages]=useState<AdminMessage[]>(()=>conversation?.key===sessionKey?conversation.messages:[]),[reply,setReply]=useState<AdminReply|null>(null),[accepted,setAccepted]=useState(false),[working,setWorking]=useState(false),selected=useRef<string|undefined>(undefined),lastRequest=useRef(''),log=useRef<HTMLDivElement>(null),responder=useMemo(()=>createSocialResponder(),[]);
 useEffect(()=>{conversation={key:sessionKey,messages,open}},[sessionKey,messages,open]);
 const context={section,data,administrator:Boolean(port.user().platform_admin&&port.session())},stamp=adminStamp(context);
 useEffect(()=>{selected.current=undefined;lastRequest.current='';setReply(null);setAccepted(false)},[stamp]);
 useEffect(()=>{if(open)log.current?.scrollTo({top:log.current.scrollHeight,behavior:'instant'})},[messages,open]);
 function submit(text:string){if(!available||!context.administrator||!text.trim())return;const source=text.trim();setQuery('');setAccepted(false);
  const social=socialIntent(source),response=social&&['greeting','thanks','goodbye','wellbeing','fatigue','celebration'].includes(social)?{text:responder.reply(source,{pending:Boolean(reply?.proposal)})!.text}:adminReply(adminFollowUp(source,lastRequest.current),context,selected.current);
  if(!social&&!response.preservePending){lastRequest.current=adminFollowUp(source,lastRequest.current);setReply(response)}
  setMessages(old=>[...old,{who:'user' as const,text:source},{who:'assistant' as const,text:response.text}].slice(-24));
 }
 async function proceed(proposal:AdminProposal){if(working||!available||!accepted||!proposalCurrent(proposal,context))return;setWorking(true);try{if(proposal.route)await onNavigate(proposal.route);else if(proposal.action)await onOpen(proposal.action);setReply(null);setAccepted(false)}finally{setWorking(false)}}
 if(!context.administrator)return null;
 return <section className="cc-assistant" data-stage={reply?.proposal?'review':'rest'} aria-label="IAtry para administración"><div className="cc-assistant-heading"><LiquidAvatar/><div><strong>IAtry <span>Administración</span></strong><p>Una tarea a la vez, con todo a la vista.</p></div><Button variant="secondary" small aria-expanded={open} aria-controls="cc-assistant-body" onClick={()=>setOpen(x=>!x)}><Icon name={open?'x':'spark'} port={port}/>{open?'Cerrar':'Pedir ayuda'}</Button></div>{open&&<div id="cc-assistant-body" className="cc-assistant-body"><div ref={log} className="cc-assistant-log" role="log" aria-label="Conversación administrativa" aria-live="polite">{messages.length?messages.map((m,i)=><p key={i} className={'cc-chat-'+m.who}>{m.text}</p>):<p>¡Buenas! Puedo ayudarte a revisar la plataforma y preparar las tareas de suscripciones, accesos e incidencias. Los cambios se revisan y confirman en sus formularios.</p>}</div>{reply?.choices&&<div className="cc-assistant-choices" role="group" aria-label="Elegir registro">{reply.choices.map(c=><Button variant="secondary" small key={c.id} onClick={()=>{selected.current=c.id;const next=adminReply(lastRequest.current+' ese',context,c.id);setReply(next);setAccepted(false);setMessages(old=>[...old,{who:'assistant' as const,text:next.text}].slice(-24))}}>{c.label}</Button>)}</div>}{reply?.proposal&&<div className="cc-assistant-proposal"><span className="eyebrow">SIGUIENTE PASO · SIN EJECUTAR</span><h3>{reply.proposal.title}</h3><p>{reply.proposal.detail}</p><label className="checkline"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} disabled={!available||working}/> Revisé el registro y el alcance.</label><Button small disabled={!accepted||!available||working||!proposalCurrent(reply.proposal,context)} onClick={()=>void proceed(reply.proposal!)}>{reply.proposal.route?'Abrir sección':'Revisar formulario'}</Button></div>}<form className="cc-assistant-composer" onSubmit={e=>{e.preventDefault();submit(query)}}><label className="sr-only" htmlFor="cc-assistant-input">Tu pedido a IAtry administrador</label><input id="cc-assistant-input" value={query} onChange={e=>setQuery(e.target.value)} maxLength={500} placeholder="¿Qué necesitás resolver?" disabled={!available||working}/><Button type="submit" small disabled={!query.trim()||!available||working}>Enviar</Button></form>{!available&&<p className="small muted" role="status">Terminá la operación abierta o esperá a que se actualicen los datos.</p>}<div className="cc-assistant-shortcuts">{['Resumen de la plataforma','Revisar negocios','Ver incidencias'].map(text=><button key={text} type="button" onClick={()=>submit(text)} disabled={!available||working}>{text}</button>)}</div></div>}</section>;
}

export function AdminAssistant(props:{port:AppPort;section:Section;data:Data;available:boolean;onNavigate:(route:string)=>Promise<void>;onOpen:(action:Action)=>Promise<void>;bindGuard?:(guard:ScreenController|null)=>void;onVerified?:()=>void;onLockChange?:(locked:boolean)=>void}){return adminChatEnabled()?<OperationalAdminAssistant {...props}/>:<GuidedAdminAssistant {...props}/>}
