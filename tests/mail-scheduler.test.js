'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('Scheduler: invoca solo el endpoint previsto, respeta pausa y mantiene Vault y la función privados',async()=>{
 const db=new PGlite();try{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
   CREATE SCHEMA private;CREATE SCHEMA net;CREATE SCHEMA vault;CREATE SCHEMA cron;
   CREATE TABLE private.runtime_settings(id int,mail_enabled boolean);INSERT INTO private.runtime_settings VALUES(1,false);
   CREATE TABLE net.http_request_queue(id bigint,headers jsonb,url text,body jsonb,timeout_ms int);
   CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
   CREATE TABLE cron.job(jobname text PRIMARY KEY,schedule text,command text,active boolean);
   GRANT USAGE ON SCHEMA net,vault TO PUBLIC;GRANT SELECT ON net.http_request_queue,vault.decrypted_secrets TO PUBLIC;
   CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds int) RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN INSERT INTO net.http_request_queue VALUES(1,headers,url,body,timeout_milliseconds);RETURN 1;END $$;
   CREATE FUNCTION cron.schedule(name text,schedule text,command text) RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN INSERT INTO cron.job VALUES(name,schedule,command,true) ON CONFLICT(jobname) DO UPDATE SET schedule=excluded.schedule,command=excluded.command;RETURN 1;END $$;`);
  const sql=fs.readFileSync('supabase/operations/schedule-mail.sql','utf8').replace(/^CREATE EXTENSION[^;]+;\r?\n/gm,'');await db.exec(sql);
  assert.equal((await db.query('SELECT private.invoke_mail_worker() v')).rows[0].v,null);
  await db.exec('UPDATE private.runtime_settings SET mail_enabled=true');await assert.rejects(db.query('SELECT private.invoke_mail_worker()'),/MAIL_INVOCATION_SECRET_MISSING/);
  await db.query('INSERT INTO vault.decrypted_secrets VALUES($1,$2)',['atry_mail_service_role','private-test-token-'.repeat(8)]);
  assert.equal((await db.query('SELECT private.invoke_mail_worker() v')).rows[0].v,1);
  const req=(await db.query('SELECT * FROM net.http_request_queue')).rows[0];assert.equal(req.url,'https://djoxdtloqwbrhgtgencc.supabase.co/functions/v1/atry-mail');assert.equal(req.headers.Authorization,'Bearer '+'private-test-token-'.repeat(8));assert.deepEqual(req.body,{});assert.equal(req.timeout_ms,115000);
  const job=(await db.query('SELECT * FROM cron.job')).rows[0];assert.equal(job.schedule,'*/2 * * * *');assert.equal(job.command,'SELECT private.invoke_mail_worker();');assert.ok(!job.command.includes('token'));
  for(const role of ['anon','authenticated','service_role']){await db.exec('SET ROLE '+role);await assert.rejects(db.query('SELECT * FROM vault.decrypted_secrets'));await assert.rejects(db.query('SELECT private.invoke_mail_worker()'));await db.exec('RESET ROLE');}
 }finally{await db.close();}
});
