import {lazy,Suspense,type ComponentProps} from 'react';
import {V2Provider} from './v2/Provider';
import type {Scope} from './v2/contracts';
import type {AppPort} from '../app/port';
import {V3Provider} from './v3/Provider';
const Legacy=lazy(()=>import('./LegacyIatryProvider').then(m=>({default:m.LegacyIatryProvider})));
export type IatryProps=ComponentProps<typeof Legacy>&{capabilities?:Scope;port?:AppPort;bindOperationGuard?:(guard:(()=>boolean)|null)=>void;onOperationSaved?:()=>void;canOperate?:()=>boolean};
export function IatryProvider(props:IatryProps){return new URLSearchParams(location.search).get('iatry')==='v1'?<Suspense fallback={props.children}><Legacy {...props}/></Suspense>:new URLSearchParams(location.search).get('iatry')==='v2'?<V2Provider {...props}/>:<V3Provider {...props}/>}
