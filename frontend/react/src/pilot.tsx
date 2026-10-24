import {createRoot,type Root} from 'react-dom/client';
import {flushSync} from 'react-dom';
import type {ScreenController} from './services/ServicesScreen';
import {isNativeView,nativeTitles,type NativeView} from './app/routes';
import type {Scope} from './services/contracts';
import {FeatureHost} from './app/FeatureHost';
import type {AppPort} from './app/port';
import {scopeKey,type Extension} from './services/contracts';
declare global {interface Window {ATRY_DEMO?:{enabled:boolean};ATRY_SERVICES_PORT?:AppPort;ATRY_SERVICES_EXTENSION?:Extension}}
const port=window.ATRY_SERVICES_PORT;
if(!window.ATRY_DEMO?.enabled||!port)throw Error('React Services requires the isolated demo bridge.');
let root:Root|null=null,host:HTMLElement|null=null,controller:ScreenController|null=null,activeScope='',activeView:NativeView|null=null,scopeSnapshot:Scope|null=null;
function dispose(){controller=null;const previous=root;root=null;host=null;activeScope='';activeView=null;scopeSnapshot=null;previous?.unmount()}
const extension:Extension={
 async show(view='servicios'){if(!isNativeView(view))throw Error('Ruta React no registrada.');const scope=port.scope();if(!scope)return;const key=scopeKey(scope);if(root&&host?.isConnected&&key===activeScope&&view===activeView){root.render(<FeatureHost view={view} scope={scopeSnapshot!} port={port} control={next=>{controller=next}}/>);controller?.reload();return}dispose();host=port.createHost(view,nativeTitles[view]);activeScope=key;activeView=view;scopeSnapshot=scope;root=createRoot(host);flushSync(()=>root!.render(<FeatureHost view={activeView!} scope={scope} port={port} control={next=>{controller=next}}/>));},
 activeRoute:()=>activeView?'/app/'+activeView:null,
 beforePage:dispose,
 beforeLeave:()=>controller?.beforeLeave()||Promise.resolve(true),
 signedOut:dispose,
};
window.ATRY_SERVICES_EXTENSION=extension;
window.addEventListener('pagehide',dispose);
const restore=(event:PageTransitionEvent)=>{if(event.persisted)location.reload()};window.addEventListener('pageshow',restore);
if(import.meta.hot)import.meta.hot.dispose(()=>{dispose();delete window.ATRY_SERVICES_EXTENSION;window.removeEventListener('pagehide',dispose);window.removeEventListener('pageshow',restore)});
