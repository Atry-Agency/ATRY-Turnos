CREATE FUNCTION public.atry_catalog(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE role text:=private.member_role(bid);
BEGIN
 IF role IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('services',coalesce((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('staff_ids',coalesce((SELECT jsonb_agg(ss.staff_id) FROM public.staff_services ss WHERE ss.service_id=s.id),'[]'::jsonb))) FROM public.services s WHERE s.business_id=bid),'[]'::jsonb),'staff',coalesce((SELECT jsonb_agg(to_jsonb(st)||jsonb_build_object('service_ids',coalesce((SELECT jsonb_agg(ss.service_id) FROM public.staff_services ss WHERE ss.staff_id=st.id),'[]'::jsonb))) FROM public.staff st WHERE st.business_id=bid AND (role IN ('owner','manager') OR private.own_staff(st.id))),'[]'::jsonb));
END $$;
CREATE FUNCTION public.atry_bookings(bid text,start_day date,days int DEFAULT 1) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE role text:=private.member_role(bid);start_time timestamptz;
BEGIN
 IF role IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF days<1 OR days>42 OR start_day IS NULL THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
 start_time:=start_day::timestamp AT TIME ZONE 'America/Montevideo';
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.starts_at) FROM (
  SELECT b.id,b.business_id,b.staff_id,b.service_id,b.customer_id,b.starts_at,b.ends_at,b.status,b.notes,b.source,b.price_uyu,b.payment_status,coalesce(to_jsonb(b)->>'customer_name_snapshot',c.name) customer_name,CASE WHEN role='staff' THEN coalesce(to_jsonb(b)->>'customer_email_snapshot','') ELSE coalesce(to_jsonb(b)->>'customer_email_snapshot',c.email) END customer_email,CASE WHEN role='staff' THEN coalesce(to_jsonb(b)->>'customer_phone_snapshot','') ELSE coalesce(to_jsonb(b)->>'customer_phone_snapshot',c.phone) END customer_phone,s.name service_name,st.name staff_name,st.color staff_color
  FROM public.bookings b JOIN public.customers c ON c.id=b.customer_id JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id
  WHERE b.business_id=bid AND b.starts_at>=start_time AND b.starts_at<start_time+make_interval(days=>days) AND (role IN ('owner','manager') OR private.own_staff(b.staff_id))
 ) x),'[]'::jsonb);
END $$;
CREATE FUNCTION public.atry_save_service(bid text,service_id text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE previous public.services;sid text:=coalesce(service_id,gen_random_uuid()::text);staff_id text;duration int;price int;before_min int;after_min int;name text;active int;
BEGIN
 IF coalesce(private.member_role(bid),'') NOT IN ('owner','manager') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 IF service_id IS NOT NULL THEN SELECT * INTO previous FROM public.services WHERE id=service_id AND business_id=bid;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;END IF;
 name:=btrim(coalesce(payload->>'name',previous.name));duration:=coalesce((payload->>'duration_min')::int,previous.duration_min);price:=coalesce((payload->>'price_uyu')::int,previous.price_uyu,0);before_min:=coalesce((payload->>'buffer_before_min')::int,previous.buffer_before_min,0);after_min:=coalesce((payload->>'buffer_after_min')::int,previous.buffer_after_min,0);active:=coalesce((payload->>'active')::int,previous.active,1);
 IF name IS NULL OR length(name)<2 OR length(name)>100 OR duration IS NULL OR duration NOT BETWEEN 5 AND 1440 OR price<0 OR active NOT IN (0,1) OR before_min NOT BETWEEN 0 AND 1440 OR after_min NOT BETWEEN 0 AND 1440 THEN RAISE EXCEPTION 'INVALID_SERVICE';END IF;
 INSERT INTO public.services(id,business_id,name,description,duration_min,price_uyu,deposit_percent,buffer_before_min,buffer_after_min,active,created_at) VALUES(sid,bid,name,left(coalesce(payload->>'description',previous.description,''),500),duration,price,coalesce((payload->>'deposit_percent')::int,previous.deposit_percent,0),before_min,after_min,active,coalesce(previous.created_at,now()))
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,duration_min=excluded.duration_min,price_uyu=excluded.price_uyu,deposit_percent=excluded.deposit_percent,buffer_before_min=excluded.buffer_before_min,buffer_after_min=excluded.buffer_after_min,active=excluded.active;
 IF payload ? 'staff_ids' THEN
  IF jsonb_typeof(payload->'staff_ids')<>'array' THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
  DELETE FROM public.staff_services WHERE staff_services.service_id=sid;
  FOR staff_id IN SELECT jsonb_array_elements_text(payload->'staff_ids') LOOP
   IF NOT EXISTS(SELECT 1 FROM public.staff WHERE id=staff_id AND business_id=bid) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
   INSERT INTO public.staff_services VALUES(staff_id,sid) ON CONFLICT DO NOTHING;
  END LOOP;
 END IF;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'service.saved','service',sid,now());RETURN jsonb_build_object('id',sid);
END $$;
CREATE FUNCTION public.atry_save_staff(bid text,staff_id text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE previous public.staff;sid text:=coalesce(staff_id,gen_random_uuid()::text);vid text;name text;email text;active int;staff_limit int;
BEGIN
 IF coalesce(private.member_role(bid),'') NOT IN ('owner','manager') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 SELECT p.staff_limit INTO staff_limit FROM public.plans p JOIN public.businesses b ON b.plan=p.code WHERE b.id=bid;
 IF staff_id IS NOT NULL THEN SELECT * INTO previous FROM public.staff WHERE id=staff_id AND business_id=bid;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;END IF;
 name:=btrim(coalesce(payload->>'name',previous.name));email:=lower(btrim(coalesce(payload->>'email',previous.email,'')));active:=coalesce((payload->>'active')::int,previous.active,1);
 IF name IS NULL OR length(name)<2 OR length(name)>100 OR length(email)>150 OR (email<>'' AND email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') OR active NOT IN (0,1) THEN RAISE EXCEPTION 'INVALID_STAFF';END IF;
 IF active=1 AND coalesce(previous.active,0)<>1 AND (SELECT count(*) FROM public.staff WHERE business_id=bid AND staff.active=1)>=coalesce(staff_limit,1) THEN RAISE EXCEPTION 'STAFF_LIMIT';END IF;
 INSERT INTO public.staff(id,business_id,name,email,active,color,created_at) VALUES(sid,bid,name,email,active,coalesce(payload->>'color',previous.color,'#007fae'),coalesce(previous.created_at,now())) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,active=excluded.active,color=excluded.color;
 IF payload ? 'service_ids' THEN
  IF jsonb_typeof(payload->'service_ids')<>'array' THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
  DELETE FROM public.staff_services WHERE staff_services.staff_id=sid;
  FOR vid IN SELECT jsonb_array_elements_text(payload->'service_ids') LOOP
   IF NOT EXISTS(SELECT 1 FROM public.services WHERE id=vid AND business_id=bid) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
   INSERT INTO public.staff_services VALUES(sid,vid) ON CONFLICT DO NOTHING;
  END LOOP;
 END IF;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'staff.saved','staff',sid,now());RETURN jsonb_build_object('id',sid);
END $$;
ALTER TABLE services ADD CHECK(deposit_percent BETWEEN 0 AND 100);
REVOKE ALL ON FUNCTION public.atry_catalog(text),public.atry_bookings(text,date,int),public.atry_save_service(text,text,jsonb),public.atry_save_staff(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_catalog(text),public.atry_bookings(text,date,int),public.atry_save_service(text,text,jsonb),public.atry_save_staff(text,text,jsonb) TO authenticated;
