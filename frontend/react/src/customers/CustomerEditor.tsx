import {useRef,useState,type ReactNode} from 'react';
import {Button,TextField} from '../ui/primitives';
import {Icon} from '../ui/Icon';
import {localDateTime,statusLabels} from '../domain/format';
import type {LegacyPort} from '../services/contracts';
import {draftOf,type Customer,type CustomerDraft,type HistoryRow} from './contracts';
export function CustomerEditor({customer,history,port,busy,onDraft,onSave,onClose,communication}:{customer?:Customer;history:HistoryRow[];port:LegacyPort;busy:boolean;onDraft:(dirty:boolean,draft:CustomerDraft)=>void;onSave:(draft:CustomerDraft)=>Promise<void>;onClose:()=>void;communication:ReactNode}){
 const initial=useRef(draftOf(customer));const [draft,setDraft]=useState(initial.current),[error,setError]=useState('');const pending=useRef(false);
 const change=(next:CustomerDraft)=>{setDraft(next);onDraft(JSON.stringify(next)!==JSON.stringify(initial.current),next)};
 return <div className="customer-profile"><p className="customer-profile-subtitle">Ficha del cliente</p><h3>Datos del cliente</h3><form id="customer-profile-form" data-react-form="customer" onSubmit={async e=>{e.preventDefault();if(pending.current||busy)return;pending.current=true;setError('');try{await onSave(draft)}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el cliente.')}finally{pending.current=false}}}>
  <TextField id="f-name" name="name" label="Nombre" value={draft.name} required minLength={2} maxLength={100} onChange={e=>change({...draft,name:e.target.value})} readOnly={busy}/>
  <TextField id="f-phone" name="phone" label="Teléfono" type="tel" value={draft.phone} maxLength={35} onChange={e=>change({...draft,phone:e.target.value})} readOnly={busy}/>
  <TextField id="f-email" name="email" label="Correo" type="email" value={draft.email} maxLength={150} onChange={e=>change({...draft,email:e.target.value})} readOnly={busy}/>
  <p className="small muted">Los turnos existentes conservan su contacto original. Los nuevos usan estos datos.</p><div className="field"><label htmlFor="customer-notes">Notas internas</label><textarea id="customer-notes" name="notes" value={draft.notes} onChange={e=>change({...draft,notes:e.target.value})} readOnly={busy}/></div>
  <label className="checkline"><input type="checkbox" name="marketing_consent" checked={draft.marketing_consent} onChange={e=>change({...draft,marketing_consent:e.target.checked})} disabled={busy}/>{' Tiene consentimiento para comunicaciones promocionales'}</label>{error&&<p role="alert" className="small">{error}</p>}
 </form>
 {customer&&<><section aria-label="Comunicación"><h3>Comunicación</h3>{communication}<p className="tiny muted">El consentimiento de WhatsApp se verifica al preparar el mensaje. No se envía automáticamente.</p></section><section aria-label="Historial de reservas"><h3>Historial de reservas</h3>{history.length?history.map(a=><div className="activity" key={a.id}><div className="grow"><strong className="small">{a.service_name}</strong><div className="tiny muted">{`${localDateTime(a.starts_at)} · ${a.staff_name||''}`}</div></div><span className={'badge '+a.status}>{statusLabels[a.status]||'Estado sin identificar'}</span></div>):<div className="empty"><Icon name="calendar" port={port} className="big"/><div>Sin reservas registradas</div></div>}</section></>}
 <footer className="customer-profile-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancelar edición</Button><Button type="submit" form="customer-profile-form" disabled={busy}>{busy?<><span className="spin"/> Guardando...</>:<><Icon name="check" port={port}/> Guardar cambios</>}</Button></footer></div>;
}
