import {lazy,Suspense,type ComponentProps} from 'react';
import {V2Provider} from './v2/Provider';
import type {Scope} from './v2/contracts';
const Legacy=lazy(()=>import('./LegacyIatryProvider').then(m=>({default:m.LegacyIatryProvider})));
export type IatryProps=ComponentProps<typeof Legacy>&{capabilities?:Scope};
export function IatryProvider(props:IatryProps){return new URLSearchParams(location.search).get('iatry')==='v1'?<Suspense fallback={props.children}><Legacy {...props}/></Suspense>:<V2Provider {...props}/>}
