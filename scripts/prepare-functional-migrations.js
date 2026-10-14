'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const directory=path.resolve(__dirname,'../supabase/migrations');
const files=fs.readdirSync(directory).filter(file=>/^2026101400(1[5-9]|2[0-2])_.*\.sql$/.test(file)).sort();
if(files.length!==8)throw new Error('Se requieren exactamente las migraciones 015–022');
let sql=`-- ATRY-Turnos ONLY: djoxdtloqwbrhgtgencc. Migrations 015-022.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
SELECT pg_advisory_xact_lock(hashtext('atry_migration_015_022'));
DO $$ BEGIN
 IF to_regprocedure('public.atry_manage_change(text,text,jsonb)') IS NULL OR to_regclass('private.migration_ledger') IS NULL THEN RAISE EXCEPTION 'MISSING_BASELINE_007_014';END IF;
 IF (SELECT count(*) FROM private.migration_ledger WHERE version BETWEEN '202610140007' AND '202610140014')<>8 THEN RAISE EXCEPTION 'INCOMPLETE_BASELINE_LEDGER';END IF;
 IF to_regclass('private.invitation_tokens') IS NOT NULL THEN RAISE EXCEPTION 'BATCH_ALREADY_STARTED_REVIEW_REQUIRED';END IF;
END $$;
`;
for(const file of files){const content=fs.readFileSync(path.join(directory,file),'utf8');sql+='\n-- '+file+'\n'+content+'\n';sql+=`INSERT INTO private.migration_ledger(version,sha256) VALUES('${file.split('_')[0]}','${crypto.createHash('sha256').update(content).digest('hex')}');\n`;}
sql+="NOTIFY pgrst,'reload schema';\nCOMMIT;\nSELECT count(*) AS migrations_applied FROM private.migration_ledger WHERE version BETWEEN '202610140015' AND '202610140022';\n";
const output=path.resolve(__dirname,'../tmp/pending-migrations-015-022.sql');fs.writeFileSync(output,sql);console.log(JSON.stringify({files,bytes:Buffer.byteLength(sql),sha256:crypto.createHash('sha256').update(sql).digest('hex')}));
