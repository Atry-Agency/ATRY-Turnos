-- Atomic sequential visits reuse the existing scheduling, contact and quota rules.
CREATE TABLE public.booking_visits(id text PRIMARY KEY,business_id text NOT NULL REFERENCES public.businesses(id),manage_token_hash text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.booking_visit_items(visit_id text NOT NULL REFERENCES public.booking_visits(id) ON DELETE CASCADE,booking_id text NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,position int NOT NULL CHECK(position BETWEEN 0 AND 5),PRIMARY KEY(visit_id,position));
CREATE TABLE private.visit_tokens(visit_id text PRIMARY KEY REFERENCES public.booking_visits(id) ON DELETE CASCADE,token text NOT NULL);
ALTER TABLE public.booking_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_visit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.visit_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_visits,public.booking_visit_items,private.visit_tokens FROM PUBLIC,anon,authenticated,service_role;

-- Snapshot the guarded scheduler, adding explicit, private-only off-grid and
-- ignore-list parameters. The single-service scheduler keeps its defaults.
DO $$ DECLARE source text;BEGIN
 SELECT pg_get_functiondef('private.check_slot_before_recurring(text,text,text,timestamptz,text,boolean)'::regprocedure) INTO source;
 source:=regexp_replace(source,'CREATE OR REPLACE FUNCTION private.check_slot_before_recurring\([^)]*\)','CREATE OR REPLACE FUNCTION private.visit_slot_base(bid text,sid text,vid text,starts timestamptz,ignore_id text,notice boolean,ignore_ids text[],off_grid boolean)');
 IF position('m%nullif(b.slot_step_min,0)<>0' IN source)=0 THEN RAISE EXCEPTION 'VISIT_SLOT_PATCH_MISMATCH';END IF;
 source:=replace(source,'m%nullif(b.slot_step_min,0)<>0','(NOT off_grid AND m%nullif(b.slot_step_min,0)<>0)');
 source:=replace(source,'id<>ignore_id AND status','id<>ignore_id AND NOT(id=ANY(ignore_ids)) AND status');
 source:=replace(source,'bb.booking_id<>ignore_id AND bb.occupied','bb.booking_id<>ignore_id AND NOT(bb.booking_id=ANY(ignore_ids)) AND bb.occupied');EXECUTE source;
 SELECT pg_get_functiondef('private.check_slot(text,text,text,timestamptz,text,boolean)'::regprocedure) INTO source;
 source:=regexp_replace(source,'CREATE OR REPLACE FUNCTION private.check_slot\([^)]*\)','CREATE OR REPLACE FUNCTION private.visit_slot_raw(bid text,sid text,vid text,starts timestamptz,ignore_id text,notice boolean,ignore_ids text[],off_grid boolean)');
 IF position('private.check_slot_before_recurring(bid,sid,vid,starts,ignore_id,notice)' IN source)=0 THEN RAISE EXCEPTION 'VISIT_SLOT_PATCH_MISMATCH';END IF;
 source:=replace(source,'private.check_slot_before_recurring(bid,sid,vid,starts,ignore_id,notice)','private.visit_slot_base(bid,sid,vid,starts,ignore_id,notice,ignore_ids,off_grid)');EXECUTE source;
END $$;
ALTER FUNCTION private.check_slot(text,text,text,timestamptz,text,boolean) RENAME TO check_slot_single;
CREATE FUNCTION private.check_slot(bid text,sid text,vid text,starts timestamptz,ignore_id text DEFAULT '',notice boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb:=coalesce(nullif(current_setting('atry.visit_slot',true),''),'{}')::jsonb;
BEGIN
 IF context->>'bid'=bid AND context->>'sid'=sid AND context->>'vid'=vid AND (context->>'starts')::timestamptz=starts THEN
  RETURN private.visit_slot_raw(bid,sid,vid,starts,ignore_id,notice,ARRAY(SELECT jsonb_array_elements_text(context->'ignore_ids')),coalesce((context->>'off_grid')::boolean,false));
 END IF;
 RETURN private.check_slot_single(bid,sid,vid,starts,ignore_id,notice);
END $$;
CREATE FUNCTION private.visit_leg(bid text,sid text,vid text,starts timestamptz,off_grid boolean,ignore_ids text[],owner boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE slot jsonb;s public.services;st public.staff;
BEGIN
 slot:=private.visit_slot_raw(bid,sid,vid,starts,'',NOT owner,ignore_ids,off_grid);
 SELECT * INTO s FROM public.services WHERE id=vid AND business_id=bid;SELECT * INTO st FROM public.staff WHERE id=sid AND business_id=bid;
 IF starts<=now() THEN RAISE EXCEPTION 'OUTSIDE_NOTICE';END IF;
 RETURN jsonb_build_object('service_id',vid,'service_name',s.name,'staff_id',sid,'staff_name',st.name,'starts_at',starts,'ends_at',slot->'ends_at','blocked_from',slot->'blocked_from','blocked_until',slot->'blocked_until','resource_ids',coalesce((SELECT jsonb_agg(resource_id ORDER BY resource_id) FROM public.service_resources WHERE service_id=vid),'[]'),'duration_min',s.duration_min,'price_uyu',s.price_uyu,'time',to_char(starts AT TIME ZONE 'America/Montevideo','HH24:MI'));
END $$;
CREATE FUNCTION private.visit_overlaps(a jsonb,b jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT (a->>'blocked_from')::timestamptz<(b->>'blocked_until')::timestamptz AND (b->>'blocked_from')::timestamptz<(a->>'blocked_until')::timestamptz AND (a->>'staff_id'=b->>'staff_id' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(a->'resource_ids') x JOIN jsonb_array_elements_text(b->'resource_ids') y ON x=y))
$$;
CREATE FUNCTION private.visit_services(bid text,ids text[],owner boolean,ignore_enabled boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN
 IF array_length(ids,1) IS NULL OR array_length(ids,1)>6 OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) OR array_position(ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'INVALID_VISIT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=bid AND is_active=1 AND (multi_service_enabled=1 OR ignore_enabled) AND (owner OR allow_guest=1)) THEN RAISE EXCEPTION 'VISITS_DISABLED';END IF;
 IF NOT private.subscription_live(bid) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM private.business_controls WHERE business_id=bid AND (reservation_scope='all' OR (NOT owner AND reservation_scope='public'))) THEN RAISE EXCEPTION 'RESERVATIONS_PAUSED';END IF;
 IF (SELECT count(*) FROM public.services WHERE business_id=bid AND active=1 AND id=ANY(ids))<>cardinality(ids) THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;
 IF (SELECT sum(duration_min) FROM public.services WHERE business_id=bid AND id=ANY(ids))>480 THEN RAISE EXCEPTION 'VISIT_TOO_LONG';END IF;
END $$;
CREATE FUNCTION private.visit_search(bid text,ids text[],idx int,starts timestamptz,legs jsonb,prefs jsonb,ignore_ids text[],owner boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
CREATE FUNCTION private.visit_options(bid text,payload jsonb,ignore_ids text[] DEFAULT '{}',owner boolean DEFAULT false,ignore_enabled boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
CREATE FUNCTION private.validate_visit(bid text,payload jsonb,ignore_ids text[],owner boolean,ignore_enabled boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
CREATE FUNCTION private.visit_read(vid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE v public.booking_visits;b public.businesses;legs jsonb;status text;
BEGIN
 SELECT * INTO v FROM public.booking_visits WHERE id=vid;IF v.id IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT * INTO b FROM public.businesses WHERE id=v.business_id;
 SELECT jsonb_agg(jsonb_build_object('id',x.id,'service_id',x.service_id,'staff_id',x.staff_id,'service_name',s.name,'staff_name',st.name,'starts_at',x.starts_at,'ends_at',x.ends_at,'status',x.status,'price_uyu',x.price_uyu) ORDER BY i.position) INTO legs FROM public.booking_visit_items i JOIN public.bookings x ON x.id=i.booking_id JOIN public.services s ON s.id=x.service_id JOIN public.staff st ON st.id=x.staff_id WHERE i.visit_id=vid;
 IF legs IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT CASE WHEN count(DISTINCT l->>'status')=1 THEN min(l->>'status') WHEN bool_and(l->>'status' IN('pending','confirmed')) THEN 'pending' ELSE 'in_progress' END INTO status FROM jsonb_array_elements(legs) l;
 RETURN jsonb_build_object('id',v.id,'visit',true,'business_name',b.name,'business_slug',b.slug,'cancel_notice_hours',b.cancel_notice_hours,'customer_name',(SELECT coalesce(x.customer_name_snapshot,c.name) FROM public.booking_visit_items i JOIN public.bookings x ON x.id=i.booking_id JOIN public.customers c ON c.id=x.customer_id WHERE i.visit_id=vid AND i.position=0),'starts_at',legs->0->'starts_at','ends_at',legs->-1->'ends_at','price_uyu',(SELECT sum((l->>'price_uyu')::int) FROM jsonb_array_elements(legs) l),'status',status,'service_name',(SELECT string_agg(l->>'service_name',' + ') FROM jsonb_array_elements(legs) l),'staff_name',(SELECT string_agg(DISTINCT l->>'staff_name',' · ') FROM jsonb_array_elements(legs) l),'legs',legs);
END $$;
CREATE FUNCTION private.visit_notify(vid text,kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE v jsonb:=private.visit_read(vid);anchor public.bookings;token text;summary text;
BEGIN
 SELECT b.* INTO anchor FROM public.booking_visit_items i JOIN public.bookings b ON b.id=i.booking_id WHERE i.visit_id=vid AND i.position=0;
 SELECT t.token INTO token FROM private.visit_tokens t WHERE t.visit_id=vid;
 SELECT string_agg((l->>'service_name')||' · '||(l->>'staff_name')||' · '||to_char((l->>'starts_at')::timestamptz AT TIME ZONE 'America/Montevideo','DD/MM/YYYY HH24:MI')||' · '||CASE l->>'status' WHEN 'confirmed' THEN 'Confirmado' WHEN 'pending' THEN 'Pendiente' WHEN 'cancelled' THEN 'Cancelado' WHEN 'completed' THEN 'Completado' ELSE 'No asistió' END,' / ') INTO summary FROM jsonb_array_elements(v->'legs') l;
 INSERT INTO public.notifications(id,business_id,booking_id,kind,recipient,subject,content,created_at) VALUES(gen_random_uuid()::text,anchor.business_id,anchor.id,kind,coalesce(anchor.customer_email_snapshot,''),'ATRY Turnos · visita completa',summary||'. Total: $'||(v->>'price_uyu')||' UYU. Gestioná toda la visita en /#/gestionar/'||token,now());
END $$;
CREATE FUNCTION private.visit_create(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
CREATE FUNCTION private.visit_change(vid text,operation text,payload jsonb,owner boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
-- Individual service completion is retained; scheduling and approvals are joint.
ALTER FUNCTION private.update_booking(text,text,jsonb,text) RENAME TO update_booking_single;
CREATE FUNCTION private.update_booking(bid text,booking_id text,patch jsonb,source text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.booking_visit_items WHERE booking_visit_items.booking_id=update_booking.booking_id) AND (patch ? 'starts_at' OR patch ? 'staff_id' OR patch->>'status' IN('confirmed','cancelled')) THEN RAISE EXCEPTION 'VISIT_REQUIRED';END IF;
 RETURN private.update_booking_single(bid,booking_id,patch,source);
END $$;
DO $$ DECLARE source text;BEGIN
 SELECT pg_get_functiondef('private.booking_change_notification()'::regprocedure) INTO source;
 source:=regexp_replace(source,'\mBEGIN\M','BEGIN IF EXISTS(SELECT 1 FROM public.booking_visit_items WHERE booking_id=NEW.id) THEN RETURN NEW;END IF;','i');EXECUTE source;
END $$;

CREATE FUNCTION public.atry_public_visit_availability(slug text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE bid text;
BEGIN SELECT id INTO bid FROM public.businesses WHERE businesses.slug=atry_public_visit_availability.slug;IF bid IS NULL THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;RETURN private.visit_options(bid,payload);END $$;
CREATE FUNCTION public.atry_public_visit_book(slug text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE bid text;
BEGIN SELECT id INTO bid FROM public.businesses WHERE businesses.slug=atry_public_visit_book.slug;IF bid IS NULL THEN RAISE EXCEPTION 'NOT_AVAILABLE';END IF;RETURN private.visit_create(bid,payload);END $$;
CREATE FUNCTION public.atry_visit(bid text,visit_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM private.require_manager(bid);IF NOT EXISTS(SELECT 1 FROM public.booking_visits WHERE id=visit_id AND business_id=bid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;RETURN private.visit_read(visit_id);END $$;
CREATE FUNCTION public.atry_visit_command(bid text,visit_id text,operation text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM public.atry_visit(bid,visit_id);RETURN private.visit_change(visit_id,operation,payload,true);END $$;
CREATE FUNCTION public.atry_visit_availability(bid text,visit_id text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;ids text[];
BEGIN
 v:=public.atry_visit(bid,visit_id);IF EXISTS(SELECT 1 FROM jsonb_array_elements(v->'legs') l WHERE l->>'status' NOT IN('pending','confirmed')) THEN RAISE EXCEPTION 'FINALIZED';END IF;
 ids:=ARRAY(SELECT booking_id FROM public.booking_visit_items WHERE booking_visit_items.visit_id=atry_visit_availability.visit_id);
 RETURN private.visit_options(bid,payload||jsonb_build_object('service_ids',(SELECT jsonb_agg(l->'service_id') FROM jsonb_array_elements(v->'legs') l)),ids,true,true);
END $$;
ALTER FUNCTION public.atry_manage(text) RENAME TO manage_single;
ALTER FUNCTION public.manage_single(text) SET SCHEMA private;
ALTER FUNCTION public.atry_manage_change(text,text,jsonb) RENAME TO manage_change_single;
ALTER FUNCTION public.manage_change_single(text,text,jsonb) SET SCHEMA private;
CREATE FUNCTION public.atry_manage(token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE vid text;
BEGIN
 IF token IS NULL OR token!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT id INTO vid FROM public.booking_visits WHERE manage_token_hash=private.hash(token);IF vid IS NOT NULL THEN RETURN private.visit_read(vid);END IF;RETURN private.manage_single(token);
END $$;
CREATE FUNCTION public.atry_manage_change(token text,operation text,payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE vid text;
BEGIN
 IF token IS NULL OR token!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT id INTO vid FROM public.booking_visits WHERE manage_token_hash=private.hash(token);IF vid IS NOT NULL THEN RETURN private.visit_change(vid,operation,payload,false);END IF;RETURN private.manage_change_single(token,operation,payload);
END $$;
CREATE FUNCTION public.atry_manage_visit_availability(token text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE vid text;bid text;v jsonb;ids text[];
BEGIN
 IF token IS NULL OR token!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT id,business_id INTO vid,bid FROM public.booking_visits WHERE manage_token_hash=private.hash(token);IF vid IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 v:=private.visit_read(vid);
 IF (v->>'starts_at')::timestamptz<now()+make_interval(hours=>(v->>'cancel_notice_hours')::int) OR EXISTS(SELECT 1 FROM jsonb_array_elements(v->'legs') l WHERE l->>'status' NOT IN('pending','confirmed')) THEN RAISE EXCEPTION 'OUTSIDE_POLICY';END IF;
 ids:=ARRAY(SELECT booking_id FROM public.booking_visit_items WHERE visit_id=vid);
 RETURN private.visit_options(bid,payload||jsonb_build_object('service_ids',(SELECT jsonb_agg(l->'service_id') FROM jsonb_array_elements(v->'legs') l)),ids,false,true);
END $$;
-- Preserve existing catalog filtering and annotate only bookings already visible to the role.
ALTER FUNCTION public.atry_bookings(text,date,int) RENAME TO bookings_visit_base;
ALTER FUNCTION public.bookings_visit_base(text,date,int) SET SCHEMA private;
CREATE FUNCTION public.atry_bookings(bid text,start_day date,days int DEFAULT 1) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 result:=private.bookings_visit_base(bid,start_day,days);
 RETURN coalesce((SELECT jsonb_agg(e||jsonb_build_object('visit_id',(SELECT visit_id FROM public.booking_visit_items WHERE booking_id=e->>'id'))) FROM jsonb_array_elements(result) e),'[]');
END $$;
-- Private helpers never become callable through PostgREST's public schema.
CREATE FUNCTION private.visit_fingerprint(vid text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.hash(coalesce(jsonb_agg(jsonb_build_array(b.id,b.status,b.starts_at,b.ends_at,b.staff_id,b.price_uyu) ORDER BY i.position)::text,'')) FROM public.booking_visit_items i JOIN public.bookings b ON b.id=i.booking_id WHERE i.visit_id=vid
$$;
-- Queue one reminder for the whole visit, with a signature covering every leg.
-- Existing preference, cycle/quota and delivery safeguards remain in place.
DO $$ DECLARE source text;f text;BEGIN
 SELECT pg_get_functiondef('private.enqueue_mail(text,text,text,text,text,text,text,text,timestamptz)'::regprocedure) INTO source;
 source:=replace(source,$find$'staff_id',b.staff_id)$find$,$replacement$'staff_id',b.staff_id)||coalesce((SELECT jsonb_build_object('visit_fingerprint',private.visit_fingerprint(i.visit_id)) FROM public.booking_visit_items i WHERE i.booking_id=b.id),'{}'::jsonb)$replacement$);
 EXECUTE source;
 FOREACH f IN ARRAY ARRAY['private.mail_ingest_before_recurring()'] LOOP
  SELECT pg_get_functiondef(f::regprocedure) INTO source;
  IF position('WHERE book.status IN' IN source)=0 THEN RAISE EXCEPTION 'VISIT_REMINDER_PATCH_MISMATCH';END IF;
  source:=replace(source,'WHERE book.status IN','WHERE NOT EXISTS(SELECT 1 FROM public.booking_visit_items vi WHERE vi.booking_id=book.id AND vi.position>0) AND book.status IN');
  source:=replace(source,'s.name service_name',$replacement$coalesce((SELECT string_agg(vs.name,' + ' ORDER BY all_items.position) FROM public.booking_visit_items vi JOIN public.booking_visit_items all_items ON all_items.visit_id=vi.visit_id JOIN public.bookings all_books ON all_books.id=all_items.booking_id JOIN public.services vs ON vs.id=all_books.service_id WHERE vi.booking_id=book.id),s.name) service_name$replacement$);
  EXECUTE source;
 END LOOP;
END $$;
ALTER FUNCTION private.mail_is_valid(public.mail_jobs) RENAME TO mail_is_valid_single;
CREATE FUNCTION private.mail_is_valid(j public.mail_jobs) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
-- The old snapshot validator compares its three known fields, while the wrapper
-- above independently checks the new visit signature.
DO $$ DECLARE source text;BEGIN
 SELECT pg_get_functiondef('private.mail_is_valid_single(public.mail_jobs)'::regprocedure) INTO source;
 source:=replace(source,'j.booking_snapshot=jsonb_build_object','(j.booking_snapshot-''visit_fingerprint'')=jsonb_build_object');EXECUTE source;
END $$;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='private'::regnamespace AND (proname LIKE 'visit_%' OR proname IN('validate_visit','check_slot','check_slot_single','update_booking','update_booking_single','manage_single','manage_change_single','bookings_visit_base','mail_is_valid','mail_is_valid_single')) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.atry_public_visit_availability(text,jsonb),public.atry_public_visit_book(text,jsonb),public.atry_manage(text),public.atry_manage_change(text,text,jsonb),public.atry_manage_visit_availability(text,jsonb),public.atry_visit(text,text),public.atry_visit_command(text,text,text,jsonb),public.atry_visit_availability(text,text,jsonb),public.atry_bookings(text,date,int) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.atry_public_visit_availability(text,jsonb),public.atry_public_visit_book(text,jsonb),public.atry_manage(text),public.atry_manage_change(text,text,jsonb),public.atry_manage_visit_availability(text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.atry_visit(text,text),public.atry_visit_command(text,text,text,jsonb),public.atry_visit_availability(text,text,jsonb),public.atry_bookings(text,date,int) TO authenticated;

-- Recompile call sites after private entry points were renamed, including hot sessions.
DO $$ DECLARE f text;BEGIN
 FOREACH f IN ARRAY ARRAY['private.create_booking(text,jsonb,text)','public.atry_update_booking(text,text,jsonb)','private.manage_change_single(text,text,jsonb)','public.atry_mail_claim(integer)'] LOOP EXECUTE pg_get_functiondef(f::regprocedure);END LOOP;
END $$;
