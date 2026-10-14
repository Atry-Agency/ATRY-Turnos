CREATE FUNCTION private.update_booking(bid text,booking_id text,patch jsonb,source text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE b public.bookings;role text;slot jsonb;sid text;starts timestamptz;next_status text;
BEGIN
 role:=private.member_role(bid);PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 SELECT * INTO b FROM public.bookings WHERE id=booking_id AND business_id=bid FOR UPDATE;
 IF b.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
IF source='manual' THEN
 IF role IS NULL OR (role='staff' AND (NOT private.own_staff(b.staff_id) OR (patch ? 'staff_id' AND NOT private.own_staff(patch->>'staff_id')))) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
ELSIF source<>'guest' THEN RAISE EXCEPTION 'INVALID_SOURCE';END IF;
 IF patch ? 'starts_at' OR patch ? 'staff_id' THEN
  IF b.status NOT IN ('pending','confirmed') THEN RAISE EXCEPTION 'FINALIZED'; END IF;
  sid:=coalesce(patch->>'staff_id',b.staff_id);starts:=coalesce((patch->>'starts_at')::timestamptz,b.starts_at);
  IF sid<>b.staff_id OR starts<>b.starts_at THEN
   slot:=private.check_slot(bid,sid,b.service_id,starts,b.id,source='guest');
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
REVOKE ALL ON FUNCTION private.update_booking(text,text,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.atry_update_booking(bid text,booking_id text,patch jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT private.update_booking(bid,booking_id,patch,'manual') $$;
CREATE FUNCTION public.atry_manage(token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF token!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT jsonb_build_object('id',b.id,'business_id',b.business_id,'starts_at',b.starts_at,'ends_at',b.ends_at,'status',b.status,'price_uyu',b.price_uyu,'business_name',bu.name,'business_slug',bu.slug,'cancel_notice_hours',bu.cancel_notice_hours,'service_name',s.name,'staff_name',st.name,'customer_name',coalesce(b.customer_name_snapshot,c.name)) INTO result FROM public.bookings b JOIN public.businesses bu ON bu.id=b.business_id JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id JOIN public.customers c ON c.id=b.customer_id WHERE b.manage_token_hash=private.hash(token);
 IF result IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;RETURN result;
END $$;
CREATE FUNCTION public.atry_manage_change(token text,operation text,payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings;biz public.businesses;patch jsonb;
BEGIN
 IF coalesce(token,'')!~'^[A-Za-z0-9_-]{32,100}$' OR coalesce(operation,'') NOT IN ('cancel','reschedule') THEN RAISE EXCEPTION 'INVALID_REQUEST';END IF;
 SELECT * INTO b FROM public.bookings WHERE manage_token_hash=private.hash(token);
 IF b.id IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT * INTO biz FROM public.businesses WHERE id=b.business_id FOR UPDATE;
 SELECT * INTO b FROM public.bookings WHERE id=b.id FOR UPDATE;
 IF operation='cancel' AND b.status='cancelled' THEN RETURN public.atry_manage(token);END IF;
 IF b.status NOT IN ('pending','confirmed') OR b.starts_at<now()+make_interval(hours=>biz.cancel_notice_hours) THEN RAISE EXCEPTION 'OUTSIDE_POLICY';END IF;
 IF operation='reschedule' THEN
  IF payload->>'starts_at' IS NULL THEN RAISE EXCEPTION 'INVALID_TIME';END IF;patch:=jsonb_build_object('starts_at',payload->>'starts_at');
 ELSE patch:=jsonb_build_object('status','cancelled');END IF;
 PERFORM private.update_booking(b.business_id,b.id,patch,'guest');
 RETURN public.atry_manage(token);
END $$;
CREATE FUNCTION public.atry_manage_availability(token text,day date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings;biz public.businesses;
BEGIN
 IF token!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT * INTO b FROM public.bookings WHERE manage_token_hash=private.hash(token);
 IF b.id IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT * INTO biz FROM public.businesses WHERE id=b.business_id;
 IF b.status NOT IN ('pending','confirmed') OR b.starts_at<now()+make_interval(hours=>biz.cancel_notice_hours) THEN RAISE EXCEPTION 'OUTSIDE_POLICY';END IF;
 RETURN public.atry_public_availability(biz.slug,b.service_id,day,b.staff_id);
END $$;
REVOKE ALL ON FUNCTION public.atry_manage(text),public.atry_manage_change(text,text,jsonb),public.atry_manage_availability(text,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atry_manage(text),public.atry_manage_change(text,text,jsonb),public.atry_manage_availability(text,date) TO service_role;
