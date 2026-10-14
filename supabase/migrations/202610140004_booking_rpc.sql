CREATE FUNCTION private.hash(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT encode(sha256(convert_to(value,'UTF8')),'hex') $$;
CREATE FUNCTION private.check_slot(bid text,sid text,vid text,starts timestamptz,ignore_id text DEFAULT '',notice boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE b public.businesses;s public.services;st public.staff;ex public.schedule_exceptions;wh public.working_hours;d text;weekday int;m int;ending timestamptz;bf timestamptz;bu timestamptz;lo int;hi int;
BEGIN
 SELECT * INTO b FROM public.businesses WHERE id=bid AND is_active=1;
 SELECT * INTO s FROM public.services WHERE id=vid AND business_id=bid AND active=1;
 SELECT * INTO st FROM public.staff WHERE id=sid AND business_id=bid AND active=1;
 IF b.id IS NULL OR s.id IS NULL OR st.id IS NULL THEN RAISE EXCEPTION 'NOT_AVAILABLE'; END IF;
 IF b.timezone<>'America/Montevideo' OR NOT EXISTS(SELECT 1 FROM public.staff_services WHERE staff_id=sid AND service_id=vid) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT'; END IF;
 IF starts IS NULL OR date_trunc('minute',starts)<>starts THEN RAISE EXCEPTION 'INVALID_TIME'; END IF;
 ending:=starts+make_interval(mins=>s.duration_min);bf:=starts-make_interval(mins=>s.buffer_before_min);bu:=ending+make_interval(mins=>s.buffer_after_min);
 d:=to_char(starts AT TIME ZONE b.timezone,'YYYY-MM-DD');weekday:=extract(dow FROM starts AT TIME ZONE b.timezone);m:=extract(hour FROM starts AT TIME ZONE b.timezone)*60+extract(minute FROM starts AT TIME ZONE b.timezone);
 IF d<>to_char((ending-interval '1 microsecond') AT TIME ZONE b.timezone,'YYYY-MM-DD') THEN RAISE EXCEPTION 'SAME_DAY_REQUIRED'; END IF;
 IF notice AND (starts<now()+make_interval(mins=>b.min_notice_min) OR starts>now()+make_interval(days=>b.max_days)) THEN RAISE EXCEPTION 'OUTSIDE_NOTICE'; END IF;
 IF EXISTS(SELECT 1 FROM public.holidays WHERE business_id=bid AND day=d) THEN RAISE EXCEPTION 'CLOSED'; END IF;
 SELECT * INTO ex FROM public.schedule_exceptions WHERE staff_id=sid AND day=d;
 IF ex.id IS NOT NULL THEN IF ex.closed=1 THEN RAISE EXCEPTION 'CLOSED'; END IF;lo:=ex.start_min;hi:=ex.end_min;
 ELSE SELECT * INTO wh FROM public.working_hours WHERE staff_id=sid AND working_hours.weekday=weekday;lo:=wh.start_min;hi:=wh.end_min; END IF;
 IF lo IS NULL OR hi IS NULL OR m-s.buffer_before_min<lo OR m+s.duration_min+s.buffer_after_min>hi OR m%nullif(b.slot_step_min,0)<>0 THEN RAISE EXCEPTION 'OUTSIDE_SCHEDULE'; END IF;
 IF EXISTS(SELECT 1 FROM public.recurring_breaks rb WHERE rb.staff_id=sid AND rb.weekday=weekday AND rb.start_min<m+s.duration_min+s.buffer_after_min AND rb.end_min>m-s.buffer_before_min) THEN RAISE EXCEPTION 'BREAK'; END IF;
 IF EXISTS(SELECT 1 FROM public.time_off WHERE staff_id=sid AND starts_at<bu AND ends_at>bf) THEN RAISE EXCEPTION 'TIME_OFF'; END IF;
 IF EXISTS(SELECT 1 FROM public.bookings WHERE staff_id=sid AND id<>ignore_id AND status IN ('pending','confirmed') AND blocked_from<bu AND blocked_until>bf) THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM public.service_resources sr JOIN public.resources r ON r.id=sr.resource_id WHERE sr.service_id=vid AND (r.business_id<>bid OR r.active<>1 OR EXISTS(SELECT 1 FROM public.booking_blocks bb WHERE bb.target='resource:'||r.id AND bb.booking_id<>ignore_id AND bb.occupied && tstzrange(bf,bu,'[)')))) THEN RAISE EXCEPTION 'RESOURCE_CONFLICT'; END IF;
 RETURN jsonb_build_object('ends_at',ending,'blocked_from',bf,'blocked_until',bu,'price',s.price_uyu,'status',CASE WHEN b.auto_confirm=1 THEN 'confirmed' ELSE 'pending' END);
END $$;

CREATE FUNCTION public.atry_create_booking(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE role text;sid text:=payload->>'staff_id';vid text:=payload->>'service_id';starts timestamptz:=(payload->>'starts_at')::timestamptz;
 name text:=btrim(payload->>'customer_name');email text:=lower(btrim(coalesce(payload->>'customer_email','')));phone text:=btrim(coalesce(payload->>'customer_phone',''));
 key text:=payload->>'idempotency_key';scope text;request_hash text;prev public.idempotency_keys;slot jsonb;cid text;booking_id text:=gen_random_uuid()::text;token text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');result jsonb;
BEGIN
 role:=private.member_role(bid);
 IF role IS NULL OR (role='staff' AND NOT private.own_staff(sid)) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF key IS NULL OR key!~'^[A-Za-z0-9_-]{16,100}$' THEN RAISE EXCEPTION 'IDEMPOTENCY_REQUIRED'; END IF;
 scope:='booking:manual:'||bid||':'||private.user_id();request_hash:=private.hash((payload-'idempotency_key')::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(scope||key,0));
 SELECT * INTO prev FROM public.idempotency_keys WHERE idempotency_keys.scope=scope AND key_hash=private.hash(key);
 IF FOUND THEN IF prev.request_hash<>request_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH'; END IF;RETURN prev.response::jsonb; END IF;
 -- Serialize rule edits and bookings in one organization; exclusion blocks races too.
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 slot:=private.check_slot(bid,sid,vid,starts,'',false);
 IF name IS NULL OR length(name)<2 OR length(name)>100 OR length(email)>150 OR length(phone)>35 OR (email='' AND phone='') OR (email<>'' AND email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'INVALID_CONTACT'; END IF;
 SELECT id INTO cid FROM public.customers WHERE business_id=bid AND ((email<>'' AND customers.email=email) OR (phone<>'' AND customers.phone=phone)) ORDER BY created_at LIMIT 1;
 IF cid IS NULL THEN cid:=gen_random_uuid()::text;INSERT INTO public.customers(id,business_id,name,email,phone,created_at) VALUES(cid,bid,name,email,phone,now()); END IF;
 INSERT INTO public.bookings(id,business_id,staff_id,service_id,customer_id,starts_at,ends_at,blocked_from,blocked_until,status,source,notes,payment_status,price_uyu,manage_token_hash,created_at,updated_at)
 VALUES(booking_id,bid,sid,vid,cid,starts,(slot->>'ends_at')::timestamptz,(slot->>'blocked_from')::timestamptz,(slot->>'blocked_until')::timestamptz,slot->>'status','manual',left(coalesce(payload->>'notes',''),500),'not_required',(slot->>'price')::int,private.hash(token),now(),now());
 INSERT INTO public.booking_resources SELECT booking_id,resource_id FROM public.service_resources WHERE service_id=vid;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'booking.created','booking',booking_id,now());
 INSERT INTO public.notifications(id,business_id,booking_id,kind,recipient,subject,content,created_at) VALUES(gen_random_uuid()::text,bid,booking_id,slot->>'status',email,'Atry Turnos — reserva','Reserva registrada. Gestioná tu turno en /#/gestionar/'||token,now());
 result:=jsonb_build_object('id',booking_id,'status',slot->>'status','manage_token',token,'starts_at',starts);
 INSERT INTO public.idempotency_keys VALUES(scope,private.hash(key),request_hash,result::text,now());RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.atry_create_booking(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_create_booking(text,jsonb) TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;

CREATE FUNCTION public.atry_update_booking(bid text,booking_id text,patch jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE b public.bookings;role text;slot jsonb;sid text;starts timestamptz;next_status text;
BEGIN
 role:=private.member_role(bid);PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 SELECT * INTO b FROM public.bookings WHERE id=booking_id AND business_id=bid FOR UPDATE;
 IF b.id IS NULL OR role IS NULL OR (role='staff' AND (NOT private.own_staff(b.staff_id) OR (patch ? 'staff_id' AND NOT private.own_staff(patch->>'staff_id')))) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF patch ? 'starts_at' OR patch ? 'staff_id' THEN
  IF b.status NOT IN ('pending','confirmed') THEN RAISE EXCEPTION 'FINALIZED'; END IF;
  sid:=coalesce(patch->>'staff_id',b.staff_id);starts:=coalesce((patch->>'starts_at')::timestamptz,b.starts_at);
  IF sid<>b.staff_id OR starts<>b.starts_at THEN
   slot:=private.check_slot(bid,sid,b.service_id,starts,b.id,false);
   DELETE FROM public.booking_resources WHERE booking_resources.booking_id=b.id;
   UPDATE public.bookings SET staff_id=sid,starts_at=starts,ends_at=(slot->>'ends_at')::timestamptz,blocked_from=(slot->>'blocked_from')::timestamptz,blocked_until=(slot->>'blocked_until')::timestamptz,updated_at=now() WHERE id=b.id;
   INSERT INTO public.booking_resources SELECT b.id,resource_id FROM public.service_resources WHERE service_id=b.service_id;
   INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'booking.rescheduled','booking',b.id,now());
  END IF;
 END IF;
 IF patch ? 'status' THEN
  next_status:=patch->>'status';
  IF next_status<>b.status THEN
   IF NOT ((b.status='pending' AND next_status IN ('confirmed','cancelled')) OR (b.status='confirmed' AND next_status IN ('completed','cancelled','no_show'))) THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
   UPDATE public.bookings SET status=next_status,updated_at=now() WHERE id=b.id;
   INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'booking.'||next_status,'booking',b.id,now());
  END IF;
 END IF;
 RETURN (SELECT to_jsonb(x)-'manage_token_hash' FROM public.bookings x WHERE x.id=b.id);
END $$;
REVOKE ALL ON FUNCTION public.atry_update_booking(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_update_booking(text,text,jsonb) TO authenticated;
