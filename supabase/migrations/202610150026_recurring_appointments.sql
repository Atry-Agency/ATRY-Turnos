-- Indefinite weekly appointments. Concrete occurrences are generated in bounded windows;
-- the rule itself protects availability beyond those windows without relying on cron.
CREATE TABLE public.recurring_appointments (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,business_id text NOT NULL REFERENCES public.businesses(id),
 staff_id text NOT NULL REFERENCES public.staff(id),service_id text NOT NULL REFERENCES public.services(id),
 customer_name text NOT NULL,customer_email text NOT NULL DEFAULT '',customer_phone text NOT NULL DEFAULT '',
 start_day date NOT NULL,end_day date,minute int NOT NULL CHECK(minute BETWEEN 0 AND 1439),
 interval_weeks int NOT NULL CHECK(interval_weeks IN (1,2,4)),active int NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 notes text NOT NULL DEFAULT '',last_error text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recurring_business ON public.recurring_appointments(business_id,active);
ALTER TABLE public.recurring_appointments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recurring_appointments FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.recurring_appointments TO authenticated;
CREATE POLICY tenant ON public.recurring_appointments FOR SELECT TO authenticated USING(private.member_role(business_id) IN ('owner','manager'));
ALTER TABLE public.bookings ADD COLUMN recurring_id text REFERENCES public.recurring_appointments(id),ADD COLUMN occurrence_day date;
CREATE UNIQUE INDEX recurring_occurrence ON public.bookings(recurring_id,occurrence_day);

CREATE FUNCTION private.recurring_applies(r public.recurring_appointments,d date) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT r.active=1 AND d>=r.start_day AND (r.end_day IS NULL OR d<=r.end_day) AND (d-r.start_day)%(r.interval_weeks*7)=0
$$;
CREATE FUNCTION private.check_slot_before_recurring(bid text,sid text,vid text,starts timestamptz,ignore_id text DEFAULT '',notice boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
CREATE OR REPLACE FUNCTION private.check_slot(bid text,sid text,vid text,starts timestamptz,ignore_id text DEFAULT '',notice boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE result jsonb;d date:=(starts AT TIME ZONE 'America/Montevideo')::date;m int;v public.services;r record;
BEGIN
 result:=private.check_slot_before_recurring(bid,sid,vid,starts,ignore_id,notice);
 SELECT * INTO v FROM public.services WHERE id=vid;
 m:=extract(hour FROM starts AT TIME ZONE 'America/Montevideo')*60+extract(minute FROM starts AT TIME ZONE 'America/Montevideo');
 FOR r IN SELECT a.*,s.duration_min,s.buffer_before_min,s.buffer_after_min FROM public.recurring_appointments a JOIN public.services s ON s.id=a.service_id
 WHERE a.business_id=bid AND private.recurring_applies(a,d) AND ignore_id<>'recurring:'||a.id
 AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.recurring_id=a.id AND b.occurrence_day=d) LOOP
  IF (r.staff_id=sid OR EXISTS(SELECT 1 FROM public.service_resources x JOIN public.service_resources y ON x.resource_id=y.resource_id WHERE x.service_id=vid AND y.service_id=r.service_id))
  AND m-v.buffer_before_min<r.minute+r.duration_min+r.buffer_after_min AND r.minute-r.buffer_before_min<m+v.duration_min+v.buffer_after_min THEN RAISE EXCEPTION 'RECURRING_CONFLICT';END IF;
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.recurring_applies(public.recurring_appointments,date),private.check_slot(text,text,text,timestamptz,text,boolean),private.check_slot_before_recurring(text,text,text,timestamptz,text,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.expand_recurring(bid text,first_day date,days int,strict boolean DEFAULT false,only_id text DEFAULT '') RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE r public.recurring_appointments;d date;i int;starts timestamptz;slot jsonb;cid text;booking_id text;token text;problem text;
BEGIN
 IF days<1 OR days>42 OR first_day IS NULL THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 FOR r IN SELECT * FROM public.recurring_appointments WHERE business_id=bid AND active=1 AND (only_id='' OR id=only_id) ORDER BY id LOOP
  problem:='';
  FOR i IN 0..days-1 LOOP
   d:=first_day+i;
   IF NOT private.recurring_applies(r,d) OR EXISTS(SELECT 1 FROM public.bookings WHERE recurring_id=r.id AND occurrence_day=d) THEN CONTINUE;END IF;
   BEGIN
    starts:=(d::timestamp+make_interval(mins=>r.minute)) AT TIME ZONE 'America/Montevideo';
    slot:=private.check_slot(bid,r.staff_id,r.service_id,starts,'recurring:'||r.id,false);
    IF (SELECT count(*) FROM public.customers c WHERE c.business_id=bid AND ((r.customer_email<>'' AND lower(c.email)=r.customer_email) OR (regexp_replace(r.customer_phone,'[^0-9]','','g')<>'' AND regexp_replace(c.phone,'[^0-9]','','g')=regexp_replace(r.customer_phone,'[^0-9]','','g'))))>1 THEN RAISE EXCEPTION 'CONTACT_CONFLICT';END IF;
    SELECT c.id INTO cid FROM public.customers c WHERE c.business_id=bid AND ((r.customer_email<>'' AND lower(c.email)=r.customer_email) OR (regexp_replace(r.customer_phone,'[^0-9]','','g')<>'' AND regexp_replace(c.phone,'[^0-9]','','g')=regexp_replace(r.customer_phone,'[^0-9]','','g'))) ORDER BY c.created_at LIMIT 1;
    IF cid IS NULL THEN cid:=gen_random_uuid()::text;INSERT INTO public.customers(id,business_id,name,email,phone,created_at) VALUES(cid,bid,r.customer_name,r.customer_email,r.customer_phone,now());END IF;
    booking_id:=gen_random_uuid()::text;token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
    INSERT INTO public.bookings(id,business_id,staff_id,service_id,customer_id,starts_at,ends_at,blocked_from,blocked_until,status,source,notes,payment_status,price_uyu,manage_token_hash,created_at,updated_at,customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot,recurring_id,occurrence_day)
    VALUES(booking_id,bid,r.staff_id,r.service_id,cid,starts,(slot->>'ends_at')::timestamptz,(slot->>'blocked_from')::timestamptz,(slot->>'blocked_until')::timestamptz,'confirmed','recurring',r.notes,'not_required',(slot->>'price')::int,private.hash(token),now(),now(),r.customer_name,r.customer_email,r.customer_phone,r.id,d);
    INSERT INTO public.booking_resources SELECT booking_id,resource_id FROM public.service_resources WHERE service_id=r.service_id;
    INSERT INTO private.booking_tokens VALUES(booking_id,token);
   EXCEPTION WHEN OTHERS THEN
    IF strict THEN RAISE EXCEPTION 'RECURRING_DATE_CONFLICT:%:%',d,SQLERRM;END IF;
    problem:='Revisar '||d::text||': '||SQLERRM;
   END;
  END LOOP;
  UPDATE public.recurring_appointments SET last_error=problem WHERE id=r.id;
 END LOOP;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION private.expand_recurring(text,date,int,boolean,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.atry_recurring(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM private.require_manager(bid);
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.active DESC,x.start_day,x.minute) FROM (
 SELECT r.*,s.name service_name,st.name staff_name FROM public.recurring_appointments r JOIN public.services s ON s.id=r.service_id JOIN public.staff st ON st.id=r.staff_id WHERE r.business_id=bid) x),'[]'::jsonb);
END $$;

CREATE FUNCTION public.atry_end_recurring(bid text,recurring_id text,from_day date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE r public.recurring_appointments;
BEGIN
 PERFORM private.require_manager(bid);PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 SELECT * INTO r FROM public.recurring_appointments WHERE id=recurring_id AND business_id=bid FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF from_day IS NULL OR from_day<(now() AT TIME ZONE 'America/Montevideo')::date THEN RAISE EXCEPTION 'INVALID_DATE';END IF;
 IF r.end_day IS NOT NULL AND r.end_day<from_day THEN RETURN jsonb_build_object('ok',true);END IF;
 IF r.end_day IS NULL OR r.end_day>=from_day THEN UPDATE public.recurring_appointments SET end_day=from_day-1,active=CASE WHEN from_day<=start_day THEN 0 ELSE 1 END,updated_at=now() WHERE id=r.id;END IF;
 UPDATE public.bookings b SET status='cancelled',updated_at=now() WHERE b.business_id=bid AND b.recurring_id=r.id AND b.starts_at>=greatest(from_day::timestamp AT TIME ZONE 'America/Montevideo',now()) AND b.status IN ('confirmed','pending');
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'recurring.ended','recurring',r.id,now());
 RETURN jsonb_build_object('ok',true);
END $$;

CREATE FUNCTION public.atry_create_recurring(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE r public.recurring_appointments;other public.recurring_appointments;v public.services;ov public.services;existing record;d date;i int;from_day date;
 key text:=payload->>'idempotency_key';scope text;digest text;prev public.idempotency_keys;result jsonb;clock text:=payload->>'time';
BEGIN
 PERFORM private.require_manager(bid);PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 IF coalesce(key,'')!~'^[A-Za-z0-9_-]{16,100}$' THEN RAISE EXCEPTION 'IDEMPOTENCY_REQUIRED';END IF;
 scope:='recurring:'||bid||':'||private.user_id();digest:=private.hash((payload-'idempotency_key')::text);
 SELECT * INTO prev FROM public.idempotency_keys WHERE idempotency_keys.scope=scope AND key_hash=private.hash(key);
 IF FOUND THEN IF prev.request_hash<>digest THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';END IF;RETURN prev.response::jsonb;END IF;
 r.id:=gen_random_uuid()::text;r.business_id:=bid;r.staff_id:=payload->>'staff_id';r.service_id:=payload->>'service_id';r.customer_name:=btrim(payload->>'customer_name');
 r.customer_email:=lower(btrim(coalesce(payload->>'customer_email','')));r.customer_phone:=btrim(coalesce(payload->>'customer_phone',''));
 r.start_day:=(payload->>'start_day')::date;r.end_day:=nullif(payload->>'end_day','')::date;r.interval_weeks:=coalesce((payload->>'interval_weeks')::int,1);r.active:=1;r.notes:=left(coalesce(payload->>'notes',''),500);
 IF clock IS NULL OR clock!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' OR r.start_day IS NULL OR r.start_day<(now() AT TIME ZONE 'America/Montevideo')::date OR r.end_day<r.start_day OR r.interval_weeks NOT IN (1,2,4) THEN RAISE EXCEPTION 'INVALID_RECURRENCE';END IF;
 r.minute:=split_part(clock,':',1)::int*60+split_part(clock,':',2)::int;
 IF (r.start_day::timestamp+make_interval(mins=>r.minute)) AT TIME ZONE 'America/Montevideo'<now() THEN RAISE EXCEPTION 'INVALID_RECURRENCE';END IF;
 IF r.customer_name IS NULL OR length(r.customer_name)<2 OR length(r.customer_name)>100 OR length(r.customer_email)>150 OR length(r.customer_phone)>35 OR (r.customer_email='' AND r.customer_phone='') OR (r.customer_email<>'' AND r.customer_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'INVALID_CONTACT';END IF;
 IF payload ? 'replace_id' AND coalesce(payload->>'replace_id','')<>'' THEN PERFORM public.atry_end_recurring(bid,payload->>'replace_id',r.start_day);END IF;
 IF (SELECT count(*) FROM public.recurring_appointments WHERE business_id=bid AND active=1 AND (end_day IS NULL OR end_day>=(now() AT TIME ZONE 'America/Montevideo')::date))>=200 THEN RAISE EXCEPTION 'RECURRING_LIMIT';END IF;
 PERFORM private.check_slot(bid,r.staff_id,r.service_id,(r.start_day::timestamp+make_interval(mins=>r.minute)) AT TIME ZONE 'America/Montevideo','',false);
 SELECT * INTO v FROM public.services WHERE id=r.service_id;
 FOR existing IN SELECT * FROM public.bookings WHERE business_id=bid AND status IN ('pending','confirmed') AND starts_at>=(r.start_day::timestamp AT TIME ZONE 'America/Montevideo') LOOP
  d:=(existing.starts_at AT TIME ZONE 'America/Montevideo')::date;
  IF private.recurring_applies(r,d) THEN PERFORM private.check_slot(bid,r.staff_id,r.service_id,(d::timestamp+make_interval(mins=>r.minute)) AT TIME ZONE 'America/Montevideo','',false);END IF;
 END LOOP;
 FOR other IN SELECT * FROM public.recurring_appointments WHERE business_id=bid AND active=1 LOOP
  IF other.staff_id<>r.staff_id AND NOT EXISTS(SELECT 1 FROM public.service_resources x JOIN public.service_resources y ON x.resource_id=y.resource_id WHERE x.service_id=r.service_id AND y.service_id=other.service_id) THEN CONTINUE;END IF;
  SELECT * INTO ov FROM public.services WHERE id=other.service_id;
  IF r.minute-v.buffer_before_min>=other.minute+ov.duration_min+ov.buffer_after_min OR other.minute-ov.buffer_before_min>=r.minute+v.duration_min+v.buffer_after_min THEN CONTINUE;END IF;
  from_day:=greatest(r.start_day,other.start_day);
  FOR i IN 0..27 LOOP IF private.recurring_applies(r,from_day+i) AND private.recurring_applies(other,from_day+i) THEN RAISE EXCEPTION 'RECURRING_CONFLICT';END IF;END LOOP;
 END LOOP;
 INSERT INTO public.recurring_appointments(id,business_id,staff_id,service_id,customer_name,customer_email,customer_phone,start_day,end_day,minute,interval_weeks,notes)
 VALUES(r.id,bid,r.staff_id,r.service_id,r.customer_name,r.customer_email,r.customer_phone,r.start_day,r.end_day,r.minute,r.interval_weeks,r.notes);
 PERFORM private.expand_recurring(bid,r.start_day,42,true,r.id);
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'recurring.created','recurring',r.id,now());
 result:=to_jsonb(r);INSERT INTO public.idempotency_keys VALUES(scope,private.hash(key),digest,result::text,now());RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.atry_recurring(text),public.atry_end_recurring(text,text,date),public.atry_create_recurring(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_recurring(text),public.atry_end_recurring(text,text,date),public.atry_create_recurring(text,jsonb) TO authenticated;

CREATE FUNCTION private.bookings_before_recurring(bid text,start_day date,days int DEFAULT 1) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
REVOKE ALL ON FUNCTION private.bookings_before_recurring(text,date,int) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.atry_bookings(bid text,start_day date,days int DEFAULT 1) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF private.member_role(bid) IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM private.expand_recurring(bid,start_day,days);
 result:=private.bookings_before_recurring(bid,start_day,days);
 RETURN coalesce((SELECT jsonb_agg(e||jsonb_build_object('recurring_id',b.recurring_id,'occurrence_day',b.occurrence_day) ORDER BY e->>'starts_at') FROM jsonb_array_elements(result) e JOIN public.bookings b ON b.id=e->>'id'),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.atry_bookings(text,date,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_bookings(text,date,int) TO authenticated;

CREATE FUNCTION private.dashboard_before_recurring(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE day date;tz text;events jsonb;totals jsonb;daily jsonb;queue_count bigint;tips jsonb:='[]';
BEGIN
 PERFORM private.require_manager(bid);SELECT timezone INTO tz FROM public.businesses WHERE id=bid;day:=(now() AT TIME ZONE tz)::date;events:=public.atry_bookings(bid,day,1);
 SELECT jsonb_build_object('total',count(*),'completed_revenue',coalesce(sum(price_uyu) FILTER(WHERE status='completed'),0),'cancelled',count(*) FILTER(WHERE status='cancelled'),'no_show',count(*) FILTER(WHERE status='no_show')) INTO totals FROM public.bookings WHERE business_id=bid AND starts_at>=now()-interval '30 days' AND starts_at<now();
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO daily FROM (SELECT to_char(starts_at AT TIME ZONE tz,'YYYY-MM-DD') AS "day",count(*) n FROM public.bookings WHERE business_id=bid AND starts_at AT TIME ZONE tz>=(day-6)::timestamp AND starts_at AT TIME ZONE tz<(day+1)::timestamp AND status<>'cancelled' GROUP BY 1 ORDER BY 1) x;
 SELECT count(*) INTO queue_count FROM public.notifications WHERE business_id=bid AND state='queued';
 IF queue_count>0 THEN tips:=tips||jsonb_build_array(queue_count||' notificaciones están en cola; todavía no se confirmó su envío.');END IF;
 IF NOT EXISTS(SELECT 1 FROM public.services WHERE business_id=bid AND active=1) THEN tips:=tips||jsonb_build_array('Agregá tu primer servicio para comenzar a recibir reservas en línea.');END IF;
 RETURN jsonb_build_object('today',events,'today_count',jsonb_array_length(events),'totals',totals,'daily',daily,'insights',tips,'upcoming',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT b.id,b.starts_at,b.status,coalesce(b.customer_name_snapshot,c.name) customer_name,s.name service_name,st.name staff_name FROM public.bookings b JOIN public.customers c ON c.id=b.customer_id JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id WHERE b.business_id=bid AND b.starts_at>=now() AND b.status IN ('confirmed','pending') ORDER BY b.starts_at LIMIT 8) x),'[]'::jsonb),
 'customers',(SELECT count(*) FROM public.customers WHERE business_id=bid),'staff',(SELECT count(*) FROM public.staff WHERE business_id=bid AND active=1),'services',(SELECT count(*) FROM public.services WHERE business_id=bid AND active=1),'waitlist',(SELECT count(*) FROM public.waitlist WHERE business_id=bid AND status IN ('waiting','offered')));
END $$;
REVOKE ALL ON FUNCTION private.dashboard_before_recurring(text) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.atry_dashboard(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM private.require_manager(bid);PERFORM private.expand_recurring(bid,(now() AT TIME ZONE 'America/Montevideo')::date,31);RETURN private.dashboard_before_recurring(bid);
END $$;
REVOKE ALL ON FUNCTION public.atry_dashboard(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_dashboard(text) TO authenticated;

CREATE FUNCTION private.mail_ingest_before_recurring() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
REVOKE ALL ON FUNCTION private.mail_ingest_before_recurring() FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.atry_mail_ingest() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b record;
BEGIN
 FOR b IN SELECT DISTINCT business_id FROM public.recurring_appointments WHERE active=1 AND (end_day IS NULL OR end_day>=(now() AT TIME ZONE 'America/Montevideo')::date) ORDER BY business_id LOOP
  PERFORM private.expand_recurring(b.business_id,(now() AT TIME ZONE 'America/Montevideo')::date,8);
 END LOOP;
 RETURN private.mail_ingest_before_recurring();
END $$;
REVOKE ALL ON FUNCTION public.atry_mail_ingest() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atry_mail_ingest() TO service_role;
