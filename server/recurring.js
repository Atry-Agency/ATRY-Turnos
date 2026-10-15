'use strict';
const {id,now,transaction,audit,hashToken}=require('./db');
const {fail,isDate,asMinutes,localISO,localDay,localHM,checkSlot,createBooking}=require('./booking');
const addDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const dayNumber=d=>Math.round(Date.parse(d+'T12:00:00Z')/86400000);
function migrate(db){
 db.exec(`CREATE TABLE IF NOT EXISTS recurring_appointments (
 id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),staff_id TEXT NOT NULL REFERENCES staff(id),service_id TEXT NOT NULL REFERENCES services(id),
 customer_name TEXT NOT NULL,customer_email TEXT NOT NULL DEFAULT '',customer_phone TEXT NOT NULL DEFAULT '',start_day TEXT NOT NULL,end_day TEXT,
 minute INTEGER NOT NULL,interval_weeks INTEGER NOT NULL CHECK(interval_weeks IN (1,2,4)),active INTEGER NOT NULL DEFAULT 1,notes TEXT NOT NULL DEFAULT '',
 last_error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS recurring_business ON recurring_appointments(business_id,active);`);
 const columns=db.prepare('PRAGMA table_info(bookings)').all().map(c=>c.name);
 if(!columns.includes('recurring_id'))db.exec('ALTER TABLE bookings ADD COLUMN recurring_id TEXT REFERENCES recurring_appointments(id)');
 if(!columns.includes('occurrence_day'))db.exec('ALTER TABLE bookings ADD COLUMN occurrence_day TEXT');
 db.exec('CREATE UNIQUE INDEX IF NOT EXISTS recurring_occurrence ON bookings(recurring_id,occurrence_day)');
}
const applies=(s,d)=>s.active&&d>=s.start_day&&(!s.end_day||d<=s.end_day)&&(dayNumber(d)-dayNumber(s.start_day))%(s.interval_weeks*7)===0;
function blocks(db,bid,sid,vid,starts,ignoreSeries=''){
 const day=localDay(starts),minute=asMinutes(localHM(starts));
 const service=db.prepare('SELECT * FROM services WHERE id=? AND business_id=?').get(vid,bid);if(!service)return false;
 const rows=db.prepare('SELECT r.*,s.duration_min,s.buffer_before_min,s.buffer_after_min FROM recurring_appointments r JOIN services s ON s.id=r.service_id WHERE r.business_id=? AND r.active=1').all(bid);
 const resources=db.prepare('SELECT resource_id FROM service_resources WHERE service_id=?').all(vid).map(x=>x.resource_id);
 return rows.some(r=>r.id!==ignoreSeries&&applies(r,day)&&!db.prepare('SELECT 1 FROM bookings WHERE recurring_id=? AND occurrence_day=?').get(r.id,day)&&
  (r.staff_id===sid||db.prepare('SELECT resource_id FROM service_resources WHERE service_id=?').all(r.service_id).some(x=>resources.includes(x.resource_id)))&&
  minute-service.buffer_before_min<r.minute+r.duration_min+r.buffer_after_min&&r.minute-r.buffer_before_min<minute+service.duration_min+service.buffer_after_min);
}
function expandInside(db,bid,start,days,{strict=false,actorId=null,onlySeries=''}={}){
 if(!require('./subscriptions').live(db.prepare('SELECT * FROM businesses WHERE id=?').get(bid)))return false;
 const series=db.prepare('SELECT * FROM recurring_appointments WHERE business_id=? AND active=1').all(bid);
 for(const r of series.filter(r=>!onlySeries||r.id===onlySeries)){let error='';for(let i=0;i<days;i++){
  const day=addDays(start,i);if(!applies(r,day)||db.prepare('SELECT 1 FROM bookings WHERE recurring_id=? AND occurrence_day=?').get(r.id,day))continue;
  try{
   const b=createBooking(db,{business_id:bid,staff_id:r.staff_id,service_id:r.service_id,starts_at:localISO(day,r.minute),customer_name:r.customer_name,customer_email:r.customer_email,customer_phone:r.customer_phone,notes:r.notes},
    {actorId,source:'manual',enforceNotice:false,withinTransaction:true,ignoreRecurring:r.id,silent:true});
   db.prepare("UPDATE bookings SET recurring_id=?,occurrence_day=?,status='confirmed',source='recurring' WHERE id=?").run(r.id,day,b.id);
  }catch(e){if(strict)fail(e.status||409,`${day}: ${e.message}`);error=`${day}: ${e.message}`;}
 }db.prepare('UPDATE recurring_appointments SET last_error=? WHERE id=?').run(error,r.id);}
}
function expand(db,bid,start,days){return transaction(db,()=>expandInside(db,bid,start,days));}
function list(db,bid){return db.prepare('SELECT r.*,s.name service_name,st.name staff_name FROM recurring_appointments r JOIN services s ON s.id=r.service_id JOIN staff st ON st.id=r.staff_id WHERE r.business_id=? ORDER BY r.active DESC,r.start_day,r.minute').all(bid);}
function create(db,bid,payload,actorId){return transaction(db,()=>{
 const key=payload.idempotency_key,scope='recurring:'+bid+':'+actorId,requestHash=hashToken(JSON.stringify(Object.fromEntries(Object.entries(payload).filter(([k])=>k!=='idempotency_key').sort(([a],[b])=>a.localeCompare(b)))));
 if(typeof key!=='string'||!/^[A-Za-z0-9_-]{16,100}$/.test(key))fail(400,'Falta la clave de la solicitud');
 const previous=db.prepare('SELECT * FROM idempotency_keys WHERE scope=? AND key_hash=?').get(scope,hashToken(key));
 if(previous){if(previous.request_hash!==requestHash)fail(409,'La solicitud cambió');return JSON.parse(previous.response);}
 const name=String(payload.customer_name||'').trim(),email=String(payload.customer_email||'').trim().toLowerCase(),phone=String(payload.customer_phone||'').trim();
 const first=payload.start_day,end=payload.end_day||null,weeks=Number(payload.interval_weeks||1),minute=asMinutes(payload.time);
 if(!isDate(first)||first<localDay(now())||Date.parse(localISO(first,minute))<Date.now()||(end&&(!isDate(end)||end<first))||![1,2,4].includes(weeks))fail(400,'Revisá las fechas y la frecuencia del turno fijo');
 if(name.length<2||name.length>100||(!email&&!phone)||email.length>150||phone.length>35||(email&&!/^\S+@\S+\.\S+$/.test(email)))fail(400,'Ingresá el nombre y un contacto válido del cliente');
 if(payload.replace_id)endInside(db,bid,payload.replace_id,first,actorId);
 if(db.prepare('SELECT count(*) n FROM recurring_appointments WHERE business_id=? AND active=1 AND (end_day IS NULL OR end_day>=?)').get(bid,localDay(now())).n>=200)fail(400,'Se alcanzó el límite de 200 turnos fijos activos');
 const firstSlot=checkSlot(db,bid,payload.staff_id,payload.service_id,localISO(first,minute),{enforceNotice:false});
 const candidate={id:id(),business_id:bid,staff_id:payload.staff_id,service_id:payload.service_id,customer_name:name,customer_email:email,customer_phone:phone,start_day:first,end_day:end,minute,interval_weeks:weeks,active:1,notes:String(payload.notes||'').slice(0,500)};
 // Check all existing future bookings, including dates beyond the public booking horizon.
 for(const b of db.prepare("SELECT * FROM bookings WHERE business_id=? AND status IN ('pending','confirmed') AND starts_at>=?").all(bid,localISO(first,0))){
  const d=localDay(b.starts_at);if(!applies(candidate,d))continue;
  checkSlot(db,bid,payload.staff_id,payload.service_id,localISO(d,minute),{enforceNotice:false});
 }
 // Weekly patterns have a maximum cycle of four weeks. Check future series even when they start later.
 for(const other of list(db,bid).filter(r=>r.active)){
  const ov=db.prepare('SELECT * FROM services WHERE id=?').get(other.service_id),v=firstSlot.service;
  const shared=db.prepare('SELECT 1 FROM service_resources x JOIN service_resources y ON x.resource_id=y.resource_id WHERE x.service_id=? AND y.service_id=?').get(candidate.service_id,other.service_id);
  if(other.staff_id!==candidate.staff_id&&!shared)continue;
  if(minute-v.buffer_before_min>=other.minute+ov.duration_min+ov.buffer_after_min||other.minute-ov.buffer_before_min>=minute+v.duration_min+v.buffer_after_min)continue;
  let from=other.start_day>first?other.start_day:first;
  for(let i=0;i<28;i++){const d=addDays(from,i);if(applies(candidate,d)&&applies(other,d))fail(409,'Ese horario pertenece a otro turno fijo');}
 }
 db.prepare('INSERT INTO recurring_appointments(id,business_id,staff_id,service_id,customer_name,customer_email,customer_phone,start_day,end_day,minute,interval_weeks,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(candidate.id,bid,candidate.staff_id,candidate.service_id,name,email,phone,first,end,minute,weeks,candidate.notes,now(),now());
 expandInside(db,bid,first,42,{strict:true,actorId,onlySeries:candidate.id});audit(db,bid,actorId,'recurring.created','recurring',candidate.id);
 const response={...candidate,ends_at:firstSlot.ends_at};db.prepare('INSERT INTO idempotency_keys VALUES(?,?,?,?,?)').run(scope,hashToken(key),requestHash,JSON.stringify(response),now());return response;
});}
function endInside(db,bid,rid,from,actorId){
 const r=db.prepare('SELECT * FROM recurring_appointments WHERE id=? AND business_id=?').get(rid,bid);if(!r)fail(404,'Turno fijo no encontrado');
 if(!isDate(from)||from<localDay(now()))fail(400,'Elegí una fecha desde hoy');
 if(r.end_day&&r.end_day<from)return {ok:true};
 const until=addDays(from,-1);if(!r.end_day||r.end_day>until)db.prepare('UPDATE recurring_appointments SET end_day=?,active=?,updated_at=? WHERE id=?').run(until,from<=r.start_day?0:1,now(),rid);
 db.prepare("UPDATE bookings SET status='cancelled',updated_at=? WHERE recurring_id=? AND starts_at>=? AND status IN ('pending','confirmed')").run(now(),rid,new Date(Math.max(Date.parse(localISO(from,0)),Date.now())).toISOString());
 audit(db,bid,actorId,'recurring.ended','recurring',rid);return {ok:true};
}
function end(db,bid,rid,from,actorId){return transaction(db,()=>endInside(db,bid,rid,from,actorId));}
module.exports={migrate,applies,blocks,expand,expandInside,list,create,end};
