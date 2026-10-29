import type {Evidence} from './v2/contracts';
import {createContext,useCallback,useContext,useEffect,useRef} from 'react';
export interface IatryBindings{request?:(instruction?:string)=>void;motionOff?:boolean;findAnchor?:(name:string)=>HTMLElement|undefined;registerAnchor(name:string,node:HTMLElement|null):void;registerSlot(name:string,node:HTMLElement|null):void;observeServices(value:unknown):void;dialog(open:boolean):void;ready(view:string,value:boolean):void;carry(view:string):void;publishEvidence?(value:Evidence|null):void}
export const IatryContext=createContext<IatryBindings|null>(null);
export function useIatryAnchors(){const context=useContext(IatryContext),callbacks=useRef(new Map<string,(node:HTMLElement|null)=>void>()),current=useRef(context);current.current=context;return useCallback((name:string)=>{if(!callbacks.current.has(name))callbacks.current.set(name,node=>current.current?.registerAnchor(name,node));return callbacks.current.get(name)!},[])}
export function IatrySlot({name='context'}:{name?:string}){const context=useContext(IatryContext),register=context?.registerSlot;const ref=useCallback((node:HTMLDivElement|null)=>register?.(name,node),[register,name]);return <div className="iatry-slot" ref={ref}/>}
export function useIatryServices(value:unknown){const publish=useContext(IatryContext)?.observeServices;useEffect(()=>{if(value!==undefined)publish?.(value)},[value,publish])}
export function useIatryDialog(){const notify=useContext(IatryContext)?.dialog;useEffect(()=>{notify?.(true);return()=>notify?.(false)},[notify])}
export function useIatryStep(){return useContext(IatryContext)?.carry}

export function useIatryReady(view:string,value:boolean){const publish=useContext(IatryContext)?.ready;useEffect(()=>{publish?.(view,value);return()=>publish?.(view,false)},[publish,view,value])}

// Screens publish only aggregates from their existing successful loaders.
export function useIatryEvidence(value:Omit<Evidence,'observedAt'>|null){const publish=useContext(IatryContext)?.publishEvidence,signature=JSON.stringify(value);useEffect(()=>{publish?.(signature==='null'?null:{...JSON.parse(signature),observedAt:Date.now()});return()=>publish?.(null)},[signature,publish])}

export function useIatryRequest(){return useContext(IatryContext)?.request}
export function useIatryMotionOff(){return useContext(IatryContext)?.motionOff??true}
