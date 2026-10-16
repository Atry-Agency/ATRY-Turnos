-- Renewal extends access without resetting the monthly quota cycle.
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.atry_admin_save_business(text,jsonb)'::regprocedure) INTO src;
 src:=replace(src,'WHEN payload?''starts_day'' THEN','WHEN payload?''starts_day'' AND act<>''renew'' THEN');EXECUTE src;
 SELECT pg_get_functiondef('public.atry_admin_businesses()'::regprocedure) INTO src;
 src:=replace(src,'b.paid_until,b.trial_until,b.created_at','b.paid_until,b.trial_until,b.subscription_started_at,b.created_at');EXECUTE src;
END $$;
