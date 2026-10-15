-- Hosted Supabase only. Project: djoxdtloqwbrhgtgencc.
-- Provision the existing service credential in Vault as atry_mail_service_role first.
-- No credentials belong in this file or in the cron command.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Defense in depth where ownership permits revocation. Hosted pg_net objects
-- belong to supabase_admin and may retain PUBLIC grants; net must stay outside
-- the Data API and application roles must stay NOLOGIN. Verify both remotely.
REVOKE ALL ON SCHEMA net FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA net FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA net FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA net FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON vault.decrypted_secrets FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.invoke_mail_worker() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text;request_id bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.runtime_settings WHERE id=1 AND mail_enabled) THEN RETURN NULL;END IF;
 SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE name='atry_mail_service_role';
 IF token IS NULL OR length(token)<100 THEN RAISE EXCEPTION 'MAIL_INVOCATION_SECRET_MISSING';END IF;
 SELECT net.http_post(
  url:='https://djoxdtloqwbrhgtgencc.supabase.co/functions/v1/atry-mail',
  headers:=jsonb_build_object('Authorization','Bearer '||token,'Content-Type','application/json'),
  body:='{}'::jsonb,timeout_milliseconds:=115000
 ) INTO request_id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION private.invoke_mail_worker() FROM PUBLIC,anon,authenticated,service_role;

SELECT cron.schedule('atry-turnos-mail','*/2 * * * *','SELECT private.invoke_mail_worker();');
COMMIT;

SELECT jobname,schedule,active FROM cron.job WHERE jobname='atry-turnos-mail';
SELECT has_table_privilege('authenticated','net.http_request_queue','SELECT') AS auth_reads_headers,
 has_table_privilege('anon','vault.decrypted_secrets','SELECT') AS anon_reads_vault,
 has_function_privilege('authenticated','private.invoke_mail_worker()','EXECUTE') AS auth_invokes_worker;
