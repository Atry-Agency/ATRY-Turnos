import {createRoot} from 'react-dom/client';
import {ApplicationModel} from './app/model';
import {NativeApp} from './app/NativeApp';
import '../../../web/styles.css';
import '../../../web/product.css';
import '../../../web/control-center.css';
import '../../../web/appearance.css';
import '../../../web/workspace.css';
import '../../../web/typography.css';
import '../../../web/business-polish.css';
import '../../../web/agenda.css';
import '../../../web/theme-studio.css';
import '../../../web/visits.css';
import '../../../web/whatsapp.css';
import '../../../web/buttons.css';
import '../../../web/staff-photos.css';
const root=createRoot(document.getElementById('root')!);let model:ApplicationModel|null=null,disposed=false;
async function start(){try{const config=window.ATRY_CONFIG,cloud=config?.backend==='supabase'&&!window.ATRY_DEMO?.enabled?(await import('./infrastructure/cloud-runtime')).createCloudRuntime(config):undefined;if(disposed)return;model=new ApplicationModel({config,cloud});root.render(<NativeApp model={model}/>)}catch(error){if(!disposed)root.render(<div className="closing"><h2>No pudimos iniciar Atry Turnos</h2><p>{error instanceof Error?error.message:'Reintentá la conexión.'}</p><button className="btn" onClick={()=>location.reload()}>Reintentar</button></div>)}}
void start();
if(!import.meta.env.DEV&&window.ATRY_CONFIG?.backend!=='preview'&&'serviceWorker'in navigator&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){const register=()=>{void navigator.serviceWorker.register('./sw.js').catch(()=>{})};if(document.readyState==='complete')register();else window.addEventListener('load',register,{once:true})}
if(import.meta.hot)import.meta.hot.dispose(()=>{disposed=true;root.unmount();model?.dispose()});
