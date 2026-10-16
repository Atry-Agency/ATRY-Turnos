-- Quotas reserve capacity before a sender is handed a job. Unknown deliveries retain reservations.
CREATE FUNCTION private.mail_reserve(j public.mail_jobs) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c record;lim int;existing private.mail_reservations;
BEGIN
 IF j.business_id IS NULL OR j.kind IN ('invitation','password_reset','auth','security') THEN RETURN true;END IF;
 IF NOT private.has_feature(j.business_id,'operational_mail') OR NOT private.subscription_live(j.business_id) THEN RETURN false;END IF;
 SELECT * INTO existing FROM private.mail_reservations WHERE job_id=j.id;IF FOUND THEN RETURN existing.state='reserved';END IF;
 SELECT * INTO c FROM private.commercial_cycle(j.business_id);SELECT p.mail_limit INTO lim FROM public.plans p JOIN public.businesses b ON b.plan=p.code WHERE b.id=j.business_id;
 INSERT INTO public.business_mail_usage(business_id,cycle_start) VALUES(j.business_id,c.cycle_start) ON CONFLICT DO NOTHING;
 UPDATE public.business_mail_usage SET reserved=reserved+1 WHERE business_id=j.business_id AND cycle_start=c.cycle_start AND accepted+reserved<lim;
 IF NOT FOUND THEN RETURN false;END IF;
 INSERT INTO private.mail_reservations(job_id,business_id,cycle_start) VALUES(j.id,j.business_id,c.cycle_start);RETURN true;
END $$;
CREATE FUNCTION private.mail_settle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r private.mail_reservations;
BEGIN
 IF NEW.state NOT IN ('provider_accepted','failed','skipped','retry','stored_local','smtp_accepted') THEN RETURN NEW;END IF;
 SELECT * INTO r FROM private.mail_reservations WHERE job_id=NEW.id AND state='reserved' FOR UPDATE;IF NOT FOUND THEN RETURN NEW;END IF;
 UPDATE public.business_mail_usage SET reserved=reserved-1,accepted=accepted+CASE WHEN NEW.state IN ('provider_accepted','stored_local','smtp_accepted') THEN 1 ELSE 0 END WHERE business_id=r.business_id AND cycle_start=r.cycle_start;
 IF NEW.state IN ('provider_accepted','stored_local','smtp_accepted') THEN UPDATE private.mail_reservations SET state='accepted' WHERE job_id=NEW.id;ELSE DELETE FROM private.mail_reservations WHERE job_id=NEW.id;END IF;RETURN NEW;
END $$;
CREATE TRIGGER commercial_mail_settle AFTER UPDATE OF state ON public.mail_jobs FOR EACH ROW EXECUTE FUNCTION private.mail_settle();
-- Operational jobs may be retained for traceability, but are explicitly omitted on Individual.
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('private.mail_is_valid(public.mail_jobs)'::regprocedure) INTO src;
 src:=regexp_replace(src,'\mBEGIN\M',E'BEGIN IF j.business_id IS NOT NULL AND j.kind NOT IN (''invitation'',''password_reset'',''auth'',''security'') AND (NOT private.has_feature(j.business_id,''operational_mail'') OR NOT private.subscription_live(j.business_id)) THEN RETURN false;END IF;','i');EXECUTE src;
END $$;
CREATE OR REPLACE FUNCTION public.atry_mail_claim(batch_size integer DEFAULT 10) RETURNS SETOF public.mail_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.mail_jobs;budget public.mail_daily_budget;today date:=(now() AT TIME ZONE 'UTC')::date;count_claimed int:=0;s private.commercial_settings;ceiling int;
BEGIN
 SELECT * INTO s FROM private.commercial_settings WHERE id=1;
 INSERT INTO public.mail_daily_budget(day,limit_count) VALUES(today,least(s.provider_daily_limit,300)) ON CONFLICT DO NOTHING;
 SELECT * INTO budget FROM public.mail_daily_budget WHERE day=today FOR UPDATE;
 UPDATE public.mail_jobs SET state='delivery_unknown',lease_until=null,last_error='LEASE_EXPIRED_RECONCILIATION_REQUIRED',updated_at=now() WHERE state='processing' AND lease_until<now();
 FOR j IN SELECT * FROM public.mail_jobs WHERE state IN ('queued','retry','quota_exhausted') AND next_attempt_at<=now() ORDER BY CASE WHEN kind IN ('invitation','password_reset','auth','security') THEN 0 ELSE 1 END,next_attempt_at,created_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(batch_size,1),20) LOOP
  ceiling:=least(budget.limit_count,s.provider_daily_limit)-CASE WHEN j.kind IN ('invitation','password_reset','auth','security') THEN 0 ELSE s.security_reserve END;
  IF budget.attempts+count_claimed>=ceiling THEN CONTINUE;END IF;
  IF j.attempts>=5 THEN UPDATE public.mail_jobs SET state='failed',updated_at=now() WHERE id=j.id;CONTINUE;END IF;
  IF j.recipient='' OR lower(j.recipient)~'@(example\.(com|net|org)|[^@]+\.(test|invalid|example|localhost))$' OR NOT private.mail_is_valid(j) THEN UPDATE public.mail_jobs SET state='skipped',last_error='RECIPIENT_OR_PLAN_BLOCKED',updated_at=now() WHERE id=j.id;CONTINUE;END IF;
  IF NOT private.mail_reserve(j) THEN UPDATE public.mail_jobs SET state='quota_exhausted',last_error='MONTHLY_QUOTA_EXHAUSTED',next_attempt_at=(SELECT cycle_end FROM private.commercial_cycle(j.business_id)),updated_at=now() WHERE id=j.id;CONTINUE;END IF;
  UPDATE public.mail_jobs SET state='processing',lease_until=now()+interval '60 seconds',attempts=attempts+1,updated_at=now() WHERE id=j.id RETURNING * INTO j;count_claimed:=count_claimed+1;RETURN NEXT j;
 END LOOP;
 UPDATE public.mail_daily_budget SET attempts=attempts+count_claimed WHERE day=today;
END $$;
REVOKE ALL ON FUNCTION private.mail_reserve(public.mail_jobs),private.mail_settle() FROM PUBLIC,anon,authenticated,service_role;
-- The operator may raise the verified provider capacity after upgrading the provider.
ALTER TABLE public.mail_daily_budget DROP CONSTRAINT mail_daily_budget_limit_count_check;
ALTER TABLE public.mail_daily_budget ADD CONSTRAINT mail_daily_budget_limit_count_check CHECK(limit_count BETWEEN 1 AND 100000);
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.atry_mail_claim(integer)'::regprocedure) INTO src;
 src:=replace(src,'least(s.provider_daily_limit,300)','s.provider_daily_limit');
 src:=replace(src,'ON CONFLICT DO NOTHING;','ON CONFLICT(day) DO UPDATE SET limit_count=EXCLUDED.limit_count;');EXECUTE src;
END $$;
