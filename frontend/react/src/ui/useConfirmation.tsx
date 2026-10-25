import {useEffect,useRef,useState} from 'react';
import {Confirmation} from './primitives';
import {Icon} from './Icon';
import type {FeaturePort} from '../services/contracts';
export function useConfirmation(port:FeaturePort){const [prompt,setPrompt]=useState<{message:string;accept:string;title?:string;variant?:'danger'|'';hideIcon?:boolean}|null>(null),pending=useRef<{promise:Promise<boolean>;resolve:(value:boolean)=>void}|null>(null);
 const confirm=(message:string,accept='Cerrar sin guardar',options:{title?:string;variant?:'danger'|'';hideIcon?:boolean}={})=>{if(pending.current)return Promise.resolve(false);let resolve!:(value:boolean)=>void;const promise=new Promise<boolean>(r=>{resolve=r});pending.current={promise,resolve};setPrompt({message,accept,...options});return promise};
 const answer=(value:boolean)=>{const last=pending.current;pending.current=null;setPrompt(null);last?.resolve(value)};
 useEffect(()=>()=>{pending.current?.resolve(false);pending.current=null},[]);
 return {confirm,confirmation:prompt?<Confirmation {...prompt} icon={<Icon name="shield" port={port}/>} onResolve={answer}/>:null};
}
