import {createRoot,type Root} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ServicesScreen,type ScreenController} from './services/ServicesScreen';
import {scopeKey,type Extension,type LegacyPort} from './services/contracts';
declare global {interface Window {ATRY_DEMO?:{enabled:boolean};ATRY_SERVICES_PORT?:LegacyPort;ATRY_SERVICES_EXTENSION?:Extension}}
const port=window.ATRY_SERVICES_PORT;
if(!window.ATRY_DEMO?.enabled||!port)throw Error('React Services requires the isolated demo bridge.');
let root:Root|null=null,host:HTMLElement|null=null,controller:ScreenController|null=null,activeScope='';
function dispose(){controller=null;const previous=root;root=null;host=null;activeScope='';previous?.unmount()}
const extension:Extension={
 async show(){const scope=port.scope();if(!scope)return;const key=scopeKey(scope);if(root&&host?.isConnected&&key===activeScope){controller?.reload();return}dispose();host=port.createHost();activeScope=key;root=createRoot(host);flushSync(()=>root!.render(<ServicesScreen scope={scope} port={port} control={next=>{controller=next}}/>));},
 beforePage:dispose,
 beforeLeave:()=>controller?.beforeLeave()||Promise.resolve(true),
 signedOut:dispose,
};
window.ATRY_SERVICES_EXTENSION=extension;
window.addEventListener('pagehide',dispose);
const restore=(event:PageTransitionEvent)=>{if(event.persisted)location.reload()};window.addEventListener('pageshow',restore);
if(import.meta.hot)import.meta.hot.dispose(()=>{dispose();delete window.ATRY_SERVICES_EXTENSION;window.removeEventListener('pagehide',dispose);window.removeEventListener('pageshow',restore)});
