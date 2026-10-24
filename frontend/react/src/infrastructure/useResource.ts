import {useEffect,useMemo,useRef,useState} from 'react';
import type {LegacyPort,Scope} from '../services/contracts';
import type {ScreenController} from '../services/ServicesScreen';
import {scopedApi} from './scoped-api';
export function useLoader<T>(port:LegacyPort,scope:Scope,key:string,loader:(api:ReturnType<typeof scopedApi>,fresh:boolean)=>Promise<T>,control:(value:ScreenController|null)=>void,allowStaff=false,allowSupport=false,allowPlanRequests=false){
 const api=useMemo(()=>scopedApi(port,scope,{allowStaff,allowSupport,allowPlanRequests}),[port,scope,allowStaff,allowSupport,allowPlanRequests]),[data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),live=useRef(true),generation=useRef(0),pending=useRef(false),reloadRef=useRef<()=>Promise<void>>(async()=>{}),loaderRef=useRef(loader);loaderRef.current=loader;
 async function load(fresh=false){const sequence=++generation.current;setLoading(true);setError('');try{const value=await loaderRef.current(api,fresh);if(live.current&&api.current()&&sequence===generation.current)setData(value)}catch(e){if(live.current&&api.current()&&sequence===generation.current)setError(e instanceof Error?e.message:'No se pudo cargar la pantalla.')}finally{if(live.current&&api.current()&&sequence===generation.current)setLoading(false)}}
 reloadRef.current=()=>load(true);
 useEffect(()=>{live.current=true;api.activate();void load();control({reload:()=>{if(!pending.current)void reloadRef.current()},beforeLeave:async()=>!pending.current});return()=>{live.current=false;generation.current++;api.dispose();control(null)}},[api,key]);
 async function command<R=unknown>(path:string,payload:unknown,method='POST'):Promise<R>{if(pending.current)throw Error('Ya hay una operación en curso.');pending.current=true;setBusy(true);setError('');try{const result=await api.write(path,payload,method);if(!live.current||!api.current())throw Error('La pantalla cambió durante la operación.');await reloadRef.current();return result as R}catch(e){if(live.current&&api.current())setError(e instanceof Error?e.message:'No se pudo guardar.');throw e}finally{pending.current=false;if(live.current&&api.current())setBusy(false)}}
 async function write(path:string,payload:unknown,method='POST'){try{await command(path,payload,method);return true}catch{return false}}
 return {api,data,error,loading,busy,command,reload:()=>reloadRef.current(),write};
}

export function useResource<T>(port:LegacyPort,scope:Scope,route:string,decode:(value:unknown)=>T,control:(value:ScreenController|null)=>void,allowSupport=false){return useLoader(port,scope,route,(api,fresh)=>api.read(route,decode,fresh),control,false,allowSupport)}
