'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{pg}=require('./pg-context');
const migration=()=>fs.readFileSync('supabase/migrations/202611130001_regional_foundation.sql','utf8');
async function expiredFixture(db){
 await db.exec(fs.readFileSync('tests/postgres.test.js','utf8').split('async function fixture(db){await db.exec(`')[1].split('`);}')[0]);
 await db.exec("UPDATE businesses SET subscription_status='expired',trial_until=now()-interval '1 day',paid_until=now()-interval '1 day'");
}
test('Regional backfill preserves expired businesses and restores subscription guards',async()=>{
 const db=await pg({through:'202611130000'});
 try{
  await expiredFixture(db);
  const before=(await db.query('SELECT id,subscription_status,paid_until,trial_until FROM businesses ORDER BY id')).rows;
  await db.exec(migration());
  assert.deepEqual((await db.query('SELECT id,subscription_status,paid_until,trial_until FROM businesses ORDER BY id')).rows,before);
  assert.equal((await db.query('SELECT count(*)::int n FROM services WHERE currency<>\'UYU\' OR price_minor<>price_uyu::bigint*100')).rows[0].n,0);
  const guards=(await db.query("SELECT c.relname,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname='subscription_write' AND c.relname IN ('services','bookings')")).rows;
  assert.equal(guards.length,2);assert(guards.every(x=>x.tgenabled==='O'));
  await assert.rejects(db.exec("UPDATE services SET name='not permitted after backfill' WHERE id='v1'"),/SUBSCRIPTION_REQUIRED/);
 }finally{await db.close()}
});
test('Failed backfill rolls back columns, data and trigger state together',async()=>{
 const db=await pg({through:'202611130000'});
 try{
  await expiredFixture(db);
  const before=(await db.query('SELECT id,name,price_uyu FROM services ORDER BY id')).rows;
  const broken=migration().replace('UPDATE public.services SET price_minor=price_uyu::bigint*100;','SELECT 1/0;');
  await assert.rejects(db.exec(broken));await db.exec('ROLLBACK');
  assert.deepEqual((await db.query('SELECT id,name,price_uyu FROM services ORDER BY id')).rows,before);
  assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND table_name='services' AND column_name='price_minor'")).rows[0].n,0);
  assert((await db.query("SELECT tgenabled FROM pg_trigger WHERE tgname='subscription_write'")).rows.every(x=>x.tgenabled==='O'));
 }finally{await db.close()}
});
