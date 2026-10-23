-- Read-only checks to run on STAGING before applying the new migration.
-- This file neither applies migrations nor publishes the application.
BEGIN READ ONLY;
SELECT name,to_regclass('public.'||name) AS dependency FROM unnest(ARRAY['businesses','memberships','staff','services','customers','bookings','plans','audit_log','booking_visit_items']) name;
SELECT name,to_regclass('public.'||name) AS unexpected_existing_object FROM unnest(ARRAY['whatsapp_settings','whatsapp_consent','whatsapp_actions','whatsapp_previous']) name;
SELECT to_regprocedure('private.user_id()') AS session_guard,to_regprocedure('private.member_role(text)') AS membership_guard,to_regprocedure('private.require_manager(text)') AS manager_guard;
SELECT t.relname,c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname IN ('bookings','customers') AND c.contype IN ('p','u') ORDER BY t.relname,c.conname;
SELECT code,price_uyu,mail_limit,staff_limit FROM public.plans ORDER BY code;
SELECT role,count(*) FROM public.memberships GROUP BY role;
SELECT count(*) AS customers_without_phone FROM public.customers WHERE phone IS NULL OR btrim(phone)='';
SELECT status,count(*) FROM public.bookings GROUP BY status;
COMMIT;
