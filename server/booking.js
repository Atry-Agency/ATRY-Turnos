'use strict';
const {id,now,randomToken,hashToken,transaction,audit} = require('./db');
const {scheduleFor,requiredResources}=require('./availability-rules');
class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new HttpError(status,message)};
const pad=n=>String(n).padStart(2,'0');
const minutesText=n=>`${pad(Math.floor(n/60))}:${pad(n%60)}`;
const asMinutes=s=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s)))fail(400,'Hora inválida');const [h,m]=s.split(':').map(Number);return h*60+m;};
const isDate=s=>/^\d{4}-\d\d-\d\d$/.test(String(s)) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s;
// V1: América/Montevideo. Fechas ISO almacenadas en UTC; la disponibilidad se expresa en hora uruguaya.
const localISO=(day,mins)=>{if(!isDate(day))fail(400,'Fecha inválida');return new Date(Date.parse(`${day}T00:00:00-03:00`)+mins*60000).toISOString();};
const localDay=utc=>new Date(Date.parse(utc)-3*3600000).toISOString().slice(0,10);
const localHM=utc=>new Date(Date.parse(utc)-3*3600000).toISOString().slice(11,16);
const weekday=day=>new Date(`${day}T12:00:00Z`).getUTCDay();
const overlap=(a,b,c,d)=>a<d && c<b;
const isLive=b=>require('./subscriptions').live(b);
function base(db,bizId,staffId,serviceId){
  const business=db.prepare('SELECT * FROM businesses WHERE id=?').get(bizId);
  const staff=db.prepare('SELECT * FROM staff WHERE id=? AND business_id=? AND active=1').get(staffId,bizId);
  const service=db.prepare('SELECT * FROM services WHERE id=? AND business_id=? AND active=1').get(serviceId,bizId);
  if(!business||!staff||!service)fail(404,'Negocio, profesional o servicio no disponible');
  if(!db.prepare('SELECT 1 FROM staff_services WHERE staff_id=? AND service_id=?').get(staffId,serviceId))fail(400,'Este profesional no ofrece ese servicio');
  return {business,staff,service};
}
function checkSlot(db,bizId,staffId,serviceId,startISO,{ignoreBooking=null,enforceNotice=true,ignoreRecurring=''}={}) {
  const {business,staff,service}=base(db,bizId,staffId,serviceId);
  if(!isLive(business))fail(403,'El acceso del negocio requiere habilitación o renovación de Atry');
  if(business.timezone!=='America/Montevideo')fail(400,'Zona horaria no compatible en esta versión');
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d\d\dZ$/.test(startISO))fail(400,'Formato de fecha incorrecto');
  const startMs=Date.parse(startISO);
  if(!Number.isFinite(startMs))fail(400,'Fecha incorrecta');
  if(new Date(startMs).toISOString()!==startISO||startMs%60000!==0)fail(400,'El horario debe indicar una fecha real y minutos completos');
  const endMs=startMs+service.duration_min*60000;
  const startDay=localDay(startISO), endDay=localDay(new Date(endMs-1).toISOString());
  if(startDay!==endDay)fail(409,'El servicio debe finalizar el mismo día');
  if(enforceNotice && startMs<Date.now()+business.min_notice_min*60000)fail(409,'Horario fuera del plazo mínimo de reserva');
  if(enforceNotice && startMs>Date.now()+business.max_days*86400000)fail(409,'Fecha fuera del período de reservas');
  const minute=asMinutes(localHM(startISO));
  if(db.prepare('SELECT id FROM holidays WHERE business_id=? AND day=?').get(bizId,startDay))fail(409,'El negocio está cerrado por un feriado configurado');
  const wh=scheduleFor(db,staffId,startDay);
  if(!wh || minute-service.buffer_before_min<wh.start_min || minute+service.duration_min+service.buffer_after_min>wh.end_min)fail(409,'El horario y su preparación deben estar dentro de la jornada laboral');
  if(minute%business.slot_step_min!==0)fail(409,'Horario no compatible con el intervalo del negocio');
  const blockedStart=new Date(startMs-service.buffer_before_min*60000).toISOString();
  const blockedEnd=new Date(endMs+service.buffer_after_min*60000).toISOString();
  const breaks=db.prepare('SELECT * FROM recurring_breaks WHERE staff_id=? AND weekday=?').all(staffId,weekday(startDay));
  if(breaks.some(b=>overlap(minute-service.buffer_before_min,minute+service.duration_min+service.buffer_after_min,b.start_min,b.end_min)))fail(409,'El horario coincide con un descanso recurrente');
  if(require('./recurring').blocks(db,bizId,staffId,serviceId,startISO,ignoreRecurring))fail(409,'Ese horario pertenece a un cliente con turno fijo');
  const resources=requiredResources(db,serviceId);
  for(const resource of resources){
   if(resource.business_id!==bizId||!resource.active)fail(409,'Un recurso requerido no está disponible');
   const used=db.prepare("SELECT b.id FROM booking_resources br JOIN bookings b ON b.id=br.booking_id WHERE br.resource_id=? AND b.status IN ('pending','confirmed') AND b.blocked_from<? AND b.blocked_until>? AND b.id!=? LIMIT 1").get(resource.id,blockedEnd,blockedStart,ignoreBooking||'');if(used)fail(409,`El recurso ${resource.name} está ocupado`);
  }
  const collision=db.prepare(`SELECT id FROM bookings WHERE staff_id=? AND status IN ('pending','confirmed') AND blocked_from < ? AND blocked_until > ? AND id != ? LIMIT 1`)
    .get(staffId,blockedEnd,blockedStart,ignoreBooking||'');
  if(collision)fail(409,'Ese horario ya fue reservado');
  const timeOff=db.prepare('SELECT id FROM time_off WHERE staff_id=? AND starts_at < ? AND ends_at > ? LIMIT 1')
    .get(staffId,blockedEnd,blockedStart);
  if(timeOff)fail(409,'El profesional no está disponible en ese horario');
  return {business,staff,service,resources,starts_at:startISO,ends_at:new Date(endMs).toISOString(),blocked_from:blockedStart,blocked_until:blockedEnd};
}
function available(db,biz,serviceId,date,staffId) {
  if(!isDate(date))fail(400,'Fecha inválida');
  if(!isLive(biz))return [];
  if(Date.parse(`${date}T23:59:59Z`)<Date.now())return [];
  if(Date.parse(`${date}T00:00:00Z`)>Date.now()+biz.max_days*86400000)return [];
  const staff=db.prepare('SELECT s.* FROM staff s JOIN staff_services ss ON ss.staff_id=s.id WHERE s.business_id=? AND s.active=1 AND ss.service_id=?'+(staffId?' AND s.id=?':'')).all(...(staffId?[biz.id,serviceId,staffId]:[biz.id,serviceId]));
  const slots=[];
  for(const s of staff){
    const wh=scheduleFor(db,s.id,date);
    const serv=db.prepare('SELECT * FROM services WHERE id=? AND business_id=? AND active=1').get(serviceId,biz.id);
    if(!wh||!serv)continue;
    for(let minute=wh.start_min;minute+serv.duration_min<=wh.end_min;minute+=biz.slot_step_min){
      if(minute%biz.slot_step_min)continue;
      const utc=localISO(date,minute);
      try{checkSlot(db,biz.id,s.id,serv.id,utc);slots.push({start:utc,time:minutesText(minute),staff_id:s.id,staff_name:s.name});}catch(e){if(!(e instanceof HttpError))throw e;}
    }
  }
  return slots.sort((a,b)=>a.start.localeCompare(b.start)||a.staff_name.localeCompare(b.staff_name));
}
function notify(db,businessId,bookingId,kind,customer,service,startsAt,manageToken=null){
  const previous=db.prepare('SELECT content FROM notifications WHERE booking_id=? ORDER BY created_at LIMIT 1').get(bookingId)?.content||'';
  const privateToken=manageToken||previous.match(/gestionar\/([A-Za-z0-9_-]+)/)?.[1];
  const label=({confirmed:'confirmado',pending:'pendiente de confirmación',cancelled:'cancelado',completed:'completado',no_show:'ausencia registrada',reprogramado:'reprogramado'})[kind]||kind;
  const message=`Hola ${customer.name}. Tu turno de ${service.name} es el ${localDay(startsAt)} a las ${localHM(startsAt)} (Uruguay). Estado: ${label}.${privateToken?` Gestioná tu reserva en /#/gestionar/${privateToken}`:''}`;
  db.prepare('INSERT INTO notifications (id,business_id,booking_id,channel,kind,recipient,subject,content,state,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id(),businessId,bookingId,'email',kind,customer.email,`Atry Turnos — ${kind}`,message,'queued',now());
}
function createBooking(db,data,{actorId=null,source='public',enforceNotice=true,withinTransaction=false,ignoreRecurring='',silent=false}={}){
  const execute=()=>{
    const key=data.idempotency_key;
    const scope=`booking:${source}:${data.business_id}:${actorId||'guest'}`;const requestHash=hashToken(JSON.stringify([data.service_id,data.staff_id,data.starts_at,data.customer_name,data.customer_email,data.customer_phone||'',data.notes||'',data.customer_id||'']));
    if(key!==undefined){if(typeof key!=='string'||!/^[A-Za-z0-9_-]{16,100}$/.test(key))fail(400,'Clave de idempotencia inválida');const previous=db.prepare('SELECT * FROM idempotency_keys WHERE scope=? AND key_hash=?').get(scope,hashToken(key));if(previous){if(previous.request_hash!==requestHash)fail(409,'La clave ya fue usada para otra solicitud');return JSON.parse(previous.response);}}
    const slot=checkSlot(db,data.business_id,data.staff_id,data.service_id,data.starts_at,{enforceNotice,ignoreRecurring});
    if(!isLive(slot.business) && source==='public')fail(403,'Este negocio todavía no admite reservas');
    const name=String(data.customer_name||'').trim(); const email=String(data.customer_email||'').trim().toLowerCase(); const phone=String(data.customer_phone||'').trim();
    if(name.length<2||name.length>100)fail(400,'Ingresá un nombre válido');
    if(!phone && !email)fail(400,'Ingresá teléfono o correo electrónico');
    if(email && !/^\S+@\S+\.\S+$/.test(email))fail(400,'Correo electrónico inválido');
    if(phone.length>35||email.length>150)fail(400,'Datos de contacto demasiado largos');
    const customer=require('./customers').resolve(db,data.business_id,data);
    const bid=id(),manageToken=randomToken();
    const status=slot.business.auto_confirm?'confirmed':'pending';
    // Los pagos son solo estado de seguimiento interno: no hay pasarela activa en la preview.
    db.prepare(`INSERT INTO bookings(id,business_id,staff_id,service_id,customer_id,starts_at,ends_at,blocked_from,blocked_until,status,source,notes,payment_status,price_uyu,manage_token_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(bid,data.business_id,data.staff_id,data.service_id,customer.id,slot.starts_at,slot.ends_at,slot.blocked_from,slot.blocked_until,status,source,String(data.notes||'').slice(0,500),'not_required',slot.service.price_uyu,hashToken(manageToken),now(),now());
    for(const resource of slot.resources)db.prepare('INSERT INTO booking_resources VALUES(?,?)').run(bid,resource.id);
    audit(db,data.business_id,actorId,'booking.created','booking',bid);
    if(!silent)notify(db,data.business_id,bid,status,customer,slot.service,slot.starts_at,manageToken);
    const response={id:bid,status,manage_token:manageToken,starts_at:slot.starts_at};if(key!==undefined)db.prepare('INSERT INTO idempotency_keys VALUES(?,?,?,?,?)').run(scope,hashToken(key),requestHash,JSON.stringify(response),now());return response;
  };
  return withinTransaction?execute():transaction(db,execute);
}
function updateBooking(db,businessId,bookingId,patch,actorId=null){
  return transaction(db,()=>{
    const b=db.prepare('SELECT * FROM bookings WHERE id=? AND business_id=?').get(bookingId,businessId);
    if(!b)fail(404,'Reserva no encontrada');
    if(patch.starts_at===b.starts_at&&(!patch.staff_id||patch.staff_id===b.staff_id)&&!patch.status)return b;
    if(patch.starts_at||patch.staff_id){
      if(['cancelled','completed','no_show'].includes(b.status))fail(409,'Una reserva finalizada no se puede reprogramar');
      const slot=checkSlot(db,businessId,patch.staff_id||b.staff_id,b.service_id,patch.starts_at||b.starts_at,{ignoreBooking:b.id,enforceNotice:false});
      db.prepare('DELETE FROM booking_resources WHERE booking_id=?').run(b.id);
      db.prepare('UPDATE bookings SET staff_id=?,starts_at=?,ends_at=?,blocked_from=?,blocked_until=?,updated_at=? WHERE id=?')
        .run(slot.staff.id,slot.starts_at,slot.ends_at,slot.blocked_from,slot.blocked_until,now(),b.id);
      for(const resource of slot.resources)db.prepare('INSERT INTO booking_resources VALUES(?,?)').run(b.id,resource.id);
      audit(db,businessId,actorId,'booking.rescheduled','booking',b.id);
    }
    if(patch.status){
      const valid={pending:['confirmed','cancelled'],confirmed:['completed','cancelled','no_show'],completed:[],cancelled:[],no_show:[]};
      if(!valid[b.status].includes(patch.status))fail(409,'Cambio de estado no permitido');
      db.prepare('UPDATE bookings SET status=?,updated_at=? WHERE id=?').run(patch.status,now(),b.id);
      audit(db,businessId,actorId,'booking.status.'+patch.status,'booking',b.id);
      if(patch.status==='cancelled' && Date.parse(b.starts_at)>Date.now()){
        const waiting=db.prepare(`SELECT * FROM waitlist WHERE business_id=? AND service_id=? AND desired_date=? AND status='waiting' AND (staff_id IS NULL OR staff_id=?) ORDER BY created_at LIMIT 1`).get(businessId,b.service_id,localDay(b.starts_at),b.staff_id);
        let offerSlot=null;
        if(waiting){try{offerSlot=checkSlot(db,businessId,b.staff_id,waiting.service_id,b.starts_at);}catch(e){if(!(e instanceof HttpError))throw e;}}
        if(waiting&&offerSlot){
          const offerToken=randomToken();
          db.prepare("UPDATE waitlist SET status='offered',offered_at=?,offer_token_hash=?,offer_expires_at=?,offer_starts_at=?,offer_staff_id=? WHERE id=?").run(now(),hashToken(offerToken),new Date(Date.now()+30*60000).toISOString(),b.starts_at,b.staff_id,waiting.id);
          const service=db.prepare('SELECT name FROM services WHERE id=?').get(b.service_id);
          db.prepare('INSERT INTO notifications(id,business_id,booking_id,channel,kind,recipient,subject,content,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
            .run(id(),businessId,b.id,'email','waitlist_offer',waiting.customer_email,'Un horario podría estar libre',
              `Hola ${waiting.customer_name}. Se liberó un horario el ${localDay(b.starts_at)} a las ${localHM(b.starts_at)} para ${service.name}. Confirmá en /#/oferta/${offerToken} dentro de 30 minutos. El horario no se retiene y se valida al confirmar.`, 'queued',now());
        }
      }
    }
    const result=db.prepare(`SELECT b.*,s.name AS service_name, st.name AS staff_name,c.name AS customer_name,c.email AS customer_email,c.phone AS customer_phone FROM bookings b JOIN services s ON s.id=b.service_id JOIN staff st ON st.id=b.staff_id JOIN customers c ON c.id=b.customer_id WHERE b.id=?`).get(b.id);
    if(patch.status||patch.starts_at||patch.staff_id){notify(db,businessId,b.id,patch.status||'reprogramado',{name:result.customer_name,email:result.customer_email},{name:result.service_name},result.starts_at);}
    return result;
  });
}
module.exports={HttpError,fail,isDate,asMinutes,minutesText,localISO,localDay,localHM,weekday,isLive,available,createBooking,updateBooking,checkSlot};
