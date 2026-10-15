-- Authorized deployment verification. No demonstration user, customer or booking.
-- Operator must set atry.mail_probe_recipient to the explicitly authorized address.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.migration_ledger WHERE version='202610140024') THEN RAISE EXCEPTION 'MISSING_MAIL_INTEGRITY';END IF;
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='atry-turnos-mail' AND active) THEN RAISE EXCEPTION 'MAIL_SCHEDULER_MISSING';END IF;
END $$;
INSERT INTO public.mail_jobs(id,dedupe_key,source,source_id,kind,recipient,subject,content,next_attempt_at,created_at,updated_at)
VALUES(gen_random_uuid()::text,'system:deployment-verification:20261014','system','deployment-verification:20261014','system_test',current_setting('atry.mail_probe_recipient'),'Atry Turnos · prueba de notificaciones','Esta es la prueba autorizada de la integración de notificaciones de Atry Turnos. No corresponde a una reserva. La aplicación está disponible en https://atry-agency.github.io/ATRY-Turnos/.',now(),now(),now())
ON CONFLICT(dedupe_key) DO NOTHING;
SELECT public.atry_configure_delivery('https://atry-agency.github.io/ATRY-Turnos/',true);
SELECT private.invoke_mail_worker() request_id;
COMMIT;
SELECT id,state,attempts,provider_id,last_error FROM public.mail_jobs WHERE dedupe_key='system:deployment-verification:20261014';
