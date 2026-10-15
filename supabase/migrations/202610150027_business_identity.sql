-- Preserve existing RPC signatures, ownership and access controls. No new grants.
CREATE OR REPLACE FUNCTION public.atry_save_customer(bid text,customer_id text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  UPDATE public.recurring_appointments r SET customer_name=n,customer_email=e,customer_phone=p WHERE r.business_id=bid AND r.customer_email=c.email AND r.customer_phone=c.phone;
 END IF;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),CASE WHEN c.id IS NULL THEN 'customer.created' ELSE 'customer.updated' END,'customer',cid,now());
 RETURN (SELECT to_jsonb(x) FROM public.customers x WHERE x.id=cid AND x.business_id=bid);
END $$;
CREATE OR REPLACE FUNCTION public.atry_create_organization(payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text:=private.user_id();u public.users;bid text:=gen_random_uuid()::text;sid text:=gen_random_uuid()::text;name text:=btrim(payload->>'name');slug text:=lower(btrim(payload->>'slug'));
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO u FROM public.users WHERE id=uid FOR UPDATE;
 IF (SELECT count(*) FROM public.memberships WHERE user_id=uid AND role='owner')>=10 THEN RAISE EXCEPTION 'ORGANIZATION_LIMIT';END IF;
 IF name IS NULL OR length(name)<2 OR length(name)>100 OR slug IS NULL OR slug!~'^[a-z0-9][a-z0-9-]{1,53}[a-z0-9]$' THEN RAISE EXCEPTION 'INVALID_ORGANIZATION';END IF;
 INSERT INTO public.businesses(id,slug,name,email,sector,trial_until,created_at) VALUES(bid,slug,name,u.email,coalesce(nullif(left(btrim(payload->>'sector'),100),''),'General'),now()+interval '14 days',now());
 INSERT INTO public.memberships VALUES(uid,bid,'owner');
 INSERT INTO public.staff(id,business_id,user_id,name,email,created_at) VALUES(sid,bid,uid,u.name,u.email,now());
 INSERT INTO public.working_hours SELECT sid,d,540,1080 FROM generate_series(1,6) d;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,uid,'business.created','business',bid,now());
 RETURN jsonb_build_object('id',bid,'name',name,'slug',slug);
END $$;
CREATE OR REPLACE FUNCTION public.atry_finish_registration() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid text:=private.user_id();meta jsonb;name text;slug text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users WHERE id=uid FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.memberships WHERE user_id=uid) THEN RETURN jsonb_build_object('ok',true);END IF;
 SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 name:=nullif(btrim(meta->>'requested_business_name'),'');slug:=nullif(meta->>'requested_business_slug','');
 IF name IS NULL THEN RETURN jsonb_build_object('ok',true);END IF;
 RETURN public.atry_create_organization(jsonb_build_object('name',name,'slug',slug,'sector',meta->>'requested_business_sector'));
END $$;
CREATE OR REPLACE FUNCTION private.create_booking(bid text,payload jsonb,source text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
CREATE OR REPLACE FUNCTION public.atry_customers(bid text,query text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN
 PERFORM private.require_manager(bid);
 IF length(coalesce(query,''))>80 THEN RAISE EXCEPTION 'INVALID_SEARCH';END IF;
 RETURN coalesce((SELECT jsonb_agg(row) FROM (SELECT to_jsonb(c)||jsonb_build_object('visits',(SELECT count(*) FROM public.bookings b WHERE b.customer_id=c.id AND b.status<>'cancelled')) AS row FROM public.customers c WHERE c.business_id=bid AND (coalesce(query,'')='' OR c.name ILIKE '%'||query||'%' OR c.email ILIKE '%'||query||'%' OR c.phone ILIKE '%'||query||'%' OR (regexp_replace(query,'[^0-9]','','g')<>'' AND regexp_replace(c.phone,'[^0-9]','','g') LIKE '%'||regexp_replace(query,'[^0-9]','','g')||'%')) ORDER BY CASE WHEN coalesce(query,'')<>'' THEN c.name END,c.created_at DESC LIMIT 100) x),'[]'::jsonb);
END $$;
