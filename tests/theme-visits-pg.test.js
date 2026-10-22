'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {pg}=require('./pg-context');
const uid=n=>'66666666-6666-4666-8666-66666666666'+n;
async function who(db,n){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[uid(n),JSON.stringify({session_id:uid(n)})]);await db.exec('SET ROLE authenticated');}
async function service(db){await db.exec("RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false);SELECT set_config('request.jwt.claims','{}',false);SET ROLE service_role");}
const rpc=async(db,sql,args=[])=>(await db.query(sql,args)).rows[0]?.v;
async function setup(){
 const db=await pg();for(const n of [1,2,3])await db.query('INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,$2,now(),$3)',[uid(n),'owner'+n+'@visit.test',JSON.stringify({name:'Propietario '+n})]);
 await db.exec('INSERT INTO auth.sessions(id,user_id) SELECT id,id FROM auth.users');await db.query('UPDATE users SET platform_admin=1 WHERE id=$1',[uid(3)]);
 await who(db,1);const b=await rpc(db,'SELECT atry_create_organization($1::jsonb) v',[JSON.stringify({name:'Salón Completo',slug:'salon-completo'})]);
 await who(db,3);await rpc(db,'SELECT atry_admin_save_business($1,$2::jsonb) v',[b.id,JSON.stringify({subscription_action:'activate',plan:'pro',until_day:new Date(Date.now()+60*86400000).toISOString().slice(0,10),amount_uyu:0,note:'Validación aislada',request_id:'visit_activation_test_001'})]);
 await who(db,1);await rpc(db,'SELECT atry_save_business($1,$2::jsonb) v',[b.id,'{"multi_service_enabled":1}']);
 const catalog=await rpc(db,'SELECT atry_catalog($1) v',[b.id]),staff=[catalog.staff[0].id];
 for(const n of [2,3])staff.push((await rpc(db,'SELECT atry_save_staff($1,NULL,$2::jsonb) v',[b.id,JSON.stringify({name:'Profesional '+n})])).id);
 const windows=Array.from({length:7},(_,weekday)=>({weekday,start_min:540,end_min:1140}));for(const sid of staff)await rpc(db,'SELECT atry_save_week($1,$2,$3::jsonb) v',[b.id,sid,JSON.stringify({windows})]);
 const ids=[];for(const [i,duration]of [20,35,45].entries())ids.push((await rpc(db,'SELECT atry_save_service($1,NULL,$2::jsonb) v',[b.id,JSON.stringify({name:['Cejas','Depilación','Corte'][i],duration_min:duration,price_uyu:(i+1)*100,staff_ids:[staff[i]]})])).id);
 const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 const options=async day=>{await service(db);return rpc(db,'SELECT atry_public_visit_availability($1,$2::jsonb) v',['salon-completo',JSON.stringify({date:day||date,service_ids:ids})]);};
 return {db,bid:b.id,staff,ids,date,options};
}
function booking(option,key='combined_visit_request_001'){return {legs:option.legs,quote:option.quote,accept_policy:true,customer_name:'Cliente de visita',customer_phone:'099123456',customer_email:'cliente@visit.test',idempotency_key:key};}
test('PostgreSQL temas: esquema, revisión, permisos, aislamiento y proyección pública',async()=>{
 const {db,bid}=await setup();try{
  const config={version:1,primary:'#A44B6D',sidebar:'#ED80A6',surface:'#FFF0F1',presets:[{name:'Mi rosa',config:{version:1,primary:'#A44B6D'}}]};
  await rpc(db,'SELECT atry_save_appearance($1,$2::jsonb) v',[bid,JSON.stringify({theme_config:config,expected_revision:0})]);
  const b=await rpc(db,'SELECT atry_business($1) v',[bid]);assert.equal(b.theme_revision,1);assert.equal(b.theme_config.sidebar,'#ED80A6');
  await assert.rejects(rpc(db,'SELECT atry_save_appearance($1,$2::jsonb)',[bid,JSON.stringify({theme_config:config,expected_revision:0})]),/STALE_REVISION/);
  await assert.rejects(rpc(db,'SELECT atry_save_appearance($1,$2::jsonb)',[bid,'{"theme_config":{"primary":"url(https://invalid)"}}']),/INVALID_APPEARANCE/);
  await service(db);let info=await rpc(db,'SELECT atry_public_info($1) v',['salon-completo']);assert.equal(info.business.plan,'pro');assert.equal(info.business.theme_config.sidebar,'#ED80A6');assert.equal(info.business.theme_config.presets,undefined);
  await db.exec('RESET ROLE');await db.query("UPDATE businesses SET plan='individual' WHERE id=$1",[bid]);
  await service(db);info=await rpc(db,'SELECT atry_public_info($1) v',['salon-completo']);assert.equal(info.business.theme_config.sidebar,undefined);assert.equal(info.business.theme_config.primary,'#4754E6');
  await who(db,1);await assert.rejects(rpc(db,'SELECT atry_save_business($1,$2::jsonb)',[bid,'{"theme_config":{"sidebar":"#ED80A6"}}']),/APPEARANCE_PLAN_REQUIRED/);
  assert.equal((await rpc(db,'SELECT atry_business($1) v',[bid])).theme_revision,1);
  await who(db,2);await assert.rejects(rpc(db,'SELECT atry_save_appearance($1,$2::jsonb)',[bid,'{}']),/FORBIDDEN/);
 }finally{await db.close();}
});
test('PostgreSQL visitas: continuidad fuera de cuadrícula, guardado íntegro, cuota y repetición segura',async()=>{
 const {db,bid,ids,date,options}=await setup();try{
  const available=await options();const selected=available.options.find(o=>o.time==='10:00');assert.ok(selected);assert.equal(selected.duration_min,100);assert.equal(selected.price_uyu,600);
  assert.equal(new Date(selected.legs[1].starts_at).getUTCMinutes(),20);assert.equal(new Date(selected.legs[2].starts_at).getUTCMinutes(),55);
  const body=booking(selected),out=await rpc(db,'SELECT atry_public_visit_book($1,$2::jsonb) v',['salon-completo',JSON.stringify(body)]);assert.equal(out.legs.length,3);assert.equal(out.visit,true);
  assert.deepEqual(await rpc(db,'SELECT atry_public_visit_book($1,$2::jsonb) v',['salon-completo',JSON.stringify(body)]),out);
  await assert.rejects(rpc(db,'SELECT atry_public_visit_book($1,$2::jsonb)',['salon-completo',JSON.stringify({...body,customer_name:'Otro cliente'})]),/IDEMPOTENCY_MISMATCH/);
  const publicRead=await rpc(db,'SELECT atry_manage($1) v',[out.manage_token]);assert.equal(publicRead.customer_name,body.customer_name);assert.ok(!JSON.stringify(publicRead).includes('customer_phone'));assert.ok(!JSON.stringify(publicRead).includes('manage_token_hash'));
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*) n FROM booking_visits')).rows[0].n,1);assert.equal((await db.query('SELECT count(*) n FROM bookings')).rows[0].n,3);
  assert.equal((await db.query('SELECT count(*) n FROM notifications')).rows[0].n,1);assert.equal((await db.query("SELECT count(*) n FROM mail_jobs WHERE kind='confirmed'")).rows[0].n,1);
  assert.ok((await db.query('SELECT private.mail_is_valid(j) ok FROM mail_jobs j')).rows.every(j=>j.ok));
  await db.exec('SET ROLE service_role');await db.query('SELECT atry_mail_ingest()');await db.exec('RESET ROLE');
  assert.equal((await db.query("SELECT count(*) n FROM mail_jobs WHERE kind='reminder'")).rows[0].n,1);
  const reminder=(await db.query("SELECT content FROM mail_jobs WHERE kind='reminder'")).rows[0];assert.ok(reminder.content.includes('Depilación'));assert.ok(reminder.content.includes('Corte'));assert.ok(reminder.content.includes(out.manage_token));
  await who(db,1);const bookings=await rpc(db,'SELECT atry_bookings($1,$2,1) v',[bid,date]);assert.equal(bookings.length,3);assert.ok(bookings.every(b=>b.visit_id===out.id));
  await assert.rejects(rpc(db,'SELECT atry_update_booking($1,$2,$3::jsonb)',[bid,out.legs[0].id,'{"status":"cancelled"}']),/VISIT_REQUIRED/);
  await who(db,2);await assert.rejects(rpc(db,'SELECT atry_visit($1,$2)',[bid,out.id]),/FORBIDDEN/);
  await db.exec('RESET ROLE;SET ROLE anon');await assert.rejects(db.query('SELECT * FROM booking_visits'));await assert.rejects(db.query('SELECT atry_public_visit_book($1,$2::jsonb)',['salon-completo',JSON.stringify(body)]));
 }finally{await db.close();}
});
test('PostgreSQL visitas: reprogramación íntegra, conflicto de cliente, cancelación y datos completados',async()=>{
 const {db,bid,date,options}=await setup();try{
  const selected=(await options()).options.find(o=>o.time==='10:00');const out=await rpc(db,'SELECT atry_public_visit_book($1,$2::jsonb) v',['salon-completo',JSON.stringify(booking(selected))]);
  let choices=await rpc(db,'SELECT atry_manage_visit_availability($1,$2::jsonb) v',[out.manage_token,JSON.stringify({date})]);let replacement=choices.options.find(o=>o.time==='10:15');assert.ok(replacement);
  const moved=await rpc(db,'SELECT atry_manage_change($1,$2,$3::jsonb) v',[out.manage_token,'reschedule',JSON.stringify({legs:replacement.legs,quote:replacement.quote})]);assert.equal(new Date(moved.starts_at).getUTCMinutes(),15);assert.equal(moved.legs.length,3);
  await db.exec('RESET ROLE');const count=(await db.query('SELECT count(*) n FROM notifications')).rows[0].n;await service(db);
  await rpc(db,'SELECT atry_manage_change($1,$2,$3::jsonb)',[out.manage_token,'reschedule',JSON.stringify({legs:replacement.legs,quote:replacement.quote})]);await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*) n FROM notifications')).rows[0].n,count);
  await db.exec('RESET ROLE');assert.ok((await db.query("SELECT private.mail_is_valid(j) ok FROM mail_jobs j WHERE kind='confirmed'")).rows.every(j=>!j.ok));
  await who(db,1);await rpc(db,'SELECT atry_update_booking($1,$2,$3::jsonb) v',[bid,moved.legs[0].id,'{"status":"completed"}']);
  await service(db);await assert.rejects(rpc(db,'SELECT atry_manage_change($1,$2,$3::jsonb)',[out.manage_token,'cancel','{}']),/OUTSIDE_POLICY/);
  await who(db,1);const cancelled=await rpc(db,'SELECT atry_visit_command($1,$2,$3,$4::jsonb) v',[bid,out.id,'cancel','{}']);assert.equal(cancelled.legs[0].status,'completed');assert.ok(cancelled.legs.slice(1).every(l=>l.status==='cancelled'));
  await db.exec('RESET ROLE');const cancelledCount=(await db.query('SELECT count(*) n FROM notifications')).rows[0].n;await who(db,1);await rpc(db,'SELECT atry_visit_command($1,$2,$3,$4::jsonb)',[bid,out.id,'cancel','{}']);await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*) n FROM notifications')).rows[0].n,cancelledCount);
 }finally{await db.close();}
});
test('PostgreSQL visitas: cotización vieja, servicios repetidos y colisiones no dejan reservas parciales',async()=>{
 const {db,bid,ids,staff,options}=await setup();try{
  const selected=(await options()).options.find(o=>o.time==='10:00');await who(db,1);
  await rpc(db,'SELECT atry_save_service($1,$2,$3::jsonb)',[bid,ids[1],JSON.stringify({price_uyu:999})]);
  await service(db);await assert.rejects(rpc(db,'SELECT atry_public_visit_book($1,$2::jsonb)',['salon-completo',JSON.stringify(booking(selected))]),/VISIT_QUOTE_CHANGED/);
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*) n FROM bookings')).rows[0].n,0);assert.equal((await db.query('SELECT count(*) n FROM booking_visits')).rows[0].n,0);
  await service(db);const current=(await options()).options.find(o=>o.time==='10:00');const out=await rpc(db,'SELECT atry_public_visit_book($1,$2::jsonb) v',['salon-completo',JSON.stringify(booking(current))]);
  await assert.rejects(rpc(db,'SELECT atry_public_visit_book($1,$2::jsonb)',['salon-completo',JSON.stringify({...booking(current,'combined_conflict_002'),customer_name:'Otro cliente',customer_phone:'099987654'})]),/CONFLICT/);
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*) n FROM bookings')).rows[0].n,3);assert.equal((await db.query('SELECT count(*) n FROM booking_visits')).rows[0].n,1);
  await who(db,1);await assert.rejects(rpc(db,'SELECT atry_visit_command($1,$2,$3,$4::jsonb)',[bid,out.id,'reschedule',JSON.stringify({legs:out.legs.slice().reverse(),quote:current.quote})]),/INVALID_VISIT_SEQUENCE/);
  assert.equal((await rpc(db,'SELECT atry_visit($1,$2) v',[bid,out.id])).starts_at,out.starts_at);
 }finally{await db.close();}
});
test('PostgreSQL visitas: recursos, preparación, pausas y feriados impiden recorridos imposibles',async()=>{
 const {db,bid,ids,staff,date,options}=await setup();try{
  const resource=await rpc(db,'SELECT atry_save_rule($1,$2,NULL,$3::jsonb,false) v',[bid,'resources','{"name":"Cabina compartida"}']);
  const resourceId=resource.id;assert.ok(resourceId);
  for(const id of ids.slice(0,2))await rpc(db,'SELECT atry_save_rule($1,$2,NULL,$3::jsonb,false)',[bid,'service_resources',JSON.stringify({service_id:id,resource_ids:[resourceId]})]);
  await rpc(db,'SELECT atry_save_service($1,$2,$3::jsonb)',[bid,ids[0],'{"buffer_after_min":10}']);
  assert.equal((await options()).options.length,0);
  await who(db,1);await rpc(db,'SELECT atry_save_service($1,$2,$3::jsonb)',[bid,ids[0],'{"buffer_after_min":0}']);
  await rpc(db,'SELECT atry_save_rule($1,$2,NULL,$3::jsonb,false)',[bid,'holidays',JSON.stringify({day:date,name:'Cerrado'})]);assert.equal((await options()).options.length,0);
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*) n FROM bookings')).rows[0].n,0);
 }finally{await db.close();}
});
test('PostgreSQL: la comprobación remota controlada revierte fixtures y no cambia datos existentes',async()=>{
 const {db}=await setup();try{
  await db.exec('RESET ROLE');const before=(await db.query('SELECT to_jsonb(b) b FROM businesses b ORDER BY id')).rows;
  const result=await db.exec(require('fs').readFileSync('supabase/operations/verify-theme-visits.sql','utf8'));
  assert.ok(result.some(r=>r.rows?.some(row=>row.result==='REMOTE_THEME_VISITS_OK_ROLLED_BACK')));
  assert.deepEqual((await db.query('SELECT to_jsonb(b) b FROM businesses b ORDER BY id')).rows,before);
  assert.equal((await db.query('SELECT count(*) n FROM booking_visits')).rows[0].n,0);
 }finally{await db.close();}
});
