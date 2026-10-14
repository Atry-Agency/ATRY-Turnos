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
