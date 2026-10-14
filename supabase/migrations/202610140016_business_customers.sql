CREATE FUNCTION private.require_manager(bid text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF coalesce(private.member_role(bid),'') NOT IN ('owner','manager') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;END $$;
REVOKE ALL ON FUNCTION private.require_manager(text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atry_business(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE role text:=private.member_role(bid);b public.businesses;
BEGIN
 IF role IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM public.businesses WHERE id=bid;
 RETURN to_jsonb(b)||jsonb_build_object('role',role,'staff_id',(SELECT id FROM public.staff WHERE business_id=bid AND user_id=private.user_id() AND active=1 LIMIT 1),'public_url','/#/reservar/'||b.slug);
END $$;
CREATE FUNCTION public.atry_save_business(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE b public.businesses;patch jsonb;pair record;max_len integer;
BEGIN
 PERFORM private.require_manager(bid);SELECT * INTO b FROM public.businesses WHERE id=bid FOR UPDATE;
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
END $$;
CREATE FUNCTION public.atry_customers(bid text,query text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN
 PERFORM private.require_manager(bid);
 IF length(coalesce(query,''))>80 THEN RAISE EXCEPTION 'INVALID_SEARCH';END IF;
 RETURN coalesce((SELECT jsonb_agg(row) FROM (SELECT to_jsonb(c)||jsonb_build_object('visits',(SELECT count(*) FROM public.bookings b WHERE b.customer_id=c.id AND b.status<>'cancelled')) AS row FROM public.customers c WHERE c.business_id=bid AND (coalesce(query,'')='' OR c.name ILIKE '%'||query||'%' OR c.email ILIKE '%'||query||'%' OR c.phone ILIKE '%'||query||'%') ORDER BY CASE WHEN coalesce(query,'')<>'' THEN c.name END,c.created_at DESC LIMIT 100) x),'[]'::jsonb);
END $$;
CREATE FUNCTION public.atry_save_customer(bid text,customer_id text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE c public.customers;
BEGIN
 PERFORM private.require_manager(bid);SELECT * INTO c FROM public.customers WHERE id=customer_id AND business_id=bid FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF payload?'notes' AND (jsonb_typeof(payload->'notes')<>'string' OR length(payload->>'notes')>700) THEN RAISE EXCEPTION 'INVALID_NOTES';END IF;
 IF payload?'marketing_consent' AND (payload->>'marketing_consent') NOT IN ('0','1') THEN RAISE EXCEPTION 'INVALID_CONSENT';END IF;
 UPDATE public.customers SET notes=coalesce(payload->>'notes',c.notes),marketing_consent=coalesce((payload->>'marketing_consent')::integer,c.marketing_consent) WHERE id=c.id;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'customer.updated','customer',c.id,now());RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION public.atry_customer_history(bid text,customer_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN
 PERFORM private.require_manager(bid);
 IF NOT EXISTS(SELECT 1 FROM public.customers WHERE id=customer_id AND business_id=bid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT b.id,b.starts_at,b.status,b.price_uyu,s.name service_name,st.name staff_name FROM public.bookings b JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id WHERE b.business_id=bid AND b.customer_id=customer_id ORDER BY b.starts_at DESC LIMIT 100) x),'[]'::jsonb);
END $$;
CREATE FUNCTION public.atry_entitlements(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF private.member_role(bid) IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 RETURN (SELECT to_jsonb(p) FROM public.plans p JOIN public.businesses b ON b.plan=p.code WHERE b.id=bid);
END $$;
REVOKE ALL ON FUNCTION public.atry_business(text),public.atry_save_business(text,jsonb),public.atry_customers(text,text),public.atry_save_customer(text,text,jsonb),public.atry_customer_history(text,text),public.atry_entitlements(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_business(text),public.atry_save_business(text,jsonb),public.atry_customers(text,text),public.atry_save_customer(text,text,jsonb),public.atry_customer_history(text,text),public.atry_entitlements(text) TO authenticated;
