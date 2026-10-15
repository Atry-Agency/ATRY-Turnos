-- Read-only operator audit. Never selects Vault values or outbound request headers.
SELECT
 (SELECT jsonb_build_object('enabled',mail_enabled,'url',public_url) FROM private.runtime_settings WHERE id=1) configuration,
 (SELECT jsonb_agg(jsonb_build_object('name',jobname,'schedule',schedule,'active',active)) FROM cron.job WHERE jobname='atry-turnos-mail') scheduler,
 (SELECT jsonb_agg(jsonb_build_object('status',status,'start',start_time)) FROM (SELECT d.* FROM cron.job_run_details d JOIN cron.job j ON j.jobid=d.jobid WHERE j.jobname='atry-turnos-mail' ORDER BY start_time DESC LIMIT 3) r) scheduled_runs,
 (SELECT jsonb_agg(jsonb_build_object('state',state,'attempts',attempts,'provider_id',provider_id)) FROM public.mail_jobs WHERE dedupe_key='system:deployment-verification:20261014') verification,
 (SELECT jsonb_agg(jsonb_build_object('status',status_code,'error',error_msg,'result',CASE WHEN status_code=200 THEN content::jsonb ELSE NULL END)) FROM (SELECT * FROM net._http_response ORDER BY created DESC LIMIT 3) r) responses,
 jsonb_build_object('auth_users',(SELECT count(*) FROM auth.users),'businesses',(SELECT count(*) FROM public.businesses),'customers',(SELECT count(*) FROM public.customers),'bookings',(SELECT count(*) FROM public.bookings)) production_counts,
 jsonb_build_object('anon_login',(SELECT rolcanlogin FROM pg_roles WHERE rolname='anon'),'authenticated_login',(SELECT rolcanlogin FROM pg_roles WHERE rolname='authenticated'),'anon_vault_select',has_table_privilege('anon','vault.decrypted_secrets','SELECT'),'authenticated_worker_execute',has_function_privilege('authenticated','private.invoke_mail_worker()','EXECUTE')) access_boundary;
