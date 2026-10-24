import {useEffect,useRef} from 'react';
import type {LegacyPort} from '../services/contracts';
import type {ScreenController} from '../services/ServicesScreen';
export function useDialogGuard(port:LegacyPort,confirm:(message:string,accept?:string)=>Promise<boolean>,control:(value:ScreenController|null)=>void){
 const dirty=useRef(false),pending=useRef(false),live=useRef(true);const confirmRef=useRef(confirm);confirmRef.current=confirm;
 const beforeLeave=async()=>{if(pending.current){port.notify('Esperá a que termine la operación.',true);return false}if(!dirty.current)return true;const leave=await confirmRef.current('Hay cambios sin guardar. ¿Querés cerrar esta ventana?');if(leave)dirty.current=false;return leave};
 useEffect(()=>{live.current=true;control({beforeLeave,reload:()=>{}});const unload=(e:BeforeUnloadEvent)=>{if(dirty.current||pending.current){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',unload);return()=>{live.current=false;control(null);window.removeEventListener('beforeunload',unload)}},[]);
 return {dirty,pending,live,beforeLeave};
}
