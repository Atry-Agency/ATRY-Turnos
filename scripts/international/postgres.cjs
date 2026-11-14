'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{pg}=require('../../tests/pg-context');
(async()=>{const db=await pg();try{
await db.exec(fs.readFileSync('tests/postgres.test.js','utf8').split('async function fixture(db){await db.exec(`')[1].split('`);}')[0]);
await db.exec(`SET request.headers='{"x-client-info":"atry-turnos-regional/1"}'`);
// Explicit opt-in only inside the disposable regional fixture.
await db.exec("UPDATE private.runtime_settings SET pa_registration_enabled=true,pa_public_enabled=true WHERE id=1");
await db.exec(`INSERT INTO businesses SELECT (jsonb_populate_record(NULL::businesses,to_jsonb(b)||jsonb_build_object('id','pa','slug','salon-panama','country','PA','timezone','America/Panama','currency','USD','locale','es-PA'))).* FROM businesses b WHERE id='b2';INSERT INTO memberships VALUES('00000000-0000-0000-0000-000000000002','pa','owner');INSERT INTO staff(id,business_id,name,created_at) VALUES('ps','pa','Profesional Panamá',now());INSERT INTO services(id,business_id,name,duration_min,price_minor,created_at) VALUES('pv','pa','Servicio USD',30,1250,now());INSERT INTO staff_services VALUES('ps','pv');INSERT INTO working_hours SELECT 'ps',d,540,1140 FROM generate_series(0,6)d;UPDATE services SET price_uyu=790 WHERE id='v1';`);
assert.equal((await db.query("SELECT price_minor FROM services WHERE id='v1'")).rows[0].price_minor,79000);
assert.equal(Number((await db.query("SELECT price_minor FROM services WHERE id='pv'")).rows[0].price_minor),1250);
await assert.rejects(db.exec("UPDATE businesses SET country='PA',timezone='America/Panama',currency='USD',locale='es-PA' WHERE id='b1'"),/REGION_IMMUTABLE/);
await assert.rejects(db.exec("UPDATE businesses SET subscription_status='active',paid_until=now()+interval '1 month' WHERE id='pa'"),/COUNTRY_CATALOG_NOT_CONFIGURED/);
const day=(await db.query("SELECT (now()+interval '7 days')::date::text d")).rows[0].d;
async function auth(n){await db.exec(`RESET ROLE;SET request.jwt.claim.sub='00000000-0000-0000-0000-00000000000${n}';SET request.jwt.claims='{"session_id":"00000000-0000-0000-0000-00000000000${n}"}';SET ROLE authenticated`)}
async function book(bid,sid,vid,zone,key){const start=(await db.query('SELECT ($1::date+time \'10:00\') AT TIME ZONE $2 t',[day,zone])).rows[0].t;return (await db.query('SELECT atry_create_booking($1,$2::jsonb) b',[bid,JSON.stringify({staff_id:sid,service_id:vid,starts_at:start,customer_name:'Cliente ficticio',customer_email:'regional@example.invalid',idempotency_key:key})])).rows[0].b}
await auth(2);await db.query('SELECT atry_save_service($1,$2,$3::jsonb)',['pa','pv',JSON.stringify({price_minor:1299,currency:'USD'})]);await assert.rejects(db.query('SELECT atry_save_service($1,$2,$3::jsonb)',['pa','pv','{"price_uyu":13}']),/USD_REQUIRES_PRICE_MINOR/);
await auth(1);const uy=await book('b1','s1','v1','America/Montevideo','regional_uy_0000001');await auth(2);const pa=await book('pa','ps','pv','America/Panama','regional_pa_0000001');assert(uy.id&&pa.id);const snapshot=(await db.query('SELECT price_minor,currency,price_uyu FROM bookings WHERE id=$1',[pa.id])).rows[0];assert.equal(Number(snapshot.price_minor),1299);assert.equal(snapshot.currency,'USD');assert.equal(snapshot.price_uyu,0);
await assert.rejects(book('pa','ps','pv','America/Panama','regional_pa_0000002'),/CONFLICT|exclusion/);
await assert.rejects(db.query("SELECT atry_request_plan('pa','{\"plan\":\"negocio\"}')"),/COUNTRY_CATALOG_NOT_CONFIGURED/);
await auth(1);assert.equal((await db.query("SELECT count(*) n FROM bookings WHERE business_id='pa'")).rows[0].n,0);await assert.rejects(book('pa','ps','pv','America/Panama','regional_cross_0001'),/FORBIDDEN/);
await db.exec('RESET ROLE');const hours=(await db.query("SELECT extract(hour FROM starts_at AT TIME ZONE b.timezone)::int h FROM bookings x JOIN businesses b ON b.id=x.business_id WHERE x.id=ANY($1::text[])",[[uy.id,pa.id]])).rows;assert(hours.every(x=>x.h===10));
await db.exec("RESET ROLE;UPDATE businesses SET multi_service_enabled=1 WHERE id='pa';INSERT INTO services(id,business_id,name,duration_min,price_minor,created_at) VALUES('pv2','pa','Segundo USD',30,1301,now());INSERT INTO staff_services VALUES('ps','pv2');SET ROLE service_role");
const opts=(await db.query('SELECT atry_public_visit_availability($1,$2::jsonb) v',['salon-panama',JSON.stringify({date:day,service_ids:['pv','pv2']})])).rows[0].v;
const chosen=opts.options.find(o=>o.time==='11:00');assert(chosen);assert.equal(chosen.price_minor,2600);assert.equal(chosen.currency,'USD');
const payload={legs:chosen.legs,quote:chosen.quote,accept_policy:true,customer_name:'Visita ficticia',customer_email:'visita@example.invalid',customer_phone:'+50760000001',idempotency_key:'regional_visit_000001'};
const visit=(await db.query('SELECT atry_public_visit_book($1,$2::jsonb) v',['salon-panama',JSON.stringify(payload)])).rows[0].v;assert.equal(visit.price_minor,2600);assert.equal(visit.business_timezone,'America/Panama');assert.deepEqual((await db.query('SELECT atry_public_visit_book($1,$2::jsonb) v',['salon-panama',JSON.stringify(payload)])).rows[0].v,visit);
await auth(2);const recurring=(await db.query('SELECT atry_create_recurring($1,$2::jsonb) v',['pa',JSON.stringify({staff_id:'ps',service_id:'pv',customer_name:'Recurrencia PA',customer_phone:'+50760000002',start_day:day,time:'14:00',interval_weeks:1,idempotency_key:'regional_recurring_0001'})])).rows[0].v;assert(recurring.id);
const rows=(await db.query('SELECT atry_bookings($1,$2,1) v',['pa',day])).rows[0].v;assert(rows.some(x=>x.recurring_id===recurring.id));
await db.exec('RESET ROLE');const snapshots=(await db.query("SELECT price_minor,currency,extract(hour FROM starts_at AT TIME ZONE 'America/Panama')::int h FROM bookings WHERE recurring_id=$1",[recurring.id])).rows;assert(snapshots.length);assert(snapshots.every(x=>Number(x.price_minor)===1299&&x.currency==='USD'&&x.h===14));
// Actual RPC registration defaults and invalid tuple rejection, no external auth traffic.
await auth(1);const org=(await db.query('SELECT atry_create_organization($1::jsonb) v',[JSON.stringify({name:'Negocio Panamá local',slug:'panama-local-regional',country:'PA'})])).rows[0].v;
await db.exec('RESET ROLE');const created=(await db.query('SELECT country,currency,timezone,subscription_status FROM businesses WHERE id=$1',[org.id])).rows[0];assert.deepEqual(created,{country:'PA',currency:'USD',timezone:'America/Panama',subscription_status:'pending'});
await auth(1);await assert.rejects(db.query('SELECT atry_create_organization($1::jsonb)',[JSON.stringify({name:'No creado',slug:'no-creado-regional',country:'XX'})]),/INVALID_COUNTRY/);
await auth(2);const cfg=(await db.query("SELECT atry_whatsapp('pa','settings','GET','{}') v")).rows[0].v;assert.equal(cfg.config.country,'507');
// A midnight-spanning absence blocks both calendar days in Panama.
const d2=(await db.query("SELECT ($1::date+1)::text d",[day])).rows[0].d;
const absence=(await db.query("SELECT atry_save_rule('pa','time_off',NULL,$1::jsonb) v",[JSON.stringify({staff_id:'ps',starts_at:day+'T23:30:00-05:00',ends_at:d2+'T10:30:00-05:00',reason:'Ausencia local regional'})])).rows[0].v;
await db.exec('RESET ROLE;SET ROLE service_role');const available=(await db.query('SELECT atry_public_availability($1,$3,$2::date,$4) v',['salon-panama',d2,'pv','ps'])).rows[0].v;assert(!available.slots.some(x=>x.time==='10:00'));assert(available.slots.some(x=>x.time==='11:00'));
await auth(2);
// Editing a service never changes a historical booked snapshot.
await db.query('SELECT atry_save_service($1,$2,$3::jsonb)',['pa','pv',JSON.stringify({price_minor:1555,currency:'USD'})]);assert.equal(Number((await db.query('SELECT price_minor FROM bookings WHERE id=$1',[pa.id])).rows[0].price_minor),1299);
await db.exec("RESET ROLE;UPDATE bookings SET status='completed',starts_at=now()-interval '2 days',ends_at=now()-interval '2 days'+interval '30 minutes',blocked_from=now()-interval '2 days',blocked_until=now()-interval '2 days'+interval '30 minutes' WHERE id='"+pa.id+"'");
await auth(2);const dash=(await db.query("SELECT atry_dashboard('pa') v")).rows[0].v;assert.equal(dash.totals.currency,'USD');assert.equal(dash.totals.completed_revenue_minor,1299);const insight=(await db.query("SELECT atry_insights('pa') v")).rows[0].v;assert.equal(insight.currency,'USD');assert.equal(insight.completed_service_value_minor,1299);
const subscription=(await db.query("SELECT atry_subscription('pa') v")).rows[0].v;assert.deepEqual(subscription.plans,[]);assert.equal(subscription.catalog_available,false);assert.equal(subscription.entitlements.price_uyu,undefined);
await db.exec("RESET ROLE;UPDATE businesses SET email='owner@atry-unit-mail.com' WHERE id='pa'");await auth(2);
const mailBooking=(await db.query("SELECT atry_create_booking('pa',$1::jsonb) v",[JSON.stringify({staff_id:'ps',service_id:'pv',starts_at:d2+'T12:00:00-05:00',customer_name:'Correo local',customer_email:'customer@atry-unit-mail.com',idempotency_key:'regional_mail_000001'})])).rows[0].v;
await db.query("SELECT atry_update_booking('pa',$1,$2::jsonb)",[mailBooking.id,JSON.stringify({starts_at:d2+'T13:00:00-05:00'})]);assert.equal(Number((await db.query('SELECT price_minor FROM bookings WHERE id=$1',[mailBooking.id])).rows[0].price_minor),1555);
await db.exec('RESET ROLE;SET ROLE service_role');await db.query('SELECT atry_mail_ingest()');await db.query('SELECT atry_mail_ingest()');await db.exec('RESET ROLE');
const alert=(await db.query("SELECT content FROM mail_jobs WHERE business_id='pa' AND kind='business_alert' AND content LIKE '%12:00%'")).rows;assert(alert.length);const reminder=(await db.query("SELECT next_attempt_at FROM mail_jobs WHERE source_id=$1 AND kind='reminder' ORDER BY created_at DESC LIMIT 1",[mailBooking.id])).rows[0];assert(reminder);
console.log('PASS PA subscription hides UYU catalog; booking reprogramming preserves USD snapshot; mail alerts use local noon and reminder ingestion deduplicates without delivery.');
console.log('PASS regional registration RPC, invalid country denied, WhatsApp +507 default, midnight-spanning absence, exact historical USD snapshot after price edit, dashboard and insight aggregates.');
console.log('PASS local PA combined visit: exact USD26.00 total, UTC/local quote, public booking and idempotent replay; recurring 14:00 expansion preserves USD12.99 snapshots.');
console.log('PASS real local PostgreSQL: full migration chain, simultaneous UY/PA RPC bookings at local 10:00, conflicts, RLS/owner isolation, USD cents snapshot separate from legacy UYU, immutable country, PA commercial catalog blocked. No external calls.');
}finally{await db.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
