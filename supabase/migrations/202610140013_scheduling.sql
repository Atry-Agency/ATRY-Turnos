CREATE FUNCTION private.assert_future(bid text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b record;
BEGIN
 FOR b IN SELECT * FROM public.bookings WHERE business_id=bid AND status IN ('pending','confirmed') AND starts_at>now() LOOP
  PERFORM private.check_slot(bid,b.staff_id,b.service_id,b.starts_at,b.id,false);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.assert_future(text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atry_rules(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF coalesce(private.member_role(bid),'') NOT IN ('owner','manager') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('breaks',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.recurring_breaks x WHERE business_id=bid),'[]'::jsonb),'exceptions',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.schedule_exceptions x WHERE business_id=bid),'[]'::jsonb),'holidays',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.holidays x WHERE business_id=bid),'[]'::jsonb),'resources',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.resources x WHERE business_id=bid),'[]'::jsonb),'time_off',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.time_off x WHERE business_id=bid),'[]'::jsonb),'hours',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.working_hours x JOIN public.staff s ON s.id=x.staff_id WHERE s.business_id=bid),'[]'::jsonb),'service_resources',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.service_resources x JOIN public.services s ON s.id=x.service_id WHERE s.business_id=bid),'[]'::jsonb));
END $$;
CREATE FUNCTION public.atry_save_rule(bid text,kind text,rule_id text,payload jsonb,remove boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE rid text:=coalesce(rule_id,gen_random_uuid()::text);sid text:=payload->>'staff_id';r text;h jsonb;day text;resource_enabled int;
BEGIN
 IF coalesce(private.member_role(bid),'') NOT IN ('owner','manager') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 IF kind NOT IN ('breaks','exceptions','holidays','resources','time_off','hours','service_resources') THEN RAISE EXCEPTION 'INVALID_RULE';END IF;
 SELECT p.resources INTO resource_enabled FROM public.plans p JOIN public.businesses b ON b.plan=p.code WHERE b.id=bid;
 IF kind NOT IN ('time_off','hours') AND coalesce(resource_enabled,0)<>1 THEN RAISE EXCEPTION 'PLAN_FEATURE_DISABLED';END IF;
 IF NOT remove AND kind IN ('breaks','exceptions','time_off','hours') AND NOT EXISTS(SELECT 1 FROM public.staff WHERE id=sid AND business_id=bid AND active=1) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
 CASE kind
 WHEN 'breaks' THEN
  IF remove THEN DELETE FROM public.recurring_breaks WHERE id=rid AND business_id=bid;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  ELSE INSERT INTO public.recurring_breaks VALUES(rid,bid,sid,(payload->>'weekday')::int,(payload->>'start_min')::int,(payload->>'end_min')::int);END IF;
 WHEN 'exceptions' THEN
  IF remove THEN DELETE FROM public.schedule_exceptions WHERE id=rid AND business_id=bid;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  ELSE day:=to_char((payload->>'day')::date,'YYYY-MM-DD');IF day IS NULL THEN RAISE EXCEPTION 'INVALID_DAY';END IF;
   INSERT INTO public.schedule_exceptions VALUES(rid,bid,sid,day,(payload->>'start_min')::int,(payload->>'end_min')::int,coalesce((payload->>'closed')::int,0));END IF;
 WHEN 'holidays' THEN
  IF remove THEN DELETE FROM public.holidays WHERE id=rid AND business_id=bid;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  ELSE day:=to_char((payload->>'day')::date,'YYYY-MM-DD');IF day IS NULL OR length(btrim(coalesce(payload->>'name','')))<2 THEN RAISE EXCEPTION 'INVALID_HOLIDAY';END IF;
   INSERT INTO public.holidays VALUES(rid,bid,day,left(btrim(payload->>'name'),100));END IF;
 WHEN 'resources' THEN
  IF remove THEN RAISE EXCEPTION 'DEACTIVATE_RESOURCE_INSTEAD';END IF;
  IF rule_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.resources WHERE id=rid AND business_id=bid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
   IF coalesce((payload->>'active')::int,1)=0 AND EXISTS(SELECT 1 FROM public.booking_resources br JOIN public.bookings b ON b.id=br.booking_id WHERE br.resource_id=rid AND b.status IN ('pending','confirmed') AND b.starts_at>now()) THEN RAISE EXCEPTION 'RESOURCE_IN_USE';END IF;
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
  IF EXISTS(SELECT 1 FROM public.bookings WHERE service_id=sid AND business_id=bid AND status IN ('pending','confirmed') AND starts_at>now()) THEN RAISE EXCEPTION 'SERVICE_IN_USE';END IF;
  DELETE FROM public.service_resources WHERE service_id=sid;
  FOR r IN SELECT jsonb_array_elements_text(payload->'resource_ids') LOOP
   IF NOT EXISTS(SELECT 1 FROM public.resources WHERE id=r AND business_id=bid AND active=1) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
   INSERT INTO public.service_resources VALUES(sid,r) ON CONFLICT DO NOTHING;
  END LOOP;rid:=sid;
 END CASE;
 PERFORM private.assert_future(bid);
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'rule.'||kind||CASE WHEN remove THEN '.removed' ELSE '.saved' END,kind,rid,now());
 RETURN jsonb_build_object('id',rid,'ok',true);
END $$;
REVOKE ALL ON FUNCTION public.atry_rules(text),public.atry_save_rule(text,text,text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_rules(text),public.atry_save_rule(text,text,text,jsonb,boolean) TO authenticated;
