-- Read-only checks for STAGING AFTER applying the migration there.
BEGIN READ ONLY;
SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('whatsapp_settings','whatsapp_consent','whatsapp_actions','whatsapp_previous');
SELECT role,has_function_privilege(role,'public.atry_whatsapp(text,text,text,jsonb)','EXECUTE') AS rpc_execute FROM unnest(ARRAY['anon','authenticated','service_role']) role;
SELECT role,table_name,has_table_privilege(role,'public.'||table_name,'SELECT') AS direct_read,has_table_privilege(role,'public.'||table_name,'INSERT') AS direct_insert FROM unnest(ARRAY['anon','authenticated','service_role']) role CROSS JOIN unnest(ARRAY['whatsapp_settings','whatsapp_consent','whatsapp_actions','whatsapp_previous']) table_name;
SELECT p.proname,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.proname IN ('atry_whatsapp','whatsapp_snapshot');
SELECT tgname,tgenabled FROM pg_trigger WHERE tgrelid='public.bookings'::regclass AND tgname='whatsapp_reschedule_snapshot';
SELECT tablename,indexname FROM pg_indexes WHERE schemaname='public' AND tablename='whatsapp_actions';
COMMIT;
