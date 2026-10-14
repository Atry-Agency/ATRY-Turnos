-- Shared booking transaction, public entry available only to the protected Edge service.
ALTER TABLE public.bookings ADD COLUMN customer_name_snapshot text,ADD COLUMN customer_email_snapshot text,ADD COLUMN customer_phone_snapshot text;
CREATE TABLE private.booking_tokens(booking_id text PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,token text NOT NULL);
ALTER TABLE private.booking_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.booking_tokens FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.create_booking(bid text,payload jsonb,source text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE role text;sid text:=payload->>'staff_id';vid text:=payload->>'service_id';starts timestamptz:=(payload->>'starts_at')::timestamptz;
 name text:=btrim(payload->>'customer_name');email text:=lower(btrim(coalesce(payload->>'customer_email','')));phone text:=btrim(coalesce(payload->>'customer_phone',''));
 key text:=payload->>'idempotency_key';scope text;request_hash text;prev public.idempotency_keys;slot jsonb;cid text;booking_id text:=gen_random_uuid()::text;token text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');result jsonb;
BEGIN
 role:=private.member_role(bid);
 IF source='manual' THEN
 IF role IS NULL OR (role='staff' AND NOT private.own_staff(sid)) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
ELSIF source='public' THEN
 IF coalesce(payload->'accept_policy','null'::jsonb)<>'true'::jsonb OR NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=bid AND is_active=1 AND allow_guest=1 AND (subscription_status='active' OR (subscription_status='trialing' AND trial_until>now()))) THEN RAISE EXCEPTION 'PUBLIC_BOOKING_DISABLED';END IF;
ELSE RAISE EXCEPTION 'INVALID_SOURCE';END IF;
 IF key IS NULL OR key!~'^[A-Za-z0-9_-]{16,100}$' THEN RAISE EXCEPTION 'IDEMPOTENCY_REQUIRED'; END IF;
 scope:='booking:'||source||':'||bid||':'||coalesce(private.user_id(),'guest');request_hash:=private.hash((payload-'idempotency_key')::text);
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended(scope||key,0));
 SELECT * INTO prev FROM public.idempotency_keys WHERE idempotency_keys.scope=scope AND key_hash=private.hash(key);
 IF FOUND THEN IF prev.request_hash<>request_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH'; END IF;RETURN prev.response::jsonb; END IF;
 -- Business lock is held before idempotency and rule validation.
 slot:=private.check_slot(bid,sid,vid,starts,'',source='public');
 IF name IS NULL OR length(name)<2 OR length(name)>100 OR length(email)>150 OR length(phone)>35 OR (email='' AND phone='') OR (email<>'' AND email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'INVALID_CONTACT'; END IF;
 SELECT id INTO cid FROM public.customers WHERE business_id=bid AND ((email<>'' AND customers.email=email) OR (phone<>'' AND customers.phone=phone)) ORDER BY CASE WHEN email<>'' AND customers.email=email THEN 0 ELSE 1 END,created_at LIMIT 1;
 IF cid IS NULL THEN cid:=gen_random_uuid()::text;INSERT INTO public.customers(id,business_id,name,email,phone,created_at) VALUES(cid,bid,name,email,phone,now());
 ELSIF source='manual' AND role IN ('owner','manager') THEN UPDATE public.customers SET name=name,email=CASE WHEN email<>'' THEN email ELSE customers.email END,phone=CASE WHEN phone<>'' THEN phone ELSE customers.phone END WHERE id=cid;END IF;
 INSERT INTO public.bookings(id,business_id,staff_id,service_id,customer_id,starts_at,ends_at,blocked_from,blocked_until,status,source,notes,payment_status,price_uyu,manage_token_hash,created_at,updated_at,customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot)
 VALUES(booking_id,bid,sid,vid,cid,starts,(slot->>'ends_at')::timestamptz,(slot->>'blocked_from')::timestamptz,(slot->>'blocked_until')::timestamptz,slot->>'status',source,left(coalesce(payload->>'notes',''),500),'not_required',(slot->>'price')::int,private.hash(token),now(),now(),name,email,phone);
 INSERT INTO public.booking_resources SELECT booking_id,resource_id FROM public.service_resources WHERE service_id=vid;
 INSERT INTO private.booking_tokens VALUES(booking_id,token);
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'booking.created','booking',booking_id,now());
 INSERT INTO public.notifications(id,business_id,booking_id,kind,recipient,subject,content,created_at) VALUES(gen_random_uuid()::text,bid,booking_id,slot->>'status',email,'Atry Turnos — reserva','Reserva registrada. Gestioná tu turno en /#/gestionar/'||token,now());
 result:=jsonb_build_object('id',booking_id,'status',slot->>'status','manage_token',token,'starts_at',starts);
 INSERT INTO public.idempotency_keys VALUES(scope,private.hash(key),request_hash,result::text,now());RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.create_booking(text,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.atry_create_booking(bid text,payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT private.create_booking(bid,payload,'manual') $$;
CREATE FUNCTION public.atry_public_book(slug text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE bid text;
BEGIN
 SELECT id INTO bid FROM public.businesses b WHERE b.slug=atry_public_book.slug;
 IF bid IS NULL THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;
 RETURN private.create_booking(bid,payload,'public');
END $$;
REVOKE ALL ON FUNCTION public.atry_public_book(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atry_public_book(text,jsonb) TO service_role;
CREATE FUNCTION public.atry_public_info(slug text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.businesses;
BEGIN
 SELECT * INTO b FROM public.businesses WHERE businesses.slug=atry_public_info.slug AND is_active=1;
 IF b.id IS NULL THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;
 RETURN jsonb_build_object('business',jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'sector',b.sector,'description',b.description,'city',b.city,'address',b.address,'phone',b.phone,'primary_color',b.primary_color,'logo_url',b.logo_url,'min_notice_min',b.min_notice_min,'max_days',b.max_days,'cancel_notice_hours',b.cancel_notice_hours),'services',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'duration_min',s.duration_min,'price_uyu',s.price_uyu,'deposit_percent',s.deposit_percent,'buffer_before_min',s.buffer_before_min,'buffer_after_min',s.buffer_after_min,'staff_ids',coalesce((SELECT jsonb_agg(st.id) FROM public.staff_services ss JOIN public.staff st ON st.id=ss.staff_id WHERE ss.service_id=s.id AND st.business_id=b.id AND st.active=1),'[]'::jsonb))) FROM public.services s WHERE s.business_id=b.id AND s.active=1),'[]'::jsonb),'staff',coalesce((SELECT jsonb_agg(jsonb_build_object('id',st.id,'name',st.name,'color',st.color,'service_ids',coalesce((SELECT jsonb_agg(service_id) FROM public.staff_services WHERE staff_id=st.id),'[]'::jsonb))) FROM public.staff st WHERE st.business_id=b.id AND st.active=1),'[]'::jsonb),'bookable',b.allow_guest=1 AND (b.subscription_status='active' OR (b.subscription_status='trialing' AND b.trial_until>now())));
END $$;
CREATE FUNCTION public.atry_public_availability(slug text,service_id text,day date,staff_id text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE b public.businesses;st record;wh record;ex public.schedule_exceptions;minute int;starts timestamptz;slot jsonb;result jsonb:='[]'::jsonb;lo int;hi int;
BEGIN
 SELECT * INTO b FROM public.businesses WHERE businesses.slug=slug AND is_active=1;
 IF b.id IS NULL THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;
 IF day IS NULL OR day<(now() AT TIME ZONE b.timezone)::date OR day>(now() AT TIME ZONE b.timezone)::date+b.max_days OR b.slot_step_min NOT BETWEEN 5 AND 60 THEN RETURN jsonb_build_object('slots',result);END IF;
 IF NOT(b.allow_guest=1 AND (b.subscription_status='active' OR (b.subscription_status='trialing' AND b.trial_until>now()))) THEN RETURN jsonb_build_object('slots',result);END IF;
 FOR st IN SELECT s.id,s.name FROM public.staff s JOIN public.staff_services ss ON ss.staff_id=s.id WHERE s.business_id=b.id AND s.active=1 AND ss.service_id=service_id AND (staff_id IS NULL OR s.id=staff_id) LOOP
  SELECT * INTO ex FROM public.schedule_exceptions WHERE schedule_exceptions.staff_id=st.id AND schedule_exceptions.day=to_char(day,'YYYY-MM-DD');
  IF ex.id IS NOT NULL THEN IF ex.closed=1 THEN CONTINUE;END IF;lo:=ex.start_min;hi:=ex.end_min;
  ELSE SELECT * INTO wh FROM public.working_hours WHERE working_hours.staff_id=st.id AND weekday=extract(dow FROM day);IF NOT FOUND THEN CONTINUE;END IF;lo:=wh.start_min;hi:=wh.end_min;END IF;
  FOR minute IN SELECT generate_series(lo,least(hi-1,1439),b.slot_step_min) LOOP
   starts:=(day::timestamp+make_interval(mins=>minute)) AT TIME ZONE b.timezone;
   BEGIN slot:=private.check_slot(b.id,st.id,service_id,starts);EXCEPTION WHEN SQLSTATE 'P0001' THEN CONTINUE;END;
   result:=result||jsonb_build_array(jsonb_build_object('start',starts,'time',to_char(starts AT TIME ZONE b.timezone,'HH24:MI'),'staff_id',st.id,'staff_name',st.name));
  END LOOP;
 END LOOP;
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'start',x->>'staff_name'),'[]'::jsonb) INTO result FROM jsonb_array_elements(result) x;
 RETURN jsonb_build_object('slots',result);
END $$;
REVOKE ALL ON FUNCTION public.atry_public_info(text),public.atry_public_availability(text,text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atry_public_info(text),public.atry_public_availability(text,text,date,text) TO anon,authenticated;
