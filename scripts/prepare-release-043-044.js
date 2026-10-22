'use strict';
// Prepare an auditable transaction. This script never connects to a database.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function prepare(out='tmp/release-043-044.sql'){
 const files=['202610220043_theme_studio.sql','202610220044_combined_visits.sql'];
 let sql=`-- ATRY-Turnos ONLY · djoxdtloqwbrhgtgencc · migrations 043–044
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
SELECT pg_advisory_xact_lock(hashtext('atry_release_043_044'));
LOCK TABLE public.businesses,public.bookings IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF to_regprocedure('public.atry_delete_business(text,jsonb)') IS NULL THEN RAISE EXCEPTION 'MISSING_MIGRATION_042';END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='businesses' AND column_name='theme_config') OR to_regclass('public.booking_visits') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_ALREADY_STARTED_REVIEW_REQUIRED';END IF;
END $$;
CREATE TEMP TABLE at_release_snapshot ON COMMIT DROP AS
SELECT (SELECT private.hash(coalesce(jsonb_agg(to_jsonb(b) ORDER BY id)::text,'')) FROM public.businesses b) business_hash,
 (SELECT private.hash(coalesce(jsonb_agg(to_jsonb(b) ORDER BY id)::text,'')) FROM public.bookings b) booking_hash,
 (SELECT count(*) FROM public.businesses) business_count,(SELECT count(*) FROM public.bookings) booking_count;
CREATE TABLE IF NOT EXISTS private.migration_ledger(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.migration_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.migration_ledger FROM PUBLIC,anon,authenticated,service_role;
`;
 for(const file of files){const source=fs.readFileSync(path.join('supabase/migrations',file),'utf8');sql+='\n-- '+file+'\n'+source+'\n';sql+=`INSERT INTO private.migration_ledger(version,sha256) VALUES('${file.split('_')[0]}','${crypto.createHash('sha256').update(source).digest('hex')}');\n`;}
 sql+=`DO $$ BEGIN
 IF (SELECT business_hash FROM pg_temp.at_release_snapshot) IS DISTINCT FROM (SELECT private.hash(coalesce(jsonb_agg(to_jsonb(b)-ARRAY['theme_config','theme_revision','multi_service_enabled'] ORDER BY id)::text,'')) FROM public.businesses b)
 OR (SELECT booking_hash FROM pg_temp.at_release_snapshot) IS DISTINCT FROM (SELECT private.hash(coalesce(jsonb_agg(to_jsonb(b) ORDER BY id)::text,'')) FROM public.bookings b) THEN RAISE EXCEPTION 'EXISTING_DATA_CHANGED_ROLLBACK';END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'RELEASE_043_044_OK' AS result,(SELECT count(*) FROM public.businesses) AS businesses_preserved,(SELECT count(*) FROM public.bookings) AS bookings_preserved,(SELECT count(*) FROM public.booking_visits) AS new_visits;
`;
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,sql);
 return {file:out,files,bytes:Buffer.byteLength(sql),sha256:crypto.createHash('sha256').update(sql).digest('hex')};
}
if(require.main===module)console.log(JSON.stringify(prepare()));module.exports={prepare};
