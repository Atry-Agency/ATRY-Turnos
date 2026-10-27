// Private loopback-only entry. Never imported by main.tsx or the Pages manifest.
import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {createCloudAuth} from '../../cloud/supabase-auth.mjs';
import {createApiAdapter} from '../../cloud/api-adapter.mjs';
import {createConversation} from '../../frontend/react/src/iatry/v3/engine';
import {capabilities} from '../../frontend/react/src/iatry/v3/catalogue';
import {createReservationValidation,reservationTrial} from '../../frontend/react/src/iatry/v3/reservation-validation';
import {bookingIssues,exactContacts,contactKey} from '../../frontend/react/src/domain/booking-rules';
const serviceValidation={project:'https://djoxdtloqwbrhgtgencc.supabase.co',business:'374cd00d-3e37-497f-9292-9bb959c1ef88',name:reservationTrial.notes};
import {V2Provider} from '../../frontend/react/src/iatry/v2/Provider';
import {OperationalPanel} from '../../frontend/react/src/iatry/v3/OperationalPanel';
import {IatrySlot} from '../../frontend/react/src/iatry/context';
import type {AppPort} from '../../frontend/react/src/app/port';
import type {Scope} from '../../frontend/react/src/services/contracts';
import '../../frontend/react/src/iatry/v3/v3.css';
const config=window.ATRY_CONFIG!;
const isolatedPreview=location.origin==='https://atryturnos.com'&&location.pathname==='/__iatry-local-reservations/';
if(!(['127.0.0.1','localhost'].includes(location.hostname)||isolatedPreview)||config.supabaseUrl!==serviceValidation.project)throw Error('Esta vista solo funciona en loopback y el proyecto autorizado.');
let current:Scope|null=null;
let signedOut=()=>{};
const auth=createCloudAuth(config,{onSignedOut:()=>{current=null;signedOut()}}),api=createApiAdapter({auth,config,fetchImpl:(url,options)=>{const u=new URL(String(url));if(u.origin!==config.supabaseUrl||u.pathname!=='/functions/v1/atry-public'||u.searchParams.get('operation')!=='availability'||(options?.method||'GET')!=='GET')throw Error('Solo se permite disponibilidad pública de lectura.');return fetch(url,options)}});
type Context={user:any;business:any;port:AppPort;gate:ReturnType<typeof createReservationValidation>;engine:ReturnType<typeof createConversation>};
async function connect():Promise<Context>{
 const identity=await api.identity(),member=identity.businesses.find((b:any)=>b.id===serviceValidation.business);
 if(!member||member.role!=='owner')throw Error('Esta cuenta no es propietaria de Pelu. No se ejecutó ninguna operación.');
 const business=await api.request('/api/business/'+serviceValidation.business);
 if(business.id!==serviceValidation.business||business.is_active!==1||business.subscription_status!=='active'||Date.parse(business.paid_until)<=Date.now())throw Error('El negocio no está habilitado para esta prueba.');
 current={businessId:business.id,userId:identity.user.id,role:'owner',sessionVersion:1,accessEnabled:true,sector:business.sector};
 const ownerRequest=async(route:string,options:any={})=>{if(options.method&&options.method!=='GET'){const live=await api.identity();if(live.user?.id!==current?.userId||!live.businesses.some((member:any)=>member.id===serviceValidation.business&&member.role==='owner'))throw Error('La identidad o el rol de propietario cambió.');}return api.request(route,options)};
 const gate=createReservationValidation(ownerRequest,config.supabaseUrl!,()=>current,business.slug,false);
 const entitlements=await api.request('/api/business/'+business.id+'/entitlements');if(entitlements.access_enabled!==true||!entitlements.features)throw Error('No se recibieron permisos vigentes del negocio.');
 const port={scope:()=>current,business:()=>({...business,role:'owner'}),user:()=>identity.user,demo:()=>false,capability:(key:string)=>entitlements.features?.[key]===true,bookingIssues,exactContacts,contactKey,privateEmployeeCatalog:()=>true,request:gate.request,publicURL:()=>'',applyBusiness:async()=>{throw Error('Cambiar configuración no está autorizado.')}} as unknown as AppPort;
 const engine=createConversation(port,current,capabilities.filter(tool=>gate.tools.includes(tool.id)),'reservation-validation');
 return {user:identity.user,business:{...business,role:'owner'},port,gate,engine};
}
function Trial({context}:{context:Context}){
 const {engine,port,gate}=context,state=useSyncExternalStore(engine.subscribe,engine.snapshot);
 const [rows,setRows]=useState<any[]>([]),[cleanupConsent,setCleanupConsent]=useState(false),[cleanupMessage,setCleanupMessage]=useState('');
 const refresh=()=>void gate.request('/api/business/'+serviceValidation.business+'/bookings?date='+reservationTrial.date+'&days=1').then(value=>setRows(value as any[]));
 useEffect(()=>{refresh();return()=>engine.dispose()},[engine]);
 return <V2Provider user={context.user} business={context.business} view="agenda" port={port} capabilities={{role:'owner',plan:context.business.plan,access:true,statistics:false}} operational={{locked:state.phase==='executing',energy:state.error?'error':state.phase==='loading'||state.phase==='executing'?'preparation':state.phase==='review'?'confirmation':state.phase==='done'?(state.result?.verified||state.tool?.kind==='read'?'success':'interaction'):undefined,cancel:()=>engine.cancel(),panel:<OperationalPanel engine={engine} port={port} view="agenda" onSaved={refresh}/>,helpPanel:<p>Este ensayo permite únicamente las cinco escrituras autorizadas y su recuperación.</p>,businessPanel:<p>Las demás consultas están bloqueadas durante este ensayo.</p>}}>
 <main className="container" style={{maxWidth:1050,margin:'40px auto',padding:20}}><h1>Validación controlada · Pelu</h1><p>Supabase real · ensayo autorizado de una única reserva y restauración de avisos de Pelu.</p><IatrySlot/><section className="card" style={{padding:24,marginTop:24}}><h2>Lectura actual de Supabase</h2><p>{rows.length} turnos recibidos del día de ensayo. No se modifican reservas existentes.</p>{rows.filter(row=>row.notes===reservationTrial.notes).map(row=><article key={row.id}><strong>{row.notes}</strong><p>ID: <code>{row.id}</code></p><p>Desde: {row.starts_at} · Hasta: {row.ends_at} · Profesional: {row.staff_name}</p></article>)}<p>Estado del ensayo: <strong>{!gate.state().authorized?'Cerrado: nuevas escrituras bloqueadas':gate.state().done?'Finalizado':'Paso '+(gate.state().stage+1)}</strong></p><details><summary>Respuestas y relecturas de Supabase</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(gate.receipts(),null,2)}</pre></details>{gate.state().authorized&&<section><h3>Recuperación del ensayo</h3><label><input type="checkbox" checked={cleanupConsent} onChange={e=>setCleanupConsent(e.target.checked)}/>Confirmo la recuperación del único ensayo autorizado.</label><button type="button" disabled={!cleanupConsent||state.phase==='executing'} onClick={async()=>{try{await gate.cancelTrial();refresh();setCleanupMessage('Cancelación del ensayo verificada.')}catch(error){setCleanupMessage((error as Error).message)}}}>Cancelar solo la reserva de ensayo</button><button type="button" disabled={!cleanupConsent||state.phase==='executing'} onClick={async()=>{try{await gate.restoreAlerts();refresh();setCleanupMessage('Avisos originales verificados. Ensayo cerrado.')}catch(error){setCleanupMessage((error as Error).message)}}}>Restaurar avisos originales de Pelu</button><p role="status">{cleanupMessage}</p></section>}</section></main>
 </V2Provider>;
}
function App(){const [context,setContext]=useState<Context|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{signedOut=()=>{setContext(null);setError('La sesión se cerró. El ensayo está detenido.')};void auth.ready().then(async()=>{const {data}=await auth.client.auth.getSession();if(data.session)setContext(await connect())}).catch(error=>setError('No pude conectar la sesión: '+String(error?.message||'Reintentá la conexión.')));return()=>{signedOut=()=>{}}},[]);
 if(context)return <Trial context={context}/>;
 return <main className="container" style={{maxWidth:480,margin:'70px auto',padding:24}}><h1>IAtry · validación autorizada</h1><p>Ingresá con la cuenta habitual del propietario de Pelu. No se crean cuentas ni se envían correos.</p><form style={{display:"grid",gap:18,marginTop:28}} onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');const data=new FormData(event.currentTarget);try{await auth.signIn(String(data.get('email')),String(data.get('password')));setContext(await connect())}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}><label style={{display:"grid",gap:8}}>Correo<input name="email" type="email" autoComplete="username" required/></label><label style={{display:"grid",gap:8}}>Contraseña<input name="password" type="password" autoComplete="current-password" required/></label><button className="btn" style={{marginTop:8,minHeight:48}} disabled={busy}>Iniciar sesión</button></form>{error&&<><p role="alert">{error}</p><button type="button" className="btn" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await auth.ready();const {data}=await auth.client.auth.getSession();if(!data.session)throw Error('La sesión no está disponible. Iniciá sesión normalmente.');setContext(await connect())}catch(error){setError((error as Error).message)}finally{setBusy(false)}}}>Reintentar conexión existente</button></>}<p className="small muted">Proyecto djoxdtloqwbrhgtgencc · negocio Pelu · sin publicación.</p></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
