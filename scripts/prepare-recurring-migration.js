'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const version='202610150026',sql=fs.readFileSync('supabase/migrations/'+version+'_recurring_appointments.sql','utf8'),hash=crypto.createHash('sha256').update(sql).digest('hex');
fs.mkdirSync('tmp',{recursive:true});fs.writeFileSync('tmp/recurring-migration.sql',`-- ATRY-Turnos only: djoxdtloqwbrhgtgencc. No seed data.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.migration_ledger WHERE version='202610140025' AND sha256='955d60fa5a5eaeddfb7a031a6d350222f0de2eb6cc25c66f38a96992791ad320') THEN RAISE EXCEPTION 'PREVIOUS_MIGRATION_MISMATCH';END IF;
 IF EXISTS(SELECT 1 FROM private.migration_ledger WHERE version='${version}') THEN RAISE EXCEPTION 'ALREADY_APPLIED';END IF;
END $$;
${sql}
INSERT INTO private.migration_ledger(version,sha256) VALUES('${version}','${hash}');
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT version,sha256,has_function_privilege('anon','public.atry_create_recurring(text,jsonb)','EXECUTE') anonymous_create,has_function_privilege('authenticated','private.expand_recurring(text,date,int,boolean,text)','EXECUTE') private_access FROM private.migration_ledger WHERE version='${version}';
`);console.log(JSON.stringify({version,sha256:hash,authenticatedManagerOnly:true}));
const identityVersion='202610150027',identitySql=fs.readFileSync('supabase/migrations/'+identityVersion+'_business_identity.sql','utf8'),identityHash=crypto.createHash('sha256').update(identitySql).digest('hex');
fs.writeFileSync('tmp/identity-migration.sql',`-- ATRY-Turnos only: djoxdtloqwbrhgtgencc. Preserve existing RPC access.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.migration_ledger WHERE version='${version}' AND sha256='${hash}') THEN RAISE EXCEPTION 'PREVIOUS_MIGRATION_MISMATCH';END IF;
 IF EXISTS(SELECT 1 FROM private.migration_ledger WHERE version='${identityVersion}') THEN RAISE EXCEPTION 'ALREADY_APPLIED';END IF;
END $$;
${identitySql}
INSERT INTO private.migration_ledger(version,sha256) VALUES('${identityVersion}','${identityHash}');
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT version,sha256 FROM private.migration_ledger WHERE version='${identityVersion}';
`);
console.log(JSON.stringify({version:identityVersion,sha256:identityHash,newGrants:false}));
