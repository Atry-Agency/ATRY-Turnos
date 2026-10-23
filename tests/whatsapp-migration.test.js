'use strict';const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const {pg}=require('./pg-context');const migration=fs.readFileSync('supabase/migrations/202610230001_whatsapp.sql','utf8');
test('WhatsApp migración: conserva datos anteriores, RLS y permisos mínimos incluso con grants por defecto',async()=>{
 const db=await pg({through:'202610220044'});try{
  await db.exec(`INSERT INTO businesses(id,slug,name,created_at,trial_until,subscription_status) VALUES('existing','salon-existente','Salón existente',now(),now()+interval '1 year','trialing');
   INSERT INTO staff(id,business_id,name,created_at) VALUES('person','existing','Claudia Llorente',now());
   INSERT INTO services(id,business_id,name,duration_min,created_at) VALUES('service','existing','Corte',30,now());
   INSERT INTO customers(id,business_id,name,phone,created_at) VALUES('client','existing','Agustina Rojas','099123456',now());
   INSERT INTO bookings(id,business_id,staff_id,service_id,customer_id,starts_at,ends_at,blocked_from,blocked_until,status,created_at,updated_at) VALUES('booking','existing','person','service','client',now()+interval '2 days',now()+interval '49 hours',now()+interval '2 days',now()+interval '49 hours','confirmed',now(),now());
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role,authenticated,anon;`);
  const snapshot=async()=>(await db.query("SELECT jsonb_build_object('bookings',(SELECT jsonb_agg(b) FROM bookings b),'customers',(SELECT jsonb_agg(c) FROM customers c),'plans',(SELECT jsonb_agg(p) FROM plans p),'mail',(SELECT jsonb_agg(m) FROM mail_jobs m)) v")).rows[0].v;
  const before=await snapshot();await db.exec(migration);assert.deepEqual(await snapshot(),before);
  for(const role of ['anon','authenticated','service_role']){const grant=(await db.query("SELECT has_function_privilege($1,'public.atry_whatsapp(text,text,text,jsonb)','EXECUTE') yes",[role])).rows[0].yes;assert.equal(grant,role==='authenticated');for(const table of ['whatsapp_settings','whatsapp_consent','whatsapp_actions','whatsapp_previous'])assert.equal((await db.query('SELECT has_table_privilege($1,$2,\'SELECT\') yes',[role,table])).rows[0].yes,false);}
  const rows=(await db.query("SELECT relrowsecurity FROM pg_class WHERE relname IN ('whatsapp_settings','whatsapp_consent','whatsapp_actions','whatsapp_previous')")).rows;assert.equal(rows.length,4);assert.ok(rows.every(x=>x.relrowsecurity));
  await db.exec("UPDATE bookings SET starts_at=starts_at+interval '1 hour',ends_at=ends_at+interval '1 hour',blocked_from=blocked_from+interval '1 hour',blocked_until=blocked_until+interval '1 hour' WHERE id='booking'");assert.equal((await db.query('SELECT count(*) n FROM whatsapp_previous')).rows[0].n,1);
 }finally{await db.close();}
});
test('WhatsApp migración: fallo revierte DDL parcial y no deja permisos abiertos',async()=>{const db=await pg({through:'202610220044'});try{await db.exec('CREATE TABLE whatsapp_consent(dummy text)');await assert.rejects(db.exec(migration));await db.exec('ROLLBACK');assert.equal((await db.query("SELECT to_regclass('public.whatsapp_settings') v")).rows[0].v,null);assert.equal((await db.query("SELECT count(*) n FROM pg_proc WHERE proname='atry_whatsapp'")).rows[0].n,0);}finally{await db.close();}});
