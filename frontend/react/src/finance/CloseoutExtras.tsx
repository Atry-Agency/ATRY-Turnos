import {useEffect,useState} from 'react';
import type {AppPort} from '../app/port';
import type {Service} from '../contracts';
import type {scopedApi} from '../infrastructure/scoped-api';
import {parseCatalog} from '../services/repository';
import {Button,TextField} from '../ui/primitives';
import {Icon} from '../ui/Icon';
import {CloseoutSelect} from './CloseoutPayments';
import type {CloseoutEntry} from './closeout-model';
import {financeMoney,inputMinor,type FinanceData} from './model';
import {addExtraService,removeExtraService} from './extra-services';

export function CloseoutExtras({entries,onChange,api,port,data,defaultMethod,disabled,showErrors}:{entries:CloseoutEntry[];onChange:(entries:CloseoutEntry[])=>void;api:ReturnType<typeof scopedApi>;port:AppPort;data:FinanceData;defaultMethod:string;disabled:boolean;showErrors:boolean}){
 const [services,setServices]=useState<Service[]|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[loading,setLoading]=useState(false),[problem,setProblem]=useState<{id:string;text:string}|null>(null);
 const needsServices=entries.some(e=>e.kind==='income');
 useEffect(()=>{if(!needsServices||services)return;let current=true;setLoading(true);setError('');void api.read('/services',v=>parseCatalog(v,[]).services,true).then(value=>{if(current)setServices(value)}).catch(e=>{if(current)setError((e as Error).message)}).finally(()=>{if(current)setLoading(false)});return()=>{current=false}},[needsServices,services,attempt,api]);
 function add(kind:'income'|'expense'){onChange([...entries,{id:crypto.randomUUID(),kind,amount:'',note:'',method:defaultMethod}])}
 return <><div className="closeout-add-actions">{(['income','expense'] as const).map(kind=><Button type="button" key={kind} variant="secondary" disabled={disabled||entries.length>=40} onClick={()=>add(kind)}><Icon name={kind==='income'?'plus':'wallet'} port={port}/>{kind==='income'?'Cobré algo más':'Pagué un gasto'}</Button>)}</div>
 <div className="closeout-entries">{entries.map((e,i)=>{
 const change=(value:Partial<CloseoutEntry>)=>onChange(entries.map(x=>x.id===e.id?{...x,...value}:x));let amountError='';try{if(BigInt(inputMinor(e.amount))<=0n)amountError='Ingresá cuánto '+(e.kind==='income'?'cobraste':'pagaste')+'. Debe ser mayor que cero.'}catch{amountError='Usá un número con hasta dos decimales.'}
 return <article key={e.id}><header><strong>{e.kind==='income'?'Cobro extra':'Gasto'} {i+1}</strong><Button type="button" variant="secondary" disabled={disabled} aria-label={'Quitar movimiento '+(i+1)} onClick={()=>onChange(entries.filter(x=>x.id!==e.id))}><Icon name="x" port={port}/></Button></header>
 {e.kind==='income'&&<><CloseoutSelect port={port} caption="¿Qué cobraste?" label={'Servicios del cobro '+(i+1)} value={e.custom?'__custom':''} disabled={disabled} onChange={id=>{setProblem(null);if(id==='__custom'){change({custom:true,services:undefined});return}const service=services?.find(s=>s.id===id);if(service){try{change(addExtraService(e,service,data.currency))}catch(reason){setProblem({id:e.id,text:(reason as Error).message})}}}}><option value="" disabled>{loading?'Buscando tus servicios…':e.services?.length?'Sumar otro servicio':'Elegí un servicio'}</option>{(services||[]).map(s=><option key={s.id} value={s.id} disabled={(s.currency||'UYU')!==data.currency}>{s.name}{!s.active?' · oculto':''}</option>)}<option value="__custom">Algo personalizado</option></CloseoutSelect>
 {problem?.id===e.id&&<p className="ag-field-error" role="alert">{problem.text}</p>}{error&&<div className="closeout-catalog-error" role="status"><span>No pudimos cargar los servicios. Podés escribir el detalle.</span><Button type="button" variant="secondary" disabled={disabled||loading} onClick={()=>setAttempt(n=>n+1)}>Volver a buscar</Button></div>}
 {e.services&&e.services.length>0&&<ul className="closeout-extra-services" aria-label={'Servicios elegidos para el cobro '+(i+1)}>{e.services.map(s=><li key={s.id}><span><b>{s.quantity>1?s.quantity+' × ':''}{s.name}</b><small>{financeMoney((BigInt(s.unitMinor)*BigInt(s.quantity)).toString(),port.business())}</small></span><Button type="button" variant="secondary" disabled={disabled} aria-label={'Quitar '+s.name+' del cobro '+(i+1)} onClick={()=>change(removeExtraService(e,s.id))}><Icon name="x" port={port}/></Button></li>)}</ul>}</>}
 <TextField label={e.kind==='income'&&e.services?.length?'Detalle':'¿Qué fue?'} aria-label={'Concepto '+(i+1)} name={'concept-'+e.id} value={e.note} maxLength={500} disabled={disabled} placeholder={e.kind==='income'?'Contanos qué cobraste':'Por ejemplo: compré insumos'} error={showErrors&&e.note.trim().length<3?'Contanos de qué se trata.':undefined} onChange={v=>change({note:v.target.value})}/>
 <TextField label={e.kind==='income'?'Cuánto cobraste':'Cuánto pagaste'} aria-label={'Importe '+(i+1)} name={'entry-'+e.id} inputMode="decimal" value={e.amount} disabled={disabled} placeholder={e.kind==='income'?'Ingresá cuánto cobraste':'Ingresá cuánto pagaste'} error={showErrors?amountError:undefined} onChange={v=>change({amount:v.target.value})}/>
 <CloseoutSelect port={port} caption={e.kind==='income'?'Cómo te pagaron':'Cómo lo pagaste'} label={'Método del movimiento '+(i+1)} value={e.method} disabled={disabled} onChange={method=>change({method})}>{data.methods.map(m=><option key={m.id} value={m.id}>{m.name}{m.cash?' · '+data.accounts.find(a=>a.id===m.account_id)?.name:''}</option>)}</CloseoutSelect></article>
 })}</div></>;
}
