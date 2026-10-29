import {conversationEnergy} from './personality';
import {lazy,Suspense,useEffect,useMemo,useSyncExternalStore} from 'react';
import type {IatryProps} from '../IatryProvider';
import {V2Provider} from '../v2/Provider';
import {createConversation} from './engine';
import {capabilities} from './catalogue';
import {scopeKey} from '../../services/contracts';
import './v3.css';
const Help=lazy(()=>import('./CapabilityHelp').then(m=>({default:m.CapabilityHelp})));
const Panel=lazy(()=>import('./OperationalPanel').then(m=>({default:m.OperationalPanel})));
export function V3Provider(props:IatryProps){
 const port=props.port,scope=port?.scope(),key=scopeKey(scope||null);
 const engine=useMemo(()=>port&&scope?createConversation(port,scope,capabilities,port.demo()?'demo':window.ATRY_CONFIG?.backend==='local'&&['localhost','127.0.0.1'].includes(location.hostname)?window.ATRY_CONFIG?.phaseOneLocal===true?'phase-one-local':'local':'connected',()=>props.canOperate?.()??true):null,[port,key]);
 const state=useSyncExternalStore(engine?.subscribe||(()=>()=>{}),engine?.snapshot||(()=>null));
 useEffect(()=>()=>engine?.dispose(),[engine]);
 useEffect(()=>{props.bindOperationGuard?.(()=>!engine?.busy());return()=>props.bindOperationGuard?.(null)},[engine,props.bindOperationGuard]);
 useEffect(()=>{if(engine&&!engine.busy())engine.cancel()},[props.view,engine]);
 if(!engine||!port)return <V2Provider {...props}/>;
 return <V2Provider {...props} operational={{start:instruction=>{if(engine.busy()||!['idle','done'].includes(engine.snapshot().phase))return false;engine.interpret(instruction);return true},locked:state?.phase==='executing',energy:conversationEnergy(state),cancel:()=>engine.cancel(),businessPanel:<Suspense fallback={<p>Preparando consultas…</p>}><Panel engine={engine} port={port} view={props.view} mode="business"/></Suspense>,helpPanel:<Suspense fallback={null}><Help tools={engine.available()}/></Suspense>,panel:<Suspense fallback={<p role="status">Preparando tus herramientas…</p>}><Panel engine={engine} port={port} view={props.view} onSaved={props.onOperationSaved}/></Suspense>}}/>;
}
