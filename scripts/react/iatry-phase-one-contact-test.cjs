'use strict';
// Incremental coverage only: no network, live credentials, RPC installation or production writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),{pg}=require('../../tests/pg-context');
(async()=>{const db=await pg();try{
 const snapshot=require('../../docs/iatry-phase-one/CONTRATOS-REALES.json');
 const functions=(await db.query("SELECT proname,md5(regexp_replace(pg_get_functiondef(p.oid),'[[:space:]]','','g')) hash FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'")).rows;
 for(const [name,hash] of Object.entries(snapshot.hashes))assert.equal(functions.find(f=>f.proname===name)?.hash,hash,'Deployed contract drift: '+name);
 await db.exec(fs.readFileSync('tests/postgres.test.js','utf8').split('async function fixture(db){await db.exec(`')[1].split('`);}')[0]);
 await db.exec("BEGIN;INSERT INTO public.recurring_appointments(id,business_id,staff_id,service_id,customer_name,customer_email,customer_phone,start_day,minute,interval_weeks) VALUES('contact-own','b1','s1','v1','Original','original@example.invalid','','2026-11-01',600,1),('contact-other','b2','s3','v2','Original','original@example.invalid','','2026-11-01',600,1);");
 await db.query("SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false),set_config('request.jwt.claims',$1,false)",[JSON.stringify({session_id:'00000000-0000-0000-0000-000000000001'})]);await db.exec('SET ROLE authenticated');
 const save=async(id,payload)=>(await db.query('SELECT public.atry_save_customer($1,$2,$3) value',['b1',id,JSON.stringify(payload)])).rows[0].value;
 const customer=await save(null,{name:'Original',email:'original@example.invalid',phone:'',marketing_consent:0});
 await save(customer.id,{name:'Updated',email:'updated@example.invalid',phone:'099123456'});
 await db.exec('RESET ROLE');let rows=(await db.query('SELECT id,customer_name,customer_email,customer_phone FROM public.recurring_appointments ORDER BY id')).rows;
 assert.deepEqual(rows.find(r=>r.id==='contact-own'),{id:'contact-own',customer_name:'Updated',customer_email:'updated@example.invalid',customer_phone:'099123456'});
 assert.equal(rows.find(r=>r.id==='contact-other').customer_email,'original@example.invalid');
 await db.exec('SET ROLE authenticated');await save(customer.id,{notes:'Only notes'});await db.exec('RESET ROLE');assert.deepEqual((await db.query('SELECT id,customer_name,customer_email,customer_phone FROM public.recurring_appointments ORDER BY id')).rows,rows);
 await db.exec('SET ROLE authenticated');await save(null,{name:'Other',email:'conflict@example.invalid',phone:''});await db.exec('SAVEPOINT conflict');await assert.rejects(()=>save(customer.id,{email:'conflict@example.invalid'}),/CONTACT_CONFLICT/);await db.exec('ROLLBACK TO SAVEPOINT conflict;RESET ROLE');assert.deepEqual((await db.query('SELECT id,customer_name,customer_email,customer_phone FROM public.recurring_appointments ORDER BY id')).rows,rows);
 const counts=(await db.query('SELECT (SELECT count(*) FROM notifications)::int n,(SELECT count(*) FROM mail_jobs)::int m')).rows[0];assert.deepEqual(counts,{n:0,m:0});await db.exec('ROLLBACK');
 console.log('PASS 9 deployed RPC definition fingerprints; local contact propagation, tenant isolation, notes preservation, atomic contact-conflict rejection; zero mail/notifications.');
 }finally{await db.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
