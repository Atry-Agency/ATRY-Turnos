-- Local candidate only. Apply after explicit approval; no production execution.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
ALTER TABLE private.runtime_settings ADD COLUMN pa_registration_enabled boolean NOT NULL DEFAULT false,ADD COLUMN pa_public_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.businesses ADD COLUMN country text NOT NULL DEFAULT 'UY', ADD COLUMN currency text NOT NULL DEFAULT 'UYU', ADD COLUMN locale text NOT NULL DEFAULT 'es-UY';
ALTER TABLE public.businesses ADD CONSTRAINT business_region CHECK ((country='UY' AND timezone='America/Montevideo' AND currency='UYU' AND locale='es-UY') OR (country='PA' AND timezone='America/Panama' AND currency='USD' AND locale='es-PA'));
CREATE FUNCTION private.business_zone(bid text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT timezone FROM public.businesses WHERE id=bid$$;
REVOKE ALL ON FUNCTION private.business_zone(text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.guard_business_region() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF TG_OP='UPDATE' AND OLD.country='PA' AND (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.paid_until IS DISTINCT FROM OLD.paid_until OR NEW.subscription_status='active' AND OLD.subscription_status IS DISTINCT FROM 'active') THEN RAISE EXCEPTION 'COUNTRY_CATALOG_NOT_CONFIGURED';END IF;
 IF TG_OP='UPDATE' AND (NEW.country IS DISTINCT FROM OLD.country OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW.timezone IS DISTINCT FROM OLD.timezone OR NEW.locale IS DISTINCT FROM OLD.locale) THEN RAISE EXCEPTION 'REGION_IMMUTABLE';END IF;
 RETURN NEW;END$$;
REVOKE ALL ON FUNCTION private.guard_business_region() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER guard_business_region BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION private.guard_business_region();
ALTER TABLE public.services ADD COLUMN price_minor bigint NOT NULL DEFAULT 0 CHECK(price_minor>=0), ADD COLUMN currency text NOT NULL DEFAULT 'UYU' CHECK(currency IN ('UYU','USD'));
ALTER TABLE public.bookings ADD COLUMN price_minor bigint NOT NULL DEFAULT 0 CHECK(price_minor>=0), ADD COLUMN currency text NOT NULL DEFAULT 'UYU' CHECK(currency IN ('UYU','USD'));
-- Existing expired businesses must also receive the additive money backfill.
-- These ALTERs hold the tables' transaction-scoped ACCESS EXCLUSIVE locks:
-- no concurrent application write can observe a disabled subscription guard.
-- A failure rolls back the trigger state as well as all backfilled values.
ALTER TABLE public.services DISABLE TRIGGER subscription_write;
ALTER TABLE public.bookings DISABLE TRIGGER subscription_write;
UPDATE public.services SET price_minor=price_uyu::bigint*100;
UPDATE public.bookings SET price_minor=price_uyu::bigint*100;
ALTER TABLE public.services ENABLE TRIGGER subscription_write;
ALTER TABLE public.bookings ENABLE TRIGGER subscription_write;
CREATE FUNCTION private.sync_regional_money() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE c text;BEGIN
 SELECT currency INTO STRICT c FROM public.businesses WHERE id=NEW.business_id;
 NEW.currency:=c;
 IF c='UYU' THEN
  IF TG_OP='INSERT' OR NEW.price_uyu IS DISTINCT FROM OLD.price_uyu THEN NEW.price_minor:=NEW.price_uyu::bigint*100;
  ELSIF NEW.price_minor IS DISTINCT FROM OLD.price_minor THEN RAISE EXCEPTION 'LEGACY_PRICE_CONTRACT_REQUIRED';END IF;
 ELSE
  IF NEW.price_uyu<>0 THEN RAISE EXCEPTION 'USD_REQUIRES_PRICE_MINOR';END IF;
  IF TG_TABLE_NAME='bookings' THEN
 IF TG_OP='INSERT' OR NEW.service_id IS DISTINCT FROM OLD.service_id THEN
   SELECT price_minor INTO STRICT NEW.price_minor FROM public.services WHERE id=NEW.service_id AND business_id=NEW.business_id;
  END IF;END IF;
 END IF;
 RETURN NEW;END$$;
CREATE TRIGGER sync_service_money BEFORE INSERT OR UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION private.sync_regional_money();
CREATE TRIGGER sync_booking_money BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION private.sync_regional_money();
REVOKE ALL ON FUNCTION private.sync_regional_money() FROM PUBLIC,anon,authenticated;
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
 start_time:=start_day::timestamp AT TIME ZONE private.business_zone(bid);
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.starts_at) FROM (
  SELECT b.id,b.business_id,b.staff_id,b.service_id,b.customer_id,b.starts_at,b.ends_at,b.status,b.notes,b.source,b.price_uyu,b.payment_status,coalesce(to_jsonb(b)->>'customer_name_snapshot',c.name) customer_name,CASE WHEN role='staff' THEN coalesce(to_jsonb(b)->>'customer_email_snapshot','') ELSE coalesce(to_jsonb(b)->>'customer_email_snapshot',c.email) END customer_email,CASE WHEN role='staff' THEN coalesce(to_jsonb(b)->>'customer_phone_snapshot','') ELSE coalesce(to_jsonb(b)->>'customer_phone_snapshot',c.phone) END customer_phone,s.name service_name,st.name staff_name,st.color staff_color
  FROM public.bookings b JOIN public.customers c ON c.id=b.customer_id JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id
  WHERE b.business_id=bid AND b.starts_at>=start_time AND b.starts_at<start_time+make_interval(days=>days) AND (role IN ('owner','manager') OR private.own_staff(b.staff_id))
 ) x),'[]'::jsonb);
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
 IF b.timezone NOT IN (private.business_zone(bid),'America/Panama') OR NOT EXISTS(SELECT 1 FROM public.staff_services WHERE staff_id=sid AND service_id=vid) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT'; END IF;
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
DECLARE result jsonb;d date:=(starts AT TIME ZONE private.business_zone(bid))::date;m int;v public.services;r record;
BEGIN
 IF NOT private.subscription_live(bid) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';END IF;
 result:=private.check_slot_before_recurring(bid,sid,vid,starts,ignore_id,notice);
 SELECT * INTO v FROM public.services WHERE id=vid;
 m:=extract(hour FROM starts AT TIME ZONE private.business_zone(bid))*60+extract(minute FROM starts AT TIME ZONE private.business_zone(bid));
 FOR r IN SELECT a.*,s.duration_min,s.buffer_before_min,s.buffer_after_min FROM public.recurring_appointments a JOIN public.services s ON s.id=a.service_id
 WHERE a.business_id=bid AND private.has_feature(bid,'recurring') AND private.recurring_applies(a,d) AND ignore_id<>'recurring:'||a.id
 AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.recurring_id=a.id AND b.occurrence_day=d) LOOP
  IF (r.staff_id=sid OR EXISTS(SELECT 1 FROM public.service_resources x JOIN public.service_resources y ON x.resource_id=y.resource_id WHERE x.service_id=vid AND y.service_id=r.service_id))
  AND m-v.buffer_before_min<r.minute+r.duration_min+r.buffer_after_min AND r.minute-r.buffer_before_min<m+v.duration_min+v.buffer_after_min THEN RAISE EXCEPTION 'RECURRING_CONFLICT';END IF;
 END LOOP;
 RETURN result;
END $function$
;

CREATE OR REPLACE FUNCTION private.commercial_cycle(bid text)
 RETURNS TABLE(cycle_start timestamp with time zone, cycle_end timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE anchor int;month_start date;candidate date;today date:=(now() AT TIME ZONE private.business_zone(bid))::date;
BEGIN
 SELECT extract(day FROM coalesce(subscription_started_at,created_at) AT TIME ZONE private.business_zone(bid))::int INTO anchor FROM public.businesses WHERE id=bid;
 month_start:=date_trunc('month',today)::date;candidate:=month_start+least(anchor,extract(day FROM month_start+interval '1 month - 1 day')::int)-1;
 IF candidate>today THEN month_start:=(month_start-interval '1 month')::date;END IF;
 cycle_start:=(month_start+least(anchor,extract(day FROM month_start+interval '1 month - 1 day')::int)-1)::timestamp AT TIME ZONE private.business_zone(bid);month_start:=(month_start+interval '1 month')::date;
 cycle_end:=(month_start+least(anchor,extract(day FROM month_start+interval '1 month - 1 day')::int)-1)::timestamp AT TIME ZONE private.business_zone(bid);RETURN NEXT;
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
  until_time:=((payload->>'until_day')::date+1)::timestamp AT TIME ZONE private.business_zone(bid);
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
 UPDATE public.businesses SET subscription_started_at=CASE WHEN payload?'starts_day' AND act<>'renew' THEN (payload->>'starts_day')::date::timestamp AT TIME ZONE private.business_zone(bid) WHEN act IN ('activate','trial') THEN coalesce(subscription_started_at,now()) ELSE subscription_started_at END WHERE id=bid;
 UPDATE public.businesses SET plan=b.plan,subscription_status=b.subscription_status,paid_until=b.paid_until,trial_until=b.trial_until,is_active=b.is_active WHERE id=bid;
 INSERT INTO public.subscription_events(business_id,actor_id,action,request_key,request_hash,before_state,after_state,amount_uyu,reference,note) VALUES(bid,uid,act,key,digest,before_data,jsonb_build_object('plan',b.plan,'status',b.subscription_status,'paid_until',b.paid_until,'trial_until',b.trial_until,'is_active',b.is_active,'starts_day',payload->>'starts_day'),amt,ref,memo) RETURNING * INTO previous;
 IF act IN ('activate','renew') AND payload?'plan_request_id' THEN
 UPDATE public.plan_requests SET state='active',payment_state=CASE WHEN ref<>'' THEN 'verified' ELSE 'waived' END,updated_at=now() WHERE id=payload->>'plan_request_id' AND business_id=bid AND plan=b.plan AND state IN ('pending_contact','pending_payment','pending_verification');IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_CHANGED';END IF;
 INSERT INTO public.plan_request_events(request_id,actor_id,state) VALUES(payload->>'plan_request_id',uid,'active');END IF;
 INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'subscription.'||act,bid,now());
 RETURN jsonb_build_object('ok',true,'event_id',previous.id);
END $function$
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
    starts:=(d::timestamp+make_interval(mins=>r.minute)) AT TIME ZONE private.business_zone(bid);
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
  IF idx=1 THEN day:=to_char((checked->>'starts_at')::timestamptz AT TIME ZONE private.business_zone(bid),'YYYY-MM-DD');
  ELSIF previous_end IS DISTINCT FROM (checked->>'starts_at')::timestamptz OR day<>to_char((checked->>'starts_at')::timestamptz AT TIME ZONE private.business_zone(bid),'YYYY-MM-DD') THEN RAISE EXCEPTION 'INVALID_VISIT_SEQUENCE';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(legs) e WHERE private.visit_overlaps(e,checked)) THEN RAISE EXCEPTION 'RESOURCE_CONFLICT';END IF;
  legs:=legs||jsonb_build_array(checked);previous_end:=(checked->>'ends_at')::timestamptz;
 END LOOP;
 IF payload->>'quote' IS DISTINCT FROM private.hash(legs::text) THEN RAISE EXCEPTION 'VISIT_QUOTE_CHANGED';END IF;
 RETURN legs;
END $function$
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
 RETURN jsonb_build_object('service_id',vid,'service_name',s.name,'staff_id',sid,'staff_name',st.name,'starts_at',starts,'ends_at',slot->'ends_at','blocked_from',slot->'blocked_from','blocked_until',slot->'blocked_until','resource_ids',coalesce((SELECT jsonb_agg(resource_id ORDER BY resource_id) FROM public.service_resources WHERE service_id=vid),'[]'),'duration_min',s.duration_min,'price_uyu',s.price_uyu,'time',to_char(starts AT TIME ZONE private.business_zone(bid),'HH24:MI'));
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
 SELECT string_agg((l->>'service_name')||' · '||(l->>'staff_name')||' · '||to_char((l->>'starts_at')::timestamptz AT TIME ZONE (SELECT timezone FROM public.businesses WHERE id=(SELECT business_id FROM public.booking_visits WHERE id=vid)),'DD/MM/YYYY HH24:MI')||' · '||CASE l->>'status' WHEN 'confirmed' THEN 'Confirmado' WHEN 'pending' THEN 'Pendiente' WHEN 'cancelled' THEN 'Cancelado' WHEN 'completed' THEN 'Completado' ELSE 'No asistió' END,' / ') INTO summary FROM jsonb_array_elements(v->'legs') l;
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
 IF day<(now() AT TIME ZONE private.business_zone(bid))::date OR day>(now() AT TIME ZONE private.business_zone(bid))::date+(SELECT max_days FROM public.businesses WHERE id=bid) THEN RETURN jsonb_build_object('options',result);END IF;
 PERFORM set_config('atry.visit_nodes','0',true);
 FOR minute IN SELECT generate_series(0,1439,step) LOOP
  legs:=private.visit_search(bid,ids,1,(day::timestamp+make_interval(mins=>minute)) AT TIME ZONE private.business_zone(bid),'[]',prefs,ignore_ids,owner);
  IF legs IS NULL THEN CONTINUE;END IF;
  SELECT sum((l->>'price_uyu')::int),sum((l->>'duration_min')::int) INTO price,duration FROM jsonb_array_elements(legs) l;
  result:=result||jsonb_build_array(jsonb_build_object('start',legs->0->'starts_at','ends_at',legs->-1->'ends_at','time',legs->0->'time','legs',legs,'quote',private.hash(legs::text),'price_uyu',price,'duration_min',duration));
 END LOOP;
 RETURN jsonb_build_object('date',day,'options',result);
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
  IF jsonb_array_length(legs)>0 AND (to_char((item->>'starts_at')::timestamptz AT TIME ZONE private.business_zone(bid),'YYYY-MM-DD')<>to_char((legs->0->>'starts_at')::timestamptz AT TIME ZONE private.business_zone(bid),'YYYY-MM-DD') OR EXISTS(SELECT 1 FROM jsonb_array_elements(legs) e WHERE private.visit_overlaps(e,item))) THEN CONTINUE;END IF;
  found:=private.visit_search(bid,ids,idx+1,(item->>'ends_at')::timestamptz,legs||jsonb_build_array(item),prefs,ignore_ids,owner);IF found IS NOT NULL THEN RETURN found;END IF;
 END LOOP;
 RETURN NULL;
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
 IF b.timezone NOT IN (private.business_zone(bid),'America/Panama') OR NOT EXISTS(SELECT 1 FROM public.staff_services WHERE staff_id=sid AND service_id=vid) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT'; END IF;
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
DECLARE result jsonb;d date:=(starts AT TIME ZONE private.business_zone(bid))::date;m int;v public.services;r record;
BEGIN
 IF NOT private.subscription_live(bid) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';END IF;
 result:=private.visit_slot_base(bid,sid,vid,starts,ignore_id,notice,ignore_ids,off_grid);
 SELECT * INTO v FROM public.services WHERE id=vid;
 m:=extract(hour FROM starts AT TIME ZONE private.business_zone(bid))*60+extract(minute FROM starts AT TIME ZONE private.business_zone(bid));
 FOR r IN SELECT a.*,s.duration_min,s.buffer_before_min,s.buffer_after_min FROM public.recurring_appointments a JOIN public.services s ON s.id=a.service_id
 WHERE a.business_id=bid AND private.has_feature(bid,'recurring') AND private.recurring_applies(a,d) AND ignore_id<>'recurring:'||a.id
 AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.recurring_id=a.id AND b.occurrence_day=d) LOOP
  IF (r.staff_id=sid OR EXISTS(SELECT 1 FROM public.service_resources x JOIN public.service_resources y ON x.resource_id=y.resource_id WHERE x.service_id=vid AND y.service_id=r.service_id))
  AND m-v.buffer_before_min<r.minute+r.duration_min+r.buffer_after_min AND r.minute-r.buffer_before_min<m+v.duration_min+v.buffer_after_min THEN RAISE EXCEPTION 'RECURRING_CONFLICT';END IF;
 END LOOP;
 RETURN result;
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
 IF clock IS NULL OR clock!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' OR r.start_day IS NULL OR r.start_day<(now() AT TIME ZONE private.business_zone(bid))::date OR r.end_day<r.start_day OR r.interval_weeks NOT IN (1,2,4) THEN RAISE EXCEPTION 'INVALID_RECURRENCE';END IF;
 r.minute:=split_part(clock,':',1)::int*60+split_part(clock,':',2)::int;
 IF (r.start_day::timestamp+make_interval(mins=>r.minute)) AT TIME ZONE private.business_zone(bid)<now() THEN RAISE EXCEPTION 'INVALID_RECURRENCE';END IF;
 IF r.customer_name IS NULL OR length(r.customer_name)<2 OR length(r.customer_name)>100 OR length(r.customer_email)>150 OR length(r.customer_phone)>35 OR (r.customer_email='' AND r.customer_phone='') OR (r.customer_email<>'' AND r.customer_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'INVALID_CONTACT';END IF;
 IF payload ? 'replace_id' AND coalesce(payload->>'replace_id','')<>'' THEN PERFORM public.atry_end_recurring(bid,payload->>'replace_id',r.start_day);END IF;
 IF (SELECT count(*) FROM public.recurring_appointments WHERE business_id=bid AND active=1 AND (end_day IS NULL OR end_day>=(now() AT TIME ZONE private.business_zone(bid))::date))>=200 THEN RAISE EXCEPTION 'RECURRING_LIMIT';END IF;
 PERFORM private.check_slot(bid,r.staff_id,r.service_id,(r.start_day::timestamp+make_interval(mins=>r.minute)) AT TIME ZONE private.business_zone(bid),'',false);
 SELECT * INTO v FROM public.services WHERE id=r.service_id;
 FOR existing IN SELECT * FROM public.bookings WHERE business_id=bid AND status IN ('pending','confirmed') AND starts_at>=(r.start_day::timestamp AT TIME ZONE private.business_zone(bid)) LOOP
  d:=(existing.starts_at AT TIME ZONE private.business_zone(bid))::date;
  IF private.recurring_applies(r,d) THEN PERFORM private.check_slot(bid,r.staff_id,r.service_id,(d::timestamp+make_interval(mins=>r.minute)) AT TIME ZONE private.business_zone(bid),'',false);END IF;
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

CREATE OR REPLACE FUNCTION public.atry_dashboard(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM private.require_manager(bid);PERFORM private.expand_recurring(bid,(now() AT TIME ZONE private.business_zone(bid))::date,31);IF NOT private.has_feature(bid,'statistics') THEN RETURN private.dashboard_before_recurring(bid)-'totals'-'daily'-'insights'-'waitlist' || jsonb_build_object('totals','{}'::jsonb,'daily','[]'::jsonb,'insights','[]'::jsonb,'waitlist',0);END IF;RETURN private.dashboard_before_recurring(bid);
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
 IF from_day IS NULL OR from_day<(now() AT TIME ZONE private.business_zone(bid))::date THEN RAISE EXCEPTION 'INVALID_DATE';END IF;
 IF r.end_day IS NOT NULL AND r.end_day<from_day THEN RETURN jsonb_build_object('ok',true);END IF;
 IF r.end_day IS NULL OR r.end_day>=from_day THEN UPDATE public.recurring_appointments SET end_day=from_day-1,active=CASE WHEN from_day<=start_day THEN 0 ELSE 1 END,updated_at=now() WHERE id=r.id;END IF;
 UPDATE public.bookings b SET status='cancelled',updated_at=now() WHERE b.business_id=bid AND b.recurring_id=r.id AND b.starts_at>=greatest(from_day::timestamp AT TIME ZONE private.business_zone(bid),now()) AND b.status IN ('confirmed','pending');
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'recurring.ended','recurring',r.id,now());
 RETURN jsonb_build_object('ok',true);
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
 FOR b IN SELECT DISTINCT business_id FROM public.recurring_appointments WHERE active=1 AND (end_day IS NULL OR end_day>=(now() AT TIME ZONE private.business_zone(business_id))::date) ORDER BY business_id LOOP
  PERFORM private.expand_recurring(b.business_id,(now() AT TIME ZONE private.business_zone(b.business_id))::date,8);
 END LOOP;
 RETURN private.mail_ingest_before_recurring();
END $function$
;

-- PA catalog has no commercial prices: prohibit borrowing UY catalog values.
ALTER FUNCTION public.atry_request_plan(text,jsonb) RENAME TO atry_request_plan_regional_base;
REVOKE ALL ON FUNCTION public.atry_request_plan_regional_base(text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.atry_request_plan(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 IF coalesce(private.member_role(bid),'')<>'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF (SELECT country FROM public.businesses WHERE id=bid)='PA' THEN RAISE EXCEPTION 'COUNTRY_CATALOG_NOT_CONFIGURED';END IF;
 RETURN public.atry_request_plan_regional_base(bid,payload);END$$;
REVOKE ALL ON FUNCTION public.atry_request_plan(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_request_plan(text,jsonb) TO authenticated;
-- Existing service RPC retains the UY contract; PA accepts explicit USD minor units only.
ALTER FUNCTION public.atry_save_service(text,text,jsonb) RENAME TO atry_save_service_regional_base;
REVOKE ALL ON FUNCTION public.atry_save_service_regional_base(text,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.atry_save_service(bid text,service_id text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE c text;result jsonb;BEGIN
 IF coalesce(private.member_role(bid),'') NOT IN ('owner','manager') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT currency INTO c FROM public.businesses WHERE id=bid FOR UPDATE;
 IF c='USD' THEN
  IF payload?'price_uyu' THEN RAISE EXCEPTION 'USD_REQUIRES_PRICE_MINOR';END IF;
  IF payload?'currency' AND payload->>'currency'<>'USD' THEN RAISE EXCEPTION 'CURRENCY_MISMATCH';END IF;
  IF service_id IS NULL AND NOT payload?'price_minor' THEN RAISE EXCEPTION 'PRICE_REQUIRED';END IF;
  IF payload?'price_minor' AND (jsonb_typeof(payload->'price_minor')<>'number' OR (payload->>'price_minor')!~'^[0-9]+$' OR (payload->>'price_minor')::numeric>9007199254740991) THEN RAISE EXCEPTION 'INVALID_PRICE_MINOR';END IF;
 ELSIF payload?'price_minor' OR payload?'currency' AND payload->>'currency'<>'UYU' THEN RAISE EXCEPTION 'LEGACY_PRICE_CONTRACT_REQUIRED';END IF;
 result:=public.atry_save_service_regional_base(bid,service_id,payload-'price_minor'-'currency');
 IF c='USD' AND payload?'price_minor' THEN UPDATE public.services SET price_minor=(payload->>'price_minor')::bigint WHERE id=result->>'id' AND business_id=bid;END IF;
 RETURN result;END$$;
REVOKE ALL ON FUNCTION public.atry_save_service(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_save_service(text,text,jsonb) TO authenticated;
COMMIT;
