'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {context}=require('./helpers'),{id,now}=require('../server/db'),commercial=require('../server/commercial');
async function fixture(){const t=await context();t.owner=(await t.call('/api/auth/login',{data:{email:'usuario1@example.com',password:'AtryDemo2026!'}})).cookie;t.admin=(await t.call('/api/auth/login',{data:{email:'admin.prueba@example.com',password:'AtryAdmin2026!'}})).cookie;t.bid=t.db.prepare('SELECT id FROM businesses').get().id;t.p='/api/business/'+t.bid;return t;}
test('Comercial: catálogo persistente, solicitud idempotente, teléfono y sin privilegios anticipados',async()=>{const t=await fixture();try{
 const before=t.db.prepare('SELECT plan FROM businesses WHERE id=?').get(t.bid).plan;
 const payload={plan:'individual',phone:'+598 93 802 328',request_id:'request_commercial_001'};
 const r=await t.call(t.p+'/plan-requests',{cookie:t.owner,data:payload});assert.equal(r.status,200);assert.equal(r.body.requests.length,1);assert.equal(r.body.requests[0].phone,'+59893802328');assert.match(r.body.requests[0].message,/ATRY Individual/);assert.match(r.body.requests[0].message, /790/);assert.ok(r.body.requests[0].code.startsWith('ATRY-'));assert.equal(r.body.settings.whatsapp,'59893802328');assert.equal(r.body.settings.tax_status,'pending');assert.equal(t.db.prepare('SELECT plan FROM businesses WHERE id=?').get(t.bid).plan,before);
 assert.equal((await t.call(t.p+'/plan-requests',{cookie:t.owner,data:payload})).body.requests.length,1);
 assert.equal((await t.call(t.p+'/plan-requests',{cookie:t.owner,data:{...payload,plan:'pro'}})).status,409);
 assert.equal((await t.call(t.p+'/plan-requests',{cookie:t.owner,data:{...payload,phone:'093802328'}})).status,400);
 assert.equal((await t.call(t.p+'/subscription',{cookie:t.admin})).status,403);
 const rid=r.body.requests[0].id;assert.equal((await t.call('/api/admin/plan-requests/'+rid,{cookie:t.owner,method:'PATCH',data:{state:'pending_payment'}})).status,403);
 assert.equal((await t.call('/api/admin/plan-requests/'+rid,{cookie:t.admin,method:'PATCH',data:{state:'pending_verification'}})).status,200);
 assert.equal((await t.call(t.p+'/plan-requests/'+rid,{cookie:t.owner,method:'PATCH',data:{state:'cancelled'}})).body.requests[0].state,'cancelled');
}finally{await t.close();}});
test('Comercial: Individual bloquea módulos, exportación, espera pública y conserva horarios y cuenta',async()=>{const t=await fixture();try{
 t.db.prepare("UPDATE businesses SET plan='individual' WHERE id=?").run(t.bid);
 for(const path of ['/recurring','/waitlist','/insights','/statistics','/export/bookings','/members','/mail-jobs'])assert.equal((await t.call(t.p+path,{cookie:t.owner})).status,403,path);
 for(const path of ['/scheduling','/services','/staff','/customers','/subscription','/entitlements'])assert.equal((await t.call(t.p+path,{cookie:t.owner})).status,200,path);
 assert.equal((await t.call('/api/public/negocio-prueba-1/waitlist',{data:{}})).status,403);
 const caps=(await t.call(t.p+'/entitlements',{cookie:t.owner})).body;assert.equal(caps.staff_limit,1);assert.equal(caps.mail_usage.limit,0);assert.equal(caps.features.smartslots,false);
 assert.throws(()=>t.db.prepare('INSERT INTO resources VALUES(?,?,?,?)').run(id(),t.bid,'Sala',1),/FEATURE_DISABLED/);
 assert.throws(()=>t.db.prepare('INSERT INTO staff(id,business_id,name,created_at) VALUES(?,?,?,?)').run(id(),t.bid,'Extra',now()),/STAFF_LIMIT/);
}finally{await t.close();}});
test('Comercial: Negocio tiene estadísticas y espera sin recursos, exportación u ofertas automáticas',async()=>{const t=await fixture();try{
 t.db.prepare("UPDATE businesses SET plan='negocio' WHERE id=?").run(t.bid);assert.equal(commercial.entitlements(t.db,t.bid).staff_limit,4);
 for(const path of ['/recurring','/statistics','/waitlist','/members','/mail-jobs'])assert.equal((await t.call(t.p+path,{cookie:t.owner})).status,200,path);
 for(const path of ['/smartslots','/insights','/export/bookings'])assert.equal((await t.call(t.p+path,{cookie:t.owner})).status,403,path);
 assert.equal(commercial.has(t.db,t.bid,'auto_offers'),false);
}finally{await t.close();}});
test('Comercial: habilitación de solicitud, pago manual y reducción conserva reservas y datos',async()=>{const t=await fixture();try{
 const r=await t.call(t.p+'/plan-requests',{cookie:t.owner,data:{plan:'individual',phone:'+59893802328',request_id:'request_down_commercial_001'}}),rid=r.body.requests[0].id;
 const active=t.db.prepare('SELECT id FROM staff WHERE business_id=? AND active=1').all(t.bid),before=t.db.prepare('SELECT count(*) n FROM bookings').get().n,until=new Date(Date.now()+370*86400000).toISOString().slice(0,10),p={plan:'individual',plan_request_id:rid,subscription_action:'activate',until_day:until,amount_uyu:790,reference:'QA-LOCAL-ONLY-001',request_id:'activate_commercial_001'};
 assert.equal((await t.call('/api/admin/businesses/'+t.bid,{cookie:t.admin,method:'PATCH',data:p})).status,409);
 // Resolve every excluded professional's future appointments before the downgrade.
 t.db.exec("UPDATE bookings SET status='completed'");p.keep_staff_ids=[active[0].id];const res=await t.call('/api/admin/businesses/'+t.bid,{cookie:t.admin,method:'PATCH',data:p});assert.equal(res.status,200);
 assert.equal((await t.call('/api/admin/businesses/'+t.bid,{cookie:t.admin,method:'PATCH',data:p})).body.event_id,res.body.event_id);
 assert.equal(t.db.prepare('SELECT count(*) n FROM bookings').get().n,before);assert.equal(t.db.prepare('SELECT count(*) n FROM staff WHERE business_id=?').get(t.bid).n,3);assert.equal(t.db.prepare('SELECT count(*) n FROM staff WHERE business_id=? AND active=1').get(t.bid).n,1);assert.equal(t.db.prepare('SELECT payment_state FROM plan_requests WHERE id=?').get(rid).payment_state,'verified');
}finally{await t.close();}});
test('Comercial: reserva simultánea de cuota no supera el cupo y conciliación es idempotente',async()=>{const t=await fixture();try{
 t.db.prepare("UPDATE plans SET mail_limit=1 WHERE code='pro'").run();const {enqueue}=require('../server/mail'),job=n=>({id:enqueue(t.db,{key:'quota-'+n,businessId:t.bid,kind:'confirmed',recipient:'client@local.test',content:'Reserva',subject:'Reserva'}),business_id:t.bid,kind:'confirmed'});
 const a=job(1),b=job(2);const {transaction}=require('../server/db');assert.equal(transaction(t.db,()=>commercial.reserve(t.db,a)),true);assert.equal(transaction(t.db,()=>commercial.reserve(t.db,b)),false);commercial.settle(t.db,a,'delivery_unknown');assert.equal(commercial.entitlements(t.db,t.bid).mail_usage.reserved,1);commercial.settle(t.db,a,'provider_accepted');commercial.settle(t.db,a,'provider_accepted');const u=commercial.entitlements(t.db,t.bid).mail_usage;assert.equal(u.accepted,1);assert.equal(u.reserved,0);assert.equal(commercial.reserve(t.db,{...b,kind:'password_reset'}),true);
}finally{await t.close();}});
test('Comercial: dos workers simultáneos no consumen más cuota ni duplican la solicitud',async()=>{const t=await fixture();try{
 const payload={plan:'negocio',phone:'+59893802328',request_id:'concurrent_request_004_001'};const requests=await Promise.all([t.call(t.p+'/plan-requests',{cookie:t.owner,data:payload}),t.call(t.p+'/plan-requests',{cookie:t.owner,data:payload})]);assert.ok(requests.every(r=>r.status===200));assert.equal(t.db.prepare('SELECT count(*) n FROM plan_requests').get().n,1);
 t.db.exec('DELETE FROM notifications; DELETE FROM bookings');t.db.exec("UPDATE plans SET mail_limit=1 WHERE code='pro'");const {enqueue,createWorker}=require('../server/mail');for(let n=0;n<2;n++)enqueue(t.db,{key:'concurrent-quota-'+n,businessId:t.bid,kind:'test_operational',recipient:'fixture@local.test',subject:'Prueba',content:'Local'});let sent=0;const provider={mode:'smtp',async send(){sent++;await new Promise(r=>setTimeout(r,20));return {state:'smtp_accepted',id:'local-fixture'};}};await Promise.all([createWorker(t.db,{provider}).tick(),createWorker(t.db,{provider}).tick()]);assert.equal(sent,1);const u=commercial.entitlements(t.db,t.bid).mail_usage;assert.equal(u.accepted,1);assert.equal(u.reserved,0);assert.equal(t.db.prepare("SELECT count(*) n FROM mail_jobs WHERE state='quota_exhausted' AND dedupe_key LIKE 'concurrent-quota-%'").get().n,1);
}finally{await t.close();}});
