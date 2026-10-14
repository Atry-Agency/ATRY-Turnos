'use strict';
const fs=require('node:fs');
const filename=process.argv[2];if(!filename?.startsWith('data/cloud-private/integration-'))throw new Error('FIXTURE_MANIFEST_REQUIRED');
const m=JSON.parse(fs.readFileSync(filename,'utf8')),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
if(m.project!=='djoxdtloqwbrhgtgencc'||!uuid.test(m.run)||!m.users.every(u=>uuid.test(u.id))||!m.businesses.every(id=>uuid.test(id)))throw new Error('INVALID_FIXTURE_SCOPE');
const users=m.users.map(u=>"'"+u.id+"'").join(','),biz=m.businesses.map(id=>"'"+id+"'").join(',');if(!users||!biz)throw new Error('EMPTY_FIXTURE_SCOPE');
const sql=`-- Remove ONLY disposable fixtures from integration run ${m.run}.
BEGIN;
DO $$ BEGIN
 IF (SELECT count(*) FROM auth.users WHERE id::text IN (${users}) AND raw_user_meta_data->>'atry_test_run'='${m.run}')<>${m.users.length} THEN RAISE EXCEPTION 'TEST_IDENTITY_SCOPE_MISMATCH';END IF;
 IF (SELECT count(*) FROM public.businesses WHERE id IN (${biz}) AND name IN ('Negocio Prueba 1','Negocio Prueba 2'))<>${m.businesses.length} THEN RAISE EXCEPTION 'TEST_BUSINESS_SCOPE_MISMATCH';END IF;
 IF EXISTS(SELECT 1 FROM public.memberships WHERE (business_id IN (${biz}) AND user_id NOT IN (${users})) OR (user_id IN (${users}) AND business_id NOT IN (${biz}))) THEN RAISE EXCEPTION 'UNEXPECTED_MEMBERSHIP';END IF;
 IF EXISTS(SELECT 1 FROM public.bookings WHERE business_id IN (${biz})) OR EXISTS(SELECT 1 FROM public.customers WHERE business_id IN (${biz})) OR EXISTS(SELECT 1 FROM public.waitlist WHERE business_id IN (${biz})) OR EXISTS(SELECT 1 FROM public.invitations WHERE business_id IN (${biz})) THEN RAISE EXCEPTION 'UNEXPECTED_OPERATIONAL_DATA';END IF;
END $$;
DELETE FROM public.audit_log WHERE business_id IN (${biz});
DELETE FROM public.working_hours WHERE staff_id IN (SELECT id FROM public.staff WHERE business_id IN (${biz}));
DELETE FROM public.staff_services WHERE staff_id IN (SELECT id FROM public.staff WHERE business_id IN (${biz}));
DELETE FROM public.staff WHERE business_id IN (${biz});
DELETE FROM public.memberships WHERE business_id IN (${biz});
DELETE FROM public.calendar_revisions WHERE business_id IN (${biz});
DELETE FROM public.notification_preferences WHERE business_id IN (${biz});
DELETE FROM public.businesses WHERE id IN (${biz});
DELETE FROM public.users WHERE id IN (${users});
COMMIT;
SELECT (SELECT count(*) FROM public.users) AS users_count,(SELECT count(*) FROM public.businesses) AS businesses_count,(SELECT count(*) FROM public.bookings) AS bookings_count;
`;
fs.mkdirSync('tmp',{recursive:true});fs.writeFileSync('tmp/integration-cleanup.sql',sql);console.log(JSON.stringify({run:m.run,users:m.users.length,businesses:m.businesses.length,sql:'tmp/integration-cleanup.sql'}));
