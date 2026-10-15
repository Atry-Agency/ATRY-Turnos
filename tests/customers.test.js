'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{context}=require('./helpers');
test('Clientes: alta, búsqueda por teléfono formateado, duplicados, edición y aislamiento',async()=>{
 const t=await context();try{
  const {cookie}=await t.call('/api/auth/login',{data:{email:'usuario1@example.com',password:'AtryDemo2026!'}});
  const bid=t.db.prepare("SELECT id FROM businesses WHERE slug='negocio-prueba-1'").get().id,url='/api/business/'+bid+'/customers';
  const data={name:'Cliente habitual',email:'habitual@example.com',phone:'099 123 456',notes:'Prefiere la tarde'};
  const created=await t.call(url,{data,cookie});assert.equal(created.status,200,JSON.stringify(created.body));const cid=created.body.id;
  const matches=await t.call(url+'?q=099123456',{cookie});assert.deepEqual(matches.body.map(c=>c.id),[cid]);
  assert.equal((await t.call(url,{data:{...data,email:'otro@example.com',phone:'099-123-456'},cookie})).status,409);
  assert.equal((await t.call(url+'/'+cid,{method:'PATCH',data:{name:'Cliente actualizado'},cookie})).status,200);
  assert.equal(t.db.prepare('SELECT email FROM customers WHERE id=?').get(cid).email,data.email);
  const sid=t.db.prepare('SELECT id FROM staff WHERE business_id=? LIMIT 1').get(bid).id,vid=t.db.prepare('SELECT ss.service_id id FROM staff_services ss JOIN services s ON s.id=ss.service_id WHERE ss.staff_id=? ORDER BY s.duration_min,s.buffer_after_min LIMIT 1').get(sid).id;
  let day=new Date(Date.now()+20*86400000).toISOString().slice(0,10);while(new Date(day+'T12:00:00Z').getUTCDay()===0)day=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  const booking={staff_id:sid,service_id:vid,starts_at:require('../server/booking').localISO(day,900),customer_id:cid,customer_name:'Cliente actualizado',customer_email:data.email,customer_phone:data.phone,idempotency_key:'customer_booking_identity_01'};
  const made=await t.call('/api/business/'+bid+'/bookings',{data:booking,cookie});assert.equal(made.status,200,JSON.stringify(made.body));assert.equal(t.db.prepare('SELECT customer_id FROM bookings WHERE id=?').get(made.body.id).customer_id,cid);
  const invalid=await t.call('/api/business/'+bid+'/bookings',{data:{...booking,starts_at:require('../server/booking').localISO(day,540),customer_id:'foreign-customer',idempotency_key:'customer_booking_identity_02'},cookie});assert.equal(invalid.status,404);
  const other='other-business';t.db.prepare("INSERT INTO businesses(id,slug,name,trial_until,created_at) VALUES(?,?,?,?,?)").run(other,'other-business','Otro negocio',new Date(Date.now()+86400000).toISOString(),new Date().toISOString());
  assert.equal((await t.call('/api/business/'+other+'/customers/'+cid,{method:'PATCH',data:{notes:'No permitido'},cookie})).status,403);
  assert.equal((await t.call(url,{data:{name:'Sin contacto'},cookie})).status,400);
 }finally{await t.close();}
});
