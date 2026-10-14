CREATE TABLE private.offer_tokens(waitlist_id text PRIMARY KEY REFERENCES public.waitlist(id),token text NOT NULL);
ALTER TABLE private.offer_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.offer_tokens FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atry_public_waitlist(slug text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE b public.businesses;wid text:=gen_random_uuid()::text;key text:=payload->>'idempotency_key';scope text;fingerprint text:=private.hash(payload::text);previous public.idempotency_keys;result jsonb;day date;name text:=btrim(payload->>'customer_name');email text:=lower(btrim(payload->>'customer_email'));sid text:=nullif(payload->>'staff_id','');
BEGIN
 SELECT * INTO b FROM public.businesses WHERE businesses.slug=slug FOR UPDATE;
 IF b.id IS NULL OR NOT(b.is_active=1 AND b.allow_guest=1 AND (b.subscription_status='active' OR (b.subscription_status='trialing' AND b.trial_until>now()))) THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;
 IF coalesce(key,'')!~'^[A-Za-z0-9_-]{16,100}$' OR payload->'accept_policy' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'INVALID_REQUEST';END IF;
 scope:='waitlist:'||b.id;PERFORM pg_advisory_xact_lock(hashtext(scope||key));SELECT * INTO previous FROM public.idempotency_keys WHERE idempotency_keys.scope=scope AND key_hash=private.hash(key);
 IF previous.scope IS NOT NULL THEN IF previous.request_hash<>fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN previous.response::jsonb;END IF;
 day:=(payload->>'desired_date')::date;
 IF day IS NULL OR to_char(day,'YYYY-MM-DD') IS DISTINCT FROM payload->>'desired_date' OR day<(now() AT TIME ZONE b.timezone)::date OR day>(now() AT TIME ZONE b.timezone)::date+b.max_days THEN RAISE EXCEPTION 'INVALID_DATE';END IF;
 IF name IS NULL OR length(name) NOT BETWEEN 2 AND 100 OR email IS NULL OR email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(email)>150 OR length(coalesce(payload->>'customer_phone',''))>35 THEN RAISE EXCEPTION 'INVALID_CONTACT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.services WHERE id=payload->>'service_id' AND business_id=b.id AND active=1) THEN RAISE EXCEPTION 'INVALID_SERVICE';END IF;
 IF sid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.staff s JOIN public.staff_services ss ON ss.staff_id=s.id WHERE s.id=sid AND s.business_id=b.id AND s.active=1 AND ss.service_id=payload->>'service_id') THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
 IF EXISTS(SELECT 1 FROM public.waitlist WHERE business_id=b.id AND service_id=payload->>'service_id' AND desired_date=payload->>'desired_date' AND customer_email=email AND status IN ('waiting','offered')) THEN RAISE EXCEPTION 'ALREADY_WAITING';END IF;
 INSERT INTO public.waitlist(id,business_id,service_id,staff_id,desired_date,customer_name,customer_email,customer_phone,created_at) VALUES(wid,b.id,payload->>'service_id',sid,payload->>'desired_date',name,email,coalesce(payload->>'customer_phone',''),now());
 result:=jsonb_build_object('id',wid,'status','waiting','message','Solicitud agregada. No es una reserva confirmada.');
 INSERT INTO public.idempotency_keys VALUES(scope,private.hash(key),fingerprint,result::text,now());RETURN result;
END $$;
CREATE FUNCTION public.atry_waitlist(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN
 PERFORM private.require_manager(bid);
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT w.id,w.service_id,w.staff_id,w.customer_name,w.customer_email,w.customer_phone,w.desired_date,w.status,w.offered_at,w.created_at,s.name service_name FROM public.waitlist w JOIN public.services s ON s.id=w.service_id WHERE w.business_id=bid ORDER BY w.created_at DESC LIMIT 100) x),'[]'::jsonb);
END $$;
CREATE FUNCTION public.atry_update_waitlist(bid text,waitlist_id text,status text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN
 PERFORM private.require_manager(bid);PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 IF coalesce(status,'') NOT IN ('waiting','cancelled') THEN RAISE EXCEPTION 'INVALID_STATUS';END IF;
 UPDATE public.waitlist SET status=atry_update_waitlist.status,offer_token_hash=null,offer_expires_at=null WHERE id=waitlist_id AND business_id=bid AND waitlist.status<>'booked';IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'waitlist.updated','waitlist',waitlist_id,now());RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION private.offer_cancelled_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.waitlist;b public.businesses;token text;slot jsonb;
BEGIN
 IF NEW.status<>'cancelled' OR OLD.status='cancelled' THEN RETURN NEW;END IF;
 SELECT * INTO b FROM public.businesses WHERE id=NEW.business_id;
 IF NOT(b.is_active=1 AND b.allow_guest=1) OR (SELECT waitlist FROM public.notification_preferences WHERE business_id=b.id)=0 THEN RETURN NEW;END IF;
 BEGIN slot:=private.check_slot(b.id,NEW.staff_id,NEW.service_id,NEW.starts_at,NEW.id,true);EXCEPTION WHEN SQLSTATE 'P0001' THEN RETURN NEW;END;
 SELECT * INTO w FROM public.waitlist WHERE business_id=b.id AND service_id=NEW.service_id AND desired_date=to_char(NEW.starts_at AT TIME ZONE b.timezone,'YYYY-MM-DD') AND status='waiting' AND (staff_id IS NULL OR staff_id=NEW.staff_id) ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF w.id IS NULL THEN RETURN NEW;END IF;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 UPDATE public.waitlist SET status='offered',offered_at=now(),offer_token_hash=private.hash(token),offer_expires_at=now()+interval '30 minutes',offer_starts_at=NEW.starts_at,offer_staff_id=NEW.staff_id WHERE id=w.id;
 INSERT INTO private.offer_tokens VALUES(w.id,token) ON CONFLICT(waitlist_id) DO UPDATE SET token=excluded.token;
 INSERT INTO public.notifications(id,business_id,booking_id,kind,recipient,subject,content,created_at) VALUES(gen_random_uuid()::text,b.id,NEW.id,'waitlist_offer',w.customer_email,'Un horario podría estar libre',jsonb_build_object('waitlist_id',w.id,'token',token)::text,now());RETURN NEW;
END $$;
CREATE TRIGGER waitlist_offer_after_cancel AFTER UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION private.offer_cancelled_booking();
CREATE FUNCTION public.atry_offer(token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE w public.waitlist;slot jsonb;
BEGIN
 IF coalesce(token,'')!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT * INTO w FROM public.waitlist WHERE offer_token_hash=private.hash(token) AND status='offered' AND offer_expires_at>now();IF w.id IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 slot:=private.check_slot(w.business_id,w.offer_staff_id,w.service_id,w.offer_starts_at,'',true);
 RETURN jsonb_build_object('business_name',(SELECT name FROM public.businesses WHERE id=w.business_id),'service_name',(SELECT name FROM public.services WHERE id=w.service_id),'starts_at',w.offer_starts_at,'expires_at',w.offer_expires_at);
END $$;
CREATE FUNCTION public.atry_accept_offer(token text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE w public.waitlist;result jsonb;previous public.idempotency_keys;scope text:='offer:'||private.hash(token);key text:=payload->>'idempotency_key';fingerprint text:=private.hash(payload::text);
BEGIN
 IF coalesce(token,'')!~'^[A-Za-z0-9_-]{32,100}$' OR coalesce(key,'')!~'^[A-Za-z0-9_-]{16,100}$' OR payload->'accept_policy' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'INVALID_REQUEST';END IF;
 SELECT * INTO w FROM public.waitlist WHERE offer_token_hash=private.hash(token);
 IF w.id IS NULL THEN
  SELECT * INTO previous FROM public.idempotency_keys WHERE idempotency_keys.scope=scope AND key_hash=private.hash(key);IF previous.scope IS NOT NULL AND previous.request_hash=fingerprint THEN RETURN previous.response::jsonb;END IF;
  RAISE EXCEPTION 'INVALID_TOKEN';
 END IF;
 PERFORM 1 FROM public.businesses WHERE id=w.business_id FOR UPDATE;PERFORM pg_advisory_xact_lock(hashtext(scope||key));
 SELECT * INTO previous FROM public.idempotency_keys WHERE idempotency_keys.scope=scope AND key_hash=private.hash(key);
 IF previous.scope IS NOT NULL THEN IF previous.request_hash<>fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN previous.response::jsonb;END IF;
 SELECT * INTO w FROM public.waitlist WHERE id=w.id FOR UPDATE;
 IF w.status<>'offered' OR w.offer_expires_at<=now() THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 result:=private.create_booking(w.business_id,jsonb_build_object('service_id',w.service_id,'staff_id',w.offer_staff_id,'starts_at',w.offer_starts_at,'customer_name',w.customer_name,'customer_email',w.customer_email,'customer_phone',w.customer_phone,'accept_policy',true,'idempotency_key',key),'public');
 UPDATE public.waitlist SET status='booked',offer_token_hash=null WHERE id=w.id;INSERT INTO public.idempotency_keys VALUES(scope,private.hash(key),fingerprint,result::text,now());RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.offer_cancelled_booking() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.atry_public_waitlist(text,jsonb),public.atry_offer(text),public.atry_accept_offer(text,jsonb),public.atry_waitlist(text),public.atry_update_waitlist(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atry_waitlist(text),public.atry_update_waitlist(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atry_public_waitlist(text,jsonb),public.atry_offer(text),public.atry_accept_offer(text,jsonb) TO service_role;
