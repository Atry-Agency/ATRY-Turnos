-- Multiple daily windows use the existing envelope + recurring-break engine.
-- No existing rows change during migration. Each edit replaces one staff member's
-- weekly hours and pauses in a single transaction, preserving dated exceptions.
CREATE FUNCTION public.atry_save_week(bid text,sid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE windows jsonb:=payload->'windows';w jsonb;d int;lo int;hi int;previous_end int;day_count int;row_count int:=0;existing record;
BEGIN
 IF coalesce(private.member_role(bid),'') NOT IN ('owner','manager') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 IF NOT private.subscription_live(bid) THEN RAISE EXCEPTION 'SUBSCRIPTION_READ_ONLY' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.staff WHERE id=sid AND business_id=bid AND active=1) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
 IF coalesce(jsonb_typeof(windows),'null')<>'array' THEN RAISE EXCEPTION 'INVALID_HOURS';END IF;
 IF jsonb_array_length(windows)>42 THEN RAISE EXCEPTION 'INVALID_HOURS';END IF;
 FOR w IN SELECT * FROM jsonb_array_elements(windows) LOOP
  IF jsonb_typeof(w)<>'object' OR coalesce(w->>'weekday','')!~'^[0-6]$' OR coalesce(w->>'start_min','')!~'^[0-9]{1,4}$' OR coalesce(w->>'end_min','')!~'^[0-9]{1,4}$' THEN RAISE EXCEPTION 'INVALID_HOURS';END IF;
  lo:=(w->>'start_min')::int;hi:=(w->>'end_min')::int;
  IF lo<0 OR hi>1440 OR lo>=hi THEN RAISE EXCEPTION 'INVALID_HOURS';END IF;
 END LOOP;
 FOR d IN 0..6 LOOP
  previous_end:=NULL;day_count:=0;
  FOR w IN SELECT value FROM jsonb_array_elements(windows) WHERE (value->>'weekday')::int=d ORDER BY (value->>'start_min')::int LOOP
   lo:=(w->>'start_min')::int;hi:=(w->>'end_min')::int;day_count:=day_count+1;
   IF day_count>6 OR (previous_end IS NOT NULL AND lo<previous_end) THEN RAISE EXCEPTION 'OVERLAPPING_HOURS';END IF;
   previous_end:=hi;
  END LOOP;
 END LOOP;
 DELETE FROM public.working_hours WHERE staff_id=sid;
 DELETE FROM public.recurring_breaks WHERE staff_id=sid AND business_id=bid;
 FOR d IN 0..6 LOOP
  SELECT min((value->>'start_min')::int),max((value->>'end_min')::int) INTO lo,hi FROM jsonb_array_elements(windows) WHERE (value->>'weekday')::int=d;
  IF lo IS NULL THEN CONTINUE;END IF;
  INSERT INTO public.working_hours(staff_id,weekday,start_min,end_min) VALUES(sid,d,lo,hi);
  previous_end:=NULL;
  FOR w IN SELECT value FROM jsonb_array_elements(windows) WHERE (value->>'weekday')::int=d ORDER BY (value->>'start_min')::int LOOP
   lo:=(w->>'start_min')::int;hi:=(w->>'end_min')::int;
   IF previous_end IS NOT NULL AND previous_end<lo THEN INSERT INTO public.recurring_breaks(id,business_id,staff_id,weekday,start_min,end_min) VALUES(gen_random_uuid()::text,bid,sid,d,previous_end,lo);END IF;
   previous_end:=hi;
  END LOOP;
 END LOOP;
 FOR existing IN SELECT * FROM public.bookings WHERE business_id=bid AND staff_id=sid AND status IN ('pending','confirmed') AND ends_at>now() LOOP
  PERFORM private.check_slot(bid,sid,existing.service_id,existing.starts_at,existing.id,false);
 END LOOP;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'staff.week.updated','staff',sid,now());
 RETURN jsonb_build_object('ok',true,'windows',windows);
END $$;
REVOKE ALL ON FUNCTION public.atry_save_week(text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.atry_save_week(text,text,jsonb) TO authenticated;
-- A configurable plan cannot expose waitlist notifications without waitlist access.
DO $patch$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef('public.atry_save_notification_preferences(text,jsonb)'::regprocedure) INTO src;
 src:=regexp_replace(src,'\mBEGIN\M','BEGIN IF coalesce((payload->>''waitlist'')::int,0)=1 THEN PERFORM private.require_feature(bid,''waitlist'');END IF;','i');
 EXECUTE src;
END $patch$;
