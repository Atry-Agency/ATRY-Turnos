CREATE TABLE private.runtime_settings(id integer PRIMARY KEY CHECK(id=1),public_url text NOT NULL DEFAULT '',mail_enabled boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO private.runtime_settings(id) VALUES(1);
ALTER TABLE private.runtime_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.runtime_settings FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atry_runtime_config() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('app','Atry Turnos','version','1.2.0','currency','UYU','timezone','America/Montevideo','payments_live',false,'whatsapp_live',false,'mail_provider',CASE WHEN mail_enabled THEN 'brevo' ELSE 'disabled' END,'automatic_email_live',mail_enabled,'plans',jsonb_build_array(jsonb_build_object('code','individual','name','Individual','price',590),jsonb_build_object('code','negocio','name','Negocio','price',1190),jsonb_build_object('code','pro','name','Pro','price',1990))) FROM private.runtime_settings WHERE id=1
$$;
CREATE FUNCTION public.atry_configure_delivery(site_url text,enabled boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF coalesce(site_url,'')!~'^https://[a-z0-9-]+\.pages\.dev/?$' OR enabled IS NULL THEN RAISE EXCEPTION 'INVALID_DELIVERY_CONFIG';END IF;
 UPDATE private.runtime_settings SET public_url=regexp_replace(site_url,'/$',''),mail_enabled=enabled,updated_at=now() WHERE id=1;RETURN true;
END $$;
CREATE FUNCTION private.enqueue_mail(dedupe text,bid text,source text,source_id text,kind text,recipient text,subject text,content text,scheduled timestamptz DEFAULT now()) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO public.mail_jobs(id,dedupe_key,business_id,source,source_id,kind,recipient,subject,content,next_attempt_at,created_at,updated_at) VALUES(gen_random_uuid()::text,dedupe,bid,source,source_id,kind,recipient,subject,content,scheduled,now(),now()) ON CONFLICT(dedupe_key) DO NOTHING
$$;
CREATE FUNCTION private.booking_change_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kind text;recipient text;token text;
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at AND NEW.staff_id IS NOT DISTINCT FROM OLD.staff_id THEN RETURN NEW;END IF;
 kind:=CASE WHEN NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN 'reprogramado' ELSE NEW.status END;
 SELECT coalesce(NEW.customer_email_snapshot,c.email,'') INTO recipient FROM public.customers c WHERE c.id=NEW.customer_id;
 SELECT t.token INTO token FROM private.booking_tokens t WHERE t.booking_id=NEW.id;
 INSERT INTO public.notifications(id,business_id,booking_id,kind,recipient,subject,content,created_at) VALUES(gen_random_uuid()::text,NEW.business_id,NEW.id,kind,recipient,CASE kind WHEN 'cancelled' THEN 'Reserva cancelada' WHEN 'reprogramado' THEN 'Reserva reprogramada' WHEN 'confirmed' THEN 'Reserva confirmada' ELSE 'Actualización de tu reserva' END,'Tu reserva fue actualizada.'||CASE WHEN token IS NOT NULL THEN ' Gestioná tu turno en /#/gestionar/'||token ELSE '' END,now());RETURN NEW;
END $$;
CREATE TRIGGER booking_change_mail AFTER UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION private.booking_change_notification();
CREATE FUNCTION private.ingest_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings;biz public.businesses;customer text;service text;offer_id text;body text;
BEGIN
 IF NEW.kind='waitlist_offer' THEN
  offer_id:=NEW.content::jsonb->>'waitlist_id';
  body:='Hay un horario disponible. La oferta vence en 30 minutos y no retiene el turno. Revisá y confirmá en /#/oferta/'||(NEW.content::jsonb->>'token');
  PERFORM private.enqueue_mail('notification:'||NEW.id,NEW.business_id,'waitlist_offer',offer_id,NEW.kind,NEW.recipient,NEW.subject,body);
 ELSE
  IF NEW.recipient<>'' THEN PERFORM private.enqueue_mail('notification:'||NEW.id,NEW.business_id,'notification',NEW.id,NEW.kind,NEW.recipient,NEW.subject,NEW.content);
  ELSE UPDATE public.notifications SET state='internal_only' WHERE id=NEW.id;END IF;
  IF NEW.kind IN ('confirmed','pending','cancelled','reprogramado','no_show') AND coalesce((SELECT business_alerts FROM public.notification_preferences WHERE business_id=NEW.business_id),1)=1 THEN
   SELECT * INTO b FROM public.bookings WHERE id=NEW.booking_id;SELECT * INTO biz FROM public.businesses WHERE id=NEW.business_id;
   SELECT coalesce(b.customer_name_snapshot,name) INTO customer FROM public.customers WHERE id=b.customer_id;SELECT name INTO service FROM public.services WHERE id=b.service_id;
   IF biz.email<>'' THEN PERFORM private.enqueue_mail('business-alert:'||NEW.id,NEW.business_id,'business_alert',NEW.id,'business_alert',biz.email,'Actualización de agenda · '||biz.name,NEW.subject||': '||customer||', '||service||', '||to_char(b.starts_at AT TIME ZONE biz.timezone,'DD/MM/YYYY HH24:MI')||'. Revisá el panel en /#/app/agenda.');END IF;
  END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER notification_enqueue AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION private.ingest_notification();
CREATE FUNCTION public.atry_mail_ingest() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b record;p public.notification_preferences;i record;scheduled timestamptz;
BEGIN
 UPDATE public.waitlist SET status='waiting',offer_token_hash=null,offer_expires_at=null WHERE status='offered' AND offer_expires_at<=now();
 FOR i IN SELECT inv.*,t.token FROM public.invitations inv JOIN private.invitation_tokens t ON t.invitation_id=inv.id WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() AND NOT EXISTS(SELECT 1 FROM public.mail_jobs WHERE dedupe_key='invitation:'||inv.id) ORDER BY inv.created_at LIMIT 100 LOOP
  PERFORM private.enqueue_mail('invitation:'||i.id,i.business_id,'invitation',i.id,'invitation',i.email,'Invitación a tu equipo','Te invitaron a un negocio. Aceptá en /#/invitacion/'||i.token||'. El enlace vence en 48 horas.');
 END LOOP;
 FOR b IN SELECT book.*,coalesce(book.customer_email_snapshot,c.email) email,coalesce(book.customer_name_snapshot,c.name) customer_name,s.name service_name,t.token FROM public.bookings book JOIN public.customers c ON c.id=book.customer_id JOIN public.services s ON s.id=book.service_id LEFT JOIN private.booking_tokens t ON t.booking_id=book.id WHERE book.status IN ('confirmed','pending') AND book.starts_at>now() AND coalesce(book.customer_email_snapshot,c.email)<>'' AND NOT EXISTS(SELECT 1 FROM public.mail_jobs WHERE dedupe_key='reminder:'||book.id||':'||book.starts_at::text) ORDER BY book.starts_at LIMIT 100 LOOP
  SELECT * INTO p FROM public.notification_preferences WHERE business_id=b.business_id;
  IF coalesce(p.reminders,1)=1 THEN
   scheduled:=greatest(now(),b.starts_at-make_interval(hours=>coalesce(p.reminder_hours,24)));
   PERFORM private.enqueue_mail('reminder:'||b.id||':'||b.starts_at::text,b.business_id,'reminder',b.id,'reminder',b.email,'Recordatorio de tu turno','Hola '||b.customer_name||'. Recordá tu turno de '||b.service_name||'.'||CASE WHEN b.token IS NOT NULL THEN ' Gestioná tu reserva en /#/gestionar/'||b.token ELSE '' END,scheduled);
  END IF;
 END LOOP;RETURN true;
END $$;
CREATE FUNCTION private.mail_is_valid(j public.mail_jobs) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.notification_preferences;b public.bookings;pref text;
BEGIN
 SELECT * INTO p FROM public.notification_preferences WHERE business_id=j.business_id;
 pref:=CASE j.kind WHEN 'confirmed' THEN 'confirmations' WHEN 'pending' THEN 'confirmations' WHEN 'cancelled' THEN 'cancellations' WHEN 'reprogramado' THEN 'reschedules' WHEN 'reminder' THEN 'reminders' WHEN 'business_alert' THEN 'business_alerts' WHEN 'waitlist_offer' THEN 'waitlist' END;
 IF coalesce((to_jsonb(p)->>pref)::integer,1)=0 THEN RETURN false;END IF;
 IF j.kind='invitation' THEN RETURN EXISTS(SELECT 1 FROM public.invitations WHERE id=j.source_id AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now());END IF;
 IF j.kind='waitlist_offer' THEN RETURN EXISTS(SELECT 1 FROM public.waitlist w JOIN private.offer_tokens t ON t.waitlist_id=w.id WHERE w.id=j.source_id AND w.status='offered' AND w.offer_expires_at>now() AND position('/#/oferta/'||t.token IN j.content)>0);END IF;
 IF j.kind='reminder' THEN SELECT * INTO b FROM public.bookings WHERE id=j.source_id;RETURN b.id IS NOT NULL AND b.status IN ('confirmed','pending') AND b.starts_at>now() AND j.dedupe_key='reminder:'||b.id||':'||b.starts_at::text;END IF;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.atry_mail_claim(batch_size integer DEFAULT 10) RETURNS SETOF public.mail_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.mail_jobs;budget public.mail_daily_budget;today date:=(now() AT TIME ZONE 'UTC')::date;count_claimed int:=0;
BEGIN
 INSERT INTO public.mail_daily_budget(day) VALUES(today) ON CONFLICT DO NOTHING;SELECT * INTO budget FROM public.mail_daily_budget WHERE day=today FOR UPDATE;
 -- A crashed sender may already have handed the message to Brevo. Do not resend blindly.
 UPDATE public.mail_jobs SET state='delivery_unknown',lease_until=null,last_error='LEASE_EXPIRED_RECONCILIATION_REQUIRED',updated_at=now() WHERE state='processing' AND lease_until<now();
 FOR j IN SELECT * FROM public.mail_jobs WHERE state IN ('queued','retry') AND next_attempt_at<=now() ORDER BY next_attempt_at,created_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(batch_size,1),20) LOOP
  IF budget.attempts+count_claimed>=budget.limit_count THEN EXIT;END IF;
  IF j.attempts>=5 THEN UPDATE public.mail_jobs SET state='failed',updated_at=now() WHERE id=j.id;CONTINUE;END IF;
  IF j.recipient='' OR lower(j.recipient)~'@(example\.(com|net|org)|[^@]+\.(test|invalid|example|localhost))$' OR NOT private.mail_is_valid(j) THEN UPDATE public.mail_jobs SET state='skipped',last_error='RECIPIENT_OR_POLICY_BLOCKED',updated_at=now() WHERE id=j.id;CONTINUE;END IF;
  UPDATE public.mail_jobs SET state='processing',lease_until=now()+interval '60 seconds',attempts=attempts+1,updated_at=now() WHERE id=j.id RETURNING * INTO j;count_claimed:=count_claimed+1;RETURN NEXT j;
 END LOOP;UPDATE public.mail_daily_budget SET attempts=attempts+count_claimed WHERE day=today;
END $$;
CREATE OR REPLACE FUNCTION public.atry_mail_result(job_id text,expected_attempt integer,provider_id text,error_code text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE new_state text;pid text:=nullif(btrim(provider_id),'');
BEGIN
 IF pid IS NULL AND error_code IS NULL THEN RAISE EXCEPTION 'PROVIDER_CONFIRMATION_REQUIRED';END IF;
 IF pid IS NOT NULL AND error_code IS NOT NULL THEN RAISE EXCEPTION 'AMBIGUOUS_PROVIDER_RESULT';END IF;
 new_state:=CASE WHEN pid IS NOT NULL THEN 'provider_accepted' WHEN error_code IN ('PROVIDER_CONNECTION_ERROR','BREVO_DUPLICATE_UNKNOWN','BREVO_HTTP_500','BREVO_HTTP_502','BREVO_HTTP_503','BREVO_HTTP_504') THEN 'delivery_unknown' ELSE 'retry' END;
 UPDATE public.mail_jobs SET state=CASE WHEN new_state='retry' AND attempts>=5 THEN 'failed' ELSE new_state END,provider_id=pid,last_error=left(regexp_replace(coalesce(error_code,''),'[^A-Z0-9_-]','','g'),80),lease_until=null,next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts-1))::int),updated_at=now() WHERE id=job_id AND attempts=expected_attempt AND state='processing';
 IF FOUND THEN UPDATE public.notifications SET state=(SELECT state FROM public.mail_jobs WHERE id=job_id) WHERE id=(SELECT source_id FROM public.mail_jobs WHERE id=job_id AND source='notification');RETURN true;END IF;RETURN false;
END $$;
CREATE FUNCTION public.atry_notification_preferences(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN PERFORM private.require_manager(bid);RETURN coalesce((SELECT to_jsonb(p) FROM public.notification_preferences p WHERE business_id=bid),jsonb_build_object('business_id',bid,'confirmations',1,'cancellations',1,'reschedules',1,'reminders',1,'waitlist',1,'reminder_hours',24,'business_alerts',1));END $$;
CREATE FUNCTION public.atry_save_notification_preferences(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE p public.notification_preferences;k text;
BEGIN
 PERFORM private.require_manager(bid);PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 p:=jsonb_populate_record(NULL::public.notification_preferences,public.atry_notification_preferences(bid));
 FOREACH k IN ARRAY ARRAY['confirmations','cancellations','reschedules','reminders','waitlist','business_alerts'] LOOP IF payload?k AND coalesce(payload->>k,'') NOT IN ('0','1') THEN RAISE EXCEPTION 'INVALID_PREFERENCE';END IF;END LOOP;
 IF payload?'reminder_hours' AND (coalesce(payload->>'reminder_hours','')!~'^[0-9]+$' OR (payload->>'reminder_hours')::integer NOT BETWEEN 1 AND 168) THEN RAISE EXCEPTION 'INVALID_REMINDER';END IF;
 INSERT INTO public.notification_preferences VALUES(bid,coalesce((payload->>'confirmations')::integer,p.confirmations),coalesce((payload->>'cancellations')::integer,p.cancellations),coalesce((payload->>'reschedules')::integer,p.reschedules),coalesce((payload->>'reminders')::integer,p.reminders),coalesce((payload->>'waitlist')::integer,p.waitlist),coalesce((payload->>'reminder_hours')::integer,p.reminder_hours),coalesce((payload->>'business_alerts')::integer,p.business_alerts)) ON CONFLICT(business_id) DO UPDATE SET confirmations=excluded.confirmations,cancellations=excluded.cancellations,reschedules=excluded.reschedules,reminders=excluded.reminders,waitlist=excluded.waitlist,reminder_hours=excluded.reminder_hours,business_alerts=excluded.business_alerts;
 UPDATE public.mail_jobs j SET next_attempt_at=greatest(now(),b.starts_at-make_interval(hours=>coalesce((payload->>'reminder_hours')::integer,p.reminder_hours))),state=CASE WHEN coalesce((payload->>'reminders')::integer,p.reminders)=1 THEN 'queued' ELSE 'skipped' END FROM public.bookings b WHERE j.business_id=bid AND j.kind='reminder' AND j.source_id=b.id AND j.state IN ('queued','retry','skipped') AND b.starts_at>now() AND b.status IN ('confirmed','pending');RETURN public.atry_notification_preferences(bid);
END $$;
CREATE FUNCTION public.atry_mail_jobs(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN PERFORM private.require_manager(bid);RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,kind,recipient,subject,state,attempts,last_error,next_attempt_at,created_at FROM public.mail_jobs WHERE business_id=bid ORDER BY created_at DESC LIMIT 100) x),'[]'::jsonb);END $$;
CREATE FUNCTION public.atry_notifications(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN PERFORM private.require_manager(bid);RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,booking_id,kind,recipient,subject,state,created_at FROM public.notifications WHERE business_id=bid ORDER BY created_at DESC LIMIT 100) x),'[]'::jsonb);END $$;
CREATE FUNCTION public.atry_audit(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN PERFORM private.require_manager(bid);RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.audit_log WHERE business_id=bid ORDER BY created_at DESC LIMIT 80) x),'[]'::jsonb);END $$;
REVOKE ALL ON FUNCTION private.enqueue_mail(text,text,text,text,text,text,text,text,timestamptz),private.booking_change_notification(),private.ingest_notification(),private.mail_is_valid(public.mail_jobs) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.atry_runtime_config(),public.atry_notification_preferences(text),public.atry_save_notification_preferences(text,jsonb),public.atry_mail_jobs(text),public.atry_notifications(text),public.atry_audit(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_runtime_config(),public.atry_notification_preferences(text),public.atry_save_notification_preferences(text,jsonb),public.atry_mail_jobs(text),public.atry_notifications(text),public.atry_audit(text) TO authenticated;
REVOKE ALL ON FUNCTION public.atry_configure_delivery(text,boolean),public.atry_mail_ingest() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atry_configure_delivery(text,boolean),public.atry_mail_ingest() TO service_role;
