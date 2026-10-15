'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{context}=require('./helpers');
const {checkSlot,localISO}=require('../server/booking');
const {addDays}= {addDays:(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)};
test('Turnos fijos: duración indefinida, fechas individuales, idempotencia y fin de repetición',async()=>{
 const t=await context();try{
  const login=await t.call('/api/auth/login',{data:{email:'usuario1@example.com',password:'AtryDemo2026!'}}),cookie=login.cookie;
  const bid=t.db.prepare("SELECT id FROM businesses WHERE slug='negocio-prueba-1'").get().id;
  const sid=t.db.prepare('SELECT id FROM staff WHERE business_id=? LIMIT 1').get(bid).id;
  const vid=t.db.prepare('SELECT ss.service_id id FROM staff_services ss JOIN services s ON s.id=ss.service_id WHERE ss.staff_id=? ORDER BY s.duration_min,s.buffer_after_min LIMIT 1').get(sid).id;
  let first=new Date(Date.now()+14*86400000).toISOString().slice(0,10);while(new Date(first+'T12:00:00Z').getUTCDay()===0)first=addDays(first,1);
  const data={staff_id:sid,service_id:vid,customer_name:'Cliente fijo',customer_phone:'099000099',start_day:first,time:'14:00',interval_weeks:1,idempotency_key:'recurring_local_test_01'};
  const url='/api/business/'+bid+'/recurring';const created=await t.call(url,{data,cookie});assert.equal(created.status,200,JSON.stringify(created.body));
  const r=created.body;assert.equal(t.db.prepare('SELECT count(*) n FROM bookings WHERE recurring_id=?').get(r.id).n,6);
  assert.equal((await t.call(url,{data,cookie})).body.id,r.id);
  assert.equal((await t.call(url,{data:{...data,customer_name:'Otro cliente'},cookie})).status,409);
  assert.throws(()=>checkSlot(t.db,bid,sid,vid,localISO(addDays(first,3640),840),{enforceNotice:false}),/turno fijo/);
  const booked=t.db.prepare('SELECT * FROM bookings WHERE recurring_id=? ORDER BY starts_at LIMIT 1').get(r.id);
  assert.equal((await t.call('/api/business/'+bid+'/bookings/'+booked.id,{method:'PATCH',data:{status:'cancelled'},cookie})).status,200);
  assert.ok(checkSlot(t.db,bid,sid,vid,localISO(first,840),{enforceNotice:false}));
  assert.throws(()=>checkSlot(t.db,bid,sid,vid,localISO(addDays(first,7),840),{enforceNotice:false}),/reservado/);
  const future=addDays(first,364);await t.call('/api/business/'+bid+'/bookings?date='+future,{cookie});await t.call('/api/business/'+bid+'/bookings?date='+future,{cookie});
  assert.equal(t.db.prepare('SELECT count(*) n FROM bookings WHERE recurring_id=? AND occurrence_day=?').get(r.id,future).n,1);
  assert.equal((await t.call(url+'/'+r.id+'/end',{data:{from_day:first},cookie})).status,200);
  assert.ok(checkSlot(t.db,bid,sid,vid,localISO(future,840),{enforceNotice:false}));
 }finally{await t.close();}
});
test('Turnos fijos: cambiar repetición es atómico, quincenas y fecha final',async()=>{
 const t=await context();try{
  const cookie=(await t.call('/api/auth/login',{data:{email:'usuario1@example.com',password:'AtryDemo2026!'}})).cookie;
  const bid=t.db.prepare("SELECT id FROM businesses WHERE slug='negocio-prueba-1'").get().id,sid=t.db.prepare('SELECT id FROM staff WHERE business_id=? LIMIT 1').get(bid).id,vid=t.db.prepare('SELECT ss.service_id id FROM staff_services ss JOIN services s ON s.id=ss.service_id WHERE ss.staff_id=? ORDER BY s.duration_min,s.buffer_after_min LIMIT 1').get(sid).id;
  let day=new Date(Date.now()+35*86400000).toISOString().slice(0,10);while(new Date(day+'T12:00:00Z').getUTCDay()===0)day=addDays(day,1);
  const data={staff_id:sid,service_id:vid,customer_name:'Cliente fijo',customer_phone:'099000099',start_day:day,time:'14:00',interval_weeks:2,end_day:addDays(day,21),idempotency_key:'recurring_atomic_001'},url='/api/business/'+bid+'/recurring';
  const r=(await t.call(url,{data,cookie})).body;assert.ok(r.id);assert.equal(t.db.prepare('SELECT count(*) n FROM bookings WHERE recurring_id=?').get(r.id).n,2);
  assert.equal((await t.call('/api/business/'+bid+'/bookings',{cookie,data:{staff_id:sid,service_id:vid,starts_at:localISO(day,900),customer_name:'Otro cliente',customer_phone:'099000098'}})).status,200);
  const failed=await t.call(url,{cookie,data:{...data,time:'15:00',replace_id:r.id,idempotency_key:'recurring_atomic_002'}});assert.equal(failed.status,409);
  assert.equal(t.db.prepare('SELECT active FROM recurring_appointments WHERE id=?').get(r.id).active,1);assert.equal(t.db.prepare("SELECT count(*) n FROM bookings WHERE recurring_id=? AND status='confirmed'").get(r.id).n,2);
  const changed=await t.call(url,{cookie,data:{...data,time:'16:00',replace_id:r.id,idempotency_key:'recurring_atomic_003'}});assert.equal(changed.status,200);assert.notEqual(changed.body.id,r.id);
  assert.equal(t.db.prepare("SELECT count(*) n FROM bookings WHERE recurring_id=? AND status='confirmed'").get(r.id).n,0);
  assert.ok(checkSlot(t.db,bid,sid,vid,localISO(addDays(day,28),960),{enforceNotice:false}));
  assert.equal(t.db.prepare("SELECT count(*) n FROM bookings WHERE recurring_id IS NULL AND starts_at=? AND status='confirmed'").get(localISO(day,900)).n,1);
 }finally{await t.close();}
});
