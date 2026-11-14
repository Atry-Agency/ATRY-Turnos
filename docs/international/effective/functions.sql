CREATE OR REPLACE FUNCTION private.apply_mail_receipts(pid text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE j public.mail_jobs;e private.mail_receipts;
BEGIN
 IF (SELECT count(*) FROM public.mail_jobs WHERE provider_id=pid)<>1 THEN RETURN false;END IF;SELECT * INTO j FROM public.mail_jobs WHERE provider_id=pid FOR UPDATE;IF NOT FOUND THEN RETURN false;END IF;
 SELECT * INTO e FROM private.mail_receipts WHERE provider_id=pid AND event IN ('delivered','hard_bounce','blocked','invalid') ORDER BY occurred_at DESC,CASE WHEN event='delivered' THEN 1 ELSE 0 END,id LIMIT 1;
 IF e.id IS NULL OR j.state IN ('queued','retry','failed','skipped','quota_exhausted','processing') THEN RETURN false;END IF;
 IF j.state='delivery_unknown' THEN UPDATE public.mail_jobs SET state='provider_accepted',updated_at=now() WHERE id=j.id;END IF;
 UPDATE public.mail_jobs SET state=CASE WHEN e.event='delivered' THEN 'delivered' ELSE 'bounced' END,updated_at=now() WHERE id=j.id AND state IS DISTINCT FROM CASE WHEN e.event='delivered' THEN 'delivered' ELSE 'bounced' END;RETURN true;
END $function$
;
CREATE OR REPLACE FUNCTION private.assert_future(bid text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE b record;
BEGIN
 FOR b IN SELECT * FROM public.bookings WHERE business_id=bid AND status IN ('pending','confirmed') AND ends_at>now() LOOP
  PERFORM private.check_slot(bid,b.staff_id,b.service_id,b.starts_at,b.id,false);
 END LOOP;
END $function$
;
CREATE OR REPLACE FUNCTION private.booking_change_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE kind text;recipient text;token text;
BEGIN IF EXISTS(SELECT 1 FROM public.booking_visit_items WHERE booking_id=NEW.id) THEN RETURN NEW;END IF;
 IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at AND NEW.staff_id IS NOT DISTINCT FROM OLD.staff_id THEN RETURN NEW;END IF;
 kind:=CASE WHEN NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN 'reprogramado' ELSE NEW.status END;
 SELECT coalesce(NEW.customer_email_snapshot,c.email,'') INTO recipient FROM public.customers c WHERE c.id=NEW.customer_id;
 SELECT t.token INTO token FROM private.booking_tokens t WHERE t.booking_id=NEW.id;
 INSERT INTO public.notifications(id,business_id,booking_id,kind,recipient,subject,content,created_at) VALUES(gen_random_uuid()::text,NEW.business_id,NEW.id,kind,recipient,CASE kind WHEN 'cancelled' THEN 'Reserva cancelada' WHEN 'reprogramado' THEN 'Reserva reprogramada' WHEN 'confirmed' THEN 'Reserva confirmada' ELSE 'Actualización de tu reserva' END,'Tu reserva fue actualizada.'||CASE WHEN token IS NOT NULL THEN ' Gestioná tu turno en /#/gestionar/'||token ELSE '' END,now());RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION private.bookings_before_recurring(bid text, start_day date, days integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION private.bookings_visit_base(bid text, start_day date, days integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF private.member_role(bid) IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM private.expand_recurring(bid,start_day,days);
 result:=private.bookings_before_recurring(bid,start_day,days);
 RETURN coalesce((SELECT jsonb_agg(e||jsonb_build_object('recurring_id',b.recurring_id,'occurrence_day',b.occurrence_day) ORDER BY e->>'starts_at') FROM jsonb_array_elements(result) e JOIN public.bookings b ON b.id=e->>'id'),'[]'::jsonb);
END $function$
;
CREATE OR REPLACE FUNCTION private.business_purge_allowed(bid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT current_setting('atry.business_purge',true)=bid AND EXISTS(SELECT 1 FROM public.users WHERE auth_user_id=auth.uid() AND platform_admin=1)
$function$
;
CREATE OR REPLACE FUNCTION private.business_purge_plan(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE t record;fk record;condition text;changed int;added int;count_rows bigint;counts jsonb:='{}';content text:='';part text;business public.businesses;crossed boolean;
BEGIN
 PERFORM private.require_admin();SELECT * INTO business FROM public.businesses WHERE id=bid;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 DROP TABLE IF EXISTS pg_temp.atry_purge_rows;
 CREATE TEMP TABLE atry_purge_rows(rel oid,tuple text,PRIMARY KEY(rel,tuple)) ON COMMIT DROP;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'public.businesses'::regclass,ctid::text FROM public.businesses WHERE id=bid;
 FOR t IN SELECT c.oid,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private') AND c.relkind='r' AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='business_id' AND NOT a.attisdropped) LOOP
  EXECUTE format('INSERT INTO pg_temp.atry_purge_rows SELECT %s,ctid::text FROM %I.%I WHERE business_id=$1 ON CONFLICT DO NOTHING',t.oid,t.nspname,t.relname) USING bid;
 END LOOP;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'private.control_requests'::regclass,ctid::text FROM private.control_requests WHERE entity_type='business' AND entity_id=bid ON CONFLICT DO NOTHING;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'private.control_events'::regclass,ctid::text FROM private.control_events WHERE entity_id=bid ON CONFLICT DO NOTHING;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'public.platform_audit'::regclass,ctid::text FROM public.platform_audit WHERE entity_id=bid ON CONFLICT DO NOTHING;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'public.idempotency_keys'::regclass,ctid::text FROM public.idempotency_keys WHERE position(bid IN scope)>0 ON CONFLICT DO NOTHING;
 LOOP
  changed:=0;
  FOR fk IN SELECT c.oid,c.conrelid,c.confrelid,n.nspname,t.relname,pn.nspname parent_schema,pt.relname parent_name,c.conkey,c.confkey FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_class pt ON pt.oid=c.confrelid JOIN pg_namespace pn ON pn.oid=pt.relnamespace WHERE c.contype='f' AND n.nspname IN ('public','private') AND EXISTS(SELECT 1 FROM pg_temp.atry_purge_rows r WHERE r.rel=c.confrelid) LOOP
   IF fk.conrelid='public.users'::regclass THEN RAISE EXCEPTION 'PROTECTED_ACCOUNT_DEPENDENCY';END IF;
   SELECT string_agg(format('child.%I=parent.%I',ca.attname,pa.attname),' AND ' ORDER BY k.i) INTO condition FROM generate_subscripts(fk.conkey,1) k(i) JOIN pg_attribute ca ON ca.attrelid=fk.conrelid AND ca.attnum=fk.conkey[k.i] JOIN pg_attribute pa ON pa.attrelid=fk.confrelid AND pa.attnum=fk.confkey[k.i];
   EXECUTE format('INSERT INTO pg_temp.atry_purge_rows SELECT %s,child.ctid::text FROM %I.%I child JOIN %I.%I parent ON %s JOIN pg_temp.atry_purge_rows selected ON selected.rel=%s AND selected.tuple=parent.ctid::text ON CONFLICT DO NOTHING',fk.conrelid,fk.nspname,fk.relname,fk.parent_schema,fk.parent_name,condition,fk.confrelid);
   GET DIAGNOSTICS added=ROW_COUNT;changed:=changed+added;
  END LOOP;
  EXIT WHEN changed=0;
 END LOOP;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'public.public_rate_buckets'::regclass,ctid::text FROM public.public_rate_buckets WHERE split_part(scope,':',2)=business.slug ON CONFLICT DO NOTHING;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'public.idempotency_keys'::regclass,k.ctid::text FROM public.idempotency_keys k JOIN private.offer_tokens o ON k.scope='offer:'||private.hash(o.token) JOIN public.waitlist w ON w.id=o.waitlist_id WHERE w.business_id=bid ON CONFLICT DO NOTHING;
 -- Receipts are provider-linked rather than FK-linked. Include only this business's jobs.
 INSERT INTO pg_temp.atry_purge_rows SELECT 'private.mail_receipts'::regclass,r.ctid::text FROM private.mail_receipts r JOIN public.mail_jobs j ON j.provider_id=r.provider_id WHERE j.business_id=bid ON CONFLICT DO NOTHING;
 FOR t IN SELECT r.rel,n.nspname,c.relname FROM pg_temp.atry_purge_rows r JOIN pg_class c ON c.oid=r.rel JOIN pg_namespace n ON n.oid=c.relnamespace GROUP BY r.rel,n.nspname,c.relname ORDER BY n.nspname,c.relname LOOP
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=t.rel AND attname='business_id' AND NOT attisdropped) THEN
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I d JOIN pg_temp.atry_purge_rows r ON r.rel=%s AND r.tuple=d.ctid::text WHERE d.business_id IS NOT NULL AND d.business_id<>$1)',t.nspname,t.relname,t.rel) INTO crossed USING bid;
   IF crossed THEN RAISE EXCEPTION 'CROSS_BUSINESS_DEPENDENCY';END IF;
  END IF;
  EXECUTE format('SELECT count(*),coalesce(string_agg(to_jsonb(d)::text,''|'' ORDER BY d.ctid::text),'''') FROM %I.%I d JOIN pg_temp.atry_purge_rows r ON r.rel=%s AND r.tuple=d.ctid::text',t.nspname,t.relname,t.rel) INTO count_rows,part;
  counts:=counts||jsonb_build_object(t.nspname||'.'||t.relname,count_rows);content:=content||t.nspname||'.'||t.relname||part;
 END LOOP;
 RETURN jsonb_build_object('id',business.id,'name',business.name,'slug',business.slug,'counts',counts,'token',private.hash(content),'total',(SELECT count(*) FROM pg_temp.atry_purge_rows),'execution_enabled',NOT EXISTS(SELECT 1 FROM public.mail_jobs WHERE business_id=bid AND state='processing'),'accounts_preserved',true);
END $function$
;
CREATE OR REPLACE FUNCTION private.calendar_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 INSERT INTO public.calendar_revisions(business_id,revision) VALUES(NEW.business_id,1) ON CONFLICT(business_id) DO UPDATE SET revision=public.calendar_revisions.revision+1,updated_at=now();RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION private.check_slot(bid text, sid text, vid text, starts timestamp with time zone, ignore_id text DEFAULT ''::text, notice boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE context jsonb:=coalesce(nullif(current_setting('atry.visit_slot',true),''),'{}')::jsonb;
BEGIN
 IF context->>'bid'=bid AND context->>'sid'=sid AND context->>'vid'=vid AND (context->>'starts')::timestamptz=starts THEN
  RETURN private.visit_slot_raw(bid,sid,vid,starts,ignore_id,notice,ARRAY(SELECT jsonb_array_elements_text(context->'ignore_ids')),coalesce((context->>'off_grid')::boolean,false));
 END IF;
 RETURN private.check_slot_single(bid,sid,vid,starts,ignore_id,notice);
END $function$
;
CREATE OR REPLACE FUNCTION private.check_slot_before_recurring(bid text, sid text, vid text, starts timestamp with time zone, ignore_id text DEFAULT ''::text, notice boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION private.check_slot_single(bid text, sid text, vid text, starts timestamp with time zone, ignore_id text DEFAULT ''::text, notice boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE result jsonb;d date:=(starts AT TIME ZONE 'America/Montevideo')::date;m int;v public.services;r record;
BEGIN
 IF NOT private.subscription_live(bid) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';END IF;
 result:=private.check_slot_before_recurring(bid,sid,vid,starts,ignore_id,notice);
 SELECT * INTO v FROM public.services WHERE id=vid;
 m:=extract(hour FROM starts AT TIME ZONE 'America/Montevideo')*60+extract(minute FROM starts AT TIME ZONE 'America/Montevideo');
 FOR r IN SELECT a.*,s.duration_min,s.buffer_before_min,s.buffer_after_min FROM public.recurring_appointments a JOIN public.services s ON s.id=a.service_id
 WHERE a.business_id=bid AND private.has_feature(bid,'recurring') AND private.recurring_applies(a,d) AND ignore_id<>'recurring:'||a.id
 AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.recurring_id=a.id AND b.occurrence_day=d) LOOP
  IF (r.staff_id=sid OR EXISTS(SELECT 1 FROM public.service_resources x JOIN public.service_resources y ON x.resource_id=y.resource_id WHERE x.service_id=vid AND y.service_id=r.service_id))
  AND m-v.buffer_before_min<r.minute+r.duration_min+r.buffer_after_min AND r.minute-r.buffer_before_min<m+v.duration_min+v.buffer_after_min THEN RAISE EXCEPTION 'RECURRING_CONFLICT';END IF;
 END LOOP;
 RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION private.commercial_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN INSERT INTO public.calendar_revisions(business_id,revision) VALUES(NEW.id,1) ON CONFLICT(business_id) DO UPDATE SET revision=public.calendar_revisions.revision+1,updated_at=now();RETURN NEW;END $function$
;
CREATE OR REPLACE FUNCTION private.commercial_cycle(bid text)
 RETURNS TABLE(cycle_start timestamp with time zone, cycle_end timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE anchor int;month_start date;candidate date;today date:=(now() AT TIME ZONE 'America/Montevideo')::date;
BEGIN
 SELECT extract(day FROM coalesce(subscription_started_at,created_at) AT TIME ZONE 'America/Montevideo')::int INTO anchor FROM public.businesses WHERE id=bid;
 month_start:=date_trunc('month',today)::date;candidate:=month_start+least(anchor,extract(day FROM month_start+interval '1 month - 1 day')::int)-1;
 IF candidate>today THEN month_start:=(month_start-interval '1 month')::date;END IF;
 cycle_start:=(month_start+least(anchor,extract(day FROM month_start+interval '1 month - 1 day')::int)-1)::timestamp AT TIME ZONE 'America/Montevideo';month_start:=(month_start+interval '1 month')::date;
 cycle_end:=(month_start+least(anchor,extract(day FROM month_start+interval '1 month - 1 day')::int)-1)::timestamp AT TIME ZONE 'America/Montevideo';RETURN NEXT;
END $function$
;
CREATE OR REPLACE FUNCTION private.control_booking_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE scope text;
BEGIN SELECT reservation_scope INTO scope FROM private.business_controls WHERE business_id=NEW.business_id;
 IF (scope='all' AND NEW.source<>'recurring') OR (scope='public' AND NEW.source='public') THEN RAISE EXCEPTION 'RESERVATIONS_PAUSED' USING ERRCODE='42501';END IF;RETURN NEW;END $function$
;
CREATE OR REPLACE FUNCTION private.control_command_base(action text, entity_id text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid text:=private.require_admin();key text:=payload->>'request_id';memo text:=btrim(coalesce(payload->>'reason',''));digest text:=private.hash(jsonb_build_object('action',action,'entity',entity_id,'payload',payload-'request_id')::text);old jsonb;newdata jsonb;previous private.control_events;bid text;v bigint;j public.mail_jobs;target public.users;counter int;
BEGIN
 PERFORM private.control_stepup();
 IF key IS NULL OR key!~'^[A-Za-z0-9_-]{16,100}$' OR length(memo) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'REASON_REQUIRED';END IF;
 -- Lock each idempotency key before effects; concurrent retries cannot double-apply.
 PERFORM pg_advisory_xact_lock(hashtextextended('control:'||key,0));
 SELECT * INTO previous FROM private.control_events WHERE request_key=key;
 IF FOUND THEN IF previous.request_hash<>digest OR previous.actor_id<>uid THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';END IF;RETURN jsonb_build_object('ok',true,'operation_id',previous.id,'replayed',true);END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('control:actor:'||uid,0));
 SELECT count(*) INTO counter FROM private.control_events WHERE actor_id=uid AND created_at>now()-interval '1 minute';IF counter>=30 THEN RAISE EXCEPTION 'ADMIN_RATE_LIMIT';END IF;
 IF action IN ('reservations','business_mail') THEN
  bid:=entity_id;PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  SELECT to_jsonb(c),revision INTO old,v FROM private.business_controls c WHERE business_id=bid;
  IF coalesce(v,0) IS DISTINCT FROM (payload->>'revision')::bigint OR NOT(payload?'revision') THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
  INSERT INTO private.business_controls(business_id) VALUES(bid) ON CONFLICT DO NOTHING;
  IF action='reservations' THEN UPDATE private.business_controls SET reservation_scope=payload->>'scope',revision=revision+1 WHERE business_id=bid;ELSE UPDATE private.business_controls SET mail_paused=(payload->>'paused')::boolean,revision=revision+1 WHERE business_id=bid;END IF;
  SELECT to_jsonb(c) INTO newdata FROM private.business_controls c WHERE business_id=bid;
 ELSIF action='global_mail' THEN
  SELECT to_jsonb(c),revision INTO old,v FROM private.control_settings c WHERE id=1 FOR UPDATE;
  IF v IS DISTINCT FROM (payload->>'revision')::bigint OR NOT(payload?'revision') THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
  UPDATE private.control_settings SET operational_mail_paused=(payload->>'paused')::boolean,revision=revision+1 WHERE id=1;SELECT to_jsonb(c) INTO newdata FROM private.control_settings c;
 ELSIF action IN ('block_user','revoke_sessions','remove_membership') THEN
  SELECT * INTO target FROM public.users WHERE id=entity_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  -- A global lock protects the last administrator against simultaneous actions.
  PERFORM pg_advisory_xact_lock(hashtextextended('control:administrators',0));
  IF action='block_user' AND (payload->>'blocked')::boolean AND (target.id=uid OR (target.platform_admin=1 AND (SELECT count(*) FROM public.users u WHERE u.platform_admin=1 AND NOT EXISTS(SELECT 1 FROM private.user_controls c WHERE c.user_id=u.id AND c.blocked))<=1)) THEN RAISE EXCEPTION 'LAST_ADMIN';END IF;
  old:=jsonb_build_object('user_id',target.id,'blocked',coalesce((SELECT blocked FROM private.user_controls WHERE user_id=target.id),false));
  IF action='block_user' THEN INSERT INTO private.user_controls VALUES(target.id,(payload->>'blocked')::boolean) ON CONFLICT(user_id) DO UPDATE SET blocked=EXCLUDED.blocked;END IF;
  IF action='revoke_sessions' OR (action='block_user' AND (payload->>'blocked')::boolean) THEN DELETE FROM auth.sessions WHERE user_id=target.auth_user_id;END IF;
  IF action='remove_membership' THEN
   bid:=payload->>'business_id';PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
   IF EXISTS(SELECT 1 FROM public.memberships WHERE user_id=target.id AND business_id=bid AND role='owner') AND (SELECT count(*) FROM public.memberships WHERE business_id=bid AND role='owner')<=1 THEN RAISE EXCEPTION 'LAST_OWNER';END IF;
   UPDATE public.staff SET user_id=NULL WHERE business_id=bid AND user_id=target.id;DELETE FROM public.memberships WHERE business_id=bid AND user_id=target.id;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  END IF;newdata:=jsonb_build_object('action',action,'blocked',coalesce((SELECT blocked FROM private.user_controls WHERE user_id=target.id),false));
 ELSIF action IN ('mail_cancel','mail_retry') THEN
  SELECT * INTO j FROM public.mail_jobs WHERE id=entity_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;bid:=j.business_id;
  old:=jsonb_build_object('state',j.state,'attempts',j.attempts);
  IF action='mail_cancel' THEN
   IF j.state NOT IN ('queued','retry','quota_exhausted') OR j.kind IN ('auth','security','password_reset','invitation') THEN RAISE EXCEPTION 'UNSAFE_MAIL_ACTION';END IF;
   UPDATE public.mail_jobs SET state='skipped',last_error='ADMIN_CANCELLED',updated_at=now() WHERE id=j.id;
  ELSE
   IF j.state<>'failed' OR j.provider_id IS NOT NULL OR j.last_error NOT IN ('BREVO_QUOTA','BREVO_HTTP_429','BREVO_HTTP_400','BREVO_HTTP_401','BREVO_HTTP_403') THEN RAISE EXCEPTION 'UNSAFE_MAIL_ACTION';END IF;
   UPDATE public.mail_jobs SET state='retry',attempts=0,next_attempt_at=now(),updated_at=now() WHERE id=j.id;
  END IF;SELECT jsonb_build_object('state',state,'attempts',attempts) INTO newdata FROM public.mail_jobs WHERE id=j.id;
 ELSIF action='incident' THEN
  SELECT to_jsonb(i),i.revision,i.business_id INTO old,v,bid FROM public.incidents i WHERE id=entity_id FOR UPDATE;
  IF old IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  IF v IS DISTINCT FROM (payload->>'revision')::bigint OR NOT(payload?'revision') THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
  IF payload->>'state' NOT IN ('open','investigating','resolved') OR payload->>'priority' NOT IN ('low','normal','high','critical') OR (payload->>'state'='resolved' AND length(btrim(coalesce(payload->>'resolution','')))<5) THEN RAISE EXCEPTION 'RESOLUTION_REQUIRED';END IF;
  UPDATE public.incidents SET state=payload->>'state',priority=payload->>'priority',resolution=left(coalesce(payload->>'resolution',''),1000),assignee=uid,closed_at=CASE WHEN payload->>'state'='resolved' THEN now() END,updated_at=now(),revision=revision+1 WHERE id=entity_id;
  SELECT to_jsonb(i) INTO newdata FROM public.incidents i WHERE id=entity_id;
 ELSIF action='followup' THEN
  SELECT business_id INTO bid FROM public.plan_requests WHERE id=entity_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  SELECT to_jsonb(f),f.revision INTO old,v FROM private.commercial_followups f WHERE request_id=entity_id;
  IF coalesce(v,0) IS DISTINCT FROM (payload->>'revision')::bigint OR NOT(payload?'revision') THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
  INSERT INTO private.commercial_followups(request_id,note,next_contact,assignee) VALUES(entity_id,left(coalesce(payload->>'note',''),1000),nullif(payload->>'next_contact','')::date,uid) ON CONFLICT(request_id) DO UPDATE SET note=EXCLUDED.note,next_contact=EXCLUDED.next_contact,assignee=uid,revision=private.commercial_followups.revision+1;
  SELECT to_jsonb(f) INTO newdata FROM private.commercial_followups f WHERE request_id=entity_id;
 ELSIF action='verify_payment' THEN
  SELECT to_jsonb(e),e.business_id INTO old,bid FROM public.subscription_events e WHERE e.id=entity_id AND e.action IN ('activate','renew') AND amount_uyu>0;IF old IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  INSERT INTO private.payment_reviews VALUES(entity_id,uid,memo,now());newdata:=jsonb_build_object('verified_by_operator',uid,'automatic_bank_check',false);
 ELSIF action='deletion_request' THEN
  IF payload->>'type'='business' THEN PERFORM 1 FROM public.businesses WHERE id=entity_id;bid:=entity_id;ELSE PERFORM 1 FROM public.users WHERE id=entity_id;END IF;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  INSERT INTO private.control_requests(entity_type,entity_id,kind,reason,actor_id) VALUES(payload->>'type',entity_id,payload->>'kind',memo,uid);newdata:=jsonb_build_object('state','policy_review','execution_enabled',false);
 ELSE RAISE EXCEPTION 'INVALID_ACTION';END IF;
 INSERT INTO private.control_events(actor_id,action,entity_id,business_id,reason,before_state,after_state,request_key,request_hash) VALUES(uid,action,entity_id,bid,memo,old,newdata,key,digest) RETURNING * INTO previous;
 RETURN jsonb_build_object('ok',true,'operation_id',previous.id,'after',newdata);
END $function$
;
CREATE OR REPLACE FUNCTION private.control_incident_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid text:=private.user_id();
BEGIN IF TG_OP='UPDATE' AND NEW.state='resolved' AND OLD.state<>'resolved' AND length(btrim(NEW.resolution))<5 THEN RAISE EXCEPTION 'RESOLUTION_REQUIRED';END IF;
 IF uid IS NOT NULL THEN INSERT INTO private.control_events(actor_id,action,entity_id,business_id,reason,before_state,after_state,request_key,request_hash) VALUES(uid,'incident.'||lower(TG_OP),NEW.id,NEW.business_id,CASE WHEN TG_OP='INSERT' THEN 'Incidencia registrada' ELSE 'Actualización de incidencia' END,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END,to_jsonb(NEW),gen_random_uuid()::text,'trigger');END IF;RETURN NEW;END $function$
;
CREATE OR REPLACE FUNCTION private.control_new_series_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN IF EXISTS(SELECT 1 FROM private.business_controls WHERE business_id=NEW.business_id AND reservation_scope='all') THEN RAISE EXCEPTION 'RESERVATIONS_PAUSED' USING ERRCODE='42501';END IF;RETURN NEW;END $function$
;
CREATE OR REPLACE FUNCTION private.control_plan_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid text:=private.user_id();
BEGIN IF uid IS NOT NULL AND EXISTS(SELECT 1 FROM public.users WHERE id=uid AND platform_admin=1) THEN
 INSERT INTO private.control_events(actor_id,action,entity_id,reason,before_state,after_state,request_key,request_hash) VALUES(uid,'plan.updated',NEW.code,left(coalesce(nullif(current_setting('atry.control_reason',true),''),'Configuración global de plan'),500),to_jsonb(OLD),to_jsonb(NEW),gen_random_uuid()::text,'trigger');END IF;RETURN NEW;END $function$
;
CREATE OR REPLACE FUNCTION private.control_read_base(section text, params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE q text:=left(coalesce(params->>'q',''),100);bid text:=params->>'business_id';lim int:=least(greatest(coalesce((params->>'limit')::int,25),1),100);off int:=greatest(coalesce((params->>'offset')::int,0),0);rows jsonb;total bigint;data jsonb;ts timestamptz:=clock_timestamp();
BEGIN
 PERFORM private.require_admin();
 IF section IN ('businesses','search') THEN
  SELECT count(*) INTO total FROM private.control_businesses b WHERE (q='' OR concat_ws(' ',b.id,b.name,b.slug,b.email,b.phone,b.owners::text) ILIKE '%'||q||'%' OR EXISTS(SELECT 1 FROM public.plan_requests r WHERE r.business_id=b.id AND r.code ILIKE '%'||q||'%')) AND (coalesce(params->>'status','')='' OR b.status=params->>'status') AND (coalesce(params->>'plan','')='' OR b.plan=params->>'plan') AND (coalesce(params->>'days','')='' OR (b.status='active' AND b.deadline BETWEEN now() AND now()+make_interval(days=>least((params->>'days')::int,365))));
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT * FROM private.control_businesses b WHERE (q='' OR concat_ws(' ',b.id,b.name,b.slug,b.email,b.phone,b.owners::text) ILIKE '%'||q||'%' OR EXISTS(SELECT 1 FROM public.plan_requests r WHERE r.business_id=b.id AND r.code ILIKE '%'||q||'%')) AND (coalesce(params->>'status','')='' OR b.status=params->>'status') AND (coalesce(params->>'plan','')='' OR b.plan=params->>'plan') AND (coalesce(params->>'days','')='' OR (b.status='active' AND b.deadline BETWEEN now() AND now()+make_interval(days=>least((params->>'days')::int,365)))) ORDER BY CASE WHEN params->>'sort'='name' THEN b.name END,CASE WHEN params->>'sort'='deadline' THEN b.deadline END ASC NULLS LAST,b.created_at DESC,b.id LIMIT lim OFFSET off) x;
 ELSIF section='business' THEN
  SELECT to_jsonb(b)||jsonb_build_object('bookings',(SELECT count(*) FROM public.bookings WHERE business_id=bid),'customers_count',(SELECT count(*) FROM public.customers WHERE business_id=bid),'active_staff',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') FROM public.staff WHERE business_id=bid AND active=1),'mail_usage',(SELECT jsonb_build_object('accepted',coalesce(u.accepted,0),'reserved',coalesce(u.reserved,0),'cycle_start',c.cycle_start,'cycle_end',c.cycle_end) FROM private.commercial_cycle(bid) c LEFT JOIN public.business_mail_usage u ON u.business_id=bid AND u.cycle_start=c.cycle_start),'license_history',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT (SELECT verified_at FROM private.payment_reviews WHERE event_id=se.id) verified_at,se.id,se.action,se.before_state,se.after_state,se.amount_uyu,se.reference,se.note,se.created_at,u.name actor_name FROM public.subscription_events se LEFT JOIN public.users u ON u.id=se.actor_id WHERE se.business_id=bid ORDER BY se.created_at DESC LIMIT 25) e),'[]')) INTO data FROM private.control_businesses b WHERE b.id=bid;
  IF data IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;RETURN jsonb_build_object('data',data,'checked_at',ts);
 ELSIF section='settings' THEN
 RETURN jsonb_build_object('checked_at',ts,'plans',(SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('expected_revision',(SELECT revision FROM private.commercial_settings WHERE id=1))) FROM public.plans p),'settings',(SELECT to_jsonb(s) FROM private.commercial_settings s),'capacity',jsonb_build_object('monthly_available',(SELECT (provider_daily_limit-security_reserve)*28 FROM private.commercial_settings WHERE id=1),'monthly_committed',(SELECT coalesce(sum(p.mail_limit),0) FROM public.businesses b JOIN public.plans p ON p.code=b.plan WHERE private.subscription_live(b.id))));
 ELSIF section='overview' THEN
  RETURN jsonb_build_object('checked_at',ts,'source','PostgreSQL / suscripciones / cola / incidencias','businesses',(SELECT jsonb_object_agg(status,n) FROM (SELECT status,count(*) n FROM private.control_businesses GROUP BY status)x),'expiring',(SELECT count(*) FROM private.control_businesses WHERE status='active' AND deadline BETWEEN now() AND now()+interval '7 days'),'requests',(SELECT count(*) FROM public.plan_requests WHERE state IN ('pending_contact','pending_payment','pending_verification')),'incidents',(SELECT count(*) FROM public.incidents WHERE state<>'resolved'),'mail',(SELECT coalesce(jsonb_object_agg(state,n),'{}') FROM (SELECT state,count(*) n FROM public.mail_jobs GROUP BY state)x),'worker',(SELECT to_jsonb(w) FROM private.worker_health w WHERE id=1),'settings',(SELECT to_jsonb(s) FROM private.control_settings s),'attention',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM (SELECT 'business' kind,id entity_id,name title,created_at since,2 priority,'pending' code FROM private.control_businesses WHERE status='pending' UNION ALL SELECT 'incident',id,subject,created_at,CASE WHEN priority='critical' THEN 0 WHEN priority='high' THEN 1 ELSE 3 END,'open' FROM public.incidents WHERE state<>'resolved' UNION ALL SELECT 'mail',id,kind,created_at,1,state FROM public.mail_jobs WHERE state IN ('failed','delivery_unknown','quota_exhausted') ORDER BY priority,since LIMIT 30)a),'[]'));
 ELSIF section='mail' THEN
  SELECT count(*) INTO total FROM public.mail_jobs j WHERE (bid IS NULL OR j.business_id=bid) AND (coalesce(params->>'state','')='' OR j.state=params->>'state');
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT j.id,j.business_id,b.name business_name,j.kind,j.state,j.attempts,j.provider_id,j.last_error,j.next_attempt_at,j.created_at,j.updated_at FROM public.mail_jobs j LEFT JOIN public.businesses b ON b.id=j.business_id WHERE (bid IS NULL OR j.business_id=bid) AND (coalesce(params->>'state','')='' OR j.state=params->>'state') ORDER BY j.created_at DESC,j.id LIMIT lim OFFSET off)x;
 ELSIF section='users' THEN
  SELECT count(*) INTO total FROM public.users u WHERE concat_ws(' ',u.id,u.name,u.email) ILIKE '%'||q||'%';
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT u.id,u.name,u.email,u.created_at,u.platform_admin,(a.email_confirmed_at IS NOT NULL) confirmed,coalesce(c.blocked,false) blocked,(SELECT count(*) FROM auth.sessions WHERE user_id=u.auth_user_id AND (not_after IS NULL OR not_after>now()) AND created_at>now()-interval '7 days') sessions,coalesce((SELECT jsonb_agg(jsonb_build_object('business_id',m.business_id,'business_name',b.name,'role',m.role)) FROM public.memberships m JOIN public.businesses b ON b.id=m.business_id WHERE m.user_id=u.id),'[]') memberships FROM public.users u LEFT JOIN auth.users a ON a.id=u.auth_user_id LEFT JOIN private.user_controls c ON c.user_id=u.id WHERE concat_ws(' ',u.id,u.name,u.email) ILIKE '%'||q||'%' ORDER BY u.created_at DESC,u.id LIMIT lim OFFSET off)x;
 ELSIF section='requests' THEN
  SELECT count(*) INTO total FROM public.plan_requests r WHERE (bid IS NULL OR r.business_id=bid) AND (coalesce(params->>'state','')='' OR r.state=params->>'state') AND concat_ws(' ',r.code,r.phone,r.plan) ILIKE '%'||q||'%';
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT r.id,r.code,r.business_id,b.name business_name,r.plan,r.price_uyu,r.phone,r.state,r.payment_state,r.created_at,f.note,f.next_contact,f.assignee,coalesce(f.revision,0) revision FROM public.plan_requests r JOIN public.businesses b ON b.id=r.business_id LEFT JOIN private.commercial_followups f ON f.request_id=r.id WHERE (bid IS NULL OR r.business_id=bid) AND (coalesce(params->>'state','')='' OR r.state=params->>'state') AND concat_ws(' ',r.code,r.phone,r.plan) ILIKE '%'||q||'%' ORDER BY r.created_at,r.id LIMIT lim OFFSET off)x;
 ELSIF section='incidents' THEN
  SELECT count(*) INTO total FROM public.incidents WHERE (bid IS NULL OR business_id=bid) AND (coalesce(params->>'state','')='' OR state=params->>'state' OR (params->>'state'='unresolved' AND state<>'resolved'));
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT i.*,b.name business_name,p.features->>'priority_support'='true' priority_support FROM public.incidents i JOIN public.businesses b ON b.id=i.business_id JOIN public.plans p ON p.code=b.plan WHERE (bid IS NULL OR i.business_id=bid) AND (coalesce(params->>'state','')='' OR i.state=params->>'state' OR (params->>'state'='unresolved' AND i.state<>'resolved')) ORDER BY CASE i.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,CASE WHEN p.features->>'priority_support'='true' THEN 0 ELSE 1 END,i.created_at,i.id LIMIT lim OFFSET off)x;
 ELSIF section='audit' THEN
  SELECT count(*) INTO total FROM private.control_audit e WHERE (bid IS NULL OR e.business_id=bid) AND concat_ws(' ',e.action,e.actor_id,e.entity_id,e.id) ILIKE '%'||q||'%' AND (coalesce(params->>'actor','')='' OR e.actor_id=params->>'actor') AND (coalesce(params->>'from','')='' OR e.created_at>=(params->>'from')::date) AND (coalesce(params->>'until','')='' OR e.created_at<(params->>'until')::date+interval '1 day');
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT e.*,u.name actor_name FROM private.control_audit e LEFT JOIN public.users u ON u.id=e.actor_id WHERE (bid IS NULL OR e.business_id=bid) AND concat_ws(' ',e.action,e.actor_id,e.entity_id,e.id) ILIKE '%'||q||'%' AND (coalesce(params->>'actor','')='' OR e.actor_id=params->>'actor') AND (coalesce(params->>'from','')='' OR e.created_at>=(params->>'from')::date) AND (coalesce(params->>'until','')='' OR e.created_at<(params->>'until')::date+interval '1 day') ORDER BY e.created_at DESC,e.id LIMIT lim OFFSET off)x;
 ELSIF section='finance' THEN
  RETURN jsonb_build_object('checked_at',ts,'declared_uyu',(SELECT coalesce(sum(amount_uyu),0) FROM public.subscription_events WHERE action IN ('activate','renew') AND (coalesce(params->>'from','')='' OR created_at>=(params->>'from')::date) AND (coalesce(params->>'until','')='' OR created_at<(params->>'until')::date+interval '1 day')),'operator_verified_uyu',(SELECT coalesce(sum(e.amount_uyu),0) FROM public.subscription_events e JOIN private.payment_reviews p ON p.event_id=e.id WHERE (coalesce(params->>'from','')='' OR e.created_at>=(params->>'from')::date) AND (coalesce(params->>'until','')='' OR e.created_at<(params->>'until')::date+interval '1 day')),'courtesies',(SELECT count(*) FROM public.subscription_events WHERE action IN ('activate','renew') AND amount_uyu=0 AND (coalesce(params->>'from','')='' OR created_at>=(params->>'from')::date) AND (coalesce(params->>'until','')='' OR created_at<(params->>'until')::date+interval '1 day')),'monthly_estimate_uyu',(SELECT coalesce(sum(p.price_uyu),0) FROM public.businesses b JOIN public.plans p ON p.code=b.plan WHERE b.plan<>'trial' AND private.subscription_live(b.id)),'bank_reconciliation',false);
 ELSIF section='storage' THEN
  RETURN jsonb_build_object('checked_at',ts,'postgres_database_bytes',pg_database_size(current_database()),'logical_rows',(SELECT jsonb_build_object('users',(SELECT count(*) FROM public.users),'businesses',(SELECT count(*) FROM public.businesses),'bookings',(SELECT count(*) FROM public.bookings),'mail_jobs',(SELECT count(*) FROM public.mail_jobs),'customers',(SELECT count(*) FROM public.customers))),'storage_bytes',NULL,'destructive_enabled',false,'backup',jsonb_build_object('status','unknown','last_verified',NULL,'restore_enabled',false));
 ELSIF section='system' THEN
  RETURN jsonb_build_object('checked_at',ts,'database','operational','evidence','Consulta administrativa PostgreSQL ejecutada','auth','unknown','public_booking','unknown','edge','unknown','realtime','unknown','brevo','unknown','worker',(SELECT to_jsonb(w) FROM private.worker_health w),'budget',(SELECT to_jsonb(d) FROM public.mail_daily_budget d WHERE day=(now() AT TIME ZONE 'UTC')::date),'errors',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT code,count(*) count,max(created_at) latest FROM public.system_errors GROUP BY code ORDER BY max(created_at) DESC LIMIT 20)x),'[]'));
 ELSIF section='deletion_preview' THEN
  IF params->>'type'='business' THEN SELECT jsonb_build_object('id',b.id,'name',b.name,'owners',b.owners,'members',(SELECT count(*) FROM public.memberships WHERE business_id=b.id),'customers',(SELECT count(*) FROM public.customers WHERE business_id=b.id),'bookings',(SELECT count(*) FROM public.bookings WHERE business_id=b.id),'payments',(SELECT count(*) FROM public.subscription_events WHERE business_id=b.id),'execution_enabled',false,'reason','Requiere política de retención y validación de Auth y Storage') INTO data FROM private.control_businesses b WHERE id=params->>'id';
  ELSE SELECT jsonb_build_object('id',u.id,'name',u.name,'memberships',(SELECT count(*) FROM public.memberships WHERE user_id=u.id),'platform_admin',u.platform_admin,'execution_enabled',false) INTO data FROM public.users u WHERE id=params->>'id';END IF;
  RETURN jsonb_build_object('data',data,'checked_at',ts);
 ELSE RAISE EXCEPTION 'INVALID_SECTION';END IF;
 RETURN jsonb_build_object('rows',rows,'total',total,'limit',lim,'offset',off,'checked_at',ts);
END $function$
;
CREATE OR REPLACE FUNCTION private.control_read_delete_base(section text, params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE data jsonb;objects jsonb;schedule jsonb;
BEGIN
 PERFORM private.require_admin();data:=private.control_read_operations(section,params);
 IF section='storage' AND to_regclass('storage.objects') IS NOT NULL THEN
  EXECUTE 'SELECT jsonb_build_object(''objects'',count(*),''reported_bytes'',coalesce(sum(CASE WHEN metadata->>''size'' ~ ''^[0-9]{1,18}$'' THEN (metadata->>''size'')::bigint ELSE 0 END),0),''unknown_sizes'',count(*) FILTER(WHERE metadata->>''size'' IS NULL OR metadata->>''size'' !~ ''^[0-9]{1,18}$'')) FROM storage.objects' INTO objects;
  data:=data||jsonb_build_object('storage',objects,'storage_bytes',CASE WHEN (objects->>'unknown_sizes')::bigint=0 THEN objects->'reported_bytes' ELSE NULL END);
 ELSIF section='system' AND to_regclass('cron.job') IS NOT NULL THEN
  EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''name'',jobname,''schedule'',schedule,''active'',active)),''[]''::jsonb) FROM cron.job WHERE jobname=''atry-turnos-mail''' INTO schedule;
  data:=data||jsonb_build_object('mail_schedule',schedule);
 END IF;
 RETURN data;
END $function$
;
CREATE OR REPLACE FUNCTION private.control_read_operations(section text, params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE bid text:=params->>'business_id';d int;data jsonb;
BEGIN
 PERFORM private.require_admin();
 IF section='retention' THEN
  SELECT mail_terminal_days INTO d FROM private.control_settings WHERE id=1;
  RETURN jsonb_build_object('checked_at',now(),'policy_days',d,'revision',(SELECT revision FROM private.control_settings),'eligible',(SELECT count(*) FROM public.mail_jobs j WHERE j.state IN ('skipped','delivered','bounced') AND j.updated_at<now()-make_interval(days=>d) AND NOT EXISTS(SELECT 1 FROM private.mail_archives a WHERE a.job_id=j.id)),'estimated_payload_bytes',(SELECT coalesce(sum(octet_length(j.recipient)+octet_length(j.subject)+octet_length(j.content)),0) FROM public.mail_jobs j WHERE j.state IN ('skipped','delivered','bounced') AND j.updated_at<now()-make_interval(days=>d) AND NOT EXISTS(SELECT 1 FROM private.mail_archives a WHERE a.job_id=j.id)),'automatic',false);
 ELSIF section='users' THEN
  data:=private.control_read_base(section,params);RETURN data||jsonb_build_object('rows',(SELECT coalesce(jsonb_agg(x||jsonb_build_object('last_sign_in_at',(SELECT to_jsonb(a)->>'last_sign_in_at' FROM public.users u JOIN auth.users a ON a.id=u.auth_user_id WHERE u.id=x->>'id'))),'[]') FROM jsonb_array_elements(data->'rows') x));
 ELSIF section='diagnostic' THEN
  IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=bid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  RETURN jsonb_build_object('checked_at',now(),'business',(SELECT to_jsonb(b) FROM private.control_businesses b WHERE id=bid),'subscription_live',private.subscription_live(bid),'active_services',(SELECT count(*) FROM public.services WHERE business_id=bid AND active=1),'active_staff',(SELECT count(*) FROM public.staff WHERE business_id=bid AND active=1),'working_hour_rules',(SELECT count(*) FROM public.working_hours h JOIN public.staff st ON st.id=h.staff_id WHERE st.business_id=bid),'future_time_off',(SELECT count(*) FROM public.time_off WHERE business_id=bid AND ends_at>now()),'mail_states',(SELECT coalesce(jsonb_object_agg(state,n),'{}') FROM (SELECT state,count(*) n FROM public.mail_jobs WHERE business_id=bid GROUP BY state)x),'private_customer_content',false);
 ELSE RETURN private.control_read_base(section,params);END IF;
END $function$
;
CREATE OR REPLACE FUNCTION private.control_save_business_base(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE uid text:=private.require_admin();b public.businesses;before_data jsonb;act text:=coalesce(payload->>'subscription_action','adjust');key text:=coalesce(payload->>'request_id',gen_random_uuid()::text);digest text:=private.hash((payload-'request_id')::text);previous public.subscription_events;until_time timestamptz;amt integer:=coalesce((payload->>'amount_uyu')::int,0);ref text:=btrim(coalesce(payload->>'reference',''));memo text:=btrim(coalesce(payload->>'note',''));
BEGIN
 SELECT * INTO b FROM public.businesses WHERE id=bid FOR UPDATE;IF b.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF act NOT IN ('adjust','activate','renew','trial','suspend','restore','cancel') OR key!~'^[A-Za-z0-9_-]{16,100}$' OR amt<0 OR amt>10000000 OR length(ref)>160 OR length(memo)>500 THEN RAISE EXCEPTION 'INVALID_SUBSCRIPTION';END IF;
 SELECT * INTO previous FROM public.subscription_events e WHERE e.business_id=bid AND e.request_key=key;
 IF FOUND THEN IF previous.request_hash<>digest THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';END IF;RETURN jsonb_build_object('ok',true,'event_id',previous.id);END IF;
 before_data:=jsonb_build_object('plan',b.plan,'status',b.subscription_status,'paid_until',b.paid_until,'trial_until',b.trial_until,'is_active',b.is_active);
 IF act='cancel' THEN
  -- ORDINARY_CANCELLATION_AT_PERIOD_END_V1: audit only; never revoke paid access.
  IF (payload - ARRAY['subscription_action','request_id','note','amount_uyu']) <> '{}'::jsonb OR amt<>0 THEN RAISE EXCEPTION 'INVALID_SUBSCRIPTION';END IF;
  INSERT INTO public.subscription_events(business_id,actor_id,action,request_key,request_hash,before_state,after_state,amount_uyu,reference,note)
  VALUES(bid,uid,act,key,digest,before_data,before_data||jsonb_build_object('cancel_at_period_end',true),0,'',memo) RETURNING * INTO previous;
  INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'subscription.cancel',bid,now());
  RETURN jsonb_build_object('ok',true,'event_id',previous.id,'cancel_at_period_end',true,'access_until',CASE WHEN b.subscription_status='trialing' THEN b.trial_until ELSE b.paid_until END);
 END IF;
 IF payload?'plan' THEN IF coalesce(payload->>'plan','') NOT IN ('trial','individual','negocio','pro') THEN RAISE EXCEPTION 'INVALID_PLAN';END IF;b.plan:=payload->>'plan';END IF;
 IF act IN ('activate','renew','trial') THEN
  IF coalesce(payload->>'until_day','')!~'^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
  until_time:=((payload->>'until_day')::date+1)::timestamp AT TIME ZONE 'America/Montevideo';
  IF until_time<=now() OR until_time>now()+interval '5 years' THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
  IF act IN ('activate','renew') THEN
   IF b.plan='trial' OR (ref='' AND memo='') OR (amt>0 AND ref='') THEN RAISE EXCEPTION 'PAYMENT_REFERENCE_REQUIRED';END IF;
   IF act='renew' AND until_time<=greatest(coalesce(b.paid_until,now()),now()) THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
   IF act='activate' AND b.paid_until>until_time THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
   IF ref<>'' AND EXISTS(SELECT 1 FROM public.subscription_events e WHERE e.business_id=bid AND e.action IN ('activate','renew') AND lower(btrim(e.reference))=lower(ref)) THEN RAISE EXCEPTION 'DUPLICATE_TRANSFER';END IF;
   b.subscription_status:='active';b.paid_until:=until_time;
  ELSE b.subscription_status:='trialing';b.plan:='trial';b.trial_until:=until_time;b.paid_until:=NULL;
  END IF;b.is_active:=1;
 ELSIF act='cancel' THEN NULL; -- handled before subscription mutation
 ELSIF act='suspend' THEN b.subscription_status:='suspended';
 ELSIF act='restore' THEN
  IF b.paid_until>now() THEN b.subscription_status:='active';ELSIF b.trial_until>now() THEN b.subscription_status:='trialing';ELSE RAISE EXCEPTION 'INVALID_PERIOD';END IF;b.is_active:=1;
 ELSE
  IF payload?'subscription_status' THEN IF coalesce(payload->>'subscription_status','') NOT IN ('pending','trialing','active','past_due','suspended','cancelled') THEN RAISE EXCEPTION 'INVALID_SUBSCRIPTION';END IF;b.subscription_status:=payload->>'subscription_status';END IF;
  IF payload?'is_active' THEN IF coalesce(payload->>'is_active','') NOT IN ('0','1') THEN RAISE EXCEPTION 'INVALID_STATUS';END IF;b.is_active:=(payload->>'is_active')::int;END IF;
  IF b.subscription_status='active' AND coalesce(b.paid_until,now())<=now() THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
 END IF;
 IF payload?'starts_day' AND ((payload->>'starts_day')::date>now()::date+1825 OR (payload->>'starts_day')::date>=coalesce(b.paid_until,b.trial_until)::date) THEN RAISE EXCEPTION 'INVALID_START';END IF;
 PERFORM private.resolve_downgrade(bid,b.plan,payload);
 UPDATE public.businesses SET subscription_started_at=CASE WHEN payload?'starts_day' AND act<>'renew' THEN (payload->>'starts_day')::date::timestamp AT TIME ZONE 'America/Montevideo' WHEN act IN ('activate','trial') THEN coalesce(subscription_started_at,now()) ELSE subscription_started_at END WHERE id=bid;
 UPDATE public.businesses SET plan=b.plan,subscription_status=b.subscription_status,paid_until=b.paid_until,trial_until=b.trial_until,is_active=b.is_active WHERE id=bid;
 INSERT INTO public.subscription_events(business_id,actor_id,action,request_key,request_hash,before_state,after_state,amount_uyu,reference,note) VALUES(bid,uid,act,key,digest,before_data,jsonb_build_object('plan',b.plan,'status',b.subscription_status,'paid_until',b.paid_until,'trial_until',b.trial_until,'is_active',b.is_active,'starts_day',payload->>'starts_day'),amt,ref,memo) RETURNING * INTO previous;
 IF act IN ('activate','renew') AND payload?'plan_request_id' THEN
 UPDATE public.plan_requests SET state='active',payment_state=CASE WHEN ref<>'' THEN 'verified' ELSE 'waived' END,updated_at=now() WHERE id=payload->>'plan_request_id' AND business_id=bid AND plan=b.plan AND state IN ('pending_contact','pending_payment','pending_verification');IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_CHANGED';END IF;
 INSERT INTO public.plan_request_events(request_id,actor_id,state) VALUES(payload->>'plan_request_id',uid,'active');END IF;
 INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'subscription.'||act,bid,now());
 RETURN jsonb_build_object('ok',true,'event_id',previous.id);
END $function$
;
CREATE OR REPLACE FUNCTION private.control_save_commercial_base(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid text:=private.require_admin();s private.commercial_settings;
BEGIN
 SELECT * INTO s FROM private.commercial_settings WHERE id=1 FOR UPDATE;
 UPDATE private.commercial_settings SET whatsapp=coalesce(payload->>'whatsapp',s.whatsapp),tax_status=coalesce(payload->>'tax_status',s.tax_status),provider_daily_limit=coalesce((payload->>'provider_daily_limit')::int,s.provider_daily_limit),security_reserve=coalesce((payload->>'security_reserve')::int,s.security_reserve),revision=revision+1 WHERE id=1;
 INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'commercial.updated','settings',now());RETURN jsonb_build_object('ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION private.control_save_plan_base(code text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE uid text:=private.require_admin();p public.plans;f jsonb;k text;newlim int;
BEGIN
 SELECT * INTO p FROM public.plans WHERE plans.code=control_save_plan_base.code FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 f:=p.features||coalesce(payload->'features','{}');FOR k IN SELECT jsonb_object_keys(f) LOOP IF NOT(p.features?k) OR jsonb_typeof(f->k)<>'boolean' THEN RAISE EXCEPTION 'INVALID_FEATURE';END IF;END LOOP;
 FOREACH k IN ARRAY ARRAY['smartslots','resources','reports'] LOOP IF payload?k THEN IF payload->>k NOT IN ('0','1') THEN RAISE EXCEPTION 'INVALID_FEATURE';END IF;f:=jsonb_set(f,ARRAY[CASE WHEN k='reports' THEN 'advanced' ELSE k END],to_jsonb((payload->>k)::int=1));END IF;END LOOP;
 IF payload?'reports' THEN f:=f||jsonb_build_object('exports',(payload->>'reports')::int=1,'statistics',(payload->>'reports')::int=1);END IF;
 newlim:=coalesce((payload->>'staff_limit')::int,p.staff_limit);
 IF newlim NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM public.staff s JOIN public.businesses b ON b.id=s.business_id WHERE b.plan=code AND s.active=1 GROUP BY s.business_id HAVING count(*)>newlim) THEN RAISE EXCEPTION 'STAFF_LIMIT';END IF;
 UPDATE public.plans SET staff_limit=newlim,price_uyu=coalesce((payload->>'price_uyu')::int,p.price_uyu),mail_limit=coalesce((payload->>'mail_limit')::int,p.mail_limit),features=f,smartslots=(f->>'smartslots')::boolean::int,resources=(f->>'resources')::boolean::int,reports=((f->>'advanced')::boolean OR (f->>'exports')::boolean)::int WHERE plans.code=control_save_plan_base.code;
 UPDATE private.commercial_settings SET revision=revision+1 WHERE id=1;UPDATE public.calendar_revisions SET revision=revision+1,updated_at=now() WHERE business_id IN(SELECT id FROM public.businesses WHERE plan=code);
 INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'plan.updated',code,now());RETURN jsonb_build_object('ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION private.control_status(b businesses)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT CASE WHEN b.subscription_status='cancelled' THEN 'cancelled' WHEN b.is_active=0 OR b.subscription_status='suspended' THEN 'suspended' WHEN b.subscription_status='pending' THEN 'pending' WHEN b.subscription_started_at>now() THEN 'scheduled' WHEN private.subscription_live(b.id) THEN 'active' ELSE 'expired' END
$function$
;
CREATE OR REPLACE FUNCTION private.control_stepup()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM private.require_admin();
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(auth.jwt()->'amr','[]')) a WHERE a->>'method' IN ('password','totp','otp','webauthn') AND (a->>'timestamp')::numeric>extract(epoch FROM now())-600) THEN RAISE EXCEPTION 'RECENT_AUTH_REQUIRED' USING ERRCODE='42501';END IF;
END $function$
;
CREATE OR REPLACE FUNCTION private.create_booking(bid text, payload jsonb, source text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 IF (SELECT count(*) FROM public.customers c WHERE c.business_id=bid AND ((email<>'' AND lower(c.email)=email) OR (regexp_replace(phone,'[^0-9]','','g')<>'' AND regexp_replace(c.phone,'[^0-9]','','g')=regexp_replace(phone,'[^0-9]','','g'))))>1 THEN RAISE EXCEPTION 'CONTACT_CONFLICT';END IF;
 IF source='manual' AND nullif(payload->>'customer_id','') IS NOT NULL THEN
  SELECT c.id INTO cid FROM public.customers c WHERE c.business_id=bid AND c.id=payload->>'customer_id' AND lower(c.email)=email AND regexp_replace(c.phone,'[^0-9]','','g')=regexp_replace(phone,'[^0-9]','','g');
  IF cid IS NULL THEN RAISE EXCEPTION 'CONTACT_CHANGED';END IF;
 ELSE
  SELECT c.id INTO cid FROM public.customers c WHERE c.business_id=bid AND ((email<>'' AND lower(c.email)=email) OR (regexp_replace(phone,'[^0-9]','','g')<>'' AND regexp_replace(c.phone,'[^0-9]','','g')=regexp_replace(phone,'[^0-9]','','g'))) ORDER BY c.created_at LIMIT 1;
 END IF;
 IF cid IS NULL THEN cid:=gen_random_uuid()::text;INSERT INTO public.customers(id,business_id,name,email,phone,created_at) VALUES(cid,bid,name,email,phone,now());END IF;
 INSERT INTO public.bookings(id,business_id,staff_id,service_id,customer_id,starts_at,ends_at,blocked_from,blocked_until,status,source,notes,payment_status,price_uyu,manage_token_hash,created_at,updated_at,customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot)
 VALUES(booking_id,bid,sid,vid,cid,starts,(slot->>'ends_at')::timestamptz,(slot->>'blocked_from')::timestamptz,(slot->>'blocked_until')::timestamptz,slot->>'status',source,left(coalesce(payload->>'notes',''),500),'not_required',(slot->>'price')::int,private.hash(token),now(),now(),name,email,phone);
 INSERT INTO public.booking_resources SELECT booking_id,resource_id FROM public.service_resources WHERE service_id=vid;
 INSERT INTO private.booking_tokens VALUES(booking_id,token);
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'booking.created','booking',booking_id,now());
 INSERT INTO public.notifications(id,business_id,booking_id,kind,recipient,subject,content,created_at) VALUES(gen_random_uuid()::text,bid,booking_id,slot->>'status',email,'Atry Turnos — reserva','Reserva registrada. Gestioná tu turno en /#/gestionar/'||token,now());
 result:=jsonb_build_object('id',booking_id,'status',slot->>'status','manage_token',token,'starts_at',starts);
 INSERT INTO public.idempotency_keys VALUES(scope,private.hash(key),request_hash,result::text,now());RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION private.dashboard_before_recurring(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION private.enqueue_mail(dedupe text, bid text, source text, source_id text, kind text, recipient text, subject text, content text, scheduled timestamp with time zone DEFAULT now())
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 INSERT INTO public.mail_jobs(id,dedupe_key,business_id,source,source_id,kind,recipient,subject,content,next_attempt_at,created_at,updated_at,booking_snapshot)
 SELECT gen_random_uuid()::text,dedupe,bid,source,source_id,kind,recipient,subject,content,scheduled,now(),now(),
  (SELECT jsonb_build_object('status',b.status,'starts_at',b.starts_at,'staff_id',b.staff_id)||coalesce((SELECT jsonb_build_object('visit_fingerprint',private.visit_fingerprint(i.visit_id)) FROM public.booking_visit_items i WHERE i.booking_id=b.id),'{}'::jsonb) FROM public.notifications n JOIN public.bookings b ON b.id=n.booking_id WHERE n.id=enqueue_mail.source_id AND b.business_id=bid AND enqueue_mail.source IN ('notification','business_alert'))
 ON CONFLICT(dedupe_key) DO NOTHING
$function$
;
CREATE OR REPLACE FUNCTION private.expand_recurring(bid text, first_day date, days integer, strict boolean DEFAULT false, only_id text DEFAULT ''::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE r public.recurring_appointments;d date;i int;starts timestamptz;slot jsonb;cid text;booking_id text;token text;problem text;
BEGIN IF NOT private.has_feature(bid,'recurring') THEN RETURN false;END IF;
 IF NOT private.subscription_live(bid) THEN RETURN false;END IF;
 IF days<1 OR days>42 OR first_day IS NULL THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 FOR r IN SELECT * FROM public.recurring_appointments WHERE business_id=bid AND active=1 AND (only_id='' OR id=only_id) ORDER BY id LOOP
  problem:='';
  FOR i IN 0..days-1 LOOP
   d:=first_day+i;
   IF NOT private.recurring_applies(r,d) OR EXISTS(SELECT 1 FROM public.bookings WHERE recurring_id=r.id AND occurrence_day=d) THEN CONTINUE;END IF;
   BEGIN
 IF NOT private.subscription_live(bid) THEN RETURN false;END IF;
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
END $function$
;
CREATE OR REPLACE FUNCTION private.guard_catalog_future()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_TABLE_NAME='staff' THEN
  IF OLD.active=1 AND NEW.active=0 AND EXISTS(SELECT 1 FROM public.bookings WHERE staff_id=NEW.id AND ends_at>now() AND status IN ('confirmed','pending')) THEN RAISE EXCEPTION 'FUTURE_BOOKINGS';END IF;
 ELSE
  IF (OLD.duration_min IS DISTINCT FROM NEW.duration_min OR OLD.buffer_before_min IS DISTINCT FROM NEW.buffer_before_min OR OLD.buffer_after_min IS DISTINCT FROM NEW.buffer_after_min OR (OLD.active=1 AND NEW.active=0)) AND EXISTS(SELECT 1 FROM public.bookings WHERE service_id=NEW.id AND ends_at>now() AND status IN ('confirmed','pending')) THEN RAISE EXCEPTION 'FUTURE_BOOKINGS';END IF;
 END IF;RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION private.guard_commercial_module()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE data jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;bid text;feature text:=TG_ARGV[0];
BEGIN
 bid:=data->>'business_id';IF bid IS NULL THEN SELECT business_id INTO bid FROM public.services WHERE id=data->>'service_id';END IF;
 IF TG_TABLE_NAME='recurring_appointments' AND TG_OP='UPDATE' AND data->>'end_day' IS NOT NULL AND (to_jsonb(OLD)->>'end_day' IS NULL OR data->>'end_day'<=to_jsonb(OLD)->>'end_day') AND (to_jsonb(NEW)-'end_day'-'active'-'updated_at')=(to_jsonb(OLD)-'end_day'-'active'-'updated_at') AND (data->>'active')::int<=(to_jsonb(OLD)->>'active')::int THEN RETURN NEW;END IF;
 IF TG_OP='DELETE' AND private.business_purge_allowed(bid) THEN RETURN OLD;END IF; PERFORM private.require_feature(bid,feature);IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $function$
;
CREATE OR REPLACE FUNCTION private.guard_future_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.staff_services WHERE staff_id=OLD.staff_id AND service_id=OLD.service_id) AND EXISTS(SELECT 1 FROM public.bookings WHERE staff_id=OLD.staff_id AND service_id=OLD.service_id AND ends_at>now() AND status IN ('confirmed','pending')) THEN RAISE EXCEPTION 'FUTURE_BOOKINGS';END IF;RETURN OLD;
END $function$
;
CREATE OR REPLACE FUNCTION private.guard_staff_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE lim int;
BEGIN
 IF NEW.active=1 AND (TG_OP='INSERT' OR OLD.active=0) THEN
  PERFORM 1 FROM public.businesses WHERE id=NEW.business_id FOR UPDATE;SELECT p.staff_limit INTO lim FROM public.plans p JOIN public.businesses b ON b.plan=p.code WHERE b.id=NEW.business_id;
  IF (SELECT count(*) FROM public.staff WHERE business_id=NEW.business_id AND active=1 AND id<>NEW.id)>=lim THEN RAISE EXCEPTION 'STAFF_LIMIT' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION private.guard_subscription_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE data jsonb;bid text;
BEGIN
 data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 bid:=data->>'business_id';
 IF bid IS NULL AND data?'staff_id' THEN SELECT business_id INTO bid FROM public.staff WHERE id=data->>'staff_id';END IF;
 IF bid IS NULL AND data?'service_id' THEN SELECT business_id INTO bid FROM public.services WHERE id=data->>'service_id';END IF;
 IF TG_OP='DELETE' AND private.business_purge_allowed(bid) THEN RETURN OLD;END IF; IF NOT private.subscription_live(bid) THEN
  IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('bookings','waitlist') AND data->>'status'='cancelled' AND (to_jsonb(NEW)-'status'-'updated_at')=(to_jsonb(OLD)-'status'-'updated_at') THEN RETURN NEW;END IF;
  IF TG_OP='UPDATE' AND TG_TABLE_NAME='waitlist' AND data->>'status'='cancelled' AND data->>'offer_token_hash' IS NULL AND data->>'offer_expires_at' IS NULL AND (to_jsonb(NEW)-'status'-'updated_at'-'offer_token_hash'-'offer_expires_at')=(to_jsonb(OLD)-'status'-'updated_at'-'offer_token_hash'-'offer_expires_at') THEN RETURN NEW;END IF;
  IF TG_OP='UPDATE' AND TG_TABLE_NAME='invitations' AND data->>'revoked_at' IS NOT NULL AND (to_jsonb(NEW)-'revoked_at')=(to_jsonb(OLD)-'revoked_at') THEN RETURN NEW;END IF;
  IF TG_OP='UPDATE' AND TG_TABLE_NAME='recurring_appointments' AND data->>'end_day' IS NOT NULL AND (to_jsonb(OLD)->>'end_day' IS NULL OR (data->>'end_day')::date<=(to_jsonb(OLD)->>'end_day')::date) AND (data->>'active')::int<=(to_jsonb(OLD)->>'active')::int AND (to_jsonb(NEW)-'end_day'-'active'-'updated_at')=(to_jsonb(OLD)-'end_day'-'active'-'updated_at') THEN RETURN NEW;END IF;
  RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $function$
;
CREATE OR REPLACE FUNCTION private.guard_transfer_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NEW.action IN ('activate','renew') AND btrim(NEW.reference)<>'' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('transfer:'||lower(btrim(NEW.reference)),0));
  IF EXISTS(SELECT 1 FROM public.subscription_events WHERE action IN ('activate','renew') AND lower(btrim(reference))=lower(btrim(NEW.reference))) THEN RAISE EXCEPTION 'DUPLICATE_TRANSFER';END IF;
 END IF;RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION private.has_feature(bid text, feature text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT coalesce((p.features->>feature)::boolean,false) AND b.subscription_status<>'pending' FROM public.businesses b JOIN public.plans p ON p.code=b.plan WHERE b.id=bid
$function$
;
CREATE OR REPLACE FUNCTION private.hash(value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ SELECT encode(sha256(convert_to(value,'UTF8')),'hex') $function$
;
CREATE OR REPLACE FUNCTION private.ingest_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE b public.bookings;biz public.businesses;customer text;service text;offer_id text;body text;
BEGIN
 IF NEW.kind='waitlist_offer' THEN
  offer_id:=NEW.content::jsonb->>'waitlist_id';
  body:='Hay un horario disponible. La oferta vence en 30 minutos y no retiene el turno. Revisá y confirmá en /#/oferta/'||(NEW.content::jsonb->>'token');
  PERFORM private.enqueue_mail('notification:'||NEW.id,NEW.business_id,'waitlist_offer',offer_id,NEW.kind,NEW.recipient,NEW.subject,body);
 ELSE
  IF NEW.recipient<>'' THEN PERFORM private.enqueue_mail('notification:'||NEW.id,NEW.business_id,'notification',NEW.id,NEW.kind,NEW.recipient,NEW.subject,NEW.content);
  ELSE UPDATE public.notifications SET state='internal_only' WHERE id=NEW.id;END IF;
  IF NEW.kind IN ('confirmed','pending','cancelled','reprogramado','no_show') AND coalesce((SELECT business_alerts FROM public.notification_preferences WHERE business_id=NEW.business_id),1)=1 THEN
   SELECT * INTO b FROM public.bookings WHERE id=NEW.booking_id;SELECT * INTO biz FROM public.businesses WHERE id=NEW.business_id;
   SELECT coalesce(b.customer_name_snapshot,name) INTO customer FROM public.customers WHERE id=b.customer_id;SELECT name INTO service FROM public.services WHERE id=b.service_id;
   IF biz.email<>'' THEN PERFORM private.enqueue_mail('business-alert:'||NEW.id,NEW.business_id,'business_alert',NEW.id,'business_alert',biz.email,'Actualización de agenda · '||biz.name,NEW.subject||': '||customer||', '||service||', '||to_char(b.starts_at AT TIME ZONE biz.timezone,'DD/MM/YYYY HH24:MI')||'. Revisá el panel en /#/app/agenda.');END IF;
  END IF;
 END IF;RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION private.link_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_TABLE_NAME='staff_services' THEN
  IF NOT EXISTS(SELECT 1 FROM public.staff st JOIN public.services s ON s.business_id=st.business_id WHERE st.id=NEW.staff_id AND s.id=NEW.service_id) THEN RAISE EXCEPTION 'TENANT_MISMATCH';END IF;
 ELSIF TG_TABLE_NAME='service_resources' THEN
  IF NOT EXISTS(SELECT 1 FROM public.services s JOIN public.resources r ON r.business_id=s.business_id WHERE s.id=NEW.service_id AND r.id=NEW.resource_id) THEN RAISE EXCEPTION 'TENANT_MISMATCH';END IF;
 ELSE RAISE EXCEPTION 'INVALID_LINK_TABLE';END IF;
 RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION private.mail_ingest_before_recurring()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE b record;p public.notification_preferences;i record;scheduled timestamptz;
BEGIN
 UPDATE public.waitlist SET status='waiting',offer_token_hash=null,offer_expires_at=null WHERE status='offered' AND offer_expires_at<=now();
 FOR i IN SELECT inv.*,t.token FROM public.invitations inv JOIN private.invitation_tokens t ON t.invitation_id=inv.id WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() AND NOT EXISTS(SELECT 1 FROM public.mail_jobs WHERE dedupe_key='invitation:'||inv.id) ORDER BY inv.created_at LIMIT 100 LOOP
  PERFORM private.enqueue_mail('invitation:'||i.id,i.business_id,'invitation',i.id,'invitation',i.email,'Invitación a tu equipo','Te invitaron a un negocio. Aceptá en /#/invitacion/'||i.token||'. El enlace vence en 48 horas.');
 END LOOP;
 FOR b IN SELECT book.*,coalesce(book.customer_email_snapshot,c.email) email,coalesce(book.customer_name_snapshot,c.name) customer_name,coalesce((SELECT string_agg(vs.name,' + ' ORDER BY all_items.position) FROM public.booking_visit_items vi JOIN public.booking_visit_items all_items ON all_items.visit_id=vi.visit_id JOIN public.bookings all_books ON all_books.id=all_items.booking_id JOIN public.services vs ON vs.id=all_books.service_id WHERE vi.booking_id=book.id),s.name) service_name,t.token FROM public.bookings book JOIN public.customers c ON c.id=book.customer_id JOIN public.services s ON s.id=book.service_id LEFT JOIN private.booking_tokens t ON t.booking_id=book.id WHERE NOT EXISTS(SELECT 1 FROM public.booking_visit_items vi WHERE vi.booking_id=book.id AND vi.position>0) AND book.status IN ('confirmed','pending') AND book.starts_at>now() AND coalesce(book.customer_email_snapshot,c.email)<>'' AND NOT EXISTS(SELECT 1 FROM public.mail_jobs WHERE dedupe_key='reminder:'||book.id||':'||book.starts_at::text) ORDER BY book.starts_at LIMIT 100 LOOP
  SELECT * INTO p FROM public.notification_preferences WHERE business_id=b.business_id;
  IF coalesce(p.reminders,1)=1 THEN
   scheduled:=greatest(now(),b.starts_at-make_interval(hours=>coalesce(p.reminder_hours,24)));
   PERFORM private.enqueue_mail('reminder:'||b.id||':'||b.starts_at::text,b.business_id,'reminder',b.id,'reminder',b.email,'Recordatorio de tu turno','Hola '||b.customer_name||'. Recordá tu turno de '||b.service_name||'.'||CASE WHEN b.token IS NOT NULL THEN ' Gestioná tu reserva en /#/gestionar/'||b.token ELSE '' END,scheduled);
  END IF;
 END LOOP;RETURN true;
END $function$
;
CREATE OR REPLACE FUNCTION private.mail_is_valid(j mail_jobs)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE vid text;
BEGIN
 IF NOT private.mail_is_valid_single(j) THEN RETURN false;END IF;
 IF j.source IN('notification','business_alert') THEN
  SELECT i.visit_id INTO vid FROM public.notifications n JOIN public.booking_visit_items i ON i.booking_id=n.booking_id WHERE n.id=j.source_id;
  IF vid IS NOT NULL AND j.booking_snapshot->>'visit_fingerprint' IS DISTINCT FROM private.visit_fingerprint(vid) THEN RETURN false;END IF;
 ELSIF j.kind='reminder' THEN
  SELECT visit_id INTO vid FROM public.booking_visit_items WHERE booking_id=j.source_id;
  IF vid IS NOT NULL AND EXISTS(SELECT 1 FROM public.booking_visit_items i JOIN public.bookings b ON b.id=i.booking_id WHERE i.visit_id=vid AND b.status NOT IN('pending','confirmed')) THEN RETURN false;END IF;
 END IF;
 RETURN true;
END $function$
;
CREATE OR REPLACE FUNCTION private.mail_is_valid_single(j mail_jobs)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p public.notification_preferences;b public.bookings;pref text;
BEGIN IF j.business_id IS NOT NULL AND j.kind NOT IN ('invitation','password_reset','auth','security') AND (NOT private.has_feature(j.business_id,'operational_mail') OR NOT private.subscription_live(j.business_id)) THEN RETURN false;END IF;
 SELECT * INTO p FROM public.notification_preferences WHERE business_id=j.business_id;
 pref:=CASE j.kind WHEN 'confirmed' THEN 'confirmations' WHEN 'pending' THEN 'confirmations' WHEN 'cancelled' THEN 'cancellations' WHEN 'reprogramado' THEN 'reschedules' WHEN 'reminder' THEN 'reminders' WHEN 'business_alert' THEN 'business_alerts' WHEN 'waitlist_offer' THEN 'waitlist' END;
 IF coalesce((to_jsonb(p)->>pref)::integer,1)=0 THEN RETURN false;END IF;
 IF j.kind='invitation' THEN RETURN EXISTS(SELECT 1 FROM public.invitations WHERE id=j.source_id AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now());END IF;
 IF j.kind='waitlist_offer' THEN RETURN EXISTS(SELECT 1 FROM public.waitlist w JOIN private.offer_tokens t ON t.waitlist_id=w.id WHERE w.id=j.source_id AND w.status='offered' AND w.offer_expires_at>now() AND position('/#/oferta/'||t.token IN j.content)>0);END IF;
 IF j.kind='reminder' THEN SELECT * INTO b FROM public.bookings WHERE id=j.source_id;RETURN b.id IS NOT NULL AND b.status IN ('confirmed','pending') AND b.starts_at>now() AND j.dedupe_key='reminder:'||b.id||':'||b.starts_at::text;END IF;
 IF j.source IN ('notification','business_alert') THEN
  SELECT book.* INTO b FROM public.notifications n JOIN public.bookings book ON book.id=n.booking_id WHERE n.id=j.source_id AND book.business_id=j.business_id;
  RETURN b.id IS NOT NULL AND j.booking_snapshot IS NOT NULL AND (j.booking_snapshot-'visit_fingerprint')=jsonb_build_object('status',b.status,'starts_at',b.starts_at,'staff_id',b.staff_id);
 END IF;
 RETURN true;
END $function$
;
CREATE OR REPLACE FUNCTION private.mail_reserve(j mail_jobs)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c record;lim int;existing private.mail_reservations;
BEGIN
 IF j.business_id IS NULL OR j.kind IN ('invitation','password_reset','auth','security') THEN RETURN true;END IF;
 IF NOT private.has_feature(j.business_id,'operational_mail') OR NOT private.subscription_live(j.business_id) THEN RETURN false;END IF;
 SELECT * INTO existing FROM private.mail_reservations WHERE job_id=j.id;IF FOUND THEN RETURN existing.state='reserved';END IF;
 SELECT * INTO c FROM private.commercial_cycle(j.business_id);SELECT p.mail_limit INTO lim FROM public.plans p JOIN public.businesses b ON b.plan=p.code WHERE b.id=j.business_id;
 INSERT INTO public.business_mail_usage(business_id,cycle_start) VALUES(j.business_id,c.cycle_start) ON CONFLICT DO NOTHING;
 UPDATE public.business_mail_usage SET reserved=reserved+1 WHERE business_id=j.business_id AND cycle_start=c.cycle_start AND accepted+reserved<lim;
 IF NOT FOUND THEN RETURN false;END IF;
 INSERT INTO private.mail_reservations(job_id,business_id,cycle_start) VALUES(j.id,j.business_id,c.cycle_start);RETURN true;
END $function$
;
CREATE OR REPLACE FUNCTION private.mail_settle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r private.mail_reservations;
BEGIN
 IF NEW.state NOT IN ('provider_accepted','failed','skipped','retry','stored_local','smtp_accepted') THEN RETURN NEW;END IF;
 SELECT * INTO r FROM private.mail_reservations WHERE job_id=NEW.id AND state='reserved' FOR UPDATE;IF NOT FOUND THEN RETURN NEW;END IF;
 UPDATE public.business_mail_usage SET reserved=reserved-1,accepted=accepted+CASE WHEN NEW.state IN ('provider_accepted','stored_local','smtp_accepted') THEN 1 ELSE 0 END WHERE business_id=r.business_id AND cycle_start=r.cycle_start;
 IF NEW.state IN ('provider_accepted','stored_local','smtp_accepted') THEN UPDATE private.mail_reservations SET state='accepted' WHERE job_id=NEW.id;ELSE DELETE FROM private.mail_reservations WHERE job_id=NEW.id;END IF;RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION private.manage_change_single(token text, operation text, payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION private.manage_single(token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF token!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT jsonb_build_object('id',b.id,'business_id',b.business_id,'starts_at',b.starts_at,'ends_at',b.ends_at,'status',b.status,'price_uyu',b.price_uyu,'business_name',bu.name,'business_slug',bu.slug,'cancel_notice_hours',bu.cancel_notice_hours,'service_name',s.name,'staff_name',st.name,'customer_name',coalesce(b.customer_name_snapshot,c.name)) INTO result FROM public.bookings b JOIN public.businesses bu ON bu.id=b.business_id JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id JOIN public.customers c ON c.id=b.customer_id WHERE b.manage_token_hash=private.hash(token);
 IF result IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION private.member_role(bid text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT role FROM public.memberships WHERE user_id=private.user_id() AND business_id=bid
$function$
;
CREATE OR REPLACE FUNCTION private.new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE name text:=left(btrim(coalesce(NEW.raw_user_meta_data->>'name','Usuario')),100);
BEGIN
 IF length(name)<2 THEN name:='Usuario';END IF;
 INSERT INTO public.users(id,auth_user_id,name,email,created_at) VALUES(NEW.id::text,NEW.id,name,NEW.email,now());RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION private.offer_cancelled_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE w public.waitlist;b public.businesses;token text;slot jsonb;
BEGIN IF NOT private.has_feature(NEW.business_id,'auto_offers') THEN RETURN NEW;END IF;
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
END $function$
;
CREATE OR REPLACE FUNCTION private.own_staff(sid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.staff s WHERE s.id=sid AND s.user_id=private.user_id() AND s.active=1 AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.business_id=s.business_id AND m.user_id=s.user_id))
$function$
;
CREATE OR REPLACE FUNCTION private.project_theme(b businesses)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE result jsonb;rank int:=CASE b.plan WHEN 'pro' THEN 2 WHEN 'negocio' THEN 1 ELSE 0 END;
BEGIN
 result:=CASE WHEN b.theme_config='{}'::jsonb THEN jsonb_build_object('version',1,'primary',CASE WHEN b.primary_color='#1D806E' THEN '#4754E6' ELSE b.primary_color END,'secondary',b.secondary_color,'mode',b.appearance_mode) ELSE private.theme_defaults(b.plan)||b.theme_config END;
 result:=result-'presets';
 IF rank<2 THEN result:=result-ARRAY['background','surface','sidebar','presets']||jsonb_build_object('font','atry','cards','elevated','density','comfortable','buttons','solid','agenda','soft');END IF;
 IF rank=0 THEN
  IF result ? 'primary' AND result->>'primary' NOT IN('#4754E6','#2056A0','#187459') THEN result:=result||'{"primary":"#4754E6"}'::jsonb;END IF;
  result:=result||'{"secondary":"#00A5E2","radius":"soft","public_mode":"inherit","public_layout":"calm"}'::jsonb;
 END IF;
 RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION private.public_info_theme_base(slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE b public.businesses;
BEGIN
 SELECT * INTO b FROM public.businesses WHERE businesses.slug=public_info_theme_base.slug AND is_active=1;
 IF b.id IS NULL THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;
 RETURN jsonb_build_object('waitlist_enabled',private.has_feature(b.id,'waitlist'),'operational_mail',private.has_feature(b.id,'operational_mail'),'business',jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'sector',b.sector,'description',b.description,'city',b.city,'address',b.address,'phone',b.phone,'primary_color',b.primary_color,'secondary_color',b.secondary_color,'appearance_mode',b.appearance_mode,'logo_url',b.logo_url,'min_notice_min',b.min_notice_min,'max_days',b.max_days,'cancel_notice_hours',b.cancel_notice_hours),'services',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'duration_min',s.duration_min,'price_uyu',s.price_uyu,'deposit_percent',s.deposit_percent,'buffer_before_min',s.buffer_before_min,'buffer_after_min',s.buffer_after_min,'staff_ids',coalesce((SELECT jsonb_agg(st.id) FROM public.staff_services ss JOIN public.staff st ON st.id=ss.staff_id WHERE ss.service_id=s.id AND st.business_id=b.id AND st.active=1),'[]'::jsonb))) FROM public.services s WHERE s.business_id=b.id AND s.active=1),'[]'::jsonb),'staff',coalesce((SELECT jsonb_agg(jsonb_build_object('id',st.id,'name',st.name,'color',st.color,'service_ids',coalesce((SELECT jsonb_agg(service_id) FROM public.staff_services WHERE staff_id=st.id),'[]'::jsonb))) FROM public.staff st WHERE st.business_id=b.id AND st.active=1),'[]'::jsonb),'bookable',b.allow_guest=1 AND private.subscription_live(b.id) AND NOT EXISTS(SELECT 1 FROM private.business_controls c WHERE c.business_id=b.id AND c.reservation_scope IN ('public','all')));
END $function$
;
CREATE OR REPLACE FUNCTION private.receipt_after_acceptance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN IF NEW.provider_id IS NOT NULL AND NEW.state IN ('provider_accepted','delivery_unknown') AND (OLD.state IS DISTINCT FROM NEW.state OR OLD.provider_id IS DISTINCT FROM NEW.provider_id) THEN PERFORM private.apply_mail_receipts(NEW.provider_id);END IF;RETURN NEW;END $function$
;
CREATE OR REPLACE FUNCTION private.recurring_applies(r recurring_appointments, d date)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 SELECT r.active=1 AND d>=r.start_day AND (r.end_day IS NULL OR d<=r.end_day) AND (d-r.start_day)%(r.interval_weeks*7)=0
$function$
;
CREATE OR REPLACE FUNCTION private.refresh_blocks()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE b public.bookings;
BEGIN
 IF TG_TABLE_NAME='bookings' THEN b:=NEW; ELSE SELECT * INTO b FROM public.bookings WHERE id=coalesce(NEW.booking_id,OLD.booking_id) FOR UPDATE; END IF;
 DELETE FROM public.booking_blocks WHERE booking_id=b.id;
 IF b.status IN ('pending','confirmed') THEN
  INSERT INTO public.booking_blocks VALUES(b.id,b.business_id,'staff:'||b.staff_id,tstzrange(b.blocked_from,b.blocked_until,'[)'));
  INSERT INTO public.booking_blocks SELECT b.id,b.business_id,'resource:'||r.id,tstzrange(b.blocked_from,b.blocked_until,'[)') FROM public.booking_resources br JOIN public.resources r ON r.id=br.resource_id WHERE br.booking_id=b.id;
 END IF;
 RETURN coalesce(NEW,OLD);
END $function$
;
CREATE OR REPLACE FUNCTION private.require_admin()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid text:=private.user_id();
BEGIN IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=uid AND platform_admin=1) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;RETURN uid;END $function$
;
CREATE OR REPLACE FUNCTION private.require_feature(bid text, feature text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN IF NOT coalesce(private.has_feature(bid,feature),false) THEN RAISE EXCEPTION 'FEATURE_DISABLED' USING ERRCODE='42501';END IF;END $function$
;
CREATE OR REPLACE FUNCTION private.require_manager(bid text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN IF coalesce(private.member_role(bid),'') NOT IN ('owner','manager') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;END $function$
;
CREATE OR REPLACE FUNCTION private.resolve_downgrade(bid text, plan_code text, payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE lim int;total int;keep jsonb:=payload->'keep_staff_ids';
BEGIN
 SELECT staff_limit INTO lim FROM public.plans WHERE code=plan_code;
 SELECT count(*) INTO total FROM public.staff WHERE business_id=bid AND active=1;
 IF payload?'plan' AND total>lim THEN
  IF jsonb_typeof(keep) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'DOWNGRADE_STAFF_SELECTION_REQUIRED';END IF;
  IF jsonb_array_length(keep) NOT BETWEEN 1 AND lim OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(keep))<>jsonb_array_length(keep) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(keep) k WHERE NOT EXISTS(SELECT 1 FROM public.staff WHERE id=k.value AND business_id=bid AND active=1)) THEN RAISE EXCEPTION 'INVALID_STAFF_SELECTION';END IF;
  -- Existing bookings and recurrence rows are preserved. Future creation with inactive staff is rejected.
  IF EXISTS(SELECT 1 FROM public.bookings b JOIN public.staff st ON st.id=b.staff_id WHERE b.business_id=bid AND b.ends_at>now() AND b.status IN ('pending','confirmed') AND st.active=1 AND NOT(keep?st.id)) THEN RAISE EXCEPTION 'DOWNGRADE_FUTURE_BOOKINGS_REASSIGN_REQUIRED';END IF;
  UPDATE public.staff SET active=0 WHERE business_id=bid AND active=1 AND NOT(keep?staff.id);
 END IF;
END $function$
;
CREATE OR REPLACE FUNCTION private.resource_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.bookings b JOIN public.resources r ON r.business_id=b.business_id WHERE b.id=NEW.booking_id AND r.id=NEW.resource_id) THEN RAISE EXCEPTION 'resource tenant mismatch'; END IF;
 RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION private.save_business_theme_base(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE b public.businesses;patch jsonb;pair record;max_len integer;
BEGIN
 PERFORM private.require_manager(bid);IF NOT private.subscription_live(bid) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';END IF;SELECT * INTO b FROM public.businesses WHERE id=bid FOR UPDATE;
 IF jsonb_typeof(payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_REQUEST';END IF;
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO patch FROM jsonb_each(payload) WHERE key IN ('name','description','phone','email','address','city','sector','primary_color','logo_url','onboarding_completed','min_notice_min','max_days','cancel_notice_hours','slot_step_min','auto_confirm');
 FOR pair IN SELECT * FROM jsonb_each(patch) LOOP
  IF pair.key IN ('onboarding_completed','min_notice_min','max_days','cancel_notice_hours','slot_step_min','auto_confirm') THEN IF jsonb_typeof(pair.value)<>'number' THEN RAISE EXCEPTION 'INVALID_SETTING';END IF;
  ELSE
   max_len:=CASE pair.key WHEN 'description' THEN 800 WHEN 'phone' THEN 35 WHEN 'email' THEN 150 WHEN 'address' THEN 180 WHEN 'primary_color' THEN 30 WHEN 'logo_url' THEN 140000 ELSE 100 END;
   IF jsonb_typeof(pair.value)<>'string' OR length(pair.value#>>'{}')>max_len THEN RAISE EXCEPTION 'INVALID_SETTING';END IF;
  END IF;
 END LOOP;
 b:=jsonb_populate_record(b,patch);
 IF length(btrim(b.name))<2 OR b.primary_color!~'^#[0-9a-fA-F]{6}$' OR (b.logo_url<>'' AND b.logo_url!~'^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') THEN RAISE EXCEPTION 'INVALID_SETTING';END IF;
 IF b.onboarding_completed NOT IN (0,1) OR b.slot_step_min NOT IN (5,10,15,20,30,60) THEN RAISE EXCEPTION 'INVALID_SETTING';END IF;
 IF b.onboarding_completed=1 AND NOT EXISTS(SELECT 1 FROM public.services WHERE business_id=bid AND active=1) THEN RAISE EXCEPTION 'SERVICE_REQUIRED';END IF;
 UPDATE public.businesses SET name=b.name,description=b.description,phone=b.phone,email=b.email,address=b.address,city=b.city,sector=b.sector,primary_color=b.primary_color,logo_url=b.logo_url,onboarding_completed=b.onboarding_completed,min_notice_min=b.min_notice_min,max_days=b.max_days,cancel_notice_hours=b.cancel_notice_hours,slot_step_min=b.slot_step_min,auto_confirm=b.auto_confirm WHERE id=bid;
 PERFORM private.assert_future(bid);
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'business.updated','business',bid,now());RETURN public.atry_business(bid);
END $function$
;
CREATE OR REPLACE FUNCTION private.scheduled_minutes(bid text, sid text, day date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE lo int;hi int;exception public.schedule_exceptions;blocked int:=0;
BEGIN
 IF EXISTS(SELECT 1 FROM public.holidays WHERE business_id=bid AND holidays.day=to_char(scheduled_minutes.day,'YYYY-MM-DD')) THEN RETURN 0;END IF;
 SELECT * INTO exception FROM public.schedule_exceptions WHERE staff_id=sid AND schedule_exceptions.day=to_char(scheduled_minutes.day,'YYYY-MM-DD');
 IF exception.id IS NOT NULL THEN IF exception.closed=1 THEN RETURN 0;END IF;lo:=exception.start_min;hi:=exception.end_min;
 ELSE SELECT start_min,end_min INTO lo,hi FROM public.working_hours WHERE staff_id=sid AND weekday=extract(dow FROM day)::int;END IF;
 IF lo IS NULL OR hi IS NULL THEN RETURN 0;END IF;
 SELECT coalesce(sum(upper(r)-lower(r)),0) INTO blocked FROM unnest((SELECT range_agg(int4range(greatest(lo,start_min),least(hi,end_min),'[)')) FROM public.recurring_breaks WHERE staff_id=sid AND weekday=extract(dow FROM day)::int AND start_min<hi AND end_min>lo)) r;
 RETURN hi-lo-blocked;
END $function$
;
CREATE OR REPLACE FUNCTION private.subscription_live(bid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT coalesce((SELECT is_active=1 AND coalesce(subscription_started_at,created_at)<=now() AND ((subscription_status='trialing' AND trial_until>now()) OR (subscription_status='active' AND paid_until>now())) FROM public.businesses WHERE id=bid),false)
$function$
;
CREATE OR REPLACE FUNCTION private.sync_auth_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email_confirmed_at IS NOT NULL THEN UPDATE public.users SET email=NEW.email WHERE auth_user_id=NEW.id;END IF;
 RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION private.theme_defaults(plan text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('version',1,'primary','#4754E6','secondary','#00A5E2','mode','light','radius',CASE WHEN plan IN('negocio','pro') THEN 'round' ELSE 'soft' END,'font','atry','cards','elevated','density','comfortable','buttons','solid','agenda','soft','public_mode','inherit','public_layout','calm')
$function$
;
CREATE OR REPLACE FUNCTION private.touch_catalog_revision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 INSERT INTO public.calendar_revisions(business_id,revision,updated_at) VALUES(NEW.business_id,1,now()) ON CONFLICT(business_id) DO UPDATE SET revision=public.calendar_revisions.revision+1,updated_at=now();RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION private.update_booking(bid text, booking_id text, patch jsonb, source text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM public.booking_visit_items WHERE booking_visit_items.booking_id=update_booking.booking_id) AND (patch ? 'starts_at' OR patch ? 'staff_id' OR patch->>'status' IN('confirmed','cancelled')) THEN RAISE EXCEPTION 'VISIT_REQUIRED';END IF;
 RETURN private.update_booking_single(bid,booking_id,patch,source);
END $function$
;
CREATE OR REPLACE FUNCTION private.update_booking_single(bid text, booking_id text, patch jsonb, source text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION private.user_id()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT u.id FROM public.users u WHERE u.auth_user_id=auth.uid()
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=u.auth_user_id AND s.id::text=auth.jwt()->>'session_id' AND s.created_at>now()-interval '7 days' AND (s.not_after IS NULL OR s.not_after>now()))
 AND NOT EXISTS(SELECT 1 FROM private.user_controls c WHERE c.user_id=u.id AND c.blocked)
$function$
;
CREATE OR REPLACE FUNCTION private.validate_theme(config jsonb, plan text, stored boolean DEFAULT false, nested boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE pair record;p jsonb;result jsonb:='{"version":1}';enums jsonb:='{"mode":["light","dark"],"radius":["soft","round","straight"],"font":["atry","system"],"cards":["elevated","outlined","flat"],"density":["comfortable","compact"],"buttons":["solid","outline"],"agenda":["soft","contrast"],"public_mode":["inherit","light","dark"],"public_layout":["calm","editorial"]}';rank int:=CASE plan WHEN 'pro' THEN 2 WHEN 'negocio' THEN 1 ELSE 0 END;value text;items jsonb:='[]';def jsonb:=private.theme_defaults(plan);
BEGIN
 IF jsonb_typeof(config) IS DISTINCT FROM 'object' OR octet_length(config::text)>20000 THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
 FOR pair IN SELECT * FROM jsonb_each(config) LOOP
  value:=pair.value#>>'{}';
  IF pair.key='version' THEN IF pair.value IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
  ELSIF pair.key IN('primary','secondary','background','surface','sidebar') THEN
   IF jsonb_typeof(pair.value)<>'string' OR value!~'^#[a-fA-F0-9]{6}$' THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
   result:=result||jsonb_build_object(pair.key,upper(value));
  ELSIF enums ? pair.key THEN
   IF jsonb_typeof(pair.value)<>'string' OR NOT (enums->pair.key ? value) THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
   result:=result||jsonb_build_object(pair.key,value);
  ELSIF pair.key='presets' THEN
   IF nested OR jsonb_typeof(pair.value)<>'array' THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
   IF jsonb_array_length(pair.value)>6 THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
   FOR p IN SELECT * FROM jsonb_array_elements(pair.value) LOOP
    IF jsonb_typeof(p)<>'object' OR jsonb_typeof(p->'name') IS DISTINCT FROM 'string' OR length(btrim(p->>'name')) NOT BETWEEN 2 AND 40 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN('name','config')) THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
    items:=items||jsonb_build_array(jsonb_build_object('name',btrim(p->>'name'),'config',private.validate_theme(p->'config','pro',true,true)));
   END LOOP;
   result:=result||jsonb_build_object('presets',items);
  ELSE RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
 END LOOP;
 IF NOT stored THEN
  IF rank=0 AND ((result ? 'primary' AND result->>'primary' NOT IN('#4754E6','#2056A0','#187459')) OR (result ? 'secondary' AND result->>'secondary'<>'#00A5E2')) THEN RAISE EXCEPTION 'APPEARANCE_PLAN_REQUIRED' USING ERRCODE='42501';END IF;
  FOR pair IN SELECT * FROM jsonb_each(result) LOOP
   IF rank<2 AND pair.key IN('background','surface','sidebar','font','cards','density','buttons','agenda','presets') AND
    (CASE WHEN pair.key='presets' THEN pair.value<>'[]'::jsonb ELSE pair.value IS DISTINCT FROM def->pair.key END) THEN RAISE EXCEPTION 'APPEARANCE_PLAN_REQUIRED' USING ERRCODE='42501';END IF;
   IF rank=0 AND pair.key IN('radius','public_mode','public_layout') AND pair.value IS DISTINCT FROM def->pair.key THEN RAISE EXCEPTION 'APPEARANCE_PLAN_REQUIRED' USING ERRCODE='42501';END IF;
  END LOOP;
 END IF;
 RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION private.validate_visit(bid text, payload jsonb, ignore_ids text[], owner boolean, ignore_enabled boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE ids text[];item jsonb;checked jsonb;legs jsonb:='[]';idx int:=0;previous_end timestamptz;day text;
BEGIN
 IF jsonb_typeof(payload->'legs') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_VISIT';END IF;
 ids:=ARRAY(SELECT e->>'service_id' FROM jsonb_array_elements(payload->'legs') e);PERFORM private.visit_services(bid,ids,owner,ignore_enabled);
 FOR item IN SELECT * FROM jsonb_array_elements(payload->'legs') LOOP
  idx:=idx+1;checked:=private.visit_leg(bid,item->>'staff_id',item->>'service_id',(item->>'starts_at')::timestamptz,idx>1,ignore_ids,owner);
  IF idx=1 THEN day:=to_char((checked->>'starts_at')::timestamptz AT TIME ZONE 'America/Montevideo','YYYY-MM-DD');
  ELSIF previous_end IS DISTINCT FROM (checked->>'starts_at')::timestamptz OR day<>to_char((checked->>'starts_at')::timestamptz AT TIME ZONE 'America/Montevideo','YYYY-MM-DD') THEN RAISE EXCEPTION 'INVALID_VISIT_SEQUENCE';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(legs) e WHERE private.visit_overlaps(e,checked)) THEN RAISE EXCEPTION 'RESOURCE_CONFLICT';END IF;
  legs:=legs||jsonb_build_array(checked);previous_end:=(checked->>'ends_at')::timestamptz;
 END LOOP;
 IF payload->>'quote' IS DISTINCT FROM private.hash(legs::text) THEN RAISE EXCEPTION 'VISIT_QUOTE_CHANGED';END IF;
 RETURN legs;
END $function$
;
CREATE OR REPLACE FUNCTION private.visit_change(vid text, operation text, payload jsonb, owner boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE v jsonb;bid text;ids text[];legs jsonb;item jsonb;row record;idx int:=0;cid text;next_status text;token text;
BEGIN
 SELECT business_id INTO bid FROM public.booking_visits WHERE id=vid;IF bid IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 IF owner THEN PERFORM private.require_manager(bid);END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 PERFORM 1 FROM public.bookings WHERE id IN(SELECT booking_id FROM public.booking_visit_items WHERE visit_id=vid) FOR UPDATE;
 v:=private.visit_read(vid);
 IF operation='cancel' AND v->>'status'='cancelled' THEN RETURN v;END IF;
 IF owner AND operation='cancel' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v->'legs') l WHERE l->>'status' IN('pending','confirmed')) THEN RETURN v;END IF;
 IF NOT owner AND ((v->>'starts_at')::timestamptz<now()+make_interval(hours=>(v->>'cancel_notice_hours')::int) OR EXISTS(SELECT 1 FROM jsonb_array_elements(v->'legs') l WHERE l->>'status' NOT IN('pending','confirmed'))) THEN RAISE EXCEPTION 'OUTSIDE_POLICY';END IF;
 IF operation NOT IN('cancel','reschedule','confirm') THEN RAISE EXCEPTION 'INVALID_REQUEST';END IF;
 IF operation<>'cancel' AND EXISTS(SELECT 1 FROM jsonb_array_elements(v->'legs') l WHERE l->>'status' NOT IN('pending','confirmed')) THEN RAISE EXCEPTION 'FINALIZED';END IF;
 IF operation='confirm' AND NOT owner THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF operation='confirm' AND v->>'status'='confirmed' THEN RETURN v;END IF;
 ids:=ARRAY(SELECT booking_id FROM public.booking_visit_items WHERE visit_id=vid ORDER BY position);
 IF operation='reschedule' THEN
  IF (SELECT jsonb_agg(l->'service_id') FROM jsonb_array_elements(payload->'legs') l) IS DISTINCT FROM (SELECT jsonb_agg(l->'service_id') FROM jsonb_array_elements(v->'legs') l) THEN RAISE EXCEPTION 'INVALID_VISIT_SEQUENCE';END IF;
  IF (SELECT jsonb_agg(jsonb_build_array(l->>'service_id',l->>'staff_id',(l->>'starts_at')::timestamptz)) FROM jsonb_array_elements(payload->'legs') l)=(SELECT jsonb_agg(jsonb_build_array(l->>'service_id',l->>'staff_id',(l->>'starts_at')::timestamptz)) FROM jsonb_array_elements(v->'legs') l) THEN RETURN v;END IF;
  legs:=private.validate_visit(bid,payload,ids,owner,true);
  SELECT customer_id INTO cid FROM public.bookings WHERE id=ids[1];
  IF EXISTS(SELECT 1 FROM public.bookings WHERE business_id=bid AND customer_id=cid AND NOT(id=ANY(ids)) AND status IN('pending','confirmed') AND starts_at<(legs->-1->>'ends_at')::timestamptz AND ends_at>(legs->0->>'starts_at')::timestamptz) THEN RAISE EXCEPTION 'CUSTOMER_CONFLICT';END IF;
  -- Release all old exclusions inside this transaction before assigning the new visit.
  DELETE FROM public.booking_resources WHERE booking_id=ANY(ids);
  DELETE FROM public.booking_blocks WHERE booking_id=ANY(ids);
  FOR item IN SELECT * FROM jsonb_array_elements(legs) LOOP
   idx:=idx+1;
   UPDATE public.bookings SET staff_id=item->>'staff_id',starts_at=(item->>'starts_at')::timestamptz,ends_at=(item->>'ends_at')::timestamptz,blocked_from=(item->>'blocked_from')::timestamptz,blocked_until=(item->>'blocked_until')::timestamptz,updated_at=now() WHERE id=ids[idx];
   INSERT INTO public.booking_resources SELECT ids[idx],jsonb_array_elements_text(item->'resource_ids');
  END LOOP;
  next_status:='reprogramado';
 ELSE
  next_status:=CASE operation WHEN 'cancel' THEN 'cancelled' ELSE 'confirmed' END;
  UPDATE public.bookings SET status=next_status,updated_at=now() WHERE id=ANY(ids) AND status IN('pending','confirmed') AND status<>next_status;
 END IF;
 PERFORM private.visit_notify(vid,next_status);
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'visit.'||operation,'visit',vid,now());RETURN private.visit_read(vid);
END $function$
;
CREATE OR REPLACE FUNCTION private.visit_create(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE legs jsonb;item jsonb;created jsonb;ids text[]:='{}';idx int:=0;vid text:=gen_random_uuid()::text;token text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');key text:=payload->>'idempotency_key';scope text:='visit:'||bid;digest text:=private.hash((payload-'idempotency_key')::text);previous public.idempotency_keys;result jsonb;cid text;
BEGIN
 IF payload->'accept_policy' IS DISTINCT FROM 'true'::jsonb OR key IS NULL OR key!~'^[A-Za-z0-9_-]{16,100}$' THEN RAISE EXCEPTION 'INVALID_REQUEST';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended(scope||key,0));
 SELECT * INTO previous FROM public.idempotency_keys WHERE idempotency_keys.scope=scope AND key_hash=private.hash(key);
 IF FOUND THEN IF previous.request_hash<>digest THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';END IF;RETURN previous.response::jsonb;END IF;
 legs:=private.validate_visit(bid,payload,'{}',false);
 INSERT INTO public.booking_visits VALUES(vid,bid,private.hash(token),now());INSERT INTO private.visit_tokens VALUES(vid,token);
 FOR item IN SELECT * FROM jsonb_array_elements(legs) LOOP
  PERFORM set_config('atry.visit_slot',jsonb_build_object('bid',bid,'sid',item->>'staff_id','vid',item->>'service_id','starts',item->'starts_at','ignore_ids','[]'::jsonb,'off_grid',idx>0)::text,true);
  created:=private.create_booking(bid,jsonb_build_object('staff_id',item->>'staff_id','service_id',item->>'service_id','starts_at',item->'starts_at','customer_name',payload->'customer_name','customer_email',payload->'customer_email','customer_phone',payload->'customer_phone','notes',payload->'notes','accept_policy',true,'idempotency_key',vid||'_'||idx),'public');
  ids:=array_append(ids,created->>'id');INSERT INTO public.booking_visit_items VALUES(vid,created->>'id',idx);idx:=idx+1;
 END LOOP;
 PERFORM set_config('atry.visit_slot','',true);
 SELECT customer_id INTO cid FROM public.bookings WHERE id=ids[1];
 IF EXISTS(SELECT 1 FROM public.bookings WHERE business_id=bid AND customer_id=cid AND NOT(id=ANY(ids)) AND status IN('pending','confirmed') AND starts_at<(legs->-1->>'ends_at')::timestamptz AND ends_at>(legs->0->>'starts_at')::timestamptz) THEN RAISE EXCEPTION 'CUSTOMER_CONFLICT';END IF;
 -- None of these uncommitted per-leg messages are visible to a mail worker.
 DELETE FROM public.mail_jobs WHERE source IN('notification','business_alert') AND source_id IN(SELECT id FROM public.notifications WHERE booking_id=ANY(ids));
 DELETE FROM public.notifications WHERE booking_id=ANY(ids);
 DELETE FROM private.booking_tokens WHERE booking_id=ANY(ids);INSERT INTO private.booking_tokens VALUES(ids[1],token);
 UPDATE public.bookings SET manage_token_hash=NULL WHERE id=ANY(ids);
 DELETE FROM public.idempotency_keys WHERE idempotency_keys.scope='booking:public:'||bid||':guest' AND key_hash IN(SELECT private.hash(vid||'_'||n) FROM generate_series(0,idx-1) n);
 PERFORM private.visit_notify(vid,created->>'status');
 result:=private.visit_read(vid)||jsonb_build_object('manage_token',token);
 INSERT INTO public.idempotency_keys VALUES(scope,private.hash(key),digest,result::text,now());
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,NULL,'visit.created','visit',vid,now());RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION private.visit_fingerprint(vid text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT private.hash(coalesce(jsonb_agg(jsonb_build_array(b.id,b.status,b.starts_at,b.ends_at,b.staff_id,b.price_uyu) ORDER BY i.position)::text,'')) FROM public.booking_visit_items i JOIN public.bookings b ON b.id=i.booking_id WHERE i.visit_id=vid
$function$
;
CREATE OR REPLACE FUNCTION private.visit_leg(bid text, sid text, vid text, starts timestamp with time zone, off_grid boolean, ignore_ids text[], owner boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE slot jsonb;s public.services;st public.staff;
BEGIN
 slot:=private.visit_slot_raw(bid,sid,vid,starts,'',NOT owner,ignore_ids,off_grid);
 SELECT * INTO s FROM public.services WHERE id=vid AND business_id=bid;SELECT * INTO st FROM public.staff WHERE id=sid AND business_id=bid;
 IF starts<=now() THEN RAISE EXCEPTION 'OUTSIDE_NOTICE';END IF;
 RETURN jsonb_build_object('service_id',vid,'service_name',s.name,'staff_id',sid,'staff_name',st.name,'starts_at',starts,'ends_at',slot->'ends_at','blocked_from',slot->'blocked_from','blocked_until',slot->'blocked_until','resource_ids',coalesce((SELECT jsonb_agg(resource_id ORDER BY resource_id) FROM public.service_resources WHERE service_id=vid),'[]'),'duration_min',s.duration_min,'price_uyu',s.price_uyu,'time',to_char(starts AT TIME ZONE 'America/Montevideo','HH24:MI'));
END $function$
;
CREATE OR REPLACE FUNCTION private.visit_notify(vid text, kind text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE v jsonb:=private.visit_read(vid);anchor public.bookings;token text;summary text;
BEGIN
 SELECT b.* INTO anchor FROM public.booking_visit_items i JOIN public.bookings b ON b.id=i.booking_id WHERE i.visit_id=vid AND i.position=0;
 SELECT t.token INTO token FROM private.visit_tokens t WHERE t.visit_id=vid;
 SELECT string_agg((l->>'service_name')||' · '||(l->>'staff_name')||' · '||to_char((l->>'starts_at')::timestamptz AT TIME ZONE 'America/Montevideo','DD/MM/YYYY HH24:MI')||' · '||CASE l->>'status' WHEN 'confirmed' THEN 'Confirmado' WHEN 'pending' THEN 'Pendiente' WHEN 'cancelled' THEN 'Cancelado' WHEN 'completed' THEN 'Completado' ELSE 'No asistió' END,' / ') INTO summary FROM jsonb_array_elements(v->'legs') l;
 INSERT INTO public.notifications(id,business_id,booking_id,kind,recipient,subject,content,created_at) VALUES(gen_random_uuid()::text,anchor.business_id,anchor.id,kind,coalesce(anchor.customer_email_snapshot,''),'ATRY Turnos · visita completa',summary||'. Total: $'||(v->>'price_uyu')||' UYU. Gestioná toda la visita en /#/gestionar/'||token,now());
END $function$
;
CREATE OR REPLACE FUNCTION private.visit_options(bid text, payload jsonb, ignore_ids text[] DEFAULT '{}'::text[], owner boolean DEFAULT false, ignore_enabled boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE ids text[];day date;step int;minute int;legs jsonb;result jsonb:='[]';prefs jsonb:=coalesce(payload->'staff_preferences','{}');price int;duration int;
BEGIN
 IF jsonb_typeof(payload->'service_ids') IS DISTINCT FROM 'array' OR (payload->>'date')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'INVALID_VISIT';END IF;
 ids:=ARRAY(SELECT jsonb_array_elements_text(payload->'service_ids'));PERFORM private.visit_services(bid,ids,owner,ignore_enabled);day:=(payload->>'date')::date;
 IF jsonb_typeof(prefs)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(prefs) k WHERE NOT(k=ANY(ids))) THEN RAISE EXCEPTION 'INVALID_VISIT';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each_text(prefs) p WHERE NOT EXISTS(SELECT 1 FROM public.staff s JOIN public.staff_services ss ON ss.staff_id=s.id WHERE s.business_id=bid AND s.active=1 AND ss.service_id=p.key AND s.id=p.value)) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
 SELECT slot_step_min INTO step FROM public.businesses WHERE id=bid;
 IF day<(now() AT TIME ZONE 'America/Montevideo')::date OR day>(now() AT TIME ZONE 'America/Montevideo')::date+(SELECT max_days FROM public.businesses WHERE id=bid) THEN RETURN jsonb_build_object('options',result);END IF;
 PERFORM set_config('atry.visit_nodes','0',true);
 FOR minute IN SELECT generate_series(0,1439,step) LOOP
  legs:=private.visit_search(bid,ids,1,(day::timestamp+make_interval(mins=>minute)) AT TIME ZONE 'America/Montevideo','[]',prefs,ignore_ids,owner);
  IF legs IS NULL THEN CONTINUE;END IF;
  SELECT sum((l->>'price_uyu')::int),sum((l->>'duration_min')::int) INTO price,duration FROM jsonb_array_elements(legs) l;
  result:=result||jsonb_build_array(jsonb_build_object('start',legs->0->'starts_at','ends_at',legs->-1->'ends_at','time',legs->0->'time','legs',legs,'quote',private.hash(legs::text),'price_uyu',price,'duration_min',duration));
 END LOOP;
 RETURN jsonb_build_object('date',day,'options',result);
END $function$
;
CREATE OR REPLACE FUNCTION private.visit_overlaps(a jsonb, b jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 SELECT (a->>'blocked_from')::timestamptz<(b->>'blocked_until')::timestamptz AND (b->>'blocked_from')::timestamptz<(a->>'blocked_until')::timestamptz AND (a->>'staff_id'=b->>'staff_id' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(a->'resource_ids') x JOIN jsonb_array_elements_text(b->'resource_ids') y ON x=y))
$function$
;
CREATE OR REPLACE FUNCTION private.visit_read(vid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE v public.booking_visits;b public.businesses;legs jsonb;status text;
BEGIN
 SELECT * INTO v FROM public.booking_visits WHERE id=vid;IF v.id IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT * INTO b FROM public.businesses WHERE id=v.business_id;
 SELECT jsonb_agg(jsonb_build_object('id',x.id,'service_id',x.service_id,'staff_id',x.staff_id,'service_name',s.name,'staff_name',st.name,'starts_at',x.starts_at,'ends_at',x.ends_at,'status',x.status,'price_uyu',x.price_uyu) ORDER BY i.position) INTO legs FROM public.booking_visit_items i JOIN public.bookings x ON x.id=i.booking_id JOIN public.services s ON s.id=x.service_id JOIN public.staff st ON st.id=x.staff_id WHERE i.visit_id=vid;
 IF legs IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT CASE WHEN count(DISTINCT l->>'status')=1 THEN min(l->>'status') WHEN bool_and(l->>'status' IN('pending','confirmed')) THEN 'pending' ELSE 'in_progress' END INTO status FROM jsonb_array_elements(legs) l;
 RETURN jsonb_build_object('id',v.id,'visit',true,'business_name',b.name,'business_slug',b.slug,'cancel_notice_hours',b.cancel_notice_hours,'customer_name',(SELECT coalesce(x.customer_name_snapshot,c.name) FROM public.booking_visit_items i JOIN public.bookings x ON x.id=i.booking_id JOIN public.customers c ON c.id=x.customer_id WHERE i.visit_id=vid AND i.position=0),'starts_at',legs->0->'starts_at','ends_at',legs->-1->'ends_at','price_uyu',(SELECT sum((l->>'price_uyu')::int) FROM jsonb_array_elements(legs) l),'status',status,'service_name',(SELECT string_agg(l->>'service_name',' + ') FROM jsonb_array_elements(legs) l),'staff_name',(SELECT string_agg(DISTINCT l->>'staff_name',' · ') FROM jsonb_array_elements(legs) l),'legs',legs);
END $function$
;
CREATE OR REPLACE FUNCTION private.visit_search(bid text, ids text[], idx integer, starts timestamp with time zone, legs jsonb, prefs jsonb, ignore_ids text[], owner boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE person record;item jsonb;found jsonb;nodes int;
BEGIN
 nodes:=coalesce(nullif(current_setting('atry.visit_nodes',true),''),'0')::int+1;PERFORM set_config('atry.visit_nodes',nodes::text,true);
 IF nodes>20000 THEN RAISE EXCEPTION 'VISIT_SEARCH_LIMIT';END IF;
 IF idx>cardinality(ids) THEN RETURN legs;END IF;
 FOR person IN SELECT s.id FROM public.staff s JOIN public.staff_services ss ON ss.staff_id=s.id WHERE s.business_id=bid AND s.active=1 AND ss.service_id=ids[idx] AND (nullif(prefs->>ids[idx],'') IS NULL OR s.id=prefs->>ids[idx]) ORDER BY s.name,s.id LOOP
  BEGIN item:=private.visit_leg(bid,person.id,ids[idx],starts,idx>1,ignore_ids,owner);EXCEPTION WHEN SQLSTATE 'P0001' THEN CONTINUE;END;
  IF jsonb_array_length(legs)>0 AND (to_char((item->>'starts_at')::timestamptz AT TIME ZONE 'America/Montevideo','YYYY-MM-DD')<>to_char((legs->0->>'starts_at')::timestamptz AT TIME ZONE 'America/Montevideo','YYYY-MM-DD') OR EXISTS(SELECT 1 FROM jsonb_array_elements(legs) e WHERE private.visit_overlaps(e,item))) THEN CONTINUE;END IF;
  found:=private.visit_search(bid,ids,idx+1,(item->>'ends_at')::timestamptz,legs||jsonb_build_array(item),prefs,ignore_ids,owner);IF found IS NOT NULL THEN RETURN found;END IF;
 END LOOP;
 RETURN NULL;
END $function$
;
CREATE OR REPLACE FUNCTION private.visit_services(bid text, ids text[], owner boolean, ignore_enabled boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN
 IF array_length(ids,1) IS NULL OR array_length(ids,1)>6 OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) OR array_position(ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'INVALID_VISIT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=bid AND is_active=1 AND (multi_service_enabled=1 OR ignore_enabled) AND (owner OR allow_guest=1)) THEN RAISE EXCEPTION 'VISITS_DISABLED';END IF;
 IF NOT private.subscription_live(bid) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM private.business_controls WHERE business_id=bid AND (reservation_scope='all' OR (NOT owner AND reservation_scope='public'))) THEN RAISE EXCEPTION 'RESERVATIONS_PAUSED';END IF;
 IF (SELECT count(*) FROM public.services WHERE business_id=bid AND active=1 AND id=ANY(ids))<>cardinality(ids) THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;
 IF (SELECT sum(duration_min) FROM public.services WHERE business_id=bid AND id=ANY(ids))>480 THEN RAISE EXCEPTION 'VISIT_TOO_LONG';END IF;
END $function$
;
CREATE OR REPLACE FUNCTION private.visit_slot_base(bid text, sid text, vid text, starts timestamp with time zone, ignore_id text, notice boolean, ignore_ids text[], off_grid boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 IF lo IS NULL OR hi IS NULL OR m-s.buffer_before_min<lo OR m+s.duration_min+s.buffer_after_min>hi OR (NOT off_grid AND m%nullif(b.slot_step_min,0)<>0) THEN RAISE EXCEPTION 'OUTSIDE_SCHEDULE'; END IF;
 IF EXISTS(SELECT 1 FROM public.recurring_breaks rb WHERE rb.staff_id=sid AND rb.weekday=weekday AND rb.start_min<m+s.duration_min+s.buffer_after_min AND rb.end_min>m-s.buffer_before_min) THEN RAISE EXCEPTION 'BREAK'; END IF;
 IF EXISTS(SELECT 1 FROM public.time_off WHERE staff_id=sid AND starts_at<bu AND ends_at>bf) THEN RAISE EXCEPTION 'TIME_OFF'; END IF;
 IF EXISTS(SELECT 1 FROM public.bookings WHERE staff_id=sid AND id<>ignore_id AND NOT(id=ANY(ignore_ids)) AND status IN ('pending','confirmed') AND blocked_from<bu AND blocked_until>bf) THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM public.service_resources sr JOIN public.resources r ON r.id=sr.resource_id WHERE sr.service_id=vid AND (r.business_id<>bid OR r.active<>1 OR EXISTS(SELECT 1 FROM public.booking_blocks bb WHERE bb.target='resource:'||r.id AND bb.booking_id<>ignore_id AND NOT(bb.booking_id=ANY(ignore_ids)) AND bb.occupied && tstzrange(bf,bu,'[)')))) THEN RAISE EXCEPTION 'RESOURCE_CONFLICT'; END IF;
 RETURN jsonb_build_object('ends_at',ending,'blocked_from',bf,'blocked_until',bu,'price',s.price_uyu,'status',CASE WHEN b.auto_confirm=1 THEN 'confirmed' ELSE 'pending' END);
END $function$
;
CREATE OR REPLACE FUNCTION private.visit_slot_raw(bid text, sid text, vid text, starts timestamp with time zone, ignore_id text, notice boolean, ignore_ids text[], off_grid boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE result jsonb;d date:=(starts AT TIME ZONE 'America/Montevideo')::date;m int;v public.services;r record;
BEGIN
 IF NOT private.subscription_live(bid) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';END IF;
 result:=private.visit_slot_base(bid,sid,vid,starts,ignore_id,notice,ignore_ids,off_grid);
 SELECT * INTO v FROM public.services WHERE id=vid;
 m:=extract(hour FROM starts AT TIME ZONE 'America/Montevideo')*60+extract(minute FROM starts AT TIME ZONE 'America/Montevideo');
 FOR r IN SELECT a.*,s.duration_min,s.buffer_before_min,s.buffer_after_min FROM public.recurring_appointments a JOIN public.services s ON s.id=a.service_id
 WHERE a.business_id=bid AND private.has_feature(bid,'recurring') AND private.recurring_applies(a,d) AND ignore_id<>'recurring:'||a.id
 AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.recurring_id=a.id AND b.occurrence_day=d) LOOP
  IF (r.staff_id=sid OR EXISTS(SELECT 1 FROM public.service_resources x JOIN public.service_resources y ON x.resource_id=y.resource_id WHERE x.service_id=vid AND y.service_id=r.service_id))
  AND m-v.buffer_before_min<r.minute+r.duration_min+r.buffer_after_min AND r.minute-r.buffer_before_min<m+v.duration_min+v.buffer_after_min THEN RAISE EXCEPTION 'RECURRING_CONFLICT';END IF;
 END LOOP;
 RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION private.whatsapp_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN IF OLD.starts_at IS DISTINCT FROM NEW.starts_at THEN INSERT INTO public.whatsapp_previous VALUES(NEW.id,OLD.starts_at) ON CONFLICT(booking_id) DO UPDATE SET starts_at=excluded.starts_at;END IF;RETURN NEW;END $function$
;
CREATE OR REPLACE FUNCTION public.atry_accept_invitation(token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE i public.invitations;uid text:=private.user_id();verified_email text;
BEGIN PERFORM private.require_feature((SELECT business_id FROM public.invitations WHERE token_hash=private.hash(atry_accept_invitation.token)),'access');
 IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT lower(email) INTO verified_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 IF verified_email IS NULL OR coalesce(token,'')!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'VERIFIED_EMAIL_REQUIRED';END IF;
 SELECT * INTO i FROM public.invitations WHERE token_hash=private.hash(token);
 IF i.id IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 PERFORM 1 FROM public.businesses WHERE id=i.business_id FOR UPDATE;
 SELECT * INTO i FROM public.invitations WHERE id=i.id FOR UPDATE;
 IF i.accepted_at IS NOT NULL OR i.revoked_at IS NOT NULL OR i.expires_at<=now() THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 IF lower(i.email)<>verified_email THEN RAISE EXCEPTION 'WRONG_ACCOUNT' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM public.memberships WHERE business_id=i.business_id AND user_id=uid) THEN RAISE EXCEPTION 'ALREADY_MEMBER';END IF;
 IF i.role='staff' THEN
  UPDATE public.staff SET user_id=uid WHERE id=i.staff_id AND business_id=i.business_id AND active=1 AND user_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
 END IF;
 INSERT INTO public.memberships VALUES(uid,i.business_id,i.role);
 UPDATE public.invitations SET accepted_at=now() WHERE id=i.id;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,i.business_id,uid,'invitation.accepted','invitation',i.id,now());RETURN jsonb_build_object('business_id',i.business_id,'email',verified_email);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_accept_offer(token text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE w public.waitlist;result jsonb;previous public.idempotency_keys;scope text:='offer:'||private.hash(token);key text:=payload->>'idempotency_key';fingerprint text:=private.hash(payload::text);
BEGIN IF EXISTS(SELECT 1 FROM public.waitlist WHERE offer_token_hash=private.hash(atry_accept_offer.token)) THEN PERFORM private.require_feature((SELECT business_id FROM public.waitlist WHERE offer_token_hash=private.hash(atry_accept_offer.token)),'waitlist');END IF;
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
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_access(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN PERFORM private.require_feature(bid,'access');
 IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('members',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'role',m.role,'staff_id',(SELECT s.id FROM public.staff s WHERE s.business_id=bid AND s.user_id=u.id LIMIT 1))) FROM public.memberships m JOIN public.users u ON u.id=m.user_id WHERE m.business_id=bid),'[]'::jsonb),'invitations',coalesce((SELECT jsonb_agg(to_jsonb(i)-'token_hash'-'created_by') FROM public.invitations i WHERE i.business_id=bid),'[]'::jsonb));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_access_context(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN RETURN jsonb_build_object('user_valid',private.user_id() IS NOT NULL,'role',private.member_role(bid),'staff_id',(SELECT id FROM public.staff WHERE business_id=bid AND private.own_staff(id) LIMIT 1));END $function$
;
CREATE OR REPLACE FUNCTION public.atry_add_member(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE uid text;role text:=payload->>'role';sid text:=nullif(payload->>'staff_id','');
BEGIN PERFORM private.require_feature(bid,'access');
 IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 IF coalesce(role,'') NOT IN ('manager','staff') THEN RAISE EXCEPTION 'INVALID_ROLE';END IF;
 SELECT u.id INTO uid FROM public.users u JOIN auth.users a ON a.id=u.auth_user_id WHERE lower(a.email)=lower(btrim(payload->>'email')) AND a.email_confirmed_at IS NOT NULL;
 IF uid IS NULL THEN RAISE EXCEPTION 'VERIFIED_ACCOUNT_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM public.memberships WHERE business_id=bid AND user_id=uid) THEN RAISE EXCEPTION 'ALREADY_MEMBER';END IF;
 IF role='staff' THEN UPDATE public.staff SET user_id=uid WHERE id=sid AND business_id=bid AND active=1 AND user_id IS NULL;IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;END IF;
 INSERT INTO public.memberships VALUES(uid,bid,role);INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'member.added','user',uid,now());RETURN jsonb_build_object('ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_admin_businesses()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM private.require_admin();RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT b.id,b.name,b.slug,b.email,b.phone,(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name)),'[]'::jsonb) FROM public.staff s WHERE s.business_id=b.id AND s.active=1) active_staff,b.plan,b.subscription_status,b.paid_until,b.trial_until,b.subscription_started_at,b.created_at,b.is_active,private.subscription_live(b.id) access_enabled,
 (SELECT count(*) FROM public.bookings WHERE business_id=b.id) bookings,(SELECT count(*) FROM public.memberships WHERE business_id=b.id) members,
 coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT se.id,se.action,se.actor_id,(SELECT u.name FROM public.users u WHERE u.id=se.actor_id) actor_name,se.after_state,se.amount_uyu,se.reference,se.note,se.created_at FROM public.subscription_events se WHERE se.business_id=b.id ORDER BY se.created_at DESC) e),'[]'::jsonb) license_history
 FROM public.businesses b ORDER BY created_at DESC) x),'[]'::jsonb);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_admin_commercial()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s private.commercial_settings;committed bigint;
BEGIN
 PERFORM private.require_admin();SELECT * INTO s FROM private.commercial_settings WHERE id=1;
 SELECT coalesce(sum(p.mail_limit),0) INTO committed FROM public.businesses b JOIN public.plans p ON p.code=b.plan WHERE private.subscription_live(b.id);
 RETURN jsonb_build_object('settings',to_jsonb(s),'capacity',jsonb_build_object('monthly_committed',committed,'monthly_available',(s.provider_daily_limit-s.security_reserve)*28,'warning',committed>(s.provider_daily_limit-s.security_reserve)*28),'requests',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('business_name',b.name,'history',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at) FROM public.plan_request_events e WHERE e.request_id=r.id),'[]'::jsonb)) ORDER BY r.created_at DESC) FROM public.plan_requests r JOIN public.businesses b ON b.id=r.business_id),'[]'::jsonb));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_admin_diagnostics()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE versions jsonb:='[]';
BEGIN
 PERFORM private.require_admin();
 IF to_regclass('private.migration_ledger') IS NOT NULL THEN SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'applied_at',applied_at)),'[]'::jsonb) INTO versions FROM private.migration_ledger;END IF;
 RETURN jsonb_build_object('integrity','Restricciones PostgreSQL activas; diagnóstico físico no disponible por API','schema_versions',versions,'mail_provider',(SELECT CASE WHEN mail_enabled THEN 'brevo' ELSE 'disabled' END FROM private.runtime_settings WHERE id=1),'mail_states',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT state,count(*) count FROM public.mail_jobs GROUP BY state) x),'[]'::jsonb),'errors',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT code,count(*) count,max(created_at) latest FROM public.system_errors GROUP BY code ORDER BY max(created_at) DESC LIMIT 20) x),'[]'::jsonb),'audit',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT action,entity_id,created_at FROM public.platform_audit ORDER BY created_at DESC LIMIT 50) x),'[]'::jsonb));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_admin_incidents()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN PERFORM private.require_admin();RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT i.id,i.subject,i.state,i.created_at,b.name business_name FROM public.incidents i JOIN public.businesses b ON b.id=i.business_id ORDER BY i.created_at DESC LIMIT 100) x),'[]'::jsonb);END $function$
;
CREATE OR REPLACE FUNCTION public.atry_admin_operations()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM private.require_admin();
 RETURN jsonb_build_object('organizations',(SELECT count(*) FROM public.businesses),'queued_notifications',(SELECT count(*) FROM public.mail_jobs WHERE state IN ('queued','retry')),'integrations',jsonb_build_object('email',CASE WHEN (SELECT mail_enabled FROM private.runtime_settings WHERE id=1) THEN 'Brevo configurado; aceptación y entrega se verifican por separado' ELSE 'Entrega deshabilitada' END,'mercado_pago','Sin credenciales ni cobros','whatsapp','Pendiente de integración oficial'),'audit',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT action,entity,created_at FROM public.audit_log ORDER BY created_at DESC LIMIT 30) x),'[]'::jsonb));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_admin_plans()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN PERFORM private.require_admin();RETURN coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.plans p),'[]'::jsonb);END $function$
;
CREATE OR REPLACE FUNCTION public.atry_admin_report_incident(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid text;bid text:=payload->>'business_id';iid text:=gen_random_uuid()::text;
 subject_value text:=btrim(coalesce(payload->>'subject',''));description_value text:=btrim(coalesce(payload->>'description',''));
 category_value text:=coalesce(payload->>'category','service');priority_value text:=coalesce(payload->>'priority','normal');
 state_value text:=coalesce(payload->>'state','open');assignee_value text:=nullif(payload->>'assignee','');
 reason_value text:=btrim(coalesce(payload->>'reason',''));request_key_value text:=payload->>'request_id';request_hash_value text;previous private.control_events;
BEGIN
 PERFORM private.control_stepup();uid:=private.user_id();
 IF jsonb_typeof(payload) IS DISTINCT FROM 'object' OR bid IS NULL OR length(subject_value) NOT BETWEEN 5 AND 180 OR length(description_value) NOT BETWEEN 5 AND 2000
 OR category_value NOT IN ('service','access','booking','mail','subscription') OR priority_value NOT IN ('low','normal','high','critical') OR state_value NOT IN ('open','investigating')
 OR length(reason_value) NOT BETWEEN 5 AND 500 OR request_key_value IS NULL OR request_key_value!~'^[A-Za-z0-9_-]{16,100}$'
 THEN RAISE EXCEPTION 'INVALID_INCIDENT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=bid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF assignee_value IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=assignee_value AND u.platform_admin=1 AND NOT EXISTS(SELECT 1 FROM private.user_controls c WHERE c.user_id=u.id AND c.blocked)) THEN RAISE EXCEPTION 'INVALID_ASSIGNEE';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('incident:'||request_key_value,0));
 request_hash_value:=private.hash((payload-'request_id')::text);
 SELECT * INTO previous FROM private.control_events WHERE request_key=request_key_value;
 IF FOUND THEN
  IF previous.actor_id<>uid OR previous.action<>'incident_create' OR previous.request_hash<>request_hash_value THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';END IF;
  RETURN jsonb_build_object('id',previous.entity_id,'replayed',true);
 END IF;
 IF (SELECT count(*) FROM private.control_events WHERE actor_id=uid AND created_at>now()-interval '1 minute')>=30 THEN RAISE EXCEPTION 'ADMIN_RATE_LIMIT';END IF;
 INSERT INTO public.incidents(id,business_id,subject,state,created_by,created_at,updated_at,description,category,priority,assignee)
 VALUES(iid,bid,subject_value,state_value,uid,now(),now(),description_value,category_value,priority_value,coalesce(assignee_value,uid));
 INSERT INTO private.control_events(actor_id,action,entity_id,business_id,reason,before_state,after_state,request_key,request_hash)
 VALUES(uid,'incident_create',iid,bid,reason_value,NULL,jsonb_build_object('state',state_value,'priority',priority_value,'category',category_value,'assignee',coalesce(assignee_value,uid)),request_key_value,request_hash_value);
 RETURN jsonb_build_object('id',iid,'replayed',false);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_admin_request_state(request_id text, state text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE uid text:=private.require_admin();
BEGIN
 IF state NOT IN ('pending_payment','pending_verification','cancelled') THEN RAISE EXCEPTION 'INVALID_REQUEST_STATE';END IF;
 UPDATE public.plan_requests SET state=atry_admin_request_state.state,updated_at=now() WHERE id=request_id AND plan_requests.state IN ('pending_contact','pending_payment','pending_verification');IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_CHANGED';END IF;
 INSERT INTO public.plan_request_events(request_id,actor_id,state) VALUES(request_id,uid,state);INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'plan.request.'||state,request_id,now());RETURN jsonb_build_object('ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_admin_save_business(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN PERFORM private.control_stepup();RETURN private.control_save_business_base(bid,payload);END $function$
;
CREATE OR REPLACE FUNCTION public.atry_admin_save_commercial(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v bigint;
BEGIN PERFORM private.control_stepup();SELECT revision INTO v FROM private.commercial_settings WHERE id=1 FOR UPDATE;
 IF payload?'expected_revision' AND (payload->>'expected_revision')::bigint IS DISTINCT FROM v THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
 RETURN private.control_save_commercial_base(payload);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_admin_save_incident(incident_id text, state text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE uid text:=private.require_admin();
BEGIN
 IF coalesce(state,'') NOT IN ('open','investigating','resolved') THEN RAISE EXCEPTION 'INVALID_STATUS';END IF;
 UPDATE public.incidents SET state=atry_admin_save_incident.state,updated_at=now() WHERE id=incident_id;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'incident.updated',incident_id,now());RETURN jsonb_build_object('ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_admin_save_plan(code text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v bigint;
BEGIN PERFORM private.control_stepup();SELECT revision INTO v FROM private.commercial_settings WHERE id=1 FOR UPDATE;
 IF payload?'expected_revision' AND (payload->>'expected_revision')::bigint IS DISTINCT FROM v THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
 IF payload?'price_uyu' AND (payload->>'price_uyu')::int NOT BETWEEN 0 AND 1000000 OR payload?'mail_limit' AND (payload->>'mail_limit')::int NOT BETWEEN 0 AND 1000000 THEN RAISE EXCEPTION 'INVALID_LIMIT';END IF;
 PERFORM set_config('atry.control_reason',left(coalesce(payload->>'reason','Configuración global de plan'),500),true);
 RETURN private.control_save_plan_base(code,payload);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_audit(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN PERFORM private.require_manager(bid);RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.audit_log WHERE business_id=bid ORDER BY created_at DESC LIMIT 80) x),'[]'::jsonb);END $function$
;
CREATE OR REPLACE FUNCTION public.atry_bookings(bid text, start_day date, days integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 result:=private.bookings_visit_base(bid,start_day,days);
 RETURN coalesce((SELECT jsonb_agg(e||jsonb_build_object('visit_id',(SELECT visit_id FROM public.booking_visit_items WHERE booking_id=e->>'id'))) FROM jsonb_array_elements(result) e),'[]');
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_business(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE role text:=private.member_role(bid);b public.businesses;
BEGIN
 IF role IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM public.businesses WHERE id=bid;
 RETURN to_jsonb(b)||jsonb_build_object('role',role,'staff_id',(SELECT id FROM public.staff WHERE business_id=bid AND user_id=private.user_id() AND active=1 LIMIT 1),'public_url','/#/reservar/'||b.slug);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_business_delete_preview(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
BEGIN RETURN jsonb_build_object('checked_at',now(),'data',private.business_purge_plan(bid));END $function$
;
CREATE OR REPLACE FUNCTION public.atry_cancel_plan_request(bid text, request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN
 IF coalesce(private.member_role(bid),'')<>'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 UPDATE public.plan_requests SET state='cancelled',updated_at=now() WHERE id=request_id AND business_id=bid AND state IN ('pending_contact','pending_payment','pending_verification');
 IF FOUND THEN INSERT INTO public.plan_request_events(request_id,actor_id,state) VALUES(request_id,private.user_id(),'cancelled');END IF;RETURN public.atry_subscription(bid);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_catalog(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE role text:=private.member_role(bid);
BEGIN
 IF role IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('services',coalesce((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('staff_ids',coalesce((SELECT jsonb_agg(ss.staff_id) FROM public.staff_services ss WHERE ss.service_id=s.id),'[]'::jsonb))) FROM public.services s WHERE s.business_id=bid),'[]'::jsonb),'staff',coalesce((SELECT jsonb_agg(to_jsonb(st)||jsonb_build_object('service_ids',coalesce((SELECT jsonb_agg(ss.service_id) FROM public.staff_services ss WHERE ss.staff_id=st.id),'[]'::jsonb))) FROM public.staff st WHERE st.business_id=bid AND (role IN ('owner','manager') OR private.own_staff(st.id))),'[]'::jsonb));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_configure_delivery(site_url text, enabled boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF (coalesce(site_url,'')!~'^https://[a-z0-9-]+\.pages\.dev/?$' AND coalesce(site_url,'') NOT IN ('https://atry-agency.github.io/ATRY-Turnos','https://atry-agency.github.io/ATRY-Turnos/')) OR enabled IS NULL THEN RAISE EXCEPTION 'INVALID_DELIVERY_CONFIG';END IF;
 UPDATE private.runtime_settings SET public_url=regexp_replace(site_url,'/$',''),mail_enabled=enabled,updated_at=now() WHERE id=1;RETURN true;
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_control_command(action text, entity_id text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE uid text:=private.require_admin();key text:=payload->>'request_id';memo text:=btrim(coalesce(payload->>'reason',''));digest text:=private.hash(jsonb_build_object('action',action,'entity',entity_id,'payload',payload-'request_id')::text);previous private.control_events;before_data jsonb;after_data jsonb;d int;v bigint;cnt int:=0;j public.mail_jobs;bid text;
BEGIN
 IF action NOT IN ('retention_policy','mail_archive','request_state') THEN RETURN private.control_command_base(action,entity_id,payload);END IF;
 PERFORM private.control_stepup();IF key IS NULL OR key!~'^[A-Za-z0-9_-]{16,100}$' OR length(memo) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'REASON_REQUIRED';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('control:'||key,0));SELECT * INTO previous FROM private.control_events WHERE request_key=key;
 IF FOUND THEN IF previous.actor_id<>uid OR previous.request_hash<>digest THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';END IF;RETURN jsonb_build_object('ok',true,'operation_id',previous.id,'replayed',true);END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('control:actor:'||uid,0));IF (SELECT count(*) FROM private.control_events WHERE actor_id=uid AND created_at>now()-interval '1 minute')>=30 THEN RAISE EXCEPTION 'ADMIN_RATE_LIMIT';END IF;
 IF action='request_state' THEN
  SELECT jsonb_build_object('state',state),business_id INTO before_data,bid FROM public.plan_requests WHERE id=entity_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  PERFORM public.atry_admin_request_state(entity_id,payload->>'state');after_data:=jsonb_build_object('state',payload->>'state');
 ELSE
  SELECT mail_terminal_days,revision,to_jsonb(c) INTO d,v,before_data FROM private.control_settings c WHERE id=1 FOR UPDATE;
  IF NOT(payload?'revision') OR v IS DISTINCT FROM (payload->>'revision')::bigint THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
  IF action='retention_policy' THEN
   UPDATE private.control_settings SET mail_terminal_days=(payload->>'days')::int,revision=revision+1 WHERE id=1;
   SELECT to_jsonb(c) INTO after_data FROM private.control_settings c WHERE id=1;
  ELSE
   IF d IS NULL THEN RAISE EXCEPTION 'RETENTION_POLICY_REQUIRED';END IF;
   FOR j IN SELECT * FROM public.mail_jobs j WHERE j.state IN ('skipped','delivered','bounced') AND j.updated_at<now()-make_interval(days=>d) AND NOT EXISTS(SELECT 1 FROM private.mail_archives a WHERE a.job_id=j.id) ORDER BY j.updated_at,j.id FOR UPDATE SKIP LOCKED LIMIT 100 LOOP
    UPDATE public.mail_jobs SET recipient='',subject='',content='' WHERE id=j.id;INSERT INTO private.mail_archives(job_id) VALUES(j.id);cnt:=cnt+1;
   END LOOP;
   before_data:=jsonb_build_object('policy_days',d);after_data:=jsonb_build_object('redacted_jobs',cnt,'dedupe_and_quota_preserved',true,'physical_space_reclaimed',NULL);
  END IF;
 END IF;
 INSERT INTO private.control_events(actor_id,action,entity_id,business_id,reason,before_state,after_state,request_key,request_hash) VALUES(uid,action,entity_id,bid,memo,before_data,after_data,key,digest) RETURNING * INTO previous;
 RETURN jsonb_build_object('ok',true,'operation_id',previous.id,'after',after_data);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_control_read(section text, params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 result:=private.control_read_delete_base(section,params);
 IF section='business' THEN result:=jsonb_set(result,'{data,deletion_enabled}','true'::jsonb);END IF;
 RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_control_worker(phase text, outcome text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN IF phase='start' THEN UPDATE private.worker_health SET started_at=now() WHERE id=1;ELSIF phase='finish' AND outcome IN ('ok','error') THEN UPDATE private.worker_health SET finished_at=now(),result=outcome WHERE id=1;ELSE RAISE EXCEPTION 'INVALID_WORKER_STATE';END IF;RETURN true;END $function$
;
CREATE OR REPLACE FUNCTION public.atry_create_booking(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ SELECT private.create_booking(bid,payload,'manual') $function$
;
CREATE OR REPLACE FUNCTION public.atry_create_incident(bid text, subject text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE iid text:=gen_random_uuid()::text;
BEGIN
 PERFORM private.require_manager(bid);IF subject IS NULL OR length(btrim(subject)) NOT BETWEEN 5 AND 180 THEN RAISE EXCEPTION 'INVALID_SUBJECT';END IF;
 INSERT INTO public.incidents(id,business_id,subject,state,created_by,created_at,updated_at) VALUES(iid,bid,btrim(subject),'open',private.user_id(),now(),now());INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'incident.created','incident',iid,now());RETURN jsonb_build_object('id',iid);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_create_organization(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE uid text:=private.user_id();u public.users;bid text:=gen_random_uuid()::text;sid text:=gen_random_uuid()::text;name text:=btrim(payload->>'name');slug text:=lower(btrim(payload->>'slug'));
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO u FROM public.users WHERE id=uid FOR UPDATE;
 IF (SELECT count(*) FROM public.memberships WHERE user_id=uid AND role='owner')>=10 THEN RAISE EXCEPTION 'ORGANIZATION_LIMIT';END IF;
 IF name IS NULL OR length(name)<2 OR length(name)>100 OR slug IS NULL OR slug!~'^[a-z0-9][a-z0-9-]{1,53}[a-z0-9]$' THEN RAISE EXCEPTION 'INVALID_ORGANIZATION';END IF;
 INSERT INTO public.businesses(id,slug,name,email,sector,subscription_status,trial_until,created_at) VALUES(bid,slug,name,u.email,coalesce(nullif(left(btrim(payload->>'sector'),100),''),'General'),'trialing',now()+interval '14 days',now());
 INSERT INTO public.memberships VALUES(uid,bid,'owner');
 INSERT INTO public.staff(id,business_id,user_id,name,email,created_at) VALUES(sid,bid,uid,u.name,u.email,now());
 INSERT INTO public.working_hours SELECT sid,d,540,1080 FROM generate_series(1,6) d;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,uid,'business.created','business',bid,now());
 UPDATE public.businesses SET subscription_status='pending',trial_until=now() WHERE id=bid;
 RETURN jsonb_build_object('id',bid,'name',name,'slug',slug);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_create_recurring(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE r public.recurring_appointments;other public.recurring_appointments;v public.services;ov public.services;existing record;d date;i int;from_day date;
 key text:=payload->>'idempotency_key';scope text;digest text;prev public.idempotency_keys;result jsonb;clock text:=payload->>'time';
BEGIN PERFORM private.require_feature(bid,'recurring');
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
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_customer_history(bid text, customer_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN
 PERFORM private.require_manager(bid);
 IF NOT EXISTS(SELECT 1 FROM public.customers WHERE id=customer_id AND business_id=bid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT b.id,b.starts_at,b.status,b.price_uyu,s.name service_name,st.name staff_name FROM public.bookings b JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id WHERE b.business_id=bid AND b.customer_id=customer_id ORDER BY b.starts_at DESC LIMIT 100) x),'[]'::jsonb);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_customers(bid text, query text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN
 PERFORM private.require_manager(bid);
 IF length(coalesce(query,''))>80 THEN RAISE EXCEPTION 'INVALID_SEARCH';END IF;
 RETURN coalesce((SELECT jsonb_agg(row) FROM (SELECT to_jsonb(c)||jsonb_build_object('visits',(SELECT count(*) FROM public.bookings b WHERE b.customer_id=c.id AND b.status<>'cancelled')) AS row FROM public.customers c WHERE c.business_id=bid AND (coalesce(query,'')='' OR c.name ILIKE '%'||query||'%' OR c.email ILIKE '%'||query||'%' OR c.phone ILIKE '%'||query||'%' OR (regexp_replace(query,'[^0-9]','','g')<>'' AND regexp_replace(c.phone,'[^0-9]','','g') LIKE '%'||regexp_replace(query,'[^0-9]','','g')||'%')) ORDER BY CASE WHEN coalesce(query,'')<>'' THEN c.name END,c.created_at DESC LIMIT 100) x),'[]'::jsonb);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_dashboard(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM private.require_manager(bid);PERFORM private.expand_recurring(bid,(now() AT TIME ZONE 'America/Montevideo')::date,31);IF NOT private.has_feature(bid,'statistics') THEN RETURN private.dashboard_before_recurring(bid)-'totals'-'daily'-'insights'-'waitlist' || jsonb_build_object('totals','{}'::jsonb,'daily','[]'::jsonb,'insights','[]'::jsonb,'waitlist',0);END IF;RETURN private.dashboard_before_recurring(bid);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_delete_business(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE uid text:=private.require_admin();data jsonb;key text:=payload->>'request_id';digest text:=private.hash(jsonb_build_object('business',bid,'payload',payload-'request_id')::text);previous private.control_events;t record;pending int;removed int;operation text:=gen_random_uuid()::text;objects_exist boolean:=false;
BEGIN
 PERFORM private.control_stepup();IF key IS NULL OR key!~'^[A-Za-z0-9_-]{16,100}$' OR length(btrim(coalesce(payload->>'reason',''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'REASON_REQUIRED';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('business-delete:'||key,0));SELECT * INTO previous FROM private.control_events WHERE request_key=key;
 IF FOUND THEN IF previous.actor_id<>uid OR previous.request_hash<>digest THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';END IF;RETURN jsonb_build_object('ok',true,'operation_id',previous.id,'replayed',true);END IF;
 IF (SELECT count(*) FROM private.control_events WHERE actor_id=uid AND created_at>now()-interval '1 minute')>=30 THEN RAISE EXCEPTION 'ADMIN_RATE_LIMIT';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 PERFORM 1 FROM public.mail_jobs WHERE business_id=bid FOR UPDATE;
 data:=private.business_purge_plan(bid);
 IF payload->>'confirm_slug' IS DISTINCT FROM data->>'slug' OR payload->>'preview_token' IS DISTINCT FROM data->>'token' THEN RAISE EXCEPTION 'DELETE_PREVIEW_CHANGED';END IF;
 IF NOT (data->>'execution_enabled')::boolean THEN RAISE EXCEPTION 'MAIL_PROCESSING';END IF;
 IF to_regclass('storage.objects') IS NOT NULL THEN EXECUTE 'SELECT EXISTS(SELECT 1 FROM storage.objects WHERE metadata->>''business_id''=$1 OR name LIKE ''businesses/''||$1||''/%'')' INTO objects_exist USING bid;END IF;
 IF objects_exist THEN RAISE EXCEPTION 'STORAGE_CLEANUP_REQUIRED';END IF;
 PERFORM set_config('atry.business_purge',bid,true);
 LOOP
  SELECT count(*) INTO pending FROM pg_temp.atry_purge_rows;EXIT WHEN pending=0;removed:=0;
  FOR t IN SELECT DISTINCT r.rel,n.nspname,c.relname FROM pg_temp.atry_purge_rows r JOIN pg_class c ON c.oid=r.rel JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT EXISTS(SELECT 1 FROM pg_constraint fk WHERE fk.contype='f' AND fk.confrelid=r.rel AND fk.conrelid<>r.rel AND EXISTS(SELECT 1 FROM pg_temp.atry_purge_rows child WHERE child.rel=fk.conrelid)) LOOP
   EXECUTE format('DELETE FROM %I.%I d USING pg_temp.atry_purge_rows r WHERE r.rel=%s AND r.tuple=d.ctid::text',t.nspname,t.relname,t.rel);
   DELETE FROM pg_temp.atry_purge_rows WHERE rel=t.rel;removed:=removed+1;
  END LOOP;
  IF removed=0 THEN RAISE EXCEPTION 'UNRESOLVED_DELETE_DEPENDENCY';END IF;
 END LOOP;
 PERFORM set_config('atry.business_purge','',true);
 INSERT INTO private.control_events(id,actor_id,action,entity_id,business_id,reason,after_state,request_key,request_hash) VALUES(operation,uid,'business.deleted','deleted-business',NULL,'Eliminación definitiva confirmada',jsonb_build_object('deleted',true,'counts',data->'counts','accounts_preserved',true),key,digest);
 RETURN jsonb_build_object('ok',true,'operation_id',operation,'after',jsonb_build_object('deleted',true,'counts',data->'counts','accounts_preserved',true));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_end_recurring(bid text, recurring_id text, from_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_entitlements(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE result jsonb;c record;
BEGIN
 IF private.member_role(bid) IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM private.commercial_cycle(bid);
 SELECT to_jsonb(p)||jsonb_build_object('features',CASE WHEN (SELECT subscription_status FROM public.businesses WHERE id=bid)='pending' THEN (SELECT jsonb_object_agg(key,false) FROM jsonb_object_keys(p.features) key) ELSE p.features END,'access_enabled',private.subscription_live(bid),'revision',(SELECT revision FROM private.commercial_settings WHERE id=1),'staff_count',(SELECT count(*) FROM public.staff WHERE business_id=bid AND active=1),'mail_usage',jsonb_build_object('accepted',coalesce(u.accepted,0),'reserved',coalesce(u.reserved,0),'limit',p.mail_limit,'cycle_start',c.cycle_start,'cycle_end',c.cycle_end)) INTO result FROM public.businesses b JOIN public.plans p ON p.code=b.plan LEFT JOIN public.business_mail_usage u ON u.business_id=b.id AND u.cycle_start=c.cycle_start WHERE b.id=bid;
 RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_export_bookings(bid text, after_start timestamp with time zone DEFAULT NULL::timestamp with time zone, after_id text DEFAULT ''::text, page_size integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE rows jsonb;cursor jsonb;revision bigint;final_revision bigint;
BEGIN PERFORM private.require_feature(bid,'exports');
 PERFORM private.require_manager(bid);
 IF (SELECT reports FROM public.plans p JOIN public.businesses b ON b.plan=p.code WHERE b.id=bid)=0 THEN RAISE EXCEPTION 'FEATURE_DISABLED' USING ERRCODE='42501';END IF;
 IF page_size NOT BETWEEN 1 AND 1000 OR page_size IS NULL THEN RAISE EXCEPTION 'INVALID_PAGE';END IF;
 SELECT coalesce(calendar_revisions.revision,0) INTO revision FROM public.calendar_revisions WHERE business_id=bid;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO rows FROM (SELECT b.id,b.starts_at,b.ends_at,b.status,s.name service,st.name professional,coalesce(b.customer_name_snapshot,c.name) customer,coalesce(b.customer_email_snapshot,c.email) email,coalesce(b.customer_phone_snapshot,c.phone) phone,b.price_uyu FROM public.bookings b JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id JOIN public.customers c ON c.id=b.customer_id WHERE b.business_id=bid AND (after_start IS NULL OR (b.starts_at,b.id)>(after_start,after_id)) ORDER BY b.starts_at,b.id LIMIT page_size) x;
 IF jsonb_array_length(rows)=page_size THEN cursor:=jsonb_build_object('start',rows->-1->>'starts_at','id',rows->-1->>'id');END IF;
 SELECT coalesce(calendar_revisions.revision,0) INTO final_revision FROM public.calendar_revisions WHERE business_id=bid;
 IF coalesce(revision,0)<>coalesce(final_revision,0) THEN RAISE EXCEPTION 'EXPORT_CHANGED';END IF;
 RETURN jsonb_build_object('rows',rows,'next_cursor',cursor,'revision',coalesce(revision,0));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_finish_registration()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid text:=private.user_id();meta jsonb;name text;slug text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users WHERE id=uid FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.memberships WHERE user_id=uid) THEN RETURN jsonb_build_object('ok',true);END IF;
 SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 name:=nullif(btrim(meta->>'requested_business_name'),'');slug:=nullif(meta->>'requested_business_slug','');
 IF name IS NULL THEN RETURN jsonb_build_object('ok',true);END IF;
 RETURN public.atry_create_organization(jsonb_build_object('name',name,'slug',slug,'sector',meta->>'requested_business_sector'));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_health()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT jsonb_build_object('status','ok','app','Atry Turnos','version','1.2.0','backend','supabase','server_time',now()) $function$
;
CREATE OR REPLACE FUNCTION public.atry_incidents(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN PERFORM private.require_manager(bid);RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,subject,state,created_at,updated_at FROM public.incidents WHERE business_id=bid ORDER BY created_at DESC LIMIT 50) x),'[]'::jsonb);END $function$
;
CREATE OR REPLACE FUNCTION public.atry_insights(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE tz text;lo timestamptz:=now()-interval '30 days';hi timestamptz:=now();history timestamptz:=now()-interval '90 days';today date;result jsonb;occupation jsonb;
BEGIN PERFORM private.require_feature(bid,'advanced');
 PERFORM private.require_manager(bid);
 IF (SELECT p.reports FROM public.plans p JOIN public.businesses b ON b.plan=p.code WHERE b.id=bid)=0 THEN RAISE EXCEPTION 'FEATURE_DISABLED' USING ERRCODE='42501';END IF;
 SELECT timezone INTO tz FROM public.businesses WHERE id=bid;today:=(now() AT TIME ZONE tz)::date;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'scheduled_minutes',capacity.minutes,'booked_minutes',used.minutes,'occupancy_percent',CASE WHEN capacity.minutes>0 THEN round(100.0*used.minutes/capacity.minutes) ELSE NULL END)),'[]'::jsonb) INTO occupation
 FROM public.staff s CROSS JOIN LATERAL (SELECT coalesce(sum(private.scheduled_minutes(bid,s.id,today-n)),0) minutes FROM generate_series(0,29) n) capacity CROSS JOIN LATERAL (SELECT coalesce(sum(extract(epoch FROM (ends_at-starts_at))/60),0) minutes FROM public.bookings WHERE business_id=bid AND staff_id=s.id AND starts_at>=lo AND starts_at<hi AND status<>'cancelled') used WHERE s.business_id=bid AND s.active=1;
 SELECT jsonb_build_object('bookings',count(*),'cancelled',count(*) FILTER(WHERE status='cancelled'),'no_show',count(*) FILTER(WHERE status='no_show'),'completed_service_value',coalesce(sum(price_uyu) FILTER(WHERE status='completed'),0)) INTO result FROM public.bookings WHERE business_id=bid AND starts_at>=lo AND starts_at<hi;
 RETURN result||jsonb_build_object(
 'period',jsonb_build_object('from',lo,'until',hi,'days',30),'occupancy',occupation,'occupancy_method','Duración de turnos no cancelados / jornada actual menos descansos y cierres, últimos 30 días. No descuenta ausencias por fecha ni reconstruye horarios históricos.',
 'forecast_service_value',(SELECT coalesce(sum(price_uyu),0) FROM public.bookings WHERE business_id=bid AND starts_at>=hi AND status IN ('confirmed','pending')),'verified_payments',NULL,'payment_explanation','No hay proveedor de pagos: los valores de servicios no acreditan cobros.',
 'popular_services',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT s.name,count(*) count FROM public.bookings b JOIN public.services s ON s.id=b.service_id WHERE b.business_id=bid AND b.starts_at>=lo AND b.starts_at<hi AND b.status<>'cancelled' GROUP BY s.id,s.name ORDER BY count(*) DESC LIMIT 5) x),'[]'::jsonb),
 'demand_hours',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT to_char(starts_at AT TIME ZONE tz,'HH24') AS "hour",count(*) count FROM public.bookings WHERE business_id=bid AND starts_at>=lo AND starts_at<hi AND status<>'cancelled' GROUP BY 1 ORDER BY count(*) DESC) x),'[]'::jsonb),
 'recurrent_customers',(SELECT count(*) FROM (SELECT customer_id FROM public.bookings WHERE business_id=bid AND starts_at>=lo AND starts_at<hi AND status='completed' GROUP BY customer_id HAVING count(*)>=2) x),
 'daily',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT to_char(starts_at AT TIME ZONE tz,'YYYY-MM-DD') AS "day",count(*) count FROM public.bookings WHERE business_id=bid AND starts_at>=lo AND starts_at<hi GROUP BY 1 ORDER BY 1) x),'[]'::jsonb),
 'weekly',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT to_char(date_trunc('week',starts_at AT TIME ZONE tz),'YYYY-MM-DD') AS "start",count(*) count FROM public.bookings WHERE business_id=bid AND starts_at>=history AND starts_at<hi GROUP BY 1 ORDER BY 1) x),'[]'::jsonb),
 'monthly',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT to_char(starts_at AT TIME ZONE tz,'YYYY-MM') AS "month",count(*) count FROM public.bookings WHERE business_id=bid AND starts_at>=history AND starts_at<hi GROUP BY 1 ORDER BY 1) x),'[]'::jsonb),'history_days',90);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_invitation(token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE i public.invitations;
BEGIN
 IF coalesce(token,'')!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT * INTO i FROM public.invitations WHERE token_hash=private.hash(token) AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now();
 IF i.id IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 RETURN jsonb_build_object('email',i.email,'business_name',(SELECT name FROM public.businesses WHERE id=i.business_id),'role',i.role,'expires_at',i.expires_at,'has_account',EXISTS(SELECT 1 FROM public.users WHERE lower(email)=lower(i.email)));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_invite(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE iid text:=gen_random_uuid()::text;token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');email text:=lower(btrim(payload->>'email'));role text:=payload->>'role';sid text:=nullif(payload->>'staff_id','');
BEGIN PERFORM private.require_feature(bid,'access');
 IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 IF email IS NULL OR email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(email)>150 OR coalesce(role,'') NOT IN ('manager','staff') THEN RAISE EXCEPTION 'INVALID_INVITATION';END IF;
 IF EXISTS(SELECT 1 FROM public.memberships m JOIN public.users u ON u.id=m.user_id WHERE m.business_id=bid AND lower(u.email)=email) THEN RAISE EXCEPTION 'ALREADY_MEMBER';END IF;
 IF role='staff' AND NOT EXISTS(SELECT 1 FROM public.staff WHERE id=sid AND business_id=bid AND active=1 AND user_id IS NULL) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
 UPDATE public.invitations SET revoked_at=now() WHERE business_id=bid AND lower(invitations.email)=email AND accepted_at IS NULL AND revoked_at IS NULL;
 INSERT INTO public.invitations VALUES(iid,bid,email,role,CASE WHEN role='staff' THEN sid ELSE NULL END,private.hash(token),now()+interval '48 hours',null,null,private.user_id(),now());
 INSERT INTO private.invitation_tokens VALUES(iid,token);
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'invitation.created','invitation',iid,now());
 RETURN jsonb_build_object('id',iid,'delivery','pending_configuration');
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_mail_claim(batch_size integer DEFAULT 10)
 RETURNS SETOF mail_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE j public.mail_jobs;budget public.mail_daily_budget;today date:=(now() AT TIME ZONE 'UTC')::date;count_claimed int:=0;s private.commercial_settings;ceiling int;
BEGIN
 SELECT * INTO s FROM private.commercial_settings WHERE id=1;
 INSERT INTO public.mail_daily_budget(day,limit_count) VALUES(today,s.provider_daily_limit) ON CONFLICT(day) DO UPDATE SET limit_count=EXCLUDED.limit_count;
 SELECT * INTO budget FROM public.mail_daily_budget WHERE day=today FOR UPDATE;
 UPDATE public.mail_jobs SET state='delivery_unknown',lease_until=null,last_error='LEASE_EXPIRED_RECONCILIATION_REQUIRED',updated_at=now() WHERE state='processing' AND lease_until<now();
 FOR j IN SELECT * FROM public.mail_jobs WHERE state IN ('queued','retry','quota_exhausted') AND next_attempt_at<=now() AND (kind IN ('invitation','password_reset','auth','security') OR (NOT (SELECT operational_mail_paused FROM private.control_settings WHERE id=1) AND NOT coalesce((SELECT c.mail_paused FROM private.business_controls c WHERE c.business_id=mail_jobs.business_id),false))) ORDER BY CASE WHEN kind IN ('invitation','password_reset','auth','security') THEN 0 ELSE 1 END,next_attempt_at,created_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(batch_size,1),20) LOOP
  IF j.kind NOT IN ('invitation','password_reset','auth','security') AND ((SELECT operational_mail_paused FROM private.control_settings WHERE id=1) OR coalesce((SELECT mail_paused FROM private.business_controls WHERE business_id=j.business_id),false)) THEN CONTINUE;END IF;
  ceiling:=least(budget.limit_count,s.provider_daily_limit)-CASE WHEN j.kind IN ('invitation','password_reset','auth','security') THEN 0 ELSE s.security_reserve END;
  IF budget.attempts+count_claimed>=ceiling THEN CONTINUE;END IF;
  IF j.attempts>=5 THEN UPDATE public.mail_jobs SET state='failed',updated_at=now() WHERE id=j.id;CONTINUE;END IF;
  IF j.recipient='' OR lower(j.recipient)~'@(example\.(com|net|org)|[^@]+\.(test|invalid|example|localhost))$' OR NOT private.mail_is_valid(j) THEN UPDATE public.mail_jobs SET state='skipped',last_error='RECIPIENT_OR_PLAN_BLOCKED',updated_at=now() WHERE id=j.id;CONTINUE;END IF;
  IF NOT private.mail_reserve(j) THEN UPDATE public.mail_jobs SET state='quota_exhausted',last_error='MONTHLY_QUOTA_EXHAUSTED',next_attempt_at=(SELECT cycle_end FROM private.commercial_cycle(j.business_id)),updated_at=now() WHERE id=j.id;CONTINUE;END IF;
  UPDATE public.mail_jobs SET state='processing',lease_until=now()+interval '60 seconds',attempts=attempts+1,updated_at=now() WHERE id=j.id RETURNING * INTO j;count_claimed:=count_claimed+1;RETURN NEXT j;
 END LOOP;
 UPDATE public.mail_daily_budget SET attempts=attempts+count_claimed WHERE day=today;
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_mail_ingest()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE b record;
BEGIN
 FOR b IN SELECT DISTINCT business_id FROM public.recurring_appointments WHERE active=1 AND (end_day IS NULL OR end_day>=(now() AT TIME ZONE 'America/Montevideo')::date) ORDER BY business_id LOOP
  PERFORM private.expand_recurring(b.business_id,(now() AT TIME ZONE 'America/Montevideo')::date,8);
 END LOOP;
 RETURN private.mail_ingest_before_recurring();
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_mail_jobs(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN PERFORM private.require_feature(bid,'operational_mail'); PERFORM private.require_manager(bid);RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,kind,recipient,subject,state,attempts,last_error,next_attempt_at,created_at FROM public.mail_jobs WHERE business_id=bid ORDER BY created_at DESC LIMIT 100) x),'[]'::jsonb);END $function$
;
CREATE OR REPLACE FUNCTION public.atry_mail_result(job_id text, expected_attempt integer, provider_id text, error_code text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE new_state text;pid text:=nullif(btrim(provider_id),'');
BEGIN
 IF pid IS NULL AND error_code IS NULL THEN RAISE EXCEPTION 'PROVIDER_CONFIRMATION_REQUIRED';END IF;
 IF pid IS NOT NULL AND error_code IS NOT NULL THEN RAISE EXCEPTION 'AMBIGUOUS_PROVIDER_RESULT';END IF;
 new_state:=CASE WHEN pid IS NOT NULL THEN 'provider_accepted' WHEN error_code IN ('PROVIDER_CONNECTION_ERROR','BREVO_DUPLICATE_UNKNOWN','BREVO_HTTP_500','BREVO_HTTP_502','BREVO_HTTP_503','BREVO_HTTP_504') THEN 'delivery_unknown' ELSE 'retry' END;
 UPDATE public.mail_jobs SET state=CASE WHEN new_state='retry' AND attempts>=5 THEN 'failed' ELSE new_state END,provider_id=pid,last_error=left(regexp_replace(coalesce(error_code,''),'[^A-Z0-9_-]','','g'),80),lease_until=null,next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts-1))::int),updated_at=now() WHERE id=job_id AND attempts=expected_attempt AND state='processing';
 IF FOUND THEN UPDATE public.notifications SET state=(SELECT state FROM public.mail_jobs WHERE id=job_id) WHERE id=(SELECT source_id FROM public.mail_jobs WHERE id=job_id AND source='notification');RETURN true;END IF;RETURN false;
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_manage(token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE vid text;
BEGIN
 IF token IS NULL OR token!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT id INTO vid FROM public.booking_visits WHERE manage_token_hash=private.hash(token);IF vid IS NOT NULL THEN RETURN private.visit_read(vid);END IF;RETURN private.manage_single(token);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_manage_availability(token text, day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE b public.bookings;biz public.businesses;
BEGIN
 IF token!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT * INTO b FROM public.bookings WHERE manage_token_hash=private.hash(token);
 IF b.id IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT * INTO biz FROM public.businesses WHERE id=b.business_id;
 IF b.status NOT IN ('pending','confirmed') OR b.starts_at<now()+make_interval(hours=>biz.cancel_notice_hours) THEN RAISE EXCEPTION 'OUTSIDE_POLICY';END IF;
 RETURN public.atry_public_availability(biz.slug,b.service_id,day,b.staff_id);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_manage_change(token text, operation text, payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE vid text;
BEGIN
 IF token IS NULL OR token!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT id INTO vid FROM public.booking_visits WHERE manage_token_hash=private.hash(token);IF vid IS NOT NULL THEN RETURN private.visit_change(vid,operation,payload,false);END IF;RETURN private.manage_change_single(token,operation,payload);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_manage_visit_availability(token text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE vid text;bid text;v jsonb;ids text[];
BEGIN
 IF token IS NULL OR token!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT id,business_id INTO vid,bid FROM public.booking_visits WHERE manage_token_hash=private.hash(token);IF vid IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 v:=private.visit_read(vid);
 IF (v->>'starts_at')::timestamptz<now()+make_interval(hours=>(v->>'cancel_notice_hours')::int) OR EXISTS(SELECT 1 FROM jsonb_array_elements(v->'legs') l WHERE l->>'status' NOT IN('pending','confirmed')) THEN RAISE EXCEPTION 'OUTSIDE_POLICY';END IF;
 ids:=ARRAY(SELECT booking_id FROM public.booking_visit_items WHERE visit_id=vid);
 RETURN private.visit_options(bid,payload||jsonb_build_object('service_ids',(SELECT jsonb_agg(l->'service_id') FROM jsonb_array_elements(v->'legs') l)),ids,false,true);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_me()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u public.users;
BEGIN
 SELECT * INTO u FROM public.users WHERE id=private.user_id();IF u.id IS NULL THEN RETURN jsonb_build_object('user',null,'businesses','[]'::jsonb);END IF;
 RETURN jsonb_build_object('user',jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'platform_admin',u.platform_admin),'businesses',coalesce((SELECT jsonb_agg(to_jsonb(b)||jsonb_build_object('role',m.role,'staff_id',(SELECT id FROM public.staff WHERE business_id=b.id AND user_id=u.id AND active=1 LIMIT 1))) FROM public.businesses b JOIN public.memberships m ON m.business_id=b.id WHERE m.user_id=u.id),'[]'::jsonb));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_notification_preferences(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN PERFORM private.require_feature(bid,'operational_mail'); PERFORM private.require_manager(bid);RETURN coalesce((SELECT to_jsonb(p) FROM public.notification_preferences p WHERE business_id=bid),jsonb_build_object('business_id',bid,'confirmations',1,'cancellations',1,'reschedules',1,'reminders',1,'waitlist',1,'reminder_hours',24,'business_alerts',1));END $function$
;
CREATE OR REPLACE FUNCTION public.atry_notifications(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN PERFORM private.require_feature(bid,'operational_mail'); PERFORM private.require_manager(bid);RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,booking_id,kind,recipient,subject,state,created_at FROM public.notifications WHERE business_id=bid ORDER BY created_at DESC LIMIT 100) x),'[]'::jsonb);END $function$
;
CREATE OR REPLACE FUNCTION public.atry_offer(token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE w public.waitlist;slot jsonb;
BEGIN IF EXISTS(SELECT 1 FROM public.waitlist WHERE offer_token_hash=private.hash(atry_offer.token)) THEN PERFORM private.require_feature((SELECT business_id FROM public.waitlist WHERE offer_token_hash=private.hash(atry_offer.token)),'waitlist');END IF;
 IF coalesce(token,'')!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT * INTO w FROM public.waitlist WHERE offer_token_hash=private.hash(token) AND status='offered' AND offer_expires_at>now();IF w.id IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 slot:=private.check_slot(w.business_id,w.offer_staff_id,w.service_id,w.offer_starts_at,'',true);
 RETURN jsonb_build_object('business_name',(SELECT name FROM public.businesses WHERE id=w.business_id),'service_name',(SELECT name FROM public.services WHERE id=w.service_id),'starts_at',w.offer_starts_at,'expires_at',w.offer_expires_at);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_profile(name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN
 IF private.user_id() IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF name IS NULL OR length(btrim(name)) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'INVALID_NAME';END IF;
 UPDATE public.users SET name=btrim(name) WHERE id=private.user_id();RETURN jsonb_build_object('ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_public_availability(slug text, service_id text, day date, staff_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_public_book(slug text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE bid text;
BEGIN
 SELECT id INTO bid FROM public.businesses b WHERE b.slug=atry_public_book.slug;
 IF bid IS NULL THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;
 RETURN private.create_booking(bid,payload,'public');
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_public_info(slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;b public.businesses;
BEGIN
 result:=private.public_info_theme_base(slug);SELECT * INTO b FROM public.businesses WHERE businesses.slug=atry_public_info.slug;
 RETURN jsonb_set(result,'{business}',result->'business'||jsonb_build_object('plan',b.plan,'theme_config',private.project_theme(b),'multi_service_enabled',b.multi_service_enabled,'logo_url',CASE WHEN b.plan IN('negocio','pro') THEN b.logo_url ELSE '' END));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_public_rate(key_hash text, request_scope text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE attempts int;
BEGIN
 IF key_hash!~'^[a-f0-9]{64}$' OR length(request_scope)>80 THEN RAISE EXCEPTION 'INVALID_RATE_KEY';END IF;
 DELETE FROM public.public_rate_buckets WHERE ctid IN(SELECT ctid FROM public.public_rate_buckets WHERE bucket<now()-interval '1 day' LIMIT 1000);
 INSERT INTO public.public_rate_buckets VALUES(key_hash,request_scope,date_trunc('minute',now()),1) ON CONFLICT ON CONSTRAINT public_rate_buckets_pkey DO UPDATE SET attempts=public.public_rate_buckets.attempts+1 RETURNING public_rate_buckets.attempts INTO attempts;
 RETURN attempts<=10;
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_public_visit_availability(slug text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE bid text;
BEGIN SELECT id INTO bid FROM public.businesses WHERE businesses.slug=atry_public_visit_availability.slug;IF bid IS NULL THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;RETURN private.visit_options(bid,payload);END $function$
;
CREATE OR REPLACE FUNCTION public.atry_public_visit_book(slug text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE bid text;
BEGIN SELECT id INTO bid FROM public.businesses WHERE businesses.slug=atry_public_visit_book.slug;IF bid IS NULL THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;RETURN private.visit_create(bid,payload);END $function$
;
CREATE OR REPLACE FUNCTION public.atry_public_waitlist(slug text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE b public.businesses;wid text:=gen_random_uuid()::text;key text:=payload->>'idempotency_key';scope text;fingerprint text:=private.hash(payload::text);previous public.idempotency_keys;result jsonb;day date;name text:=btrim(payload->>'customer_name');email text:=lower(btrim(payload->>'customer_email'));sid text:=nullif(payload->>'staff_id','');
BEGIN PERFORM private.require_feature((SELECT id FROM public.businesses WHERE businesses.slug=atry_public_waitlist.slug),'waitlist');
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
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_record_mail_receipt(event_id text, message_id text, event_kind text, event_time timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE matched boolean;
BEGIN
 IF length(event_id) NOT BETWEEN 1 AND 250 OR length(message_id) NOT BETWEEN 1 AND 300 OR event_kind NOT IN ('delivered','hard_bounce','soft_bounce','blocked','invalid','sent','deferred') OR event_time>now()+interval '5 minutes' OR event_time<now()-interval '90 days' THEN RAISE EXCEPTION 'INVALID_RECEIPT';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('receipt:'||message_id,0));
 INSERT INTO private.mail_receipts(id,provider_id,event,occurred_at) VALUES(event_id,message_id,event_kind,event_time) ON CONFLICT DO NOTHING;
 matched:=private.apply_mail_receipts(message_id);RETURN jsonb_build_object('accepted',true,'matched',matched);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_recurring(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN PERFORM private.require_feature(bid,'recurring');
 PERFORM private.require_manager(bid);
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.active DESC,x.start_day,x.minute) FROM (
 SELECT r.*,s.name service_name,st.name staff_name FROM public.recurring_appointments r JOIN public.services s ON s.id=r.service_id JOIN public.staff st ON st.id=r.staff_id WHERE r.business_id=bid) x),'[]'::jsonb);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_report_support(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid text:=private.user_id();iid text:=gen_random_uuid()::text;subject text:=btrim(coalesce(payload->>'subject',''));description text:=btrim(coalesce(payload->>'description',''));category text:=coalesce(payload->>'category','service');
BEGIN
 IF uid IS NULL OR private.member_role(bid) IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF length(subject) NOT BETWEEN 5 AND 180 OR length(description)>2000 OR category NOT IN ('service','access','booking','mail','subscription') THEN RAISE EXCEPTION 'INVALID_INCIDENT';END IF;
 IF (SELECT count(*) FROM public.incidents WHERE created_by=uid AND created_at>now()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'ADMIN_RATE_LIMIT';END IF;
 INSERT INTO public.incidents(id,business_id,subject,state,created_by,created_at,updated_at,description,category) VALUES(iid,bid,subject,'open',uid,now(),now(),description,category);RETURN jsonb_build_object('id',iid);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_request_plan(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE p public.plans;phone text:=regexp_replace(coalesce(payload->>'phone',''),'[ ()-]','','g');key text:=payload->>'request_id';digest text;old public.plan_requests;rid text;
BEGIN
 IF private.member_role(bid)<>'owner' OR private.member_role(bid) IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 SELECT * INTO p FROM public.plans WHERE code=payload->>'plan' AND code<>'trial';
 IF p.code IS NULL OR phone!~'^\+[1-9][0-9]{7,14}$' OR key IS NULL OR key!~'^[A-Za-z0-9_-]{16,100}$' THEN RAISE EXCEPTION 'INVALID_PLAN_REQUEST';END IF;
 digest:=private.hash(jsonb_build_object('plan',p.code,'phone',phone)::text);
 SELECT * INTO old FROM public.plan_requests WHERE business_id=bid AND request_key=key;
 IF FOUND THEN IF old.request_hash<>digest THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';END IF;RETURN public.atry_subscription(bid);END IF;
 IF EXISTS(SELECT 1 FROM public.plan_requests WHERE business_id=bid AND state IN ('pending_contact','pending_payment','pending_verification')) THEN RAISE EXCEPTION 'OPEN_REQUEST_EXISTS';END IF;
 INSERT INTO public.plan_requests(business_id,requested_by,plan,price_uyu,phone,request_key,request_hash) VALUES(bid,private.user_id(),p.code,p.price_uyu,phone,key,digest) RETURNING id INTO rid;
 UPDATE public.businesses SET phone=phone WHERE id=bid;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'plan.requested','plan_request',rid,now());RETURN public.atry_subscription(bid);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_revoke_invitation(bid text, invitation_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN PERFORM private.require_feature(bid,'access');
 IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 UPDATE public.invitations SET revoked_at=now() WHERE id=invitation_id AND business_id=bid AND accepted_at IS NULL AND revoked_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_UNAVAILABLE';END IF;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'invitation.revoked','invitation',invitation_id,now());RETURN jsonb_build_object('ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_revoke_session(session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF private.user_id() IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 DELETE FROM auth.sessions WHERE id::text=session_id AND user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 RETURN jsonb_build_object('ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_rules(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF coalesce(private.member_role(bid),'') NOT IN ('owner','manager') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('breaks',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.recurring_breaks x WHERE business_id=bid),'[]'::jsonb),'exceptions',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.schedule_exceptions x WHERE business_id=bid),'[]'::jsonb),'holidays',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.holidays x WHERE business_id=bid),'[]'::jsonb),'resources',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.resources x WHERE business_id=bid AND private.has_feature(bid,'resources')),'[]'::jsonb),'time_off',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.time_off x WHERE business_id=bid),'[]'::jsonb),'hours',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.working_hours x JOIN public.staff s ON s.id=x.staff_id WHERE s.business_id=bid),'[]'::jsonb),'service_resources',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.service_resources x JOIN public.services s ON s.id=x.service_id WHERE s.business_id=bid AND private.has_feature(bid,'resources')),'[]'::jsonb));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_runtime_config()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('app','Atry Turnos','version','1.3.0','currency','UYU','timezone','America/Montevideo','payments_live',false,'whatsapp_live',false,'mail_provider',CASE WHEN mail_enabled THEN 'brevo' ELSE 'disabled' END,'automatic_email_live',mail_enabled,'tax_status',(SELECT tax_status FROM private.commercial_settings WHERE id=1),'plans',(SELECT jsonb_agg(to_jsonb(p) ORDER BY price_uyu) FROM public.plans p WHERE code<>'trial')) FROM private.runtime_settings WHERE id=1
$function$
;
CREATE OR REPLACE FUNCTION public.atry_save_appearance(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE b public.businesses;incoming jsonb;config jsonb;defaults jsonb;logo text;
BEGIN
 IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM public.businesses WHERE id=bid FOR UPDATE;IF b.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF NOT private.subscription_live(bid) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';END IF;
 IF jsonb_typeof(payload) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(payload) k WHERE k NOT IN('theme_config','expected_revision','reset_theme','primary_color','secondary_color','appearance_mode','logo_url')) THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
 IF payload ? 'expected_revision' AND (jsonb_typeof(payload->'expected_revision')<>'number' OR (payload->>'expected_revision')!~'^[0-9]+$' OR (payload->>'expected_revision')::numeric<>b.theme_revision) THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
 IF payload ? 'reset_theme' AND jsonb_typeof(payload->'reset_theme')<>'boolean' THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
 incoming:=coalesce(payload->'theme_config','{}');
 IF jsonb_typeof(incoming)<>'object' THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
 IF payload ? 'primary_color' THEN incoming:=incoming||jsonb_build_object('primary',payload->'primary_color');END IF;
 IF payload ? 'secondary_color' THEN incoming:=incoming||jsonb_build_object('secondary',payload->'secondary_color');END IF;
 IF payload ? 'appearance_mode' THEN incoming:=incoming||jsonb_build_object('mode',payload->'appearance_mode');END IF;
 config:=private.validate_theme(incoming,b.plan);
 defaults:=CASE WHEN payload->'reset_theme'='true'::jsonb THEN private.theme_defaults(b.plan) WHEN b.theme_config='{}'::jsonb THEN jsonb_build_object('primary',b.primary_color,'secondary',b.secondary_color,'mode',b.appearance_mode) ELSE b.theme_config END;
 config:=defaults||config;logo:=b.logo_url;
 IF payload ? 'logo_url' THEN
  logo:=payload->>'logo_url';
  IF jsonb_typeof(payload->'logo_url')<>'string' OR length(logo)>140000 OR (logo<>'' AND logo!~'^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
  IF b.plan NOT IN('negocio','pro') AND logo<>'' THEN RAISE EXCEPTION 'APPEARANCE_PLAN_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 UPDATE public.businesses SET theme_config=config,theme_revision=theme_revision+1,primary_color=coalesce(config->>'primary',primary_color),secondary_color=coalesce(config->>'secondary',secondary_color),appearance_mode=coalesce(config->>'mode',appearance_mode),logo_url=logo WHERE id=bid;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'business.appearance.updated','business',bid,now());
 RETURN public.atry_business(bid);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_save_business(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE appearance jsonb;result jsonb;
BEGIN
 PERFORM private.require_manager(bid);
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO appearance FROM jsonb_each(payload) WHERE key IN('primary_color','secondary_color','appearance_mode','logo_url','theme_config','expected_revision','reset_theme');
 result:=private.save_business_theme_base(bid,payload-ARRAY['primary_color','secondary_color','appearance_mode','logo_url','theme_config','expected_revision','reset_theme','multi_service_enabled']);
 IF payload ? 'multi_service_enabled' THEN
  IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
  IF payload->'multi_service_enabled' NOT IN('0'::jsonb,'1'::jsonb) THEN RAISE EXCEPTION 'INVALID_SETTING';END IF;
  UPDATE public.businesses SET multi_service_enabled=(payload->>'multi_service_enabled')::int WHERE id=bid;
 END IF;
 IF appearance<>'{}'::jsonb THEN PERFORM public.atry_save_appearance(bid,appearance);END IF;
 RETURN public.atry_business(bid);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_save_customer(bid text, customer_id text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE c public.customers;n text;e text;p text;note text;consent integer;cid text:=coalesce(nullif(customer_id,''),gen_random_uuid()::text);
BEGIN
 PERFORM private.require_manager(bid);
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 IF nullif(customer_id,'') IS NOT NULL THEN SELECT * INTO c FROM public.customers x WHERE x.id=customer_id AND x.business_id=bid FOR UPDATE;IF c.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;END IF;
 n:=btrim(coalesce(payload->>'name',c.name,''));e:=lower(btrim(coalesce(payload->>'email',c.email,'')));p:=btrim(coalesce(payload->>'phone',c.phone,''));note:=coalesce(payload->>'notes',c.notes,'');
 IF length(n)<2 OR length(n)>100 OR length(e)>150 OR length(p)>35 OR length(note)>700 OR (e='' AND regexp_replace(p,'[^0-9]','','g')='') OR (e<>'' AND e!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'INVALID_CONTACT';END IF;
 IF payload?'marketing_consent' AND coalesce(payload->>'marketing_consent','') NOT IN ('0','1') THEN RAISE EXCEPTION 'INVALID_CONSENT';END IF;
 consent:=coalesce((payload->>'marketing_consent')::integer,c.marketing_consent,0);
 IF EXISTS(SELECT 1 FROM public.customers x WHERE x.business_id=bid AND x.id<>cid AND ((e<>'' AND lower(x.email)=e) OR (regexp_replace(p,'[^0-9]','','g')<>'' AND regexp_replace(x.phone,'[^0-9]','','g')=regexp_replace(p,'[^0-9]','','g')))) THEN RAISE EXCEPTION 'CONTACT_CONFLICT';END IF;
 IF c.id IS NULL THEN INSERT INTO public.customers(id,business_id,name,email,phone,notes,marketing_consent,created_at) VALUES(cid,bid,n,e,p,note,consent,now());
 ELSE
  UPDATE public.customers x SET name=n,email=e,phone=p,notes=note,marketing_consent=consent WHERE x.id=cid AND x.business_id=bid;
  UPDATE public.recurring_appointments r SET customer_name=n,customer_email=e,customer_phone=p WHERE r.business_id=bid AND private.has_feature(bid,'recurring') AND r.customer_email=c.email AND r.customer_phone=c.phone;
 END IF;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),CASE WHEN c.id IS NULL THEN 'customer.created' ELSE 'customer.updated' END,'customer',cid,now());
 RETURN (SELECT to_jsonb(x) FROM public.customers x WHERE x.id=cid AND x.business_id=bid);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_save_notification_preferences(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE p public.notification_preferences;k text;
BEGIN IF coalesce((payload->>'waitlist')::int,0)=1 THEN PERFORM private.require_feature(bid,'waitlist');END IF; PERFORM private.require_feature(bid,'operational_mail');
 PERFORM private.require_manager(bid);PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 p:=jsonb_populate_record(NULL::public.notification_preferences,public.atry_notification_preferences(bid));
 FOREACH k IN ARRAY ARRAY['confirmations','cancellations','reschedules','reminders','waitlist','business_alerts'] LOOP IF payload?k AND coalesce(payload->>k,'') NOT IN ('0','1') THEN RAISE EXCEPTION 'INVALID_PREFERENCE';END IF;END LOOP;
 IF payload?'reminder_hours' AND (coalesce(payload->>'reminder_hours','')!~'^[0-9]+$' OR (payload->>'reminder_hours')::integer NOT BETWEEN 1 AND 168) THEN RAISE EXCEPTION 'INVALID_REMINDER';END IF;
 INSERT INTO public.notification_preferences VALUES(bid,coalesce((payload->>'confirmations')::integer,p.confirmations),coalesce((payload->>'cancellations')::integer,p.cancellations),coalesce((payload->>'reschedules')::integer,p.reschedules),coalesce((payload->>'reminders')::integer,p.reminders),coalesce((payload->>'waitlist')::integer,p.waitlist),coalesce((payload->>'reminder_hours')::integer,p.reminder_hours),coalesce((payload->>'business_alerts')::integer,p.business_alerts)) ON CONFLICT(business_id) DO UPDATE SET confirmations=excluded.confirmations,cancellations=excluded.cancellations,reschedules=excluded.reschedules,reminders=excluded.reminders,waitlist=excluded.waitlist,reminder_hours=excluded.reminder_hours,business_alerts=excluded.business_alerts;
 UPDATE public.mail_jobs j SET next_attempt_at=greatest(now(),b.starts_at-make_interval(hours=>coalesce((payload->>'reminder_hours')::integer,p.reminder_hours))),state=CASE WHEN coalesce((payload->>'reminders')::integer,p.reminders)=1 THEN 'queued' ELSE 'skipped' END FROM public.bookings b WHERE j.business_id=bid AND j.kind='reminder' AND j.source_id=b.id AND j.state IN ('queued','retry','skipped') AND coalesce(j.last_error,'')<>'ADMIN_CANCELLED' AND NOT EXISTS(SELECT 1 FROM private.mail_archives a WHERE a.job_id=j.id) AND b.starts_at>now() AND b.status IN ('confirmed','pending');RETURN public.atry_notification_preferences(bid);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_save_rule(bid text, kind text, rule_id text, payload jsonb, remove boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE rid text:=coalesce(rule_id,gen_random_uuid()::text);sid text:=payload->>'staff_id';r text;h jsonb;day text;resource_enabled int;
BEGIN
 IF coalesce(private.member_role(bid),'') NOT IN ('owner','manager') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 IF kind NOT IN ('breaks','exceptions','holidays','resources','time_off','hours','service_resources') THEN RAISE EXCEPTION 'INVALID_RULE';END IF;
 SELECT p.resources INTO resource_enabled FROM public.plans p JOIN public.businesses b ON b.plan=p.code WHERE b.id=bid;
 IF kind IN ('resources','service_resources') AND coalesce(resource_enabled,0)<>1 THEN RAISE EXCEPTION 'PLAN_FEATURE_DISABLED';END IF;
 IF NOT remove AND kind IN ('breaks','exceptions','time_off','hours') AND NOT EXISTS(SELECT 1 FROM public.staff WHERE id=sid AND business_id=bid AND active=1) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
 IF kind IS NULL OR kind NOT IN ('breaks','exceptions','holidays','resources','time_off','hours','service_resources') THEN RAISE EXCEPTION 'INVALID_RULE';END IF;
 CASE kind
 WHEN 'breaks' THEN
  IF remove THEN DELETE FROM public.recurring_breaks WHERE id=rid AND business_id=bid;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  ELSE INSERT INTO public.recurring_breaks VALUES(rid,bid,sid,(payload->>'weekday')::int,(payload->>'start_min')::int,(payload->>'end_min')::int);END IF;
 WHEN 'exceptions' THEN
  IF remove THEN DELETE FROM public.schedule_exceptions WHERE id=rid AND business_id=bid;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  ELSE day:=to_char((payload->>'day')::date,'YYYY-MM-DD');IF day IS NULL THEN RAISE EXCEPTION 'INVALID_DAY';END IF;
   INSERT INTO public.schedule_exceptions VALUES(rid,bid,sid,day,(payload->>'start_min')::int,(payload->>'end_min')::int,coalesce((payload->>'closed')::int,0)) ON CONFLICT(staff_id,day) DO UPDATE SET start_min=excluded.start_min,end_min=excluded.end_min,closed=excluded.closed RETURNING id INTO rid;END IF;
 WHEN 'holidays' THEN
  IF remove THEN DELETE FROM public.holidays WHERE id=rid AND business_id=bid;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  ELSE day:=to_char((payload->>'day')::date,'YYYY-MM-DD');IF day IS NULL OR length(btrim(coalesce(payload->>'name','')))<2 THEN RAISE EXCEPTION 'INVALID_HOLIDAY';END IF;
   INSERT INTO public.holidays VALUES(rid,bid,day,left(btrim(payload->>'name'),100));END IF;
 WHEN 'resources' THEN
  IF remove THEN RAISE EXCEPTION 'DEACTIVATE_RESOURCE_INSTEAD';END IF;
  IF rule_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.resources WHERE id=rid AND business_id=bid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
   IF coalesce((payload->>'active')::int,1)=0 AND EXISTS(SELECT 1 FROM public.booking_resources br JOIN public.bookings b ON b.id=br.booking_id WHERE br.resource_id=rid AND b.status IN ('pending','confirmed') AND b.ends_at>now()) THEN RAISE EXCEPTION 'RESOURCE_IN_USE';END IF;
   IF payload ? 'name' AND length(btrim(coalesce(payload->>'name','')))<2 THEN RAISE EXCEPTION 'INVALID_RESOURCE';END IF;
   UPDATE public.resources SET name=left(btrim(coalesce(payload->>'name',name)),100),active=coalesce((payload->>'active')::int,active) WHERE id=rid AND business_id=bid;
  ELSE IF length(btrim(coalesce(payload->>'name','')))<2 THEN RAISE EXCEPTION 'INVALID_RESOURCE';END IF;INSERT INTO public.resources VALUES(rid,bid,left(btrim(payload->>'name'),100),1);END IF;
 WHEN 'time_off' THEN
  IF remove THEN DELETE FROM public.time_off WHERE id=rid AND business_id=bid;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  ELSE INSERT INTO public.time_off VALUES(rid,bid,sid,(payload->>'starts_at')::timestamptz,(payload->>'ends_at')::timestamptz,left(coalesce(payload->>'reason',''),200));END IF;
 WHEN 'hours' THEN
  IF remove OR coalesce(jsonb_typeof(payload->'hours'),'null')<>'array' OR jsonb_array_length(payload->'hours')>7 THEN RAISE EXCEPTION 'INVALID_HOURS';END IF;
  DELETE FROM public.working_hours WHERE staff_id=sid;
  FOR h IN SELECT * FROM jsonb_array_elements(payload->'hours') LOOP INSERT INTO public.working_hours VALUES(sid,(h->>'weekday')::int,(h->>'start_min')::int,(h->>'end_min')::int);END LOOP;
  rid:=sid;
 WHEN 'service_resources' THEN
  sid:=payload->>'service_id';IF remove OR NOT EXISTS(SELECT 1 FROM public.services WHERE id=sid AND business_id=bid) OR coalesce(jsonb_typeof(payload->'resource_ids'),'null')<>'array' THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
  IF EXISTS(SELECT 1 FROM public.bookings WHERE service_id=sid AND business_id=bid AND status IN ('pending','confirmed') AND ends_at>now()) THEN RAISE EXCEPTION 'SERVICE_IN_USE';END IF;
  DELETE FROM public.service_resources WHERE service_id=sid;
  FOR r IN SELECT jsonb_array_elements_text(payload->'resource_ids') LOOP
   IF NOT EXISTS(SELECT 1 FROM public.resources WHERE id=r AND business_id=bid AND active=1) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
   INSERT INTO public.service_resources VALUES(sid,r) ON CONFLICT DO NOTHING;
  END LOOP;rid:=sid;
 END CASE;
 PERFORM private.assert_future(bid);
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'rule.'||kind||CASE WHEN remove THEN '.removed' ELSE '.saved' END,kind,rid,now());
 RETURN jsonb_build_object('id',rid,'ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_save_service(bid text, service_id text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_save_staff(bid text, staff_id text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_save_week(bid text, sid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_sessions()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF private.user_id() IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'created_at',s.created_at,'expires_at',least(coalesce(s.not_after,s.created_at+interval '7 days'),s.created_at+interval '7 days'),'current',s.id::text=auth.jwt()->>'session_id')) FROM auth.sessions s WHERE s.user_id=auth.uid() AND s.created_at>now()-interval '7 days' AND (s.not_after IS NULL OR s.not_after>now())),'[]'::jsonb);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_smartslots(bid text, day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE b public.businesses;s public.services;slots jsonb;result jsonb:='[]';
BEGIN PERFORM private.require_feature(bid,'smartslots');
 PERFORM private.require_manager(bid);SELECT * INTO b FROM public.businesses WHERE id=bid;
 IF (SELECT smartslots FROM public.plans WHERE code=b.plan)=0 THEN RAISE EXCEPTION 'FEATURE_DISABLED' USING ERRCODE='42501';END IF;
 FOR s IN SELECT * FROM public.services WHERE business_id=bid AND active=1 ORDER BY created_at LOOP
  slots:=public.atry_public_availability(b.slug,s.id,day,NULL)->'slots';
  result:=result||coalesce((SELECT jsonb_agg(value||jsonb_build_object('service_id',s.id,'service_name',s.name)) FROM (SELECT value FROM jsonb_array_elements(slots) WITH ORDINALITY ORDER BY ordinality LIMIT 3) x),'[]'::jsonb);
 END LOOP;
 RETURN jsonb_build_object('date',day,'method','Disponibilidad validada por el motor; hasta tres alternativas por servicio','suggestions',result);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_staff_photos(bid text, public_view boolean DEFAULT false, sid text DEFAULT NULL::text, payload jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r text;old_revision integer;old_path text;new_path text;result jsonb;
BEGIN
 IF NOT public_view OR payload IS NOT NULL THEN
  r:=private.member_role(bid);IF coalesce(r,'') NOT IN ('owner','manager','staff') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 END IF;
 IF payload IS NULL THEN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.staff_photos p JOIN public.staff s ON s.id=p.staff_id JOIN public.businesses b ON b.id=p.business_id WHERE p.business_id=bid AND (NOT public_view OR p.show_public AND s.active=1 AND b.is_active=1)),'[]');
 END IF;
 IF r NOT IN ('owner','manager') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.staff WHERE id=sid AND business_id=bid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT path,revision INTO old_path,old_revision FROM public.staff_photos WHERE staff_id=sid AND business_id=bid;
 IF NOT(payload ? 'expected_path') OR (payload->>'expected_path') IS DISTINCT FROM old_path OR coalesce((payload->>'expected_revision')::integer,-1)<>coalesce(old_revision,0) THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
 IF jsonb_typeof(payload->'show_public') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'INVALID_VISIBILITY';END IF;
 new_path:=CASE WHEN payload ? 'path' THEN payload->>'path' ELSE old_path END;
 IF new_path IS NULL THEN DELETE FROM public.staff_photos WHERE staff_id=sid AND business_id=bid;
 ELSE
  IF split_part(new_path,'/',1)<>bid OR split_part(new_path,'/',2)<>sid OR NOT public.staff_photo_storage_access(new_path,true) THEN RAISE EXCEPTION 'INVALID_PHOTO_PATH';END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='staff-photos' AND name=new_path AND metadata->>'mimetype'='image/webp' AND (metadata->>'size')::bigint BETWEEN 16 AND 65536) THEN RAISE EXCEPTION 'INVALID_PHOTO_OBJECT';END IF;
  INSERT INTO public.staff_photos VALUES(sid,bid,new_path,(payload->>'show_public')::boolean,coalesce(old_revision,0)+1) ON CONFLICT(staff_id) DO UPDATE SET path=excluded.path,show_public=excluded.show_public,revision=excluded.revision;
 END IF;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'staff.photo.updated','staff',sid,now());
 SELECT to_jsonb(p) INTO result FROM public.staff_photos p WHERE staff_id=sid AND business_id=bid;
 RETURN jsonb_build_object('photo',result,'old_path',old_path);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_statistics(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN PERFORM private.require_manager(bid);PERFORM private.require_feature(bid,'statistics');RETURN (SELECT jsonb_build_object('total',count(*),'completed',count(*) FILTER(WHERE status='completed'),'cancelled',count(*) FILTER(WHERE status='cancelled')) FROM public.bookings WHERE business_id=bid AND starts_at>=now()-interval '30 days' AND starts_at<now());END $function$
;
CREATE OR REPLACE FUNCTION public.atry_subscription(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE caps jsonb:=public.atry_entitlements(bid);biz public.businesses;contact jsonb;
BEGIN
 SELECT * INTO biz FROM public.businesses WHERE id=bid;SELECT jsonb_build_object('whatsapp',whatsapp,'tax_status',tax_status) INTO contact FROM private.commercial_settings WHERE id=1;
 RETURN jsonb_build_object('plans',(SELECT jsonb_agg(to_jsonb(p) ORDER BY price_uyu) FROM public.plans p WHERE code<>'trial'),'settings',contact,'entitlements',caps,'requests',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('message','Hola, quiero contratar Atry Turnos.'||chr(10)||'Negocio: '||biz.name||chr(10)||'Plan solicitado: '||(SELECT name FROM public.plans WHERE code=r.plan)||chr(10)||'Precio mensual propuesto: $'||r.price_uyu||' UYU'||chr(10)||'Código de solicitud: '||r.code||chr(10)||'Me gustaría coordinar la transferencia y habilitación de mi cuenta.') ORDER BY r.created_at DESC) FROM public.plan_requests r WHERE r.business_id=bid),'[]'::jsonb));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_update_booking(bid text, booking_id text, patch jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ SELECT private.update_booking(bid,booking_id,patch,'manual') $function$
;
CREATE OR REPLACE FUNCTION public.atry_update_member(bid text, member_id text, patch jsonb, remove boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE old public.memberships;new_role text;sid text;
BEGIN PERFORM private.require_feature(bid,'access');
 IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;SELECT * INTO old FROM public.memberships WHERE business_id=bid AND user_id=member_id;
 IF old.user_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 new_role:=coalesce(patch->>'role',old.role);IF new_role NOT IN ('owner','manager','staff') THEN RAISE EXCEPTION 'INVALID_ROLE';END IF;
 IF old.role='owner' AND (remove OR new_role<>'owner') AND (SELECT count(*) FROM public.memberships WHERE business_id=bid AND role='owner')<=1 THEN RAISE EXCEPTION 'LAST_OWNER';END IF;
 IF remove THEN DELETE FROM public.memberships WHERE business_id=bid AND user_id=member_id;UPDATE public.staff SET user_id=null WHERE business_id=bid AND user_id=member_id;
 ELSE
  IF patch?'staff_id' THEN sid:=nullif(patch->>'staff_id','');ELSE SELECT id INTO sid FROM public.staff WHERE business_id=bid AND user_id=member_id AND active=1 LIMIT 1;END IF;
  IF new_role='staff' AND sid IS NULL THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
  IF sid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.staff WHERE id=sid AND business_id=bid AND active=1 AND (user_id IS NULL OR user_id=member_id)) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
  UPDATE public.memberships SET role=new_role WHERE business_id=bid AND user_id=member_id;
  IF patch?'staff_id' OR new_role='staff' THEN UPDATE public.staff SET user_id=null WHERE business_id=bid AND user_id=member_id;IF sid IS NOT NULL THEN UPDATE public.staff SET user_id=member_id WHERE id=sid AND business_id=bid;END IF;END IF;
 END IF;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),CASE WHEN remove THEN 'member.removed' ELSE 'member.updated' END,'membership',member_id,now());RETURN jsonb_build_object('ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_update_waitlist(bid text, waitlist_id text, status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN PERFORM private.require_feature(bid,'waitlist');
 PERFORM private.require_manager(bid);PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 IF coalesce(status,'') NOT IN ('waiting','cancelled') THEN RAISE EXCEPTION 'INVALID_STATUS';END IF;
 UPDATE public.waitlist SET status=atry_update_waitlist.status,offer_token_hash=null,offer_expires_at=null WHERE id=waitlist_id AND business_id=bid AND waitlist.status<>'booked';IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'waitlist.updated','waitlist',waitlist_id,now());RETURN jsonb_build_object('ok',true);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_usage_local()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=private.user_id() AND platform_admin=1) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('database_bytes',pg_database_size(current_database()),'mail_budget',(SELECT to_jsonb(x)||jsonb_build_object('warning',attempts>=limit_count*.7) FROM public.mail_daily_budget x WHERE day=(now() AT TIME ZONE 'UTC')::date),'provider_usage_available',false);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_visit(bid text, visit_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN PERFORM private.require_manager(bid);IF NOT EXISTS(SELECT 1 FROM public.booking_visits WHERE id=visit_id AND business_id=bid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;RETURN private.visit_read(visit_id);END $function$
;
CREATE OR REPLACE FUNCTION public.atry_visit_availability(bid text, visit_id text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v jsonb;ids text[];
BEGIN
 v:=public.atry_visit(bid,visit_id);IF EXISTS(SELECT 1 FROM jsonb_array_elements(v->'legs') l WHERE l->>'status' NOT IN('pending','confirmed')) THEN RAISE EXCEPTION 'FINALIZED';END IF;
 ids:=ARRAY(SELECT booking_id FROM public.booking_visit_items WHERE booking_visit_items.visit_id=atry_visit_availability.visit_id);
 RETURN private.visit_options(bid,payload||jsonb_build_object('service_ids',(SELECT jsonb_agg(l->'service_id') FROM jsonb_array_elements(v->'legs') l)),ids,true,true);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_visit_command(bid text, visit_id text, operation text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN PERFORM public.atry_visit(bid,visit_id);RETURN private.visit_change(visit_id,operation,payload,true);END $function$
;
CREATE OR REPLACE FUNCTION public.atry_waitlist(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
BEGIN PERFORM private.require_feature(bid,'waitlist');
 PERFORM private.require_manager(bid);
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT w.id,w.service_id,w.staff_id,w.customer_name,w.customer_email,w.customer_phone,w.desired_date,w.status,w.offered_at,w.created_at,s.name service_name FROM public.waitlist w JOIN public.services s ON s.id=w.service_id WHERE w.business_id=bid ORDER BY w.created_at DESC LIMIT 100) x),'[]'::jsonb);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_whatsapp(bid text, action text, verb text, payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE role text:=private.member_role(bid);plan_code text;cfg jsonb;cap integer;cid text;bk text;b public.bookings;c public.customers;item jsonb;key text;txt text;allowed_vars text[]:=ARRAY['cliente','negocio','profesional','servicio','fecha','hora','duracion','direccion','fecha_anterior','hora_anterior','enlace'];token text;last_state text;country text;digits text;raw_phone text;kind text;st text;result jsonb;context_data jsonb:='{}';reminder_action public.whatsapp_actions;actor_uid text:=private.user_id();
BEGIN
 IF coalesce(role,'') NOT IN ('owner','manager','staff') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT plan INTO plan_code FROM public.businesses WHERE id=bid;
 IF role='staff' AND plan_code='individual' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 cap:=CASE plan_code WHEN 'pro' THEN 100 WHEN 'negocio' THEN 10 ELSE 2 END;
 SELECT config INTO cfg FROM public.whatsapp_settings WHERE business_id=bid;cfg:=coalesce(cfg,'{}');
 IF action='settings' THEN
  IF verb='PUT' THEN
   PERFORM private.require_manager(bid);
   IF jsonb_typeof(payload->'custom') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'custom')>cap THEN RAISE EXCEPTION 'Límite de plantillas del plan';END IF;
   IF coalesce(payload->>'country','')!~'^[0-9]{1,3}$' OR (payload->>'reminder_hours')::integer NOT BETWEEN 1 AND 168 OR length(coalesce(payload->>'name',''))>100 THEN RAISE EXCEPTION 'Configuración inválida';END IF;
   IF jsonb_typeof(payload->'enabled') IS DISTINCT FROM 'boolean' OR jsonb_typeof(payload->'reminders') IS DISTINCT FROM 'boolean' OR jsonb_typeof(payload->'templates') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Configuración inválida';END IF;
   raw_phone:=coalesce(payload->>'phone','');country:=payload->>'country';digits:=regexp_replace(raw_phone,'[^0-9]','','g');
   IF raw_phone<>'' THEN
    IF raw_phone!~'^[+0-9 ().-]+$' THEN RAISE EXCEPTION 'Teléfono inválido';END IF;
    IF raw_phone LIKE '00%' THEN digits:=substring(digits from 3);ELSIF raw_phone NOT LIKE '+%' THEN
     IF country='598' THEN digits:=regexp_replace(digits,'^0','');END IF;
     IF NOT(country='598' AND digits LIKE '598%' AND length(digits)=11) THEN digits:=country||digits;END IF;
    END IF;
    IF digits!~'^[1-9][0-9]{6,14}$' OR (digits LIKE '598%' AND length(digits)<>11) THEN RAISE EXCEPTION 'Teléfono internacional inválido';END IF;
   END IF;
   FOR key,txt IN SELECT * FROM jsonb_each_text(payload->'templates') LOOP
    IF key NOT IN ('confirmation','reminder','reschedule','cancellation','request','free') THEN RAISE EXCEPTION 'Plantilla inválida';END IF;
    IF length(btrim(txt)) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'Texto inválido';END IF;
    FOR token IN SELECT (regexp_matches(txt,'\{([^{}]+)\}','g'))[1] LOOP IF NOT(token=ANY(allowed_vars)) THEN RAISE EXCEPTION 'Variable desconocida';END IF;END LOOP;
    IF regexp_replace(txt,'\{[^{}]+\}','','g')~'[{}]' THEN RAISE EXCEPTION 'Variable inválida';END IF;
   END LOOP;
   IF (SELECT count(DISTINCT t->>'id') FROM jsonb_array_elements(payload->'custom') t)<>jsonb_array_length(payload->'custom') THEN RAISE EXCEPTION 'Plantillas duplicadas';END IF;
   FOR item IN SELECT * FROM jsonb_array_elements(payload->'custom') LOOP
    txt:=item->>'text';IF coalesce(item->>'id','')!~'^custom_[a-zA-Z0-9_-]{1,50}$' OR length(btrim(coalesce(item->>'name',''))) NOT BETWEEN 1 AND 80 OR length(btrim(coalesce(txt,''))) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'Plantilla inválida';END IF;
    FOR token IN SELECT (regexp_matches(txt,'\{([^{}]+)\}','g'))[1] LOOP IF NOT(token=ANY(allowed_vars)) THEN RAISE EXCEPTION 'Variable desconocida';END IF;END LOOP;
    IF regexp_replace(txt,'\{[^{}]+\}','','g')~'[{}]' THEN RAISE EXCEPTION 'Variable inválida';END IF;
   END LOOP;
   cfg:=jsonb_build_object('enabled',(payload->>'enabled')::boolean,'country',country,'phone',CASE WHEN digits<>'' THEN '+'||digits ELSE '' END,'name',coalesce(payload->>'name',''),'reminders',(payload->>'reminders')::boolean,'reminder_hours',(payload->>'reminder_hours')::integer,'templates',payload->'templates','custom',(payload->'custom')||coalesce((SELECT jsonb_agg(t.value) FROM jsonb_array_elements(coalesce(cfg->'custom','[]')) WITH ORDINALITY t WHERE t.ordinality>cap AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'custom') n WHERE n->>'id'=t.value->>'id')),'[]'));
   INSERT INTO public.whatsapp_settings VALUES(bid,cfg) ON CONFLICT(business_id) DO UPDATE SET config=excluded.config;
  ELSIF verb<>'GET' THEN RAISE EXCEPTION 'Acción inválida';END IF;
  cfg:=jsonb_set(cfg,'{custom}',coalesce((SELECT jsonb_agg(t) FROM (SELECT value t FROM jsonb_array_elements(coalesce(cfg->'custom','[]')) LIMIT cap) x),'[]'));
  RETURN jsonb_build_object('config',cfg,'limit',cap,'plan',plan_code,'can_edit',role IN ('owner','manager'));
 END IF;
 IF action='/stats' AND verb='GET' THEN
  IF plan_code<>'pro' THEN RAISE EXCEPTION 'Las estadísticas de comunicación requieren Pro';END IF;
  RETURN coalesce((SELECT jsonb_agg(x) FROM(SELECT a.state,count(*) count FROM public.whatsapp_actions a LEFT JOIN public.bookings qb ON qb.id=a.booking_id LEFT JOIN public.staff s ON s.id=qb.staff_id WHERE a.business_id=bid AND a.created_at>=now()-interval '30 days' AND(role<>'staff' OR a.actor_id=actor_uid OR s.user_id=actor_uid) GROUP BY a.state)x),'[]');
 END IF;
 IF action='/reminders' AND verb='GET' THEN
  IF NOT coalesce((cfg->>'enabled')::boolean,false) OR NOT coalesce((cfg->>'reminders')::boolean,true) THEN RETURN '{"pending":[],"snoozed":[],"managed":[]}';END IF;
  WITH items AS (
   SELECT (to_jsonb(qb)-'manage_token'-'notes')||jsonb_build_object('customer_name',qc.name,'customer_phone',qc.phone,'service_name',v.name,'staff_name',s.name,'reminder_action_id',j.id,'reminder_state',j.state,'snoozed_until',j.snoozed_until) reminder_entry,
    CASE WHEN j.state IN ('manual_sent','skipped') THEN 'managed' WHEN j.state='snoozed' AND j.snoozed_until>now() THEN 'snoozed' ELSE 'pending' END bucket
   FROM public.bookings qb JOIN public.customers qc ON qc.id=qb.customer_id JOIN public.services v ON v.id=qb.service_id JOIN public.staff s ON s.id=qb.staff_id
   LEFT JOIN LATERAL(SELECT a.id,a.state,a.snoozed_until FROM public.whatsapp_actions a WHERE a.business_id=bid AND a.booking_id=qb.id AND a.starts_at=qb.starts_at AND a.created_at>=qb.updated_at AND a.kind='reminder' AND a.state IN ('manual_sent','skipped','snoozed') ORDER BY a.created_at DESC LIMIT 1) j ON true
   WHERE qb.business_id=bid AND qb.status IN ('pending','confirmed') AND qb.starts_at>now() AND qb.starts_at<=now()+make_interval(hours=>coalesce((cfg->>'reminder_hours')::integer,24)) AND(role<>'staff' OR s.user_id=actor_uid AND s.active=1)
   ORDER BY qb.starts_at LIMIT 500
  ) SELECT jsonb_build_object('pending',coalesce(jsonb_agg(reminder_entry) FILTER(WHERE bucket='pending'),'[]'),'snoozed',coalesce(jsonb_agg(reminder_entry) FILTER(WHERE bucket='snoozed'),'[]'),'managed',coalesce(jsonb_agg(reminder_entry) FILTER(WHERE bucket='managed'),'[]')) INTO result FROM items;RETURN result;
 END IF;
 IF action LIKE '/reminders/%/restore' AND verb='POST' THEN
  SELECT * INTO reminder_action FROM public.whatsapp_actions WHERE business_id=bid AND id=split_part(action,'/',3) AND state='snoozed';
  IF reminder_action.id IS NULL THEN RAISE EXCEPTION 'Recordatorio pospuesto no encontrado';END IF;
  SELECT * INTO b FROM public.bookings WHERE id=reminder_action.booking_id AND business_id=bid FOR UPDATE;
  IF b.id IS NULL OR role='staff' AND NOT EXISTS(SELECT 1 FROM public.staff s WHERE s.id=b.staff_id AND s.user_id=actor_uid AND s.active=1) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
  IF b.starts_at<>reminder_action.starts_at OR b.starts_at<=now() OR b.status NOT IN ('pending','confirmed') THEN RAISE EXCEPTION 'La reserva cambió';END IF;
  IF reminder_action.id IS DISTINCT FROM(SELECT a.id FROM public.whatsapp_actions a WHERE a.business_id=bid AND a.booking_id=b.id AND a.starts_at=b.starts_at AND a.kind='reminder' AND a.state IN ('manual_sent','skipped','snoozed') ORDER BY a.created_at DESC LIMIT 1) THEN RAISE EXCEPTION 'El recordatorio ya fue gestionado';END IF;
  UPDATE public.whatsapp_actions SET snoozed_until=now() WHERE id=reminder_action.id AND business_id=bid;
  INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,actor_uid,'whatsapp.reminder.restored','booking',b.id,now());
  RETURN '{"ok":true}';
 END IF;
 IF action='/pending' AND verb='GET' THEN
  IF NOT coalesce((cfg->>'enabled')::boolean,false) OR NOT coalesce((cfg->>'reminders')::boolean,true) THEN RETURN '[]';END IF;
  RETURN coalesce((SELECT jsonb_agg(x ORDER BY x->>'starts_at') FROM (
   SELECT (to_jsonb(qb)-'manage_token'-'notes')||jsonb_build_object('customer_name',qc.name,'customer_phone',qc.phone,'staff_name',s.name,'service_name',v.name) x
   FROM public.bookings qb JOIN public.customers qc ON qc.id=qb.customer_id JOIN public.staff s ON s.id=qb.staff_id JOIN public.services v ON v.id=qb.service_id
   WHERE qb.business_id=bid AND qb.status IN ('pending','confirmed') AND qb.starts_at>now() AND qb.starts_at<=now()+make_interval(hours=>coalesce((cfg->>'reminder_hours')::integer,24))
   AND (role<>'staff' OR s.user_id=actor_uid AND s.active=1)
   AND NOT EXISTS(SELECT 1 FROM public.whatsapp_actions a WHERE a.business_id=bid AND a.booking_id=qb.id AND a.starts_at=qb.starts_at AND a.created_at>=qb.updated_at AND a.kind='reminder' AND (a.state IN ('manual_sent','skipped') OR a.state='snoozed' AND a.snoozed_until>now()))
   ORDER BY qb.starts_at LIMIT 500) t),'[]');
 END IF;
 IF action LIKE '/booking/%' OR action LIKE '/context/%' THEN bk:=substring(action from 10);ELSIF action='/actions' THEN bk:=nullif(payload->>'booking_id','');END IF;
 IF bk IS NOT NULL THEN
  IF action='/actions' AND verb='POST' THEN SELECT * INTO b FROM public.bookings WHERE id=bk AND business_id=bid FOR UPDATE;
  ELSE SELECT * INTO b FROM public.bookings WHERE id=bk AND business_id=bid;END IF;
  IF b.id IS NULL OR role='staff' AND NOT EXISTS(SELECT 1 FROM public.staff WHERE id=b.staff_id AND business_id=bid AND staff.user_id=private.user_id() AND active=1) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
  cid:=b.customer_id;
  IF action LIKE '/booking/%' AND verb='GET' THEN RETURN jsonb_build_object('booking',(to_jsonb(b)-'manage_token'-'notes')||jsonb_build_object('service_name',(SELECT name FROM public.services WHERE id=b.service_id),'staff_name',(SELECT name FROM public.staff WHERE id=b.staff_id)),'previous',(SELECT starts_at FROM public.whatsapp_previous WHERE booking_id=b.id));END IF;
 END IF;
 IF action LIKE '/context/%' THEN context_data:=public.atry_whatsapp(bid,'settings','GET','{}')||jsonb_build_object('booking',(to_jsonb(b)-'manage_token'-'notes')||jsonb_build_object('service_name',(SELECT name FROM public.services WHERE id=b.service_id),'staff_name',(SELECT name FROM public.staff WHERE id=b.staff_id)),'previous',(SELECT starts_at FROM public.whatsapp_previous WHERE booking_id=b.id));action:='/customer/'||b.customer_id;END IF;
 IF action LIKE '/customer/%' THEN cid:=substring(action from 11);ELSIF cid IS NULL THEN cid:=payload->>'customer_id';END IF;
 IF action='/actions' AND verb='POST' OR action LIKE '/customer/%' AND verb='PUT' THEN
  SELECT * INTO c FROM public.customers WHERE id=cid AND business_id=bid FOR UPDATE;
 ELSE SELECT * INTO c FROM public.customers WHERE id=cid AND business_id=bid;END IF;
 IF c.id IS NULL OR role='staff' AND NOT EXISTS(SELECT 1 FROM public.bookings qb JOIN public.staff s ON s.id=qb.staff_id WHERE qb.customer_id=cid AND qb.business_id=bid AND s.user_id=actor_uid AND s.active=1) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF action LIKE '/customer/%' THEN
  IF verb='PUT' THEN
   IF jsonb_typeof(payload->'allowed') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Consentimiento inválido';END IF;
   INSERT INTO public.whatsapp_consent VALUES(bid,cid,(payload->>'allowed')::boolean,now()) ON CONFLICT(business_id,customer_id) DO UPDATE SET allowed=excluded.allowed,updated_at=excluded.updated_at;RETURN '{"ok":true}';
  ELSIF verb='GET' THEN
   RETURN context_data||jsonb_build_object('customer',CASE WHEN role='staff' THEN to_jsonb(c)-'notes'-'marketing_consent' ELSE to_jsonb(c) END,'consent',coalesce((SELECT allowed FROM public.whatsapp_consent WHERE business_id=bid AND customer_id=cid),false),'bookings',coalesce((SELECT jsonb_agg(x) FROM(SELECT (to_jsonb(qb)-'manage_token'-'notes')||jsonb_build_object('service_name',v.name,'staff_name',s.name) x FROM public.bookings qb JOIN public.services v ON v.id=qb.service_id JOIN public.staff s ON s.id=qb.staff_id WHERE qb.business_id=bid AND qb.customer_id=cid AND(role<>'staff' OR s.user_id=actor_uid AND s.active=1) ORDER BY qb.starts_at DESC LIMIT 30)t),'[]'),'history',CASE WHEN plan_code='individual' THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(x) FROM(SELECT jsonb_build_object('id',a.id,'kind',a.kind,'state',a.state,'created_at',a.created_at) x FROM public.whatsapp_actions a LEFT JOIN public.bookings qb ON qb.id=a.booking_id LEFT JOIN public.staff s ON s.id=qb.staff_id WHERE a.business_id=bid AND a.customer_id=cid AND(role<>'staff' OR a.actor_id=actor_uid OR s.user_id=actor_uid) ORDER BY a.created_at DESC LIMIT CASE WHEN plan_code='pro' THEN 200 ELSE 30 END)t),'[]') END);
  END IF;
 END IF;
 IF action='/actions' AND verb='POST' THEN
  IF NOT coalesce((cfg->>'enabled')::boolean,false) THEN RAISE EXCEPTION 'WhatsApp está desactivado';END IF;
  kind:=payload->>'kind';st:=payload->>'state';
  IF st NOT IN ('prepared','opened','manual_sent','skipped','snoozed') OR st IS NULL THEN RAISE EXCEPTION 'Estado inválido';END IF;
  IF kind NOT IN ('confirmation','reminder','reschedule','cancellation','request','free') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(cfg->'custom','[]')) WITH ORDINALITY t WHERE t.value->>'id'=kind AND t.ordinality<=cap) THEN RAISE EXCEPTION 'Plantilla no disponible';END IF;
  IF kind<>'free' AND b.id IS NULL THEN RAISE EXCEPTION 'Seleccioná una reserva';END IF;
  IF b.id IS NOT NULL AND b.starts_at IS DISTINCT FROM (payload->>'starts_at')::timestamptz THEN RAISE EXCEPTION 'La reserva cambió';END IF;
  IF b.id IS NOT NULL AND payload ? 'booking_updated_at' AND b.updated_at IS DISTINCT FROM (payload->>'booking_updated_at')::timestamptz THEN RAISE EXCEPTION 'Los datos del turno cambiaron. Volvé a preparar el mensaje.';END IF;
  IF kind IN ('reminder','request','reschedule') AND (b.status NOT IN ('pending','confirmed') OR b.starts_at<=now()) OR kind='confirmation' AND b.status<>'confirmed' OR kind='cancellation' AND b.status<>'cancelled' THEN RAISE EXCEPTION 'Estado del turno incompatible';END IF;
  IF kind='reschedule' AND NOT EXISTS(SELECT 1 FROM public.whatsapp_previous WHERE booking_id=b.id) THEN RAISE EXCEPTION 'No hay horario anterior';END IF;
  IF kind='reminder' AND st IN ('skipped','snoozed') AND EXISTS(SELECT 1 FROM public.whatsapp_actions a WHERE a.business_id=bid AND a.booking_id=b.id AND a.starts_at=b.starts_at AND a.created_at>=b.updated_at AND a.kind='reminder' AND a.state IN ('manual_sent','skipped')) THEN RAISE EXCEPTION 'El recordatorio ya fue gestionado';END IF;
  IF st NOT IN ('skipped','snoozed') THEN
   IF NOT coalesce((SELECT allowed FROM public.whatsapp_consent WHERE business_id=bid AND customer_id=cid),false) THEN RAISE EXCEPTION 'Falta autorización del cliente';END IF;
   raw_phone:=coalesce(c.phone,'');digits:=regexp_replace(raw_phone,'[^0-9]','','g');country:=coalesce(cfg->>'country','598');
   IF raw_phone LIKE '00%' THEN digits:=substring(digits from 3);ELSIF raw_phone NOT LIKE '+%' THEN IF country='598' THEN digits:=regexp_replace(digits,'^0','');END IF;IF NOT(country='598' AND digits LIKE '598%' AND length(digits)=11) THEN digits:=country||digits;END IF;END IF;
   IF raw_phone!~'^[+0-9 ().-]+$' OR digits!~'^[1-9][0-9]{6,14}$' OR digits LIKE '598%' AND length(digits)<>11 THEN RAISE EXCEPTION 'Teléfono inválido';END IF;
   IF payload ? 'recipient_phone' AND payload->>'recipient_phone' IS DISTINCT FROM digits THEN RAISE EXCEPTION 'El teléfono del cliente cambió. Volvé a preparar el mensaje.';END IF;
  END IF;
  -- Writes lock the customer before reading consent; GET contexts do not lock bookings.
  SELECT a.state INTO last_state FROM public.whatsapp_actions a WHERE a.business_id=bid AND a.customer_id=cid AND a.booking_id IS NOT DISTINCT FROM b.id AND a.starts_at IS NOT DISTINCT FROM b.starts_at AND a.kind=kind AND a.actor_id=actor_uid ORDER BY a.created_at DESC LIMIT 1;
  IF st='opened' AND last_state IS DISTINCT FROM 'prepared' OR st='manual_sent' AND last_state IS DISTINCT FROM 'opened' THEN RAISE EXCEPTION 'Prepará y abrí WhatsApp con tu usuario antes de confirmar el envío manual';END IF;
  INSERT INTO public.whatsapp_actions(business_id,customer_id,booking_id,starts_at,kind,state,actor_id,snoozed_until) VALUES(bid,cid,b.id,b.starts_at,kind,st,actor_uid,CASE WHEN st='snoozed' THEN now()+interval '1 hour' END) RETURNING jsonb_build_object('id',id,'state',state,'created_at',created_at,'snoozed_until',snoozed_until) INTO result;RETURN result;
 END IF;
 RAISE EXCEPTION 'Acción de comunicación inválida';
END $function$
;
CREATE OR REPLACE FUNCTION public.staff_photo_storage_access(object_path text, writing boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE bid text:=split_part(object_path,'/',1);sid text:=split_part(object_path,'/',2);r text;
BEGIN
 IF object_path!~'^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\.webp$' OR NOT EXISTS(SELECT 1 FROM public.staff WHERE id=sid AND business_id=bid) THEN RETURN false;END IF;
 IF NOT writing AND EXISTS(SELECT 1 FROM public.staff_photos p JOIN public.staff s ON s.id=p.staff_id JOIN public.businesses b ON b.id=p.business_id WHERE p.path=object_path AND p.show_public AND s.active=1 AND b.is_active=1) THEN RETURN true;END IF;
 IF auth.uid() IS NULL THEN RETURN false;END IF;
 r:=private.member_role(bid);
 RETURN CASE WHEN writing THEN coalesce(r IN ('owner','manager'),false) ELSE coalesce(r IN ('owner','manager','staff'),false) END;
END $function$
;