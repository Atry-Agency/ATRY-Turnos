-- Readiness correction: compatibility installation does not authorize PA rollout.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
REVOKE ALL ON FUNCTION private.guard_business_region() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.require_public_region(bid text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE c text;BEGIN SELECT country INTO c FROM public.businesses WHERE id=bid;IF c IS NULL THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;IF c='PA' AND NOT coalesce((SELECT pa_public_enabled FROM private.runtime_settings WHERE id=1),false) THEN RAISE EXCEPTION 'REGION_NOT_ENABLED';END IF;END$$;
REVOKE ALL ON FUNCTION private.require_public_region(text) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.atry_create_organization(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE uid text:=private.user_id();u public.users;bid text:=gen_random_uuid()::text;sid text:=gen_random_uuid()::text;name text:=btrim(payload->>'name');slug text:=lower(btrim(payload->>'slug'));
BEGIN
 IF payload->>'country'='PA' AND NOT coalesce((SELECT pa_registration_enabled FROM private.runtime_settings WHERE id=1),false) THEN RAISE EXCEPTION 'REGION_NOT_ENABLED';END IF;
 IF coalesce(payload->>'country','UY') NOT IN ('UY','PA') THEN RAISE EXCEPTION 'INVALID_COUNTRY';END IF;
 IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO u FROM public.users WHERE id=uid FOR UPDATE;
 IF (SELECT count(*) FROM public.memberships WHERE user_id=uid AND role='owner')>=10 THEN RAISE EXCEPTION 'ORGANIZATION_LIMIT';END IF;
 IF name IS NULL OR length(name)<2 OR length(name)>100 OR slug IS NULL OR slug!~'^[a-z0-9][a-z0-9-]{1,53}[a-z0-9]$' THEN RAISE EXCEPTION 'INVALID_ORGANIZATION';END IF;
 INSERT INTO public.businesses(id,slug,name,email,sector,city,country,timezone,currency,locale,subscription_status,trial_until,created_at) VALUES(bid,slug,name,u.email,coalesce(nullif(left(btrim(payload->>'sector'),100),''),'General'),CASE WHEN payload->>'country'='PA' THEN '' ELSE 'Montevideo' END,coalesce(payload->>'country','UY'),CASE WHEN payload->>'country'='PA' THEN 'America/Panama' ELSE 'America/Montevideo' END,CASE WHEN payload->>'country'='PA' THEN 'USD' ELSE 'UYU' END,CASE WHEN payload->>'country'='PA' THEN 'es-PA' ELSE 'es-UY' END,'trialing',now()+interval '14 days',now());
 INSERT INTO public.memberships VALUES(uid,bid,'owner');
 INSERT INTO public.staff(id,business_id,user_id,name,email,created_at) VALUES(sid,bid,uid,u.name,u.email,now());
 INSERT INTO public.working_hours SELECT sid,d,540,1080 FROM generate_series(1,6) d;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,uid,'business.created','business',bid,now());
 UPDATE public.businesses SET subscription_status='pending',trial_until=now() WHERE id=bid;
 RETURN jsonb_build_object('id',bid,'name',name,'slug',slug);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_runtime_config()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('app','Atry Turnos','version','1.3.0','regional_contract',1,'pa_registration_enabled',pa_registration_enabled,'pa_public_enabled',pa_public_enabled,'currency','UYU','timezone','America/Montevideo','payments_live',false,'whatsapp_live',false,'mail_provider',CASE WHEN mail_enabled THEN 'brevo' ELSE 'disabled' END,'automatic_email_live',mail_enabled,'tax_status',(SELECT tax_status FROM private.commercial_settings WHERE id=1),'plans',(SELECT jsonb_agg(to_jsonb(p) ORDER BY price_uyu) FROM public.plans p WHERE code<>'trial')) FROM private.runtime_settings WHERE id=1
$function$
;
CREATE OR REPLACE FUNCTION public.atry_public_info(slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;b public.businesses;
BEGIN
 PERFORM private.require_public_region((SELECT id FROM public.businesses WHERE businesses.slug=atry_public_info.slug));
 result:=private.public_info_theme_base(slug);SELECT * INTO b FROM public.businesses WHERE businesses.slug=atry_public_info.slug;
 RETURN jsonb_set(result,'{business}',result->'business'||jsonb_build_object('plan',b.plan,'country',b.country,'timezone',b.timezone,'currency',b.currency,'locale',b.locale,'theme_config',private.project_theme(b),'multi_service_enabled',b.multi_service_enabled,'logo_url',CASE WHEN b.plan IN('negocio','pro') THEN b.logo_url ELSE '' END));
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
 IF b.id IS NULL THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;PERFORM private.require_public_region(b.id);
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
CREATE OR REPLACE FUNCTION public.atry_public_visit_availability(slug text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE bid text;
BEGIN SELECT id INTO bid FROM public.businesses WHERE businesses.slug=atry_public_visit_availability.slug;IF bid IS NULL THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;PERFORM private.require_public_region(bid);RETURN private.visit_options(bid,payload);END $function$
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
 PERFORM private.require_public_region(b.id);
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
 IF source='public' THEN PERFORM private.require_public_region(bid);END IF;
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
CREATE OR REPLACE FUNCTION private.visit_create(bid text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE legs jsonb;item jsonb;created jsonb;ids text[]:='{}';idx int:=0;vid text:=gen_random_uuid()::text;token text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');key text:=payload->>'idempotency_key';scope text:='visit:'||bid;digest text:=private.hash((payload-'idempotency_key')::text);previous public.idempotency_keys;result jsonb;cid text;
BEGIN
 PERFORM private.require_public_region(bid);
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
CREATE FUNCTION private.require_regional_client(bid text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN IF private.member_role(bid) IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;IF (SELECT country FROM public.businesses WHERE id=bid)='PA' AND coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-client-info' IS DISTINCT FROM 'atry-turnos-regional/1' THEN RAISE EXCEPTION 'REGIONAL_CLIENT_REQUIRED';END IF;END$$;
REVOKE ALL ON FUNCTION private.require_regional_client(text) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.atry_business(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE role text:=private.member_role(bid);b public.businesses;
BEGIN
 PERFORM private.require_regional_client(bid);
 IF role IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM public.businesses WHERE id=bid;
 RETURN to_jsonb(b)||jsonb_build_object('role',role,'staff_id',(SELECT id FROM public.staff WHERE business_id=bid AND user_id=private.user_id() AND active=1 LIMIT 1),'public_url','/#/reservar/'||b.slug);
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
 PERFORM private.require_regional_client(bid);
 IF role IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('services',coalesce((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('staff_ids',coalesce((SELECT jsonb_agg(ss.staff_id) FROM public.staff_services ss WHERE ss.service_id=s.id),'[]'::jsonb))) FROM public.services s WHERE s.business_id=bid),'[]'::jsonb),'staff',coalesce((SELECT jsonb_agg(to_jsonb(st)||jsonb_build_object('service_ids',coalesce((SELECT jsonb_agg(ss.service_id) FROM public.staff_services ss WHERE ss.staff_id=st.id),'[]'::jsonb))) FROM public.staff st WHERE st.business_id=bid AND (role IN ('owner','manager') OR private.own_staff(st.id))),'[]'::jsonb));
END $function$
;
COMMIT;
