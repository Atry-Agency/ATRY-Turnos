'use strict';
// Generates a reviewed baseline from metadata only: never exports rows or passwords.
const fs=require('node:fs');const {connect}=require('../server/db');
const db=connect(':memory:');
const excluded=new Set(['sessions','password_resets','system_outbox','schema_migrations']);
const timeColumns=new Set(['created_at','updated_at','expires_at','accepted_at','revoked_at','trial_until','starts_at','ends_at','blocked_from','blocked_until','offered_at','offer_expires_at','offer_starts_at','next_attempt_at','lease_until']);
let sql=`-- PostgreSQL baseline. No demonstration rows or legacy credentials.\nCREATE SCHEMA IF NOT EXISTS extensions;\nCREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;\nSET search_path=public,extensions;\n`;
for(const table of db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all()){
 if(excluded.has(table.name))continue;
 let ddl=table.sql;
 if(table.name==='users')ddl=ddl.replace('password_hash TEXT NOT NULL,','auth_user_id UUID UNIQUE REFERENCES auth.users(id),');
 for(const column of timeColumns)ddl=ddl.replace(new RegExp('\\b'+column+' TEXT','g'),column+' TIMESTAMPTZ');
 sql+=ddl+';\nALTER TABLE '+table.name+' ENABLE ROW LEVEL SECURITY;\n';
}
sql+=`\n-- Cross-tenant composite foreign keys protect privileged writes too.\n`;
for(const table of ['staff','services','customers','resources','bookings'])sql+=`ALTER TABLE ${table} ADD UNIQUE(id,business_id);\n`;
for(const [table,column,target] of [['bookings','staff_id','staff'],['bookings','service_id','services'],['bookings','customer_id','customers'],['time_off','staff_id','staff'],['recurring_breaks','staff_id','staff'],['schedule_exceptions','staff_id','staff'],['waitlist','service_id','services']])sql+=`ALTER TABLE ${table} ADD FOREIGN KEY(${column},business_id) REFERENCES ${target}(id,business_id);\n`;
sql+=`CREATE INDEX ON bookings(business_id,starts_at);\nCREATE INDEX ON memberships(business_id,user_id);\nCREATE INDEX ON mail_jobs(state,next_attempt_at);\n`;
fs.mkdirSync('supabase/migrations',{recursive:true});fs.writeFileSync('supabase/migrations/202610140001_baseline.sql',sql);db.close();
