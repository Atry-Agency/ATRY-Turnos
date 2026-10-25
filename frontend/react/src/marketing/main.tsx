import {createRoot} from 'react-dom/client';
import {Landing} from './Landing';
import '../../../../web/descubrir.css';
document.documentElement.classList.add('js');
document.documentElement.classList.toggle('ios-standalone',(navigator as Navigator&{standalone?:boolean}).standalone===true||matchMedia('(display-mode: standalone)').matches);
const root=createRoot(document.getElementById('root')!);root.render(<Landing/>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
