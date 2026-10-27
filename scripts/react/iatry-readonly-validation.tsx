// Private loopback-only entry. Never imported by main.tsx or the Pages manifest.
import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {createCloudAuth} from '../../cloud/supabase-auth.mjs';
import {createApiAdapter} from '../../cloud/api-adapter.mjs';
import {createConversation} from '../../frontend/react/src/iatry/v3/engine';
import {capabilities} from '../../frontend/react/src/iatry/v3/catalogue';
import {createReadonlyValidation} from '../../frontend/react/src/iatry/v3/readonly-validation';
import {productionProject,validationBusiness} from '../../frontend/react/src/iatry/v3/production-policy';
import {V2Provider} from '../../frontend/react/src/iatry/v2/Provider';
import {OperationalPanel} from '../../frontend/react/src/iatry/v3/OperationalPanel';
import {IatrySlot} from '../../frontend/react/src/iatry/context';
import type {AppPort} from '../../frontend/react/src/app/port';
import type {Scope} from '../../frontend/react/src/services/contracts';
import '../../frontend/react/src/iatry/v3/v3.css';
const config=window.ATRY_CONFIG!;
if(!['127.0.0.1','localhost'].includes(location.hostname)||config.supabaseUrl!==productionProject)throw Error('Esta vista solo funciona en loopback y el proyecto autorizado.');
let current:Scope|null=null;
let signedOut=()=>{};
const auth=createCloudAuth(config,{onSignedOut:()=>{current=null;signedOut()}}),api=createApiAdapter({auth,config,fetchImpl:()=>{throw Error('Las Edge Functions y operaciones públicas están bloqueadas en este ensayo.')}});
type Context={user:any;business:any;port:AppPort;gate:ReturnType<typeof createReadonlyValidation>;engine:ReturnType<typeof createConversation>};
async function connect():Promise<Context>{
 const identity=await api.identity(),member=identity.businesses.find((b:any)=>b.id===validationBusiness);
 if(!member||member.role!=='owner')throw Error('Esta cuenta no es propietaria de Pelu. No se ejecutó ninguna operación.');
 const business=await api.request('/api/business/'+validationBusiness);
 if(business.id!==validationBusiness||business.is_active!==1||business.subscription_status!=='active'||Date.parse(business.paid_until)<=Date.now())throw Error('El negocio no está habilitado para esta prueba.');
 current={businessId:business.id,userId:identity.user.id,role:'owner',sessionVersion:1,accessEnabled:true,sector:business.sector};
 const entitlements=await api.request('/api/business/'+validationBusiness+'/entitlements');
 const gate=createReadonlyValidation(api.request,config.supabaseUrl!,()=>current);
 const port={scope:()=>current,business:()=>({...business,role:'owner'}),user:()=>identity.user,demo:()=>false,capability:(feature:string)=>Boolean(entitlements.features?.[feature]),privateEmployeeCatalog:()=>true,request:gate.request,publicURL:()=>'',applyBusiness:async()=>{throw Error('Cambiar configuración no está autorizado.')}} as unknown as AppPort;
 const engine=createConversation(port,current,capabilities,'supabase-readonly');
 return {user:identity.user,business:{...business,role:'owner'},port,gate,engine};
}
function Trial({context}:{context:Context}){
 const {engine,port,gate}=context,state=useSyncExternalStore(engine.subscribe,engine.snapshot);
 const [checks,setChecks]=useState<{id:string;phase:string}[]>([]),[running,setRunning]=useState(false);
 useEffect(()=>()=>engine.dispose(),[engine]);
 async function verify(){if(running)return;setRunning(true);setChecks([]);try{for(const id of gate.tools){engine.cancel();await engine.begin(id);while(engine.snapshot().phase==='question'){const f=engine.snapshot().field!;await engine.answer(f.type==='select'?f.options?.[0]?.value||'':'');if(engine.snapshot().error)break}const phase=engine.snapshot().phase;setChecks(old=>[...old,{id,phase}]);if(phase!=='done')break}}finally{setRunning(false)}}
 return <V2Provider user={context.user} business={context.business} view="servicios" port={port} capabilities={{role:'owner',plan:context.business.plan,access:true,statistics:true}} operational={{locked:running,energy:running?'preparation':undefined,cancel:()=>engine.cancel(),panel:<OperationalPanel engine={engine} port={port} view="servicios"/>,helpPanel:<p>Solo lecturas auditadas. Las reservas y todas las escrituras están bloqueadas.</p>,businessPanel:<OperationalPanel engine={engine} port={port} mode="business"/>}}>
 <main className="container" style={{maxWidth:1050,margin:'40px auto',padding:20}}><h1>Validación de lecturas · Pelu</h1><p>Sesión normal · adaptador cloud · RPC existentes · sin escrituras ni envíos.</p><IatrySlot/><button className="btn" disabled={running} onClick={()=>void verify()}>Validar lecturas auditadas</button><ul>{checks.map(c=><li key={c.id}>{c.id}: {c.phase}</li>)}</ul><p>Consultas de IAtry: {gate.count()} · Escrituras permitidas: 0</p>{state.error&&<p role="alert">{state.error}</p>}</main>
 </V2Provider>;
}
function App(){const [context,setContext]=useState<Context|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{signedOut=()=>{setContext(null);setError('La sesión se cerró. Las lecturas están detenidas.')};void auth.ready().then(async()=>{const {data}=await auth.client.auth.getSession();if(data.session)setContext(await connect())}).catch(()=>setError('Iniciá sesión con la cuenta propietaria de Pelu.'));return()=>{signedOut=()=>{}}},[]);
 if(context)return <Trial context={context}/>;
 return <main className="container" style={{maxWidth:480,margin:'70px auto',padding:24}}><h1>IAtry · validación de lecturas</h1><p>Ingresá con la cuenta habitual del propietario de Pelu. No se crean cuentas ni se envían correos.</p><form style={{display:"grid",gap:18,marginTop:28}} onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');const data=new FormData(event.currentTarget);try{await auth.signIn(String(data.get('email')),String(data.get('password')));setContext(await connect())}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}><label style={{display:"grid",gap:8}}>Correo<input name="email" type="email" autoComplete="username" required/></label><label style={{display:"grid",gap:8}}>Contraseña<input name="password" type="password" autoComplete="current-password" required/></label><button className="btn" style={{marginTop:8,minHeight:48}} disabled={busy}>Iniciar sesión</button></form>{error&&<p role="alert">{error}</p>}<p className="small muted">Proyecto djoxdtloqwbrhgtgencc · negocio Pelu · sin publicación.</p></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
