-- READ ONLY. Run only in dashboard project djoxdtloqwbrhgtgencc (ATRY Turnos).
-- Do not run this in ATRY LAB Operaciones. No users, addresses, tokens or message bodies returned.
SELECT version,applied_at FROM private.migration_ledger ORDER BY version;
SELECT count(*) businesses,(SELECT count(*) FROM public.bookings) bookings,(SELECT count(*) FROM public.users) application_users,(SELECT count(*) FROM public.users WHERE platform_admin=1) platform_administrators FROM public.businesses;
SELECT n.nspname,p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_exec,has_function_privilege('service_role',p.oid,'EXECUTE') service_exec FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname IN ('atry_control_read','atry_control_command','atry_control_worker','atry_record_mail_receipt','atry_admin_save_business','atry_admin_save_plan','atry_admin_save_commercial','control_read_base','control_command_base','control_save_business_base','control_save_plan_base','require_admin','control_stepup') ORDER BY n.nspname,p.proname;
SELECT n.nspname,c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private') AND c.relkind='r' ORDER BY n.nspname,c.relname;
SELECT state,count(*) jobs,min(created_at) oldest FROM public.mail_jobs GROUP BY state ORDER BY state;
SELECT code,count(*) count,max(created_at) latest FROM public.system_errors GROUP BY code ORDER BY latest DESC LIMIT 20;
SELECT pg_database_size(current_database()) measured_database_bytes;
-- After confirming pg_cron is installed, independently inspect only safe schedule metadata:
-- SELECT jobname,schedule,active FROM cron.job WHERE jobname='atry-turnos-mail';
-- Never select cron commands, HTTP headers, Vault decrypted secrets or provider credentials here.
