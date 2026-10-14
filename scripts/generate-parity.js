'use strict';
const fs=require('node:fs');
let rules=fs.readFileSync('supabase/migrations/202610140013_scheduling.sql','utf8').replaceAll('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
rules=rules.replaceAll('starts_at>now()', 'ends_at>now()');
rules=rules.replace(' CASE kind'," IF kind IS NULL OR kind NOT IN ('breaks','exceptions','holidays','resources','time_off','hours','service_resources') THEN RAISE EXCEPTION 'INVALID_RULE';END IF;\n CASE kind");
rules=rules.replace("INSERT INTO public.schedule_exceptions VALUES(rid,bid,sid,day,(payload->>'start_min')::int,(payload->>'end_min')::int,coalesce((payload->>'closed')::int,0));", "INSERT INTO public.schedule_exceptions VALUES(rid,bid,sid,day,(payload->>'start_min')::int,(payload->>'end_min')::int,coalesce((payload->>'closed')::int,0)) ON CONFLICT(staff_id,day) DO UPDATE SET start_min=excluded.start_min,end_min=excluded.end_min,closed=excluded.closed RETURNING id INTO rid;");
const tail=fs.readFileSync('supabase/parity-tail.sql','utf8');
fs.writeFileSync('supabase/migrations/202610140022_parity.sql','-- Generated from 013 + parity-tail.sql. Applied migrations remain immutable.\n'+rules+'\n'+tail);
