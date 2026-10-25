import {createContext,useCallback,useContext,useEffect,useRef} from 'react';
export interface IatryBindings{registerAnchor(name:string,node:HTMLElement|null):void;registerSlot(name:string,node:HTMLElement|null):void;observeServices(value:unknown):void;dialog(open:boolean):void;ready(view:string,value:boolean):void;carry(view:string):void}
export const IatryContext=createContext<IatryBindings|null>(null);
export function useIatryAnchors(){const context=useContext(IatryContext),callbacks=useRef(new Map<string,(node:HTMLElement|null)=>void>()),current=useRef(context);current.current=context;return useCallback((name:string)=>{if(!callbacks.current.has(name))callbacks.current.set(name,node=>current.current?.registerAnchor(name,node));return callbacks.current.get(name)!},[])}
export function IatrySlot({name='context'}:{name?:string}){const context=useContext(IatryContext),register=context?.registerSlot;const ref=useCallback((node:HTMLDivElement|null)=>register?.(name,node),[register,name]);return <div className="iatry-slot" ref={ref}/>}
export function useIatryServices(value:unknown){const publish=useContext(IatryContext)?.observeServices;useEffect(()=>{if(value!==undefined)publish?.(value)},[value,publish])}
export function useIatryDialog(){const notify=useContext(IatryContext)?.dialog;useEffect(()=>{notify?.(true);return()=>notify?.(false)},[notify])}
export function useIatryStep(){return useContext(IatryContext)?.carry}

export function useIatryReady(view:string,value:boolean){const publish=useContext(IatryContext)?.ready;useEffect(()=>{publish?.(view,value);return()=>publish?.(view,false)},[publish,view,value])}
