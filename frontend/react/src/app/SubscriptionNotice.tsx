import {useEffect,useRef,useState} from 'react';
import {Icon} from '../ui/Icon';
import {Modal} from '../ui/primitives';
import {WorkspaceActionMenu} from './WorkspaceActionMenu';
import {reviewSubscriptionAccess} from './subscription-review';
import {subscriptionDate,subscriptionDay,subscriptionDeadline,subscriptionLabel,subscriptionLive} from '../subscription/model';
import type {Business} from './model';
import type {AppPort} from './port';
type Phase='idle'|'checking'|'unchanged'|'error'|'success'|'leaving'|'dismissed';
export function SubscriptionNotice({business:b,port,beforeLeave,copy}:{business:Business;port:AppPort;beforeLeave:()=>Promise<boolean>;copy:(text:string)=>Promise<void>}){
 const [phase,setPhase]=useState<Phase>('idle'),[details,setDetails]=useState(false),[attempt,setAttempt]=useState(0),[preview,setPreview]=useState(false);
 const busy=useRef(false),mounted=useRef(true),notice=useRef<HTMLElement>(null);
 const live=subscriptionLive(b),end=subscriptionDay(subscriptionDeadline(b)),label=subscriptionLabel(b),demo=import.meta.env.DEV&&port.demo();
 const successful=['success','leaving','dismissed'].includes(phase),visible=phase!=='dismissed'&&(!live||['checking','success','leaving'].includes(phase));
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 useEffect(()=>{if(phase!=='success')return;const timer=setTimeout(()=>setPhase('leaving'),1300);return()=>clearTimeout(timer)},[phase]);
 useEffect(()=>{if(phase!=='leaving')return;const timer=setTimeout(()=>setPhase('dismissed'),420);return()=>clearTimeout(timer)},[phase]);
 async function review(){
  if(busy.current)return;
  busy.current=true;
  try{
   if(!await beforeLeave())return;
   setPreview(false);setPhase('checking');
   const result=await reviewSubscriptionAccess(port,b.id);
   if(!mounted.current)return;
   if(result==='stale'){setPhase('idle');return;}
   const enabled=result==='enabled';
   setAttempt(n=>n+1);setPhase(enabled?'success':'unchanged');
   if(!enabled)notice.current?.focus({preventScroll:true});
  }catch(error){if(mounted.current){setAttempt(n=>n+1);setPhase('error');port.notify(error instanceof Error?error.message:'No pudimos comprobar el acceso. Intentá nuevamente.',true);notice.current?.focus({preventScroll:true})}}
  finally{busy.current=false}
 }
 function simulate(enabled:boolean){if(!demo||busy.current)return;setPreview(true);setAttempt(n=>n+1);setPhase(enabled?'success':'unchanged')}
 const icon=(name:string)=><Icon name={name} port={port}/>;
 return <>
 {visible?<div className={'subscription-notice-motion'+(phase==='leaving'?' is-leaving':'')}><div><section ref={notice} key={attempt} tabIndex={-1} data-review={phase} aria-busy={phase==='checking'} className={'subscription-notice restricted premium-attention'+(successful?' is-restored':label==='Vencido'?' is-expired':'')} aria-label="Estado de la suscripción">
 {!successful&&<WorkspaceActionMenu port={port} disabled={phase==='checking'} actions={[{label:'Información del acceso',icon:'help',run:()=>setDetails(true)},{label:'Copiar código del negocio',icon:'copy',description:'Este código identifica tu negocio. Compartilo con soporte de ATRY si necesitás ayuda para revisar tu acceso o una habilitación. Copiarlo no cambia tu plan ni tus datos, y no es una contraseña.',run:()=>void copy(b.id)},{label:phase==='checking'?'Revisando habilitación…':'Revisar habilitación',icon:'refresh',run:()=>void review()}]}/>}
 <div className="plan-notice-symbol" aria-hidden="true">{icon(successful?'check':'calendar')}{!successful&&<span>!</span>}</div>
 <div className="subscription-notice-copy"><span className="eyebrow">{successful?'ACCESO CONFIRMADO':'ESTADO DE TU PLAN'}</span><h2>{successful?(preview?'Acceso habilitado · simulación':'Tu acceso está habilitado'):phase==='checking'?'Revisando tu acceso…':label==='Vencido'?'Tu plan finalizó':label}</h2>
 {successful?<span className="plan-notice-date">{preview?'Vista local, sin cambios reales':'Ya podés continuar con tu negocio.'}</span>:end&&<span className="plan-notice-date">{label==='Vencido'?'Venció el ':'Período hasta el '}{subscriptionDate(end)}</span>}
 {!successful&&<p className="plan-notice-description"><span className="banner-desktop-copy">Podés seguir consultando tu historial y cancelar turnos existentes. Para volver a gestionar tu negocio, coordiná tu acceso con ATRY.</span><span className="banner-mobile-copy">Tu historial sigue disponible y podés cancelar turnos. Renová para volver a gestionar tu negocio.</span></p>}
 </div>
 {!successful&&<div className="plan-notice-actions"><a className="btn plan-notice-primary" href="#/app/suscripcion">{label==='Vencido'?'Renovar mi plan':'Ver mi plan'} {icon('arrow')}</a><a className="plan-notice-history" href="#/app/suscripcion">Ver historial de habilitaciones</a></div>}
 {['unchanged','error'].includes(phase)&&<p className="plan-review-feedback" role="status">{preview?'Simulación: el acceso sigue sin habilitarse.':phase==='error'?'No pudimos comprobar el acceso. Intentá nuevamente.':'Todavía no figura una habilitación activa.'}</p>}
 {successful&&<span className="plan-review-announcement" role="status">{preview?'Simulación visual de acceso habilitado. No se modificó el plan.':'Acceso verificado. Tu plan ya está habilitado.'}</span>}
 </section></div></div>:live&&Date.parse(subscriptionDeadline(b)||'')-Date.now()<=7*86400000?<section className="subscription-renewal premium-attention" aria-label="Próximo vencimiento">{icon('clock')}<span>Tu {b.subscription_status==='trialing'?'prueba':'acceso'} vence el {subscriptionDate(end)}.</span><a href="#/app/suscripcion">Ver mi plan {icon('arrow')}</a></section>:null}
 {demo&&<div className="plan-review-preview" aria-label="Ensayo visual local"><span>Animaciones · solo vista local</span><button onClick={()=>simulate(false)}>Ver sin habilitación</button><button onClick={()=>simulate(true)}>Ver habilitado</button>{phase==='dismissed'&&<button onClick={()=>{setPhase('idle');setPreview(false)}}>Volver al aviso</button>}</div>}
 {details&&<Modal title="Tu plan y acceso" closeIcon={icon('x')} onClose={()=>setDetails(false)}><p>Podés seguir consultando tu historial y cancelar turnos existentes. Para crear o modificar datos, coordiná la habilitación o renovación con ATRY.</p>{end&&<p className="small muted">Último día del período: {subscriptionDate(end)}.</p>}<a className="btn" href="#/app/suscripcion" onClick={()=>setDetails(false)}>Ver mi plan e historial {icon('arrow')}</a></Modal>}
 </>;
}
