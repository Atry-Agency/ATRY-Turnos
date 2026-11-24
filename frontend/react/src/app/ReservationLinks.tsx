import {useId,useState} from 'react';
import type {AppPort} from './port';
import {Button} from '../ui/primitives';
import {Icon} from '../ui/Icon';

/** Shares the existing public URL. Opening WhatsApp never sends a message. */
export function ReservationLinks({port}:{port:AppPort}){
 const id=useId(),[copied,setCopied]=useState(false),[manual,setManual]=useState(false),url=port.publicURL();
 async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);setManual(false)}catch{setManual(true)}}
 return <section className="stack" aria-label="Enlace para tus clientes">
  <p className="small muted">Probá cómo reservan tus clientes o compartí tu página. No necesitan una cuenta.</p>
  <div className="actions">
   <Button type="button" small variant="secondary" onClick={()=>void copy()}><Icon name={copied?'check':'copy'} port={port}/>{copied?'Enlace copiado':'Copiar enlace'}</Button>
   <a className="btn secondary sm" href={url} target="_blank" rel="noopener"><Icon name="external" port={port}/>Probar como cliente</a>
   <a className="btn secondary sm" href={'https://wa.me/?text='+encodeURIComponent('Reservá tu próximo turno en '+port.business().name+': '+url)} target="_blank" rel="noopener"><Icon name="whatsapp" port={port}/>Compartir por WhatsApp</a>
  </div>
  {copied&&<p className="small muted" role="status">Enlace copiado. Podés pegarlo donde quieras compartirlo.</p>}
  {manual&&<div className="field"><label htmlFor={id}>Copiá este enlace</label><input id={id} readOnly value={url} onFocus={e=>e.currentTarget.select()}/><p className="small muted" role="status">El navegador no permitió copiarlo automáticamente.</p></div>}
  <p className="tiny muted">WhatsApp abre un mensaje preparado. Vos elegís a quién enviarlo y confirmás el envío.</p>
 </section>;
}
