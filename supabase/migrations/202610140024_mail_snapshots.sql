-- Keep queued booking messages tied to the event they describe.
ALTER TABLE public.mail_jobs ADD COLUMN booking_snapshot jsonb;

CREATE OR REPLACE FUNCTION private.enqueue_mail(dedupe text,bid text,source text,source_id text,kind text,recipient text,subject text,content text,scheduled timestamptz DEFAULT now()) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO public.mail_jobs(id,dedupe_key,business_id,source,source_id,kind,recipient,subject,content,next_attempt_at,created_at,updated_at,booking_snapshot)
 SELECT gen_random_uuid()::text,dedupe,bid,source,source_id,kind,recipient,subject,content,scheduled,now(),now(),
  (SELECT jsonb_build_object('status',b.status,'starts_at',b.starts_at,'staff_id',b.staff_id) FROM public.notifications n JOIN public.bookings b ON b.id=n.booking_id WHERE n.id=enqueue_mail.source_id AND b.business_id=bid AND enqueue_mail.source IN ('notification','business_alert'))
 ON CONFLICT(dedupe_key) DO NOTHING
$$;

CREATE OR REPLACE FUNCTION private.mail_is_valid(j public.mail_jobs) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.notification_preferences;b public.bookings;pref text;
BEGIN
 SELECT * INTO p FROM public.notification_preferences WHERE business_id=j.business_id;
 pref:=CASE j.kind WHEN 'confirmed' THEN 'confirmations' WHEN 'pending' THEN 'confirmations' WHEN 'cancelled' THEN 'cancellations' WHEN 'reprogramado' THEN 'reschedules' WHEN 'reminder' THEN 'reminders' WHEN 'business_alert' THEN 'business_alerts' WHEN 'waitlist_offer' THEN 'waitlist' END;
 IF coalesce((to_jsonb(p)->>pref)::integer,1)=0 THEN RETURN false;END IF;
 IF j.kind='invitation' THEN RETURN EXISTS(SELECT 1 FROM public.invitations WHERE id=j.source_id AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now());END IF;
 IF j.kind='waitlist_offer' THEN RETURN EXISTS(SELECT 1 FROM public.waitlist w JOIN private.offer_tokens t ON t.waitlist_id=w.id WHERE w.id=j.source_id AND w.status='offered' AND w.offer_expires_at>now() AND position('/#/oferta/'||t.token IN j.content)>0);END IF;
 IF j.kind='reminder' THEN SELECT * INTO b FROM public.bookings WHERE id=j.source_id;RETURN b.id IS NOT NULL AND b.status IN ('confirmed','pending') AND b.starts_at>now() AND j.dedupe_key='reminder:'||b.id||':'||b.starts_at::text;END IF;
 IF j.source IN ('notification','business_alert') THEN
  SELECT book.* INTO b FROM public.notifications n JOIN public.bookings book ON book.id=n.booking_id WHERE n.id=j.source_id AND book.business_id=j.business_id;
  RETURN b.id IS NOT NULL AND j.booking_snapshot IS NOT NULL AND j.booking_snapshot=jsonb_build_object('status',b.status,'starts_at',b.starts_at,'staff_id',b.staff_id);
 END IF;
 RETURN true;
END $$;
