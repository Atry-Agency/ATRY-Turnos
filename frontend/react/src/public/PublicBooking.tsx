import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import type {AppPort} from '../app/port';
import type {ScreenController} from '../services/ServicesScreen';
import {Feedback} from '../ui/primitives';
import {publicCatalog,type PublicCatalog,type PublicBusiness,type Receipt} from './contracts';
import {BusinessIdentity,PublicHeader,BookingReceipt} from './Shared';
const Single=lazy(()=>import('./SingleBooking').then(m=>({default:m.SingleBooking}))),Visit=lazy(()=>import('./VisitBooking').then(m=>({default:m.VisitBooking})));
export function PublicBooking({port,slug,control,onTheme}:{port:AppPort;slug:string;control:(value:ScreenController|null)=>void;onTheme:(business:PublicBusiness|null)=>void}){
 const [catalog,setCatalog]=useState<PublicCatalog|null>(null),[error,setError]=useState(''),[receipt,setReceipt]=useState<Receipt|null>(null),generation=useRef(0),child=useRef<ScreenController|null>(null),loadRef=useRef<()=>Promise<void>>(async()=>{});
 async function load(){const version=++generation.current;setError('');try{const p=publicCatalog(await port.request('/api/public/'+encodeURIComponent(slug),{fresh:true}));if(version===generation.current){setCatalog(p);document.title='Reservar en '+p.business.name+' | Atry Turnos'}}catch(e){if(version===generation.current)setError((e as Error).message)}}
 loadRef.current=load;useEffect(()=>{control({reload:()=>loadRef.current(),canRefresh:()=>child.current?.canRefresh?.()??true,beforeLeave:async()=>await child.current?.beforeLeave()??true});void load();return()=>{generation.current++;control(null)}},[slug]);
 useEffect(()=>{onTheme(catalog?.business||null);return()=>onTheme(null)},[catalog?.business,onTheme]);
 if(receipt)return <BookingReceipt port={port} receipt={receipt} management={new URL('./',location.href).href+(port.demo()?'?demo=1&plan='+window.ATRY_DEMO!.number:'')+'#/gestionar/'+receipt.manage_token}/>;
 if(!catalog)return <div className="public-shell"><PublicHeader port={port}/>{error?<div className="closing" role="alert"><h1>No encontramos ese negocio.</h1><p className="muted">{error}</p><a href="#/" className="btn">Volver al inicio</a></div>:<Feedback>Cargando página de reservas…</Feedback>}</div>;
 return <div className="public-shell" data-react-public-booking><PublicHeader port={port} back/><div className="book-layout"><BusinessIdentity business={catalog.business} port={port}/><div className="book-main"><Suspense fallback={<Feedback>Cargando reservas…</Feedback>}>{catalog.business.multi_service_enabled?<Visit catalog={catalog} port={port} control={value=>{child.current=value}}/>:<Single catalog={catalog} port={port} control={value=>{child.current=value}} onReceipt={setReceipt}/>}</Suspense></div></div></div>;
}
