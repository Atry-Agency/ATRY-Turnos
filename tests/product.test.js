const {test}=require('node:test');
const assert=require('node:assert/strict');
const {connect,id,now,passwordHash,hashToken}=require('../server/db');
const {createApp}=require('../server/app');
const {checkSlot,localISO}=require('../server/booking');
const {seedDemo}=require('../server/seed');
async function setup(){const db=connect(':memory:');seedDemo(db);const server=createApp({db}).createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;return {db,base,async call(url,data,cookie='',method=data?'POST':'GET'){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',cookie},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};},async close(){await new Promise(r=>server.close(r));db.close();}};}
test('recuperación: sin enumeración, token único, vencimiento y revocación de sesiones',async()=>{const t=await setup();try{
 const a=await t.call('/api/auth/forgot-password',{email:'demo@atryturnos.test'});const b=await t.call('/api/auth/forgot-password',{email:'unknown@test.uy'});assert.deepEqual(a.body,b.body);
 const login=await t.call('/api/auth/login',{email:'demo@atryturnos.test',password:'AtryDemo2026!'});
 const message=t.db.prepare("SELECT content FROM system_outbox WHERE kind='password_reset'").get();const token=message.content.split('/').pop();
 assert.equal((await t.call('/api/auth/reset-password',{token,password:'NuevaSegura2026!'})).status,200);
 assert.equal((await t.call('/api/auth/reset-password',{token,password:'OtraSegura2026!'})).status,400);
 assert.equal((await t.call('/api/auth/me',null,login.cookie)).status,401);
 assert.equal((await t.call('/api/auth/login',{email:'demo@atryturnos.test',password:'NuevaSegura2026!'})).status,200);
 await t.call('/api/auth/forgot-password',{email:'demo@atryturnos.test'});t.db.exec("UPDATE password_resets SET expires_at='2000-01-01T00:00:00.000Z'");const expired=t.db.prepare('SELECT content FROM system_outbox ORDER BY created_at DESC LIMIT 1').get().content.split('/').pop();assert.equal((await t.call('/api/auth/reset-password',{token:expired,password:'NuevaSegura2026!'})).status,400);
}finally{await t.close();}});
test('empleado solo consulta su agenda y administración no abre datos privados',async()=>{const t=await setup();try{
 const bid=t.db.prepare('SELECT id FROM businesses').get().id,staff=t.db.prepare('SELECT id FROM staff WHERE business_id=? LIMIT 1').get(bid).id,uid=id();
 t.db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(uid,'Empleado','staff@test.uy',passwordHash('EmpleadoSegura!'),0,now());t.db.prepare('INSERT INTO memberships VALUES(?,?,?)').run(uid,bid,'staff');t.db.prepare('UPDATE staff SET user_id=? WHERE id=?').run(uid,staff);
 const login=await t.call('/api/auth/login',{email:'staff@test.uy',password:'EmpleadoSegura!'});const prefix='/api/business/'+bid;
 const agenda=await t.call(prefix+'/bookings',null,login.cookie);assert.equal(agenda.status,200);assert.ok(agenda.body.every(x=>x.staff_id===staff));
 for(const p of ['/customers','/dashboard','/notifications','/audit','/staff','/services'])assert.equal((await t.call(prefix+p,null,login.cookie)).status,403,p);
 assert.equal((await t.call(prefix+'/bookings',{},login.cookie)).status,403);
 const admin=await t.call('/api/auth/login',{email:'admin@atryturnos.test',password:'AtryAdmin2026!'});assert.equal((await t.call(prefix+'/customers',null,admin.cookie)).status,403);assert.equal((await t.call('/api/admin/operations',null,admin.cookie)).status,200);
}finally{await t.close();}});
test('configuración inicial, períodos de agenda, SmartSlots y recursos de marca',async()=>{const t=await setup();try{
 const login=await t.call('/api/auth/login',{email:'demo@atryturnos.test',password:'AtryDemo2026!'}),cookie=login.cookie;const bid=t.db.prepare('SELECT id FROM businesses').get().id,p='/api/business/'+bid;
 assert.equal((await t.call(p,{onboarding_completed:1},cookie,'PATCH')).body.onboarding_completed,1);
 assert.equal((await t.call(p+'/bookings?days=32',null,cookie)).status,400);
 const date=new Date(Date.now()+4*86400000).toISOString().slice(0,10);const smart=await t.call(p+'/smartslots?date='+date,null,cookie);assert.equal(smart.status,200);assert.ok(Array.isArray(smart.body.suggestions));
 assert.equal((await fetch(t.base+'/assets/brand/atry.png')).status,200);assert.equal((await fetch(t.base+'/product.css')).status,200);assert.equal((await fetch(t.base+'/assets/brand/../../server/db.js')).status,404);
 const registered=await t.call('/api/auth/register',{name:'Sin servicios',business_name:'Sin servicios',email:'new@test.uy',password:'SeguraNueva2026!'});const fresh=await t.call('/api/auth/login',{email:'new@test.uy',password:'SeguraNueva2026!'});assert.equal((await t.call('/api/business/'+registered.body.business_id,{onboarding_completed:1},fresh.cookie,'PATCH')).status,409);
}finally{await t.close();}});
test('oferta de lista de espera: disponibilidad, aceptación concurrente y vencimiento',async()=>{const t=await setup();try{
 const publicBiz=(await t.call('/api/public/estudio-sofia')).body;const service=publicBiz.services[0];let date=new Date(Date.now()+8*86400000).toISOString().slice(0,10);let availability=await t.call(`/api/public/estudio-sofia/availability?date=${date}&service_id=${service.id}`);if(!availability.body.slots.length){date=new Date(Date.now()+9*86400000).toISOString().slice(0,10);availability=await t.call(`/api/public/estudio-sofia/availability?date=${date}&service_id=${service.id}`);}const slot=availability.body.slots[0];assert.ok(slot);
 const original=await t.call('/api/public/estudio-sofia/book',{service_id:service.id,staff_id:slot.staff_id,starts_at:slot.start,customer_name:'Original',customer_email:'original@test.uy',accept_policy:true});
 await t.call('/api/public/estudio-sofia/waitlist',{service_id:service.id,staff_id:slot.staff_id,desired_date:date,customer_name:'En espera',customer_email:'espera@test.uy',accept_policy:true});
 assert.equal((await t.call('/api/manage/'+original.body.manage_token+'/cancel',{})).status,200);
 const content=t.db.prepare("SELECT content FROM notifications WHERE kind='waitlist_offer'").get().content;const token=content.match(/oferta\/([A-Za-z0-9_-]+)/)[1];assert.equal((await t.call('/api/offers/'+token)).status,200);
 t.db.prepare("UPDATE waitlist SET offer_expires_at='2000-01-01T00:00:00.000Z' WHERE offer_token_hash=?").run(hashToken(token));assert.equal((await t.call('/api/offers/'+token)).status,404);assert.equal((await t.call('/api/offers/'+token+'/accept',{accept_policy:true})).status,409);t.db.prepare('UPDATE waitlist SET offer_expires_at=? WHERE offer_token_hash=?').run(new Date(Date.now()+1800000).toISOString(),hashToken(token));
 const results=await Promise.all([t.call('/api/offers/'+token+'/accept',{accept_policy:true}),t.call('/api/offers/'+token+'/accept',{accept_policy:true})]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);assert.equal(t.db.prepare("SELECT status FROM waitlist WHERE customer_email='espera@test.uy'").get().status,'booked');
 assert.equal((await t.call('/api/offers/'+token)).status,404);
}finally{await t.close();}});
test('migración aditiva y persistencia conservan usuarios y reservas al reconectar',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const folder=fs.mkdtempSync(path.join(os.tmpdir(),'atry-test-')),file=path.join(folder,'db.sqlite');let db;
 try{db=connect(file);seedDemo(db);const users=db.prepare('SELECT count(*) n FROM users').get().n,bookings=db.prepare('SELECT count(*) n FROM bookings').get().n;db.close();db=connect(file);assert.equal(db.prepare('SELECT count(*) n FROM users').get().n,users);assert.equal(db.prepare('SELECT count(*) n FROM bookings').get().n,bookings);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db?.close();fs.rmSync(folder,{recursive:true,force:true});}
});
test('buffers dentro de jornada, minutos completos y métricas sin reservas futuras',async()=>{const t=await setup();try{
 const bid=t.db.prepare('SELECT id FROM businesses').get().id,staff=t.db.prepare('SELECT id FROM staff WHERE business_id=? LIMIT 1').get(bid).id,service=t.db.prepare('SELECT service_id id FROM staff_services WHERE staff_id=? LIMIT 1').get(staff).id;
 let d=new Date(Date.now()+15*86400000);while([0,6].includes(d.getUTCDay()))d=new Date(d.getTime()+86400000);const day=d.toISOString().slice(0,10);
 t.db.prepare('UPDATE services SET buffer_before_min=15 WHERE id=?').run(service);
 assert.throws(()=>checkSlot(t.db,bid,staff,service,localISO(day,540)),/jornada/);
 assert.throws(()=>checkSlot(t.db,bid,staff,service,localISO(day,600).replace('00.000Z','01.000Z')),/minutos completos/);
 const login=await t.call('/api/auth/login',{email:'demo@atryturnos.test',password:'AtryDemo2026!'});const dash=await t.call('/api/business/'+bid+'/dashboard',null,login.cookie);assert.equal(dash.body.totals.total,0);assert.ok(dash.body.daily.every(x=>x.day<=new Date(Date.now()-3*3600000).toISOString().slice(0,10)));
}finally{await t.close();}});
