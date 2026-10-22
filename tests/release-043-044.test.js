'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {pg}=require('./pg-context'),{prepare}=require('../scripts/prepare-release-043-044');
test('Release 043–044: el paquete preserva datos existentes y rechaza una segunda aplicación',async()=>{
 const db=await pg({through:'202610200042'}),file='tmp/release-test-'+crypto.randomUUID()+'.sql';
 try{
  await db.exec("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('88888888-8888-4888-8888-888888888888','release@local.test',now());INSERT INTO auth.sessions(id,user_id) VALUES('88888888-8888-4888-8888-888888888888','88888888-8888-4888-8888-888888888888');UPDATE users SET platform_admin=1;SELECT set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',false);SELECT set_config('request.jwt.claims','{\"session_id\":\"88888888-8888-4888-8888-888888888888\"}',false);SET ROLE authenticated;");
  const b=(await db.query('SELECT atry_create_organization($1::jsonb) v',['{"name":"Negocio existente","slug":"negocio-existente"}'])).rows[0].v;
  const before=(await db.query('SELECT atry_business($1) v',[b.id])).rows[0].v;
  await db.exec('RESET ROLE');prepare(file);const sql=fs.readFileSync(file,'utf8');
  const results=await db.exec(sql);assert.ok(results.some(r=>r.rows?.some(row=>row.result==='RELEASE_043_044_OK')));
  const after=(await db.query('SELECT to_jsonb(b) v FROM businesses b WHERE id=$1',[b.id])).rows[0].v;
  for(const key of ['id','name','plan','subscription_status','primary_color','logo_url','created_at'])assert.equal(after[key],before[key]);
  assert.equal(after.multi_service_enabled,0);assert.deepEqual(after.theme_config,{});
  assert.equal((await db.query("SELECT count(*) n FROM private.migration_ledger WHERE version IN('202610220043','202610220044')")).rows[0].n,2);
  await assert.rejects(db.exec(sql),/RELEASE_ALREADY_STARTED_REVIEW_REQUIRED/);await db.exec('ROLLBACK');
 }finally{fs.unlinkSync(file);await db.close();}
});
