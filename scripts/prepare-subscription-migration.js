'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const version='202610150028',sql=fs.readFileSync('supabase/migrations/'+version+'_manual_subscriptions.sql','utf8'),hash=crypto.createHash('sha256').update(sql).digest('hex');
fs.mkdirSync('tmp',{recursive:true});fs.writeFileSync('tmp/subscription-migration.sql',`-- Only ATRY-Turnos djoxdtloqwbrhgtgencc. No commercial accounts are activated by this migration.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.migration_ledger WHERE version='202610150027' AND sha256='f6e67347d3f2f025085ea2177f93d39f4fc66c8242c581b0140be35d3925d2a7') THEN RAISE EXCEPTION 'PREVIOUS_MIGRATION_MISMATCH';END IF;
 IF EXISTS(SELECT 1 FROM private.migration_ledger WHERE version='${version}') THEN RAISE EXCEPTION 'ALREADY_APPLIED';END IF;
END $$;
${sql}
INSERT INTO private.migration_ledger(version,sha256) VALUES('${version}','${hash}');
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT version,sha256,has_table_privilege('authenticated','public.subscription_events','SELECT') private_history_exposed,has_function_privilege('authenticated','private.subscription_live(text)','EXECUTE') private_helper_exposed FROM private.migration_ledger WHERE version='${version}';
`);console.log(JSON.stringify({version,sha256:hash,newGrants:false}));
