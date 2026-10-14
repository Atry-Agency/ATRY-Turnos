'use strict';const fs=require('node:fs');const original=fs.readFileSync('supabase/migrations/202610140004_booking_rpc.sql','utf8');const start=original.indexOf('CREATE FUNCTION public.atry_update_booking('),end=original.indexOf('REVOKE ALL ON FUNCTION public.atry_update_booking',start);
let core=original.slice(start,end).replace('CREATE FUNCTION public.atry_update_booking(bid text,booking_id text,patch jsonb)','CREATE FUNCTION private.update_booking(bid text,booking_id text,patch jsonb,source text)');
core=core.replace("IF b.id IS NULL OR role IS NULL OR (role='staff' AND (NOT private.own_staff(b.staff_id) OR (patch ? 'staff_id' AND NOT private.own_staff(patch->>'staff_id')))) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;",`IF b.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
IF source='manual' THEN
 IF role IS NULL OR (role='staff' AND (NOT private.own_staff(b.staff_id) OR (patch ? 'staff_id' AND NOT private.own_staff(patch->>'staff_id')))) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
ELSIF source<>'guest' THEN RAISE EXCEPTION 'INVALID_SOURCE';END IF;`);
core=core.replace('starts,b.id,false','starts,b.id,source=\'guest\'');
fs.writeFileSync('supabase/migrations/202610140014_management.sql',core+fs.readFileSync('supabase/management-tail.sql','utf8'));
