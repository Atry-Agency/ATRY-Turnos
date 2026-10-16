'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const files=fs.readdirSync('supabase/migrations').sort().filter(f=>f.split('_')[0]>='202610150032');
fs.mkdirSync('tmp',{recursive:true});
for(let i=1;i<files.length;i++){
 const file=files[i],previous=files[i-1],version=file.split('_')[0],sql=fs.readFileSync('supabase/migrations/'+file,'utf8');
 const guard=`DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM private.migration_ledger WHERE version='${previous.split('_')[0]}' AND sha256='${hash(fs.readFileSync('supabase/migrations/'+previous))}') THEN RAISE EXCEPTION 'PREVIOUS_MIGRATION_MISMATCH'; END IF; IF EXISTS(SELECT 1 FROM private.migration_ledger WHERE version='${version}') THEN RAISE EXCEPTION 'ALREADY_APPLIED'; END IF; END $guard$;`;
 fs.writeFileSync('tmp/control-'+version+'.sql',`-- ONLY ATRY-Turnos djoxdtloqwbrhgtgencc. Manual snapshot verified before execution.
BEGIN;
SET LOCAL lock_timeout='10s';SET LOCAL statement_timeout='90s';
${guard}
CREATE TEMP TABLE control_before ON COMMIT DROP AS SELECT (SELECT count(*) FROM public.businesses) businesses,(SELECT count(*) FROM public.users) users,(SELECT count(*) FROM public.bookings) bookings;
${sql}
DO $guard$ BEGIN IF EXISTS(SELECT 1 FROM control_before WHERE businesses<>(SELECT count(*) FROM public.businesses) OR users<>(SELECT count(*) FROM public.users) OR bookings<>(SELECT count(*) FROM public.bookings)) THEN RAISE EXCEPTION 'CORE_ROW_COUNTS_CHANGED';END IF;END $guard$;
INSERT INTO private.migration_ledger(version,sha256) VALUES('${version}','${hash(sql)}');
NOTIFY pgrst,'reload schema';COMMIT;
SELECT version,sha256,(SELECT count(*) FROM public.businesses) businesses,(SELECT count(*) FROM public.users) users,(SELECT count(*) FROM public.bookings) bookings FROM private.migration_ledger WHERE version='${version}';
`);
 console.log(JSON.stringify({file,version,sha256:hash(sql)}));
}
