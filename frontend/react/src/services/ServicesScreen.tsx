import {useEffect,useMemo,useRef,useState} from 'react';
import type {Service} from '../contracts';
import {ServiceCard} from '../ServiceCard';
import {Button,Confirmation,Feedback,Modal} from '../ui/primitives';
import {Icon} from '../ui/Icon';
import {canManage,type Catalog,type FeaturePort,type Scope,type ServicePayload} from './contracts';
import {createServicesRepository,StaleScopeError} from './repository';
import {initialDraft,type Draft} from './form';
import {ServiceEditor} from './ServiceEditor';
export interface ScreenController {beforeLeave():Promise<boolean>;reload():void}
export function ServicesScreen({scope,port,control}:{scope:Scope;port:FeaturePort;control:(controller:ScreenController|null)=>void}){
 const repository=useMemo(()=>createServicesRepository(port,scope),[port,scope]);
 const [catalog,setCatalog]=useState<Catalog|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [editor,setEditor]=useState<{service:Service|null;draft:Draft}|null>(null);
 const [confirmation,setConfirmation]=useState<{message:string;accept:string}|null>(null);
 const resolveConfirmation=useRef<((answer:boolean)=>void)|null>(null),confirmationPromise=useRef<Promise<boolean>|null>(null);
 const mounted=useRef(true),operation=useRef(false),sequence=useRef(0),dirty=useRef(false);
 const reloadRef=useRef<()=>void>(()=>{});
 function ask(message:string,accept:string){if(confirmationPromise.current)return confirmationPromise.current;setConfirmation({message,accept});const promise=new Promise<boolean>(resolve=>{resolveConfirmation.current=resolve});confirmationPromise.current=promise;return promise;}
 function answer(accepted:boolean){setConfirmation(null);const resolve=resolveConfirmation.current;resolveConfirmation.current=null;confirmationPromise.current=null;resolve?.(accepted);}
 const valid=()=>mounted.current&&repository.current();
 async function load(fresh=false){const request=++sequence.current;setLoading(true);setError('');try{const next=await repository.load(fresh);if(valid()&&request===sequence.current)setCatalog(next)}catch(e){if(valid()&&request===sequence.current&&!(e instanceof StaleScopeError))setError(e instanceof Error?e.message:'No pudimos cargar los servicios.')}finally{if(valid()&&request===sequence.current)setLoading(false)}}
 reloadRef.current=()=>{if(!operation.current)void load(true)};
 useEffect(()=>{mounted.current=true;repository.activate();void load();control({reload:()=>reloadRef.current(),beforeLeave:async()=>{if(operation.current){port.notify('Esperá a que termine el guardado para salir.',true);return false}if(!dirty.current)return true;const accepted=await ask('Hay cambios sin guardar. ¿Querés cerrar esta ventana?','Cerrar sin guardar');if(accepted)dirty.current=false;return accepted}});return()=>{mounted.current=false;repository.dispose();sequence.current++;control(null);resolveConfirmation.current?.(false);resolveConfirmation.current=null;confirmationPromise.current=null;dirty.current=false;}},[repository]);
 useEffect(()=>{const unload=(e:BeforeUnloadEvent)=>{if(dirty.current||operation.current){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',unload);return()=>window.removeEventListener('beforeunload',unload)},[]);
 async function close(){if(operation.current)return;if(dirty.current&&!await ask('Hay cambios sin guardar. ¿Querés cerrar esta ventana?','Cerrar sin guardar'))return;dirty.current=false;setEditor(null)}
 function open(service:Service|null){if(!catalog||operation.current)return;dirty.current=false;setEditor({service,draft:initialDraft(service,catalog.staff)})}
 async function write(payload:ServicePayload|{active:number},id?:string){
  if(operation.current)return;operation.current=true;setBusy(true);
  try{await repository.save(payload,id);if(!valid())return;dirty.current=false;setEditor(null);port.notify('active' in payload?'Servicio actualizado':'Servicio guardado');await load(true)}finally{operation.current=false;if(valid())setBusy(false)}
 }
 async function toggle(s:Service){if(operation.current)return;if(s.active&&!await ask('¿Ocultar el servicio de las nuevas reservas? Las reservas existentes se conservan.','Ocultar servicio'))return;try{await write({active:s.active?0:1},s.id)}catch(e){if(valid())setError(e instanceof Error?e.message:'No se pudo actualizar el servicio.')}}
 if(!['owner','manager'].includes(scope.role))return <Feedback error>No tenés permiso o acceso habilitado para gestionar servicios.</Feedback>;
 return <>
  <div className="page-header"><div><span className="eyebrow">ATRY TURNOS / PANEL</span><h1>Servicios</h1><p>Definí qué ofrecés, cuánto dura y qué cuesta.</p></div><Button data-react-action="add-service" disabled={busy||!catalog||!canManage(scope)} onClick={()=>open(null)}><Icon name="plus" port={port}/> Nuevo servicio</Button></div>
  {error&&<Feedback error retry={()=>void load(true)}>{error}</Feedback>}
  {loading&&!catalog&&<Feedback>Cargando servicios…</Feedback>}
  {catalog&&<div className="grid3" data-react-services-list aria-busy={loading}>{catalog.services.length?catalog.services.map(s=><ServiceCard key={s.id} service={s} icon={<Icon name={port.serviceIcon(scope.sector,s.name)} port={port}/>} editIcon={<Icon name="edit" port={port}/>} onEdit={()=>open(s)} onToggle={()=>void toggle(s)} disabled={busy||!canManage(scope)}/>):<div className="empty"><svg className="i i-scissors big" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{__html:port.icon('scissors')}}/><div>Todavía no hay servicios. Creá el primero para abrir la agenda.</div></div>}</div>}
  <div className="hint-block" style={{marginTop:20}}><Icon name="info" port={port}/>{' Un servicio con reservas futuras no permite cambiar su duración para evitar conflictos. Podés ocultarlo y crear otra versión.'}</div>
  {editor&&catalog&&<Modal title={editor.service?'Editar servicio':'Nuevo servicio'} onClose={()=>void close()} closeIcon={<Icon name="x" port={port}/>}><ServiceEditor key={editor.service?.id||'new'} initial={editor.draft} staff={catalog.staff} port={port} id={editor.service?.id} busy={busy} onDraft={draft=>{dirty.current=JSON.stringify(draft)!==JSON.stringify(editor.draft)}} onSave={payload=>write(payload,editor.service?.id)}/></Modal>}
  {confirmation&&<Confirmation message={confirmation.message} accept={confirmation.accept} icon={<Icon name="shield" port={port}/>} onResolve={answer}/>}
 </>;
}
