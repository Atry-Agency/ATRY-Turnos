import {useEffect,useMemo,useState} from 'react';
import type {AppPort} from '../app/port';
import type {Scope} from '../services/contracts';
import type {ScreenController} from '../services/ServicesScreen';
import type {RecurringRecord} from './RecurringEditor';
import {scopedApi} from '../infrastructure/scoped-api';
import {Button,Modal,TextField} from '../ui/primitives';
import {Icon} from '../ui/Icon';
import {useConfirmation} from '../ui/useConfirmation';
import {useDialogGuard} from '../ui/useDialogGuard';
import {today} from '../domain/format';
export function EndRecurring({port,scope,row,control,onClose,onSaved}:{port:AppPort;scope:Scope;row:RecurringRecord;control:(value:ScreenController|null)=>void;onClose:()=>void;onSaved:()=>void}){const api=useMemo(()=>scopedApi(port,scope,{allowCancellation:true}),[port,scope]),{confirm,confirmation}=useConfirmation(port),guard=useDialogGuard(port,confirm,control);const [day,setDay]=useState(today()),[busy,setBusy]=useState(false),[error,setError]=useState('');useEffect(()=>{api.activate();return()=>api.dispose()},[api]);async function submit(){if(guard.pending.current)return;guard.pending.current=true;setBusy(true);setError('');let success=false;try{await api.write('/recurring/'+encodeURIComponent(row.id)+'/end',{from_day:day});if(api.current()&&guard.live.current){guard.dirty.current=false;port.notify('Repetición terminada');success=true}}catch(e){if(guard.live.current)setError(e instanceof Error?e.message:'No se pudo terminar la repetición.')}finally{guard.pending.current=false;if(guard.live.current)setBusy(false)}if(success)onSaved()}
return <><Modal title="Terminar repetición" onClose={()=>{void guard.beforeLeave().then(leave=>{if(leave)onClose()})}} closeIcon={<Icon name="x" port={port}/>}><form className="stack" data-react-form="end-recurring" onSubmit={e=>{e.preventDefault();void submit()}}><p>Cliente: <strong>{row.customer_name}</strong>. Se cancelan las fechas pendientes desde el día elegido. Se conserva el historial y no se eliminan las reservas.</p><TextField id="f-from_day" name="from_day" label="Terminar desde" type="date" value={day} min={today()} required onChange={e=>{guard.dirty.current=true;setDay(e.target.value)}} readOnly={busy}/>{error&&<p className="small" role="alert">{error}</p>}<Button variant="danger" type="submit" disabled={busy}>Terminar y liberar horarios</Button></form></Modal>{confirmation}</>}
