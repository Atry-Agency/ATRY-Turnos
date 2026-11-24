import {regionalDay} from '../domain/region';
import {bookingList,type Rules} from '../agenda/model';
import type {AppPort} from '../app/port';
import type {scopedApi} from '../infrastructure/scoped-api';
/** Summary/history rows aren't authoritative booking objects. Re-read the existing scoped contract. */
export async function loadSummaryBooking(api:ReturnType<typeof scopedApi>,port:AppPort,id:string,startsAt:string){
 if(!id||!Number.isFinite(Date.parse(startsAt)))throw Error('No se recibió una referencia válida del turno.');
 const day=regionalDay(startsAt,port.business());
 const [bookings,rules]=await Promise.all([
  api.read('/bookings?date='+encodeURIComponent(day)+'&days=1',bookingList,true),
  port.capability('resources')?api.read('/scheduling',value=>{if(!value||typeof value!=='object')throw Error('No pudimos consultar los recursos del turno.');return value as Rules},true):Promise.resolve(null)
 ]);
 const booking=bookings.find(row=>row.id===id);
 if(!booking)throw Error('Este turno ya no está disponible en esa fecha. Actualizá la lista o buscalo en Agenda.');
 return{booking,rules};
}
