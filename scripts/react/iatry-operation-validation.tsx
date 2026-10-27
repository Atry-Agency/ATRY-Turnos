// Private loopback-only entry. Never imported by main.tsx or the Pages manifest.
import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {createCloudAuth} from '../../cloud/supabase-auth.mjs';
import {createApiAdapter} from '../../cloud/api-adapter.mjs';
import {createConversation} from '../../frontend/react/src/iatry/v3/engine';
import {capabilities} from '../../frontend/react/src/iatry/v3/catalogue';
import {createOperationValidation,operationTrial} from '../../frontend/react/src/iatry/v3/operation-validation';
const serviceValidation={project:'https://djoxdtloqwbrhgtgencc.supabase.co',business:'374cd00d-3e37-497f-9292-9bb959c1ef88',name:operationTrial.serviceName};
import {V2Provider} from '../../frontend/react/src/iatry/v2/Provider';
import {OperationalPanel} from '../../frontend/react/src/iatry/v3/OperationalPanel';
import {IatrySlot} from '../../frontend/react/src/iatry/context';
import type {AppPort} from '../../frontend/react/src/app/port';
import type {Scope} from '../../frontend/react/src/services/contracts';
import '../../frontend/react/src/iatry/v3/v3.css';
const config=window.ATRY_CONFIG!;
if(!['127.0.0.1','localhost'].includes(location.hostname)||config.supabaseUrl!==serviceValidation.project)throw Error('Esta vista solo funciona en loopback y el proyecto autorizado.');
let current:Scope|null=null;
let signedOut=()=>{};
const auth=createCloudAuth(config,{onSignedOut:()=>{current=null;signedOut()}}),api=createApiAdapter({auth,config,fetchImpl:()=>{throw Error('Las Edge Functions y operaciones públicas están bloqueadas en este ensayo.')}});
type Context={user:any;business:any;port:AppPort;gate:ReturnType<typeof createOperationValidation>;engine:ReturnType<typeof createConversation>};
async function connect():Promise<Context>{
 const identity=await api.identity(),member=identity.businesses.find((b:any)=>b.id===serviceValidation.business);
 if(!member||member.role!=='owner')throw Error('Esta cuenta no es propietaria de Pelu. No se ejecutó ninguna operación.');
 const business=await api.request('/api/business/'+serviceValidation.business);
 if(business.id!==serviceValidation.business||business.is_active!==1||business.subscription_status!=='active'||Date.parse(business.paid_until)<=Date.now())throw Error('El negocio no está habilitado para esta prueba.');
 current={businessId:business.id,userId:identity.user.id,role:'owner',sessionVersion:1,accessEnabled:true,sector:business.sector};
 const gate=createOperationValidation(api.request,config.supabaseUrl!,()=>current,'absence',false);
 const port={scope:()=>current,business:()=>({...business,role:'owner'}),user:()=>identity.user,demo:()=>false,capability:()=>false,privateEmployeeCatalog:()=>true,request:gate.request,publicURL:()=>'',applyBusiness:async()=>{throw Error('Cambiar configuración no está autorizado.')}} as unknown as AppPort;
 const engine=createConversation(port,current,capabilities.filter(tool=>gate.tools.includes(tool.id)),'operation-validation');
 return {user:identity.user,business:{...business,role:'owner'},port,gate,engine};
}
function Trial({context}:{context:Context}){
 const {engine,port,gate}=context,state=useSyncExternalStore(engine.subscribe,engine.snapshot);
 const [rows,setRows]=useState<any[]>([]);
 const refresh=()=>void gate.request('/api/business/'+serviceValidation.business+'/time-off').then(value=>setRows(value as any[]));
 useEffect(()=>{refresh();return()=>engine.dispose()},[engine]);
 return <V2Provider user={context.user} business={context.business} view="servicios" port={port} capabilities={{role:'owner',plan:context.business.plan,access:true,statistics:false}} operational={{locked:state.phase==='executing',energy:state.error?'error':state.phase==='loading'||state.phase==='executing'?'preparation':state.phase==='review'?'confirmation':state.phase==='done'?(state.result?.verified||state.tool?.kind==='read'?'success':'interaction'):undefined,cancel:()=>engine.cancel(),panel:<OperationalPanel engine={engine} port={port} view="servicios" onSaved={refresh}/>,helpPanel:<p>Esta sesión solo valida el bloqueo autorizado del 16/11/2026, de 13 a 14.</p>,businessPanel:<p>Las demás consultas están bloqueadas durante este ensayo.</p>}}>
 <main className="container" style={{maxWidth:1050,margin:'40px auto',padding:20}}><h1>Validación controlada · Pelu</h1><p>Supabase real · un único bloqueo autorizado; sin reservas ni envíos.</p><IatrySlot/><section className="card" style={{padding:24,marginTop:24}}><h2>Lectura actual de Supabase</h2><p>{rows.length} bloqueos recibidos. Los registros anteriores se mantienen intactos.</p>{rows.filter(row=>row.reason===operationTrial.reason).map(row=><article key={row.id}><strong>{row.reason}</strong><p>ID: <code>{row.id}</code></p><p>Desde: {row.starts_at} · Hasta: {row.ends_at} · Profesional: {row.staff_name}</p></article>)}<p>Estado del ensayo: <strong>{!gate.state().authorized?'Cerrado: nuevas escrituras bloqueadas':gate.state().done?'Finalizado':'Paso '+(gate.state().index+1)}</strong></p><details><summary>Respuestas y relecturas de Supabase</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(gate.evidence(),null,2)}</pre></details></section></main>
 </V2Provider>;
}
function App(){const [context,setContext]=useState<Context|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{signedOut=()=>{setContext(null);setError('La sesión se cerró. El ensayo está detenido.')};void auth.ready().then(async()=>{const {data}=await auth.client.auth.getSession();if(data.session)setContext(await connect())}).catch(error=>setError('No pude conectar la sesión: '+String(error?.message||'Reintentá la conexión.')));return()=>{signedOut=()=>{}}},[]);
 if(context)return <Trial context={context}/>;
 return <main className="container" style={{maxWidth:480,margin:'70px auto',padding:24}}><h1>IAtry · validación autorizada</h1><p>Ingresá con la cuenta habitual del propietario de Pelu. No se crean cuentas ni se envían correos.</p><form style={{display:"grid",gap:18,marginTop:28}} onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');const data=new FormData(event.currentTarget);try{await auth.signIn(String(data.get('email')),String(data.get('password')));setContext(await connect())}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}><label style={{display:"grid",gap:8}}>Correo<input name="email" type="email" autoComplete="username" required/></label><label style={{display:"grid",gap:8}}>Contraseña<input name="password" type="password" autoComplete="current-password" required/></label><button className="btn" style={{marginTop:8,minHeight:48}} disabled={busy}>Iniciar sesión</button></form>{error&&<><p role="alert">{error}</p><button type="button" className="btn" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await auth.ready();const {data}=await auth.client.auth.getSession();if(!data.session)throw Error('La sesión no está disponible. Iniciá sesión normalmente.');setContext(await connect())}catch(error){setError((error as Error).message)}finally{setBusy(false)}}}>Reintentar conexión existente</button></>}<p className="small muted">Proyecto djoxdtloqwbrhgtgencc · negocio Pelu · sin publicación.</p></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
