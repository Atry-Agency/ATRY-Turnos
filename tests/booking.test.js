const {test}=require('node:test');
const assert=require('node:assert/strict');
const {connect}=require('../server/db');
const {seedDemo}=require('../server/seed');
const {createApp}=require('../server/app');
const {localISO,available}=require('../server/booking');
function nextWeekday(days=2){const localToday=new Date(Date.now()-3*3600000).toISOString().slice(0,10);let d=new Date(Date.parse(localToday+'T12:00:00Z')+days*86400000);while(d.getUTCDay()===0||d.getUTCDay()===6)d=new Date(d.getTime()+86400000);return d.toISOString().slice(0,10);}
async function context(){
  const db=connect(':memory:');seedDemo(db);
  const server=createApp({db}).createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function call(route,{method='GET',data=null,cookie=''}={}){
    const response=await fetch(base+route,{method,headers:{...(data?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});
    const body=await response.json();return {status:response.status,body,cookie:response.headers.get('set-cookie')};
  }
  return {db,server,call,close:async()=>{await new Promise(resolve=>server.close(resolve));db.close();}};
}
test('registro, autenticar, aislar negocio y permisos',async()=>{
  const t=await context();try{
    assert.equal((await t.call('/api/auth/me')).status,401);
    const payload={name:'Nuevo Propietario',email:'owner@test.uy',password:'SeguraNueva!23',business_name:'Taller de Ana'};
    const newBiz=await t.call('/api/auth/register',{method:'POST',data:payload});assert.equal(newBiz.status,200);
    const login=await t.call('/api/auth/login',{method:'POST',data:payload});assert.equal(login.status,200);assert.ok(login.cookie);
    const own=await t.call('/api/auth/me',{cookie:login.cookie});assert.equal(own.body.businesses.length,1);
    const biz=await t.call('/api/business/'+newBiz.body.business_id,{cookie:login.cookie});assert.equal(biz.status,200);
    const demo=t.db.prepare('SELECT id FROM businesses WHERE slug=?').get('negocio-prueba-1');
    assert.equal((await t.call('/api/business/'+demo.id+'/dashboard',{cookie:login.cookie})).status,403);
    assert.equal((await t.call('/api/admin/businesses',{cookie:login.cookie})).status,403);
    const duplicate=await t.call('/api/auth/register',{method:'POST',data:payload});assert.equal(duplicate.status,409);
  }finally{await t.close();}
});
test('reservas reales, bloqueo de superposición, cancelar y volver a reservar',async()=>{
 const t=await context();try{
   const publicBiz=(await t.call('/api/public/negocio-prueba-1')).body;
   assert.ok(publicBiz.services.length>=3);
   const svc=publicBiz.services[0],staff=publicBiz.staff[0];const date=nextWeekday(8);
   let response=await t.call(`/api/public/negocio-prueba-1/availability?date=${date}&service_id=${svc.id}&staff_id=${staff.id}`);
   assert.equal(response.status,200);assert.ok(response.body.slots.length>0);
   const slot=response.body.slots.find(s=>s.time==='09:00')||response.body.slots[0];
   const values={service_id:svc.id,staff_id:staff.id,starts_at:slot.start,customer_name:'Cliente de prueba',customer_email:'cliente-prueba@example.com',accept_policy:true};
   const first=await t.call('/api/public/negocio-prueba-1/book',{method:'POST',data:values});assert.equal(first.status,200);assert.ok(first.body.manage_token);assert.equal(first.body.status,'confirmed');
   const second=await t.call('/api/public/negocio-prueba-1/book',{method:'POST',data:{...values,customer_email:'otro@ejemplo.com'}});assert.equal(second.status,409);
   response=await t.call(`/api/public/negocio-prueba-1/availability?date=${date}&service_id=${svc.id}&staff_id=${staff.id}`);
   assert.equal(response.body.slots.some(s=>s.start===slot.start),false);
   const managed=await t.call('/api/manage/'+first.body.manage_token);assert.equal(managed.status,200);
   const cancelled=await t.call('/api/manage/'+first.body.manage_token+'/cancel',{method:'POST',data:{}});assert.equal(cancelled.status,200);
   const retry=await t.call('/api/public/negocio-prueba-1/book',{method:'POST',data:{...values,customer_email:'otra@ejemplo.com'}});assert.equal(retry.status,200);
   assert.equal((await t.call('/api/manage/token-incorrecto')).status,404);
 }finally{await t.close();}
});
test('cambios de jornada, descansos, exportación y auditoría',async()=>{
 const t=await context();try{
   const login=await t.call('/api/auth/login',{method:'POST',data:{email:'usuario1@example.com',password:'AtryDemo2026!'}});const cookie=login.cookie;
   const biz=t.db.prepare('SELECT id FROM businesses WHERE slug=?').get('negocio-prueba-1').id;
   const staff=(await t.call(`/api/business/${biz}/staff`,{cookie})).body[0];
   const services=(await t.call(`/api/business/${biz}/services`,{cookie})).body;
   const svc=services[0];
   assert.equal((await t.call(`/api/business/${biz}/staff/${staff.id}/hours`,{cookie})).status,200);
   const change=await t.call(`/api/business/${biz}/services/${svc.id}`,{method:'PATCH',cookie,data:{price_uyu:680}});assert.equal(change.status,200);
   const audit=await t.call(`/api/business/${biz}/audit`,{cookie});assert.ok(audit.body.some(x=>x.action==='service.updated'));
   const list=await t.call(`/api/business/${biz}/bookings?date=${nextWeekday(2)}`,{cookie});assert.equal(list.status,200);
   const csv=await fetch(`http://127.0.0.1:${t.server.address().port}/api/business/${biz}/export/bookings`,{headers:{cookie}});assert.equal(csv.status,200);assert.match(await csv.text(),/Precio UYU/);
 }finally{await t.close();}
});
test('validación de datos y reservas fuera de horario',async()=>{
 const t=await context();try{
   const publicBiz=(await t.call('/api/public/negocio-prueba-1')).body,svc=publicBiz.services[0],staff=publicBiz.staff[0];
   const invalid=await t.call('/api/public/negocio-prueba-1/book',{method:'POST',data:{staff_id:staff.id,service_id:svc.id,starts_at:localISO(nextWeekday(5),180),customer_name:'Prueba',customer_email:'p@t.uy',accept_policy:true}});
   assert.equal(invalid.status,409);
   const noConsent=await t.call('/api/public/negocio-prueba-1/book',{method:'POST',data:{staff_id:staff.id,service_id:svc.id,starts_at:localISO(nextWeekday(5),600),customer_name:'Prueba',customer_email:'p@t.uy'}});
   assert.equal(noConsent.status,400);
 }finally{await t.close();}
});
test('lista de espera: solicitud, acceso del dueño y oferta cuando se cancela',async()=>{
 const t=await context();try{
   const pub=(await t.call('/api/public/negocio-prueba-1')).body;
   const date=nextWeekday(10),svc=pub.services[0],staff=pub.staff[0];
   const slot=(await t.call(`/api/public/negocio-prueba-1/availability?date=${date}&service_id=${svc.id}&staff_id=${staff.id}`)).body.slots[0];
   assert.ok(slot);
   const initial=await t.call('/api/public/negocio-prueba-1/book',{method:'POST',data:{staff_id:staff.id,service_id:svc.id,starts_at:slot.start,customer_name:'Primera clienta',customer_email:'primera@example.test',accept_policy:true}});
   assert.equal(initial.status,200);
   const waiter=await t.call('/api/public/negocio-prueba-1/waitlist',{method:'POST',data:{service_id:svc.id,staff_id:staff.id,desired_date:date,customer_name:'Lista Espera',customer_email:'wait@example.test',accept_policy:true}});
   assert.equal(waiter.status,200);
   const repeat=await t.call('/api/public/negocio-prueba-1/waitlist',{method:'POST',data:{service_id:svc.id,staff_id:staff.id,desired_date:date,customer_name:'Lista Espera',customer_email:'wait@example.test',accept_policy:true}});
   assert.equal(repeat.status,409);
   const cancel=await t.call('/api/manage/'+initial.body.manage_token+'/cancel',{method:'POST',data:{}});assert.equal(cancel.status,200);
   const owner=(await t.call('/api/auth/login',{method:'POST',data:{email:'usuario1@example.com',password:'AtryDemo2026!'}})).cookie;
   const biz=t.db.prepare('SELECT id FROM businesses WHERE slug=?').get('negocio-prueba-1').id;
   const w=(await t.call(`/api/business/${biz}/waitlist`,{cookie:owner})).body;
   assert.equal(w.find(x=>x.id===waiter.body.id).status,'offered');
   const notes=(await t.call(`/api/business/${biz}/notifications`,{cookie:owner})).body;
   assert.ok(notes.some(n=>n.kind==='waitlist_offer' && n.state==='queued'));
 }finally{await t.close();}
});
test('plan individual: límite de un profesional y reservas independientes por negocio',async()=>{
 const t=await context();try{
   const owner=(await t.call('/api/auth/login',{method:'POST',data:{email:'usuario1@example.com',password:'AtryDemo2026!'}})).cookie;
   const biz=t.db.prepare('SELECT id FROM businesses WHERE slug=?').get('negocio-prueba-1').id;
   const admin=(await t.call('/api/auth/login',{method:'POST',data:{email:'admin.prueba@example.com',password:'AtryAdmin2026!'}})).cookie;
   assert.equal((await t.call(`/api/admin/businesses/${biz}`,{cookie:admin,method:'PATCH',data:{plan:'individual'}})).status,409);
   // Release fixture appointments explicitly before choosing the single active professional.
   t.db.exec("UPDATE bookings SET status='completed'");
   const keep=t.db.prepare('SELECT id FROM staff WHERE business_id=? LIMIT 1').get(biz).id;
   const change=await t.call(`/api/admin/businesses/${biz}`,{cookie:admin,method:'PATCH',data:{plan:'individual',keep_staff_ids:[keep]}});assert.equal(change.status,200);
   const add=await t.call(`/api/business/${biz}/staff`,{cookie:owner,method:'POST',data:{name:'Cuarto empleado'}});assert.equal(add.status,403);
   const reg=await t.call('/api/auth/register',{method:'POST',data:{name:'Segundo Dueño',email:'new@independent.test',password:'password10293!',business_name:'Otra peluquería'}});
   assert.equal(reg.status,200);
   const other=(await t.call('/api/auth/login',{method:'POST',data:{email:'new@independent.test',password:'password10293!'}})).cookie;
   assert.equal((await t.call(`/api/business/${biz}/customers`,{cookie:other})).status,403);
 }finally{await t.close();}
});
test('dos solicitudes simultáneas nunca confirman el mismo horario',async()=>{
 const t=await context();try{
   const pub=(await t.call('/api/public/negocio-prueba-1')).body;
   const date=nextWeekday(12),svc=pub.services[0],staff=pub.staff[0];
   const slot=(await t.call(`/api/public/negocio-prueba-1/availability?date=${date}&service_id=${svc.id}&staff_id=${staff.id}`)).body.slots[0];
   assert.ok(slot);
   const base={service_id:svc.id,staff_id:staff.id,starts_at:slot.start,customer_name:'Simultáneo',accept_policy:true};
   const [first,second]=await Promise.all([
     t.call('/api/public/negocio-prueba-1/book',{method:'POST',data:{...base,customer_email:'uno@test.uy'}}),
     t.call('/api/public/negocio-prueba-1/book',{method:'POST',data:{...base,customer_email:'dos@test.uy'}})
   ]);
   assert.deepEqual([first.status,second.status].sort(),[200,409]);
   const booked=t.db.prepare('SELECT count(*) n FROM bookings WHERE starts_at=? AND staff_id=? AND status IN (\'pending\',\'confirmed\')').get(slot.start,staff.id);
   assert.equal(booked.n,1);
 }finally{await t.close();}
});
