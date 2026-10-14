'use strict';
// Build a reviewable transaction for the dashboard. Never connects or executes SQL.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=path.resolve(__dirname,'../supabase/migrations');
const files=fs.readdirSync(dir).filter(f=>/^2026101400(0[7-9]|1[0-4])_.*\.sql$/.test(f)).sort();
if(files.length!==8)throw new Error('El lote debe contener exactamente las migraciones 007–014');
let sql=`-- ATRY-Turnos ONLY: djoxdtloqwbrhgtgencc. Reviewed migrations 007-014.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
SELECT pg_advisory_xact_lock(hashtext('atry_migration_007_014'));
DO $$ BEGIN
 IF to_regprocedure('public.atry_update_booking(text,text,jsonb)') IS NULL OR to_regclass('public.calendar_revisions') IS NULL THEN RAISE EXCEPTION 'MISSING_BASELINE_001_006'; END IF;
 IF to_regprocedure('public.atry_me()') IS NOT NULL THEN RAISE EXCEPTION 'PENDING_BATCH_ALREADY_STARTED_REVIEW_REQUIRED'; END IF;
END $$;
CREATE TABLE IF NOT EXISTS private.migration_ledger(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.migration_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.migration_ledger FROM PUBLIC,anon,authenticated,service_role;
`;
for(const f of files){const content=fs.readFileSync(path.join(dir,f),'utf8');sql+='\n-- '+f+'\n'+content+'\n';sql+=`INSERT INTO private.migration_ledger(version,sha256) VALUES('${f.split('_')[0]}','${crypto.createHash('sha256').update(content).digest('hex')}');\n`;}
sql+=`NOTIFY pgrst,'reload schema';
COMMIT;
SELECT count(*) AS pending_migrations_applied FROM private.migration_ledger WHERE version BETWEEN '202610140007' AND '202610140014';\n`;
const out=path.resolve(__dirname,'../tmp');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'pending-migrations-007-014.sql'),sql);
console.log(JSON.stringify({files,bytes:Buffer.byteLength(sql),sha256:crypto.createHash('sha256').update(sql).digest('hex')}));
