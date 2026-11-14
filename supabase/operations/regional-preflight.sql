-- PREPARED READ-ONLY ONLY. Run exclusively after explicit target authorization.
-- Does not invoke RPCs that expand recurring appointments or enqueue notifications.
BEGIN READ ONLY;
SELECT version() AS database_version,current_database() AS database_name;
SELECT extname,extversion FROM pg_extension ORDER BY extname;
SELECT table_schema,table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns WHERE table_schema IN ('public','private')
 AND table_name IN ('businesses','services','bookings','runtime_settings') ORDER BY 1,2,ordinal_position;
SELECT timezone,count(*) AS businesses FROM public.businesses GROUP BY timezone ORDER BY timezone;
SELECT coalesce(to_jsonb(b)->>'country','UY') AS country,coalesce(to_jsonb(b)->>'currency','UYU') AS currency,count(*)
FROM public.businesses b GROUP BY 1,2 ORDER BY 1,2;
SELECT to_jsonb(s)->'pa_registration_enabled' AS pa_registration_enabled,to_jsonb(s)->'pa_public_enabled' AS pa_public_enabled FROM private.runtime_settings s WHERE id=1;
SELECT n.nspname AS schema,c.relname AS relation,c.reltuples::bigint AS estimated_rows,pg_total_relation_size(c.oid) AS total_bytes,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private','storage') AND c.relkind='r' ORDER BY 1,2;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY 1,2,3;
SELECT n.nspname AS schema,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef,p.proconfig,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.prokind='f' ORDER BY 1,2,3;
SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema IN ('public','private','storage') AND grantee IN ('anon','authenticated','service_role') ORDER BY 1,2,3,4;
SELECT event_object_schema,event_object_table,trigger_name,event_manipulation,action_timing FROM information_schema.triggers WHERE event_object_schema='public' ORDER BY 1,2,3;
ROLLBACK;
