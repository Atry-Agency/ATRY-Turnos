'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');const {pg}=require('./pg-context');
const uid=n=>'77777777-7777-4777-8777-77777777777'+n;
async function who(db,n){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[uid(n),JSON.stringify({session_id:uid(n)})]);await db.exec('SET ROLE authenticated');}
async function rpc(db,sql,args=[]){return (await db.query(sql,args)).rows[0]?.v;}
async function setup(){const db=await pg();for(const n of [1,2])await db.query('INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,$2,now(),$3)',[uid(n),'week'+n+'@local.test',JSON.stringify({name:'Semana '+n})]);await db.exec('INSERT INTO auth.sessions(id,user_id) SELECT id,id FROM auth.users;UPDATE users SET platform_admin=1 WHERE id=\''+uid(2)+'\'');await who(db,1);const bid=(await rpc(db,'SELECT atry_create_organization($1::jsonb) v',['{"name":"Semana Flexible","slug":"semana-flexible"}'])).id;await who(db,2);await rpc(db,'SELECT atry_admin_save_business($1,$2::jsonb) v',[bid,JSON.stringify({subscription_action:'activate',plan:'individual',until_day:new Date(Date.now()+60*86400000).toISOString().slice(0,10),amount_uyu:0,note:'Prueba aislada',request_id:'weekly_activation_test_001'})]);await who(db,1);const catalog=await rpc(db,'SELECT atry_catalog($1) v',[bid]);return {db,bid,sid:catalog.staff[0].id};}
const windows=[{weekday:1,start_min:540,end_min:660},{weekday:1,start_min:840,end_min:900},{weekday:1,start_min:1020,end_min:1080}];
test('Semana PostgreSQL: tramos atómicos, validación, aislamiento y permiso de suscripción',async()=>{const {db,bid,sid}=await setup();try{
 const save=w=>rpc(db,'SELECT atry_save_week($1,$2,$3::jsonb) v',[bid,sid,JSON.stringify({windows:w})]);
 assert.equal((await save(windows)).ok,true);const rules=await rpc(db,'SELECT atry_rules($1) v',[bid]);assert.equal(rules.hours.length,1);assert.deepEqual(rules.breaks.map(x=>[x.start_min,x.end_min]).sort((a,b)=>a[0]-b[0]),[[660,840],[900,1020]]);
 await assert.rejects(save([{weekday:1,start_min:600,end_min:700},{weekday:1,start_min:650,end_min:750}]),/OVERLAPPING_HOURS/);
 for(const value of [null,{},[{weekday:1,start_min:0,end_min:1441}],[{weekday:1,start_min:1.5,end_min:100}]])await assert.rejects(save(value),/INVALID_HOURS/);
 assert.equal((await rpc(db,'SELECT atry_rules($1) v',[bid])).breaks.length,2);
 await who(db,2);await assert.rejects(save(windows),/FORBIDDEN/);
 await who(db,1);const other=(await rpc(db,'SELECT atry_create_organization($1::jsonb) v',['{"name":"Negocio independiente","slug":"independiente"}'])).id;
 assert.equal((await rpc(db,'SELECT atry_entitlements($1) v',[other])).access_enabled,false);assert.equal((await rpc(db,'SELECT atry_entitlements($1) v',[bid])).access_enabled,true);
 const otherSid=(await rpc(db,'SELECT atry_catalog($1) v',[other])).staff[0].id;
 await assert.rejects(rpc(db,'SELECT atry_save_week($1,$2,$3::jsonb)',[other,otherSid,JSON.stringify({windows})]),/SUBSCRIPTION_READ_ONLY/);
 await assert.rejects(rpc(db,'SELECT atry_save_week($1,$2,$3::jsonb)',[bid,otherSid,JSON.stringify({windows})]),/INVALID_ASSIGNMENT/);
 await db.exec('RESET ROLE');assert.equal((await db.query("SELECT has_function_privilege('anon','public.atry_save_week(text,text,jsonb)','EXECUTE') v")).rows[0].v,false);
}finally{await db.close();}});
test('Semana PostgreSQL: protege una reserva existente y conserva horas y pausas tras rollback',async()=>{const {db,bid,sid}=await setup();try{
 const date=new Date(Date.now()+20*86400000);while(date.getUTCDay()!==1)date.setUTCDate(date.getUTCDate()+1);date.setUTCHours(17,0,0,0);
 const service=await rpc(db,'SELECT atry_save_service($1,NULL,$2::jsonb) v',[bid,JSON.stringify({name:'Servicio Flexible',duration_min:30,price_uyu:300,staff_ids:[sid]})]);
 await rpc(db,'SELECT atry_save_week($1,$2,$3::jsonb) v',[bid,sid,JSON.stringify({windows})]);
 await rpc(db,'SELECT atry_create_booking($1,$2::jsonb) v',[bid,JSON.stringify({staff_id:sid,service_id:service.id,starts_at:date.toISOString(),customer_name:'Cliente Flexible',customer_email:'flex@local.test',idempotency_key:'weekly_booking_test_001'})]);
 await assert.rejects(rpc(db,'SELECT atry_save_week($1,$2,$3::jsonb)',[bid,sid,JSON.stringify({windows:[windows[0]]})]),/OUTSIDE|HOURS|SCHEDULE|BREAK/);
 const after=await rpc(db,'SELECT atry_rules($1) v',[bid]);assert.equal(after.hours[0].end_min,1080);assert.equal(after.breaks.length,2);
}finally{await db.close();}});
test('Semana PostgreSQL: la verificación remota controlada revierte todos los cambios',async()=>{const {db,bid}=await setup();try{await db.exec('RESET ROLE');const before=await db.query('SELECT * FROM working_hours ORDER BY weekday');const results=await db.exec(require('node:fs').readFileSync('supabase/operations/verify-weekly-availability.sql','utf8'));assert.ok(results.some(r=>r.rows?.some(row=>row.result==='WEEKLY_AVAILABILITY_OK_ROLLED_BACK')));assert.deepEqual((await db.query('SELECT * FROM working_hours ORDER BY weekday')).rows,before.rows);assert.equal((await db.query('SELECT count(*) n FROM recurring_breaks')).rows[0].n,0);}finally{await db.close();}});
