'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const number=process.argv[2]||'024';if(!['024','025'].includes(number))throw new Error('INVALID_MIGRATION');
const suffix=number==='024'?'mail_snapshots':'delivery_diagnostics',version='202610140'+number,previous='202610140'+String(Number(number)-1).padStart(3,'0');
const sql=fs.readFileSync('supabase/migrations/'+version+'_'+suffix+'.sql','utf8');
const hash=crypto.createHash('sha256').update(sql).digest('hex');
fs.mkdirSync('tmp',{recursive:true});
fs.writeFileSync('tmp/mail-migration-'+number+'.sql',`-- ATRY-Turnos only: djoxdtloqwbrhgtgencc. Preserves existing access controls.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.migration_ledger WHERE version='${previous}') THEN RAISE EXCEPTION 'MISSING_PREVIOUS_MIGRATION';END IF;
 IF EXISTS(SELECT 1 FROM private.migration_ledger WHERE version='${version}') THEN RAISE EXCEPTION 'ALREADY_APPLIED';END IF;
END $$;
${sql}
INSERT INTO private.migration_ledger(version,sha256) VALUES('${version}','${hash}');
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT version,sha256,has_function_privilege('authenticated','private.mail_is_valid(public.mail_jobs)','EXECUTE') authenticated_private_access,has_function_privilege('anon','public.atry_admin_diagnostics()','EXECUTE') anonymous_admin_access FROM private.migration_ledger WHERE version='${version}';
`);
console.log(JSON.stringify({migration:number,sha256:hash,newGrants:false}));
