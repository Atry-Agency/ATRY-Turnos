import type {Service} from '../contracts';
import type {CloseoutEntry,ExtraService} from './closeout-model';
import {amountInput,inputMinor} from './model';
function withServices(entry:CloseoutEntry,services:ExtraService[]):CloseoutEntry{
 const note=services.map(s=>(s.quantity>1?s.quantity+' × ':'')+s.name).join(' + ');
 if(note.length>500)throw Error('Hay demasiados detalles para un cobro. Agregá otro cobro extra.');
 return {...entry,custom:false,services,note,amount:services.length?amountInput(services.reduce((n,s)=>n+BigInt(s.unitMinor)*BigInt(s.quantity),0n).toString()):''};
}
/** Local convenience only: the confirmed entry remains a declared income, never a booking or receipt. */
export function addExtraService(entry:CloseoutEntry,service:Service,currency:string){
 if(entry.kind!=='income')return entry;
 if((service.currency||'UYU')!==currency)throw Error('El servicio usa otra moneda. Escribí el cobro como personalizado.');
 const unitMinor=service.currency==='USD'?String(service.price_minor):inputMinor(String(service.price_uyu));
 if(!/^\d+$/.test(unitMinor))throw Error('Revisá el precio del servicio.');
 const services=[...(entry.services||[])],index=services.findIndex(s=>s.id===service.id);
 if(index>=0){if(services[index].quantity>=40)throw Error('Podés sumar hasta 40 unidades de un servicio por cobro.');services[index]={...services[index],quantity:services[index].quantity+1}}
 else {if(services.length>=40)throw Error('Agregá otro cobro extra para sumar más servicios.');services.push({id:service.id,name:service.name,unitMinor,quantity:1})}
 return withServices(entry,services);
}
export function removeExtraService(entry:CloseoutEntry,id:string){return withServices(entry,(entry.services||[]).filter(s=>s.id!==id))}
