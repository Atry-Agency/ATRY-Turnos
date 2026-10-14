INSERT INTO plans VALUES('trial','Prueba',5,1,1,1),('individual','Individual',1,1,1,1),('negocio','Negocio',5,1,1,1),('pro','Pro',10,1,1,1);
CREATE TABLE mail_daily_budget(day date PRIMARY KEY,attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),limit_count integer NOT NULL DEFAULT 200 CHECK(limit_count BETWEEN 1 AND 300));
ALTER TABLE mail_daily_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mail_daily_budget FROM anon,authenticated;
CREATE FUNCTION public.atry_mail_claim(batch_size integer DEFAULT 10) RETURNS SETOF mail_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.mail_jobs;budget public.mail_daily_budget;today date:=(now() AT TIME ZONE 'UTC')::date;count_claimed int:=0;
BEGIN
 INSERT INTO public.mail_daily_budget(day) VALUES(today) ON CONFLICT DO NOTHING;
 SELECT * INTO budget FROM public.mail_daily_budget WHERE day=today FOR UPDATE;
 UPDATE public.mail_jobs SET state='retry',lease_until=null WHERE state='processing' AND lease_until<now();
 FOR j IN SELECT * FROM public.mail_jobs WHERE state IN ('queued','retry') AND next_attempt_at<=now() ORDER BY next_attempt_at,created_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(batch_size,1),20) LOOP
  IF budget.attempts+count_claimed>=budget.limit_count THEN EXIT; END IF;
  IF j.attempts>=5 THEN UPDATE public.mail_jobs SET state='failed' WHERE id=j.id;CONTINUE;END IF;
  IF j.recipient='' OR lower(j.recipient)~'@(example\.(com|net|org)|[^@]+\.(test|invalid|example|localhost))$' THEN UPDATE public.mail_jobs SET state='skipped',last_error='TEST_RECIPIENT_BLOCKED' WHERE id=j.id;CONTINUE;END IF;
  UPDATE public.mail_jobs SET state='processing',lease_until=now()+interval '60 seconds',attempts=attempts+1,updated_at=now() WHERE id=j.id RETURNING * INTO j;
  count_claimed:=count_claimed+1;RETURN NEXT j;
 END LOOP;
 UPDATE public.mail_daily_budget SET attempts=attempts+count_claimed WHERE day=today;
END $$;
REVOKE ALL ON FUNCTION public.atry_mail_claim(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atry_mail_claim(integer) TO service_role;
CREATE FUNCTION public.atry_mail_result(job_id text,expected_attempt integer,provider_id text,error_code text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF provider_id IS NULL AND error_code IS NULL THEN RAISE EXCEPTION 'PROVIDER_CONFIRMATION_REQUIRED'; END IF;
 UPDATE public.mail_jobs SET state=CASE WHEN atry_mail_result.provider_id IS NOT NULL THEN 'provider_accepted' WHEN attempts>=5 THEN 'failed' ELSE 'retry' END,provider_id=atry_mail_result.provider_id,last_error=left(regexp_replace(coalesce(error_code,''),'[^A-Z0-9_-]','','g'),80),lease_until=null,next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts-1))::int),updated_at=now() WHERE id=job_id AND attempts=expected_attempt AND state='processing';
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.atry_mail_result(text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atry_mail_result(text,integer,text,text) TO service_role;
CREATE FUNCTION public.atry_usage_local() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=private.user_id() AND platform_admin=1) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('database_bytes',pg_database_size(current_database()),'mail_budget',(SELECT to_jsonb(x)||jsonb_build_object('warning',attempts>=limit_count*.7) FROM public.mail_daily_budget x WHERE day=(now() AT TIME ZONE 'UTC')::date),'provider_usage_available',false);
END $$;
REVOKE ALL ON FUNCTION public.atry_usage_local() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_usage_local() TO authenticated;
