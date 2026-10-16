-- Optional authenticated Brevo receipts. Disabled until the Edge secret and webhook are provisioned.
CREATE TABLE private.mail_receipts(id text PRIMARY KEY,provider_id text NOT NULL,event text NOT NULL CHECK(event IN ('delivered','hard_bounce','soft_bounce','blocked','invalid','sent','deferred')),occurred_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.mail_receipts ENABLE ROW LEVEL SECURITY;REVOKE ALL ON private.mail_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX mail_receipts_provider_time ON private.mail_receipts(provider_id,occurred_at DESC);
CREATE FUNCTION private.apply_mail_receipts(pid text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.mail_jobs;e private.mail_receipts;
BEGIN
 IF (SELECT count(*) FROM public.mail_jobs WHERE provider_id=pid)<>1 THEN RETURN false;END IF;SELECT * INTO j FROM public.mail_jobs WHERE provider_id=pid FOR UPDATE;IF NOT FOUND THEN RETURN false;END IF;
 SELECT * INTO e FROM private.mail_receipts WHERE provider_id=pid AND event IN ('delivered','hard_bounce','blocked','invalid') ORDER BY occurred_at DESC,CASE WHEN event='delivered' THEN 1 ELSE 0 END,id LIMIT 1;
 IF e.id IS NULL OR j.state IN ('queued','retry','failed','skipped','quota_exhausted','processing') THEN RETURN false;END IF;
 IF j.state='delivery_unknown' THEN UPDATE public.mail_jobs SET state='provider_accepted',updated_at=now() WHERE id=j.id;END IF;
 UPDATE public.mail_jobs SET state=CASE WHEN e.event='delivered' THEN 'delivered' ELSE 'bounced' END,updated_at=now() WHERE id=j.id AND state IS DISTINCT FROM CASE WHEN e.event='delivered' THEN 'delivered' ELSE 'bounced' END;RETURN true;
END $$;
CREATE FUNCTION public.atry_record_mail_receipt(event_id text,message_id text,event_kind text,event_time timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE matched boolean;
BEGIN
 IF length(event_id) NOT BETWEEN 1 AND 250 OR length(message_id) NOT BETWEEN 1 AND 300 OR event_kind NOT IN ('delivered','hard_bounce','soft_bounce','blocked','invalid','sent','deferred') OR event_time>now()+interval '5 minutes' OR event_time<now()-interval '90 days' THEN RAISE EXCEPTION 'INVALID_RECEIPT';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('receipt:'||message_id,0));
 INSERT INTO private.mail_receipts(id,provider_id,event,occurred_at) VALUES(event_id,message_id,event_kind,event_time) ON CONFLICT DO NOTHING;
 matched:=private.apply_mail_receipts(message_id);RETURN jsonb_build_object('accepted',true,'matched',matched);
END $$;
CREATE FUNCTION private.receipt_after_acceptance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NEW.provider_id IS NOT NULL AND NEW.state IN ('provider_accepted','delivery_unknown') AND (OLD.state IS DISTINCT FROM NEW.state OR OLD.provider_id IS DISTINCT FROM NEW.provider_id) THEN PERFORM private.apply_mail_receipts(NEW.provider_id);END IF;RETURN NEW;END $$;
CREATE TRIGGER receipt_on_acceptance AFTER UPDATE OF provider_id,state ON public.mail_jobs FOR EACH ROW EXECUTE FUNCTION private.receipt_after_acceptance();
REVOKE ALL ON FUNCTION private.apply_mail_receipts(text),private.receipt_after_acceptance(),public.atry_record_mail_receipt(text,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.atry_record_mail_receipt(text,text,text,timestamptz) TO service_role;
