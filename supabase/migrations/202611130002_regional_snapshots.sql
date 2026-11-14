BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
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
 RETURN jsonb_build_object('service_id',vid,'service_name',s.name,'staff_id',sid,'staff_name',st.name,'starts_at',starts,'ends_at',slot->'ends_at','blocked_from',slot->'blocked_from','blocked_until',slot->'blocked_until','resource_ids',coalesce((SELECT jsonb_agg(resource_id ORDER BY resource_id) FROM public.service_resources WHERE service_id=vid),'[]'),'duration_min',s.duration_min,'price_uyu',s.price_uyu,'price_minor',s.price_minor,'currency',s.currency,'time',to_char(starts AT TIME ZONE private.business_zone(bid),'HH24:MI'));
END $function$
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
 SELECT jsonb_agg(jsonb_build_object('id',x.id,'service_id',x.service_id,'staff_id',x.staff_id,'service_name',s.name,'staff_name',st.name,'starts_at',x.starts_at,'ends_at',x.ends_at,'status',x.status,'price_uyu',x.price_uyu,'price_minor',x.price_minor,'currency',x.currency) ORDER BY i.position) INTO legs FROM public.booking_visit_items i JOIN public.bookings x ON x.id=i.booking_id JOIN public.services s ON s.id=x.service_id JOIN public.staff st ON st.id=x.staff_id WHERE i.visit_id=vid;
 IF legs IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT CASE WHEN count(DISTINCT l->>'status')=1 THEN min(l->>'status') WHEN bool_and(l->>'status' IN('pending','confirmed')) THEN 'pending' ELSE 'in_progress' END INTO status FROM jsonb_array_elements(legs) l;
 RETURN jsonb_build_object('id',v.id,'visit',true,'business_name',b.name,'business_country',b.country,'business_timezone',b.timezone,'business_currency',b.currency,'currency',b.currency,'price_minor',(SELECT sum((l->>'price_minor')::bigint) FROM jsonb_array_elements(legs) l),'business_slug',b.slug,'cancel_notice_hours',b.cancel_notice_hours,'customer_name',(SELECT coalesce(x.customer_name_snapshot,c.name) FROM public.booking_visit_items i JOIN public.bookings x ON x.id=i.booking_id JOIN public.customers c ON c.id=x.customer_id WHERE i.visit_id=vid AND i.position=0),'starts_at',legs->0->'starts_at','ends_at',legs->-1->'ends_at','price_uyu',(SELECT sum((l->>'price_uyu')::int) FROM jsonb_array_elements(legs) l),'status',status,'service_name',(SELECT string_agg(l->>'service_name',' + ') FROM jsonb_array_elements(legs) l),'staff_name',(SELECT string_agg(DISTINCT l->>'staff_name',' · ') FROM jsonb_array_elements(legs) l),'legs',legs);
END $function$
;
CREATE OR REPLACE FUNCTION private.visit_fingerprint(vid text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT private.hash(coalesce(jsonb_agg(jsonb_build_array(b.id,b.status,b.starts_at,b.ends_at,b.staff_id,b.price_uyu,b.price_minor,b.currency) ORDER BY i.position)::text,'')) FROM public.booking_visit_items i JOIN public.bookings b ON b.id=i.booking_id WHERE i.visit_id=vid
$function$
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
  result:=result||jsonb_build_array(jsonb_build_object('start',legs->0->'starts_at','ends_at',legs->-1->'ends_at','time',legs->0->'time','legs',legs,'quote',private.hash(legs::text),'price_uyu',price,'price_minor',(SELECT sum((l->>'price_minor')::bigint) FROM jsonb_array_elements(legs) l),'currency',(SELECT currency FROM public.businesses WHERE id=bid),'duration_min',duration));
 END LOOP;
 RETURN jsonb_build_object('date',day,'options',result);
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
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO rows FROM (SELECT b.id,b.starts_at,b.ends_at,b.status,s.name service,st.name professional,coalesce(b.customer_name_snapshot,c.name) customer,coalesce(b.customer_email_snapshot,c.email) email,coalesce(b.customer_phone_snapshot,c.phone) phone,b.price_uyu,b.price_minor,b.currency FROM public.bookings b JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id JOIN public.customers c ON c.id=b.customer_id WHERE b.business_id=bid AND (after_start IS NULL OR (b.starts_at,b.id)>(after_start,after_id)) ORDER BY b.starts_at,b.id LIMIT page_size) x;
 IF jsonb_array_length(rows)=page_size THEN cursor:=jsonb_build_object('start',rows->-1->>'starts_at','id',rows->-1->>'id');END IF;
 SELECT coalesce(calendar_revisions.revision,0) INTO final_revision FROM public.calendar_revisions WHERE business_id=bid;
 IF coalesce(revision,0)<>coalesce(final_revision,0) THEN RAISE EXCEPTION 'EXPORT_CHANGED';END IF;
 RETURN jsonb_build_object('rows',rows,'currency',(SELECT currency FROM public.businesses WHERE id=bid),'timezone',private.business_zone(bid),'next_cursor',cursor,'revision',coalesce(revision,0));
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
 RETURN jsonb_set(result,'{business}',result->'business'||jsonb_build_object('plan',b.plan,'country',b.country,'timezone',b.timezone,'currency',b.currency,'locale',b.locale,'theme_config',private.project_theme(b),'multi_service_enabled',b.multi_service_enabled,'logo_url',CASE WHEN b.plan IN('negocio','pro') THEN b.logo_url ELSE '' END));
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
 SELECT jsonb_build_object('id',b.id,'business_id',b.business_id,'starts_at',b.starts_at,'ends_at',b.ends_at,'status',b.status,'price_uyu',b.price_uyu,'price_minor',b.price_minor,'currency',b.currency,'business_country',bu.country,'business_timezone',bu.timezone,'business_currency',bu.currency,'business_name',bu.name,'business_slug',bu.slug,'cancel_notice_hours',bu.cancel_notice_hours,'service_name',s.name,'staff_name',st.name,'customer_name',coalesce(b.customer_name_snapshot,c.name)) INTO result FROM public.bookings b JOIN public.businesses bu ON bu.id=b.business_id JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id JOIN public.customers c ON c.id=b.customer_id WHERE b.manage_token_hash=private.hash(token);
 IF result IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;RETURN result;
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
 RETURN jsonb_build_object('waitlist_enabled',private.has_feature(b.id,'waitlist'),'operational_mail',private.has_feature(b.id,'operational_mail'),'business',jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'sector',b.sector,'description',b.description,'city',b.city,'address',b.address,'phone',b.phone,'primary_color',b.primary_color,'secondary_color',b.secondary_color,'appearance_mode',b.appearance_mode,'logo_url',b.logo_url,'min_notice_min',b.min_notice_min,'max_days',b.max_days,'cancel_notice_hours',b.cancel_notice_hours),'services',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'duration_min',s.duration_min,'price_uyu',s.price_uyu,'price_minor',s.price_minor,'currency',s.currency,'deposit_percent',s.deposit_percent,'buffer_before_min',s.buffer_before_min,'buffer_after_min',s.buffer_after_min,'staff_ids',coalesce((SELECT jsonb_agg(st.id) FROM public.staff_services ss JOIN public.staff st ON st.id=ss.staff_id WHERE ss.service_id=s.id AND st.business_id=b.id AND st.active=1),'[]'::jsonb))) FROM public.services s WHERE s.business_id=b.id AND s.active=1),'[]'::jsonb),'staff',coalesce((SELECT jsonb_agg(jsonb_build_object('id',st.id,'name',st.name,'color',st.color,'service_ids',coalesce((SELECT jsonb_agg(service_id) FROM public.staff_services WHERE staff_id=st.id),'[]'::jsonb))) FROM public.staff st WHERE st.business_id=b.id AND st.active=1),'[]'::jsonb),'bookable',b.allow_guest=1 AND private.subscription_live(b.id) AND NOT EXISTS(SELECT 1 FROM private.business_controls c WHERE c.business_id=b.id AND c.reservation_scope IN ('public','all')));
END $function$
;

COMMIT;
