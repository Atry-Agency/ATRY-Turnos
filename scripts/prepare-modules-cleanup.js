'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{createClient}=require('@supabase/supabase-js');
async function main(){
 const file=process.argv[2];if(!/^data\/cloud-private\/modules-[a-f0-9-]+\.json$/.test(file||''))throw new Error('SCOPED_MANIFEST_REQUIRED');
 const m=JSON.parse(fs.readFileSync(file,'utf8')),config=JSON.parse(fs.readFileSync('data/cloud-private/connection.json','utf8')),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
 if(m.project!=='djoxdtloqwbrhgtgencc'||config.url!=='https://djoxdtloqwbrhgtgencc.supabase.co'||!uuid.test(m.run)||!m.users.every(u=>uuid.test(u.id))||!m.businesses.every(id=>uuid.test(id)))throw new Error('TARGET_MISMATCH');
 const snapshot={run:m.run,businesses:[]};
 for(let i=0;i<2;i++){
  const c=createClient(config.url,config.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});if((await c.auth.signInWithPassword({email:m.users[i].email,password:m.users[i].password})).error)throw new Error('LOGIN_FAILED');
  const call=async(name,args)=>{const r=await c.rpc(name,args);if(r.error)throw new Error(name+':'+r.error.code);return r.data;},bid=m.businesses[i];
  const bookings=await call('atry_bookings',{bid,start_day:'2026-10-01',days:42});snapshot.businesses.push({business:await call('atry_business',{bid}),catalog:await call('atry_catalog',{bid}),rules:await call('atry_rules',{bid}),bookings,customers:await call('atry_customers',{bid,query:''})});
 }
 m.bookings=[...new Set(snapshot.businesses.flatMap(b=>b.bookings.map(row=>row.id)))];assert.ok(m.bookings.every(id=>uuid.test(id)));fs.writeFileSync(file,JSON.stringify(m,null,2));
 fs.writeFileSync('data/cloud-private/cleanup-snapshot-'+m.run+'.json',JSON.stringify(snapshot,null,2));
 const quote=value=>"'"+value+"'",users=m.users.map(u=>quote(u.id)).join(','),biz=m.businesses.map(quote).join(','),books=m.bookings.map(quote).join(','),invite=quote(m.accessWaitlist.invitation),wait=quote(m.accessWaitlist.waitlist),slugs=snapshot.businesses.map(b=>quote(b.business.slug)).join(',');
 if(!uuid.test(m.accessWaitlist.invitation)||!uuid.test(m.accessWaitlist.waitlist))throw new Error('INVALID_LINK_SCOPE');
 const sql=`-- ONLY fixtures from run ${m.run}; preserves all other identities and businesses.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $$ BEGIN
 IF (SELECT count(*) FROM auth.users WHERE id::text IN (${users}) AND raw_user_meta_data->>'atry_test_run'='${m.run}')<>${m.users.length} THEN RAISE EXCEPTION 'IDENTITY_SCOPE_MISMATCH';END IF;
 IF (SELECT count(*) FROM public.businesses WHERE id IN (${biz}) AND name IN ('Negocio Prueba 1','Negocio Prueba 2') AND slug IN (${slugs}))<>${m.businesses.length} THEN RAISE EXCEPTION 'BUSINESS_SCOPE_MISMATCH';END IF;
 IF EXISTS(SELECT 1 FROM public.memberships WHERE (business_id IN (${biz}) AND user_id NOT IN (${users})) OR (user_id IN (${users}) AND business_id NOT IN (${biz}))) THEN RAISE EXCEPTION 'UNEXPECTED_MEMBERSHIP';END IF;
 IF (SELECT count(*) FROM public.bookings WHERE business_id IN (${biz}))<>${m.bookings.length} OR EXISTS(SELECT 1 FROM public.bookings WHERE business_id IN (${biz}) AND id NOT IN (${books})) THEN RAISE EXCEPTION 'BOOKING_SCOPE_CHANGED';END IF;
 IF EXISTS(SELECT 1 FROM public.customers WHERE business_id IN (${biz}) AND (name!~'^Cliente [0-9]+$' OR email!~'^cliente[0-9]+@example.com$' OR coalesce(notes,'')<>'')) THEN RAISE EXCEPTION 'UNEXPECTED_CUSTOMER_DATA';END IF;
 IF EXISTS(SELECT 1 FROM public.invitations WHERE business_id IN (${biz}) AND id<>${invite}) OR EXISTS(SELECT 1 FROM public.waitlist WHERE business_id IN (${biz}) AND id<>${wait}) OR EXISTS(SELECT 1 FROM public.incidents WHERE business_id IN (${biz})) THEN RAISE EXCEPTION 'UNEXPECTED_OPERATIONAL_DATA';END IF;
 IF EXISTS(SELECT 1 FROM public.mail_jobs WHERE business_id IN (${biz}) AND (provider_id IS NOT NULL OR state IN ('provider_accepted','smtp_accepted','delivered'))) THEN RAISE EXCEPTION 'UNEXPECTED_EXTERNAL_DELIVERY';END IF;
END $$;
CREATE TEMP TABLE fixture_offer_scopes ON COMMIT DROP AS SELECT 'offer:'||private.hash(token) scope FROM private.offer_tokens WHERE waitlist_id=${wait};
DELETE FROM public.idempotency_keys WHERE ${m.businesses.map(id=>"position('"+id+"' in scope)>0").join(' OR ')} OR scope IN (SELECT scope FROM fixture_offer_scopes);
DELETE FROM private.invitation_tokens WHERE invitation_id=${invite};
DELETE FROM private.offer_tokens WHERE waitlist_id=${wait};
DELETE FROM public.invitations WHERE business_id IN (${biz});
DELETE FROM public.waitlist WHERE business_id IN (${biz});
DELETE FROM public.mail_jobs WHERE business_id IN (${biz});
DELETE FROM public.notifications WHERE business_id IN (${biz});
DELETE FROM public.booking_resources WHERE booking_id IN (${books});
DELETE FROM public.bookings WHERE business_id IN (${biz});
DELETE FROM public.service_resources WHERE service_id IN (SELECT id FROM public.services WHERE business_id IN (${biz}));
DELETE FROM public.staff_services WHERE staff_id IN (SELECT id FROM public.staff WHERE business_id IN (${biz}));
DELETE FROM public.working_hours WHERE staff_id IN (SELECT id FROM public.staff WHERE business_id IN (${biz}));
${['time_off','recurring_breaks','schedule_exceptions','holidays','resources','services','customers','audit_log','staff','memberships','calendar_revisions','notification_preferences'].map(table=>'DELETE FROM public.'+table+' WHERE business_id IN ('+biz+');').join('\n')}
DELETE FROM public.public_rate_buckets WHERE split_part(scope,':',2) IN (${slugs});
DELETE FROM public.businesses WHERE id IN (${biz});
DELETE FROM public.users WHERE id IN (${users});
SET CONSTRAINTS ALL IMMEDIATE;
/* TRANSACTION_END */
SELECT (SELECT count(*) FROM public.users WHERE id IN (${users})) AS fixture_users,(SELECT count(*) FROM public.businesses WHERE id IN (${biz})) AS fixture_businesses,(SELECT count(*) FROM public.bookings WHERE id IN (${books})) AS fixture_bookings;
`;
 fs.writeFileSync('tmp/modules-cleanup-dry-run.sql',sql.replace('/* TRANSACTION_END */','ROLLBACK;'));
 fs.writeFileSync('tmp/modules-cleanup.sql',sql.replace('/* TRANSACTION_END */','COMMIT;'));
 console.log(JSON.stringify({run:m.run,users:m.users.length,businesses:m.businesses.length,bookings:m.bookings.length,snapshotIgnoredByGit:true}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
