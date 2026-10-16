'use strict';
// Local-only rehearsal; never connects to Supabase and never prints row contents.
const fs=require('node:fs'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const {btree_gist}=require('@electric-sql/pglite/contrib/btree_gist');
const quote=s=>'"'+s.replaceAll('"','""')+'"';
(async()=>{
 const file=process.argv[2];if(!file)throw Error('SNAPSHOT_FILE_REQUIRED');
 const raw=fs.readFileSync(file),snapshot=JSON.parse(raw);
 if(snapshot.project!=='djoxdtloqwbrhgtgencc')throw Error('PROJECT_MISMATCH');
 const db=new PGlite({extensions:{btree_gist}});
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id),created_at timestamptz DEFAULT now(),not_after timestamptz,updated_at timestamptz);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;`);
 const files=fs.readdirSync('supabase/migrations').sort(),baseline=files.filter(f=>f.split('_')[0]<='202610150032');
 for(const f of baseline)await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'));
 await db.exec('CREATE TABLE private.migration_ledger(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());SET session_replication_role=replica;');
 const tables=snapshot.entries.filter(e=>e.kind==='table'&&(e.name.startsWith('public.')||e.name.startsWith('private.')||e.name==='auth.users'));
 await db.exec('TRUNCATE '+tables.map(e=>e.name.split('.').map(quote).join('.')).join(',')+' CASCADE');
 let restored=0;
 for(const e of tables){
  if(!e.data.length)continue;
  const [schema,table]=e.name.split('.'),name=[schema,table].map(quote).join('.');
  const columns=(await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND is_generated=\'NEVER\' ORDER BY ordinal_position',[schema,table])).rows.map(r=>r.column_name).filter(c=>Object.hasOwn(e.data[0],c));
  const cols=columns.map(quote).join(',');
  await db.query(`INSERT INTO ${name}(${cols}) SELECT ${cols} FROM jsonb_populate_recordset(NULL::${name},$1::jsonb)`,[JSON.stringify(e.data)]);restored+=e.data.length;
 }
 await db.exec('SET session_replication_role=origin;');
 const before=await counts(db,tables);
 for(const e of tables)if(before[e.name]!==e.data.length)throw Error('RESTORE_COUNT_MISMATCH:'+e.name);
 const ledger=snapshot.entries.find(e=>e.name==='private.migration_ledger').data;
 for(const m of ledger){const f=baseline.find(f=>f.startsWith(m.version+'_'));if(!f||hash(fs.readFileSync('supabase/migrations/'+f))!==m.sha256)throw Error('BASELINE_HASH_MISMATCH:'+m.version);}
 const applied=[];
 for(const f of files.filter(f=>f.split('_')[0]>'202610150032')){
  const sql=fs.readFileSync('supabase/migrations/'+f,'utf8');await db.exec('BEGIN;'+sql+'COMMIT;');applied.push({file:f,sha256:hash(sql)});
 }
 const after=await counts(db,tables);for(const e of tables)if(before[e.name]!==after[e.name])throw Error('MIGRATION_CHANGED_ROW_COUNT:'+e.name);
 console.log(JSON.stringify({project:snapshot.project,captured_at:snapshot.captured_at,snapshot_sha256:hash(raw),restored_application_tables:tables.length,restored_rows:restored,baseline_hashes_verified:ledger.length,application_row_counts_preserved:true,migrations:applied,limitations:['Auth is a local stub; sessions, provider configuration, Vault and Storage object bytes are excluded.','Not a full Supabase disaster-recovery rehearsal.']},null,2));await db.close();
})().catch(e=>{console.error(e.message);process.exitCode=1;});
function hash(s){return crypto.createHash('sha256').update(s).digest('hex');}
async function counts(db,tables){const result={};for(const e of tables)result[e.name]=Number((await db.query('SELECT count(*) AS n FROM '+e.name.split('.').map(quote).join('.'))).rows[0].n);return result;}
