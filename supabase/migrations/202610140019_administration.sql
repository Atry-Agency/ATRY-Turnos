CREATE FUNCTION private.require_admin() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid text:=private.user_id();
BEGIN IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=uid AND platform_admin=1) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;RETURN uid;END $$;
CREATE FUNCTION public.atry_admin_businesses() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM private.require_admin();RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT b.id,b.name,b.slug,b.plan,b.subscription_status,b.trial_until,b.created_at,b.is_active,(SELECT count(*) FROM public.bookings WHERE business_id=b.id) bookings,(SELECT count(*) FROM public.memberships WHERE business_id=b.id) members FROM public.businesses b ORDER BY created_at DESC) x),'[]'::jsonb);
END $$;
CREATE FUNCTION public.atry_admin_save_business(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text:=private.require_admin();b public.businesses;
BEGIN
 SELECT * INTO b FROM public.businesses WHERE id=bid FOR UPDATE;IF b.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF payload?'plan' THEN IF coalesce(payload->>'plan','') NOT IN ('trial','individual','negocio','pro') THEN RAISE EXCEPTION 'INVALID_PLAN';END IF;b.plan:=payload->>'plan';END IF;
 IF payload?'subscription_status' THEN IF coalesce(payload->>'subscription_status','') NOT IN ('trialing','active','past_due','suspended') THEN RAISE EXCEPTION 'INVALID_SUBSCRIPTION';END IF;b.subscription_status:=payload->>'subscription_status';END IF;
 IF payload?'is_active' THEN IF coalesce(payload->>'is_active','') NOT IN ('0','1') THEN RAISE EXCEPTION 'INVALID_STATUS';END IF;b.is_active:=(payload->>'is_active')::integer;END IF;
 UPDATE public.businesses SET plan=b.plan,subscription_status=b.subscription_status,is_active=b.is_active WHERE id=bid;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,uid,'admin.business.updated','business',bid,now());INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'admin.business.updated',bid,now());RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION public.atry_admin_plans() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM private.require_admin();RETURN coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.plans p),'[]'::jsonb);END $$;
CREATE FUNCTION public.atry_admin_save_plan(code text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text:=private.require_admin();p public.plans;k text;
BEGIN
 SELECT * INTO p FROM public.plans WHERE plans.code=atry_admin_save_plan.code FOR UPDATE;IF p.code IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF payload?'staff_limit' THEN IF jsonb_typeof(payload->'staff_limit')<>'number' OR (payload->>'staff_limit')::integer NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'INVALID_LIMIT';END IF;p.staff_limit:=(payload->>'staff_limit')::integer;END IF;
 FOREACH k IN ARRAY ARRAY['smartslots','resources','reports'] LOOP IF payload?k AND coalesce(payload->>k,'') NOT IN ('0','1') THEN RAISE EXCEPTION 'INVALID_FEATURE';END IF;END LOOP;
 UPDATE public.plans SET staff_limit=p.staff_limit,smartslots=coalesce((payload->>'smartslots')::integer,p.smartslots),resources=coalesce((payload->>'resources')::integer,p.resources),reports=coalesce((payload->>'reports')::integer,p.reports) WHERE plans.code=atry_admin_save_plan.code;
 INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'plan.updated',code,now());RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION public.atry_incidents(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN PERFORM private.require_manager(bid);RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,subject,state,created_at,updated_at FROM public.incidents WHERE business_id=bid ORDER BY created_at DESC LIMIT 50) x),'[]'::jsonb);END $$;
CREATE FUNCTION public.atry_create_incident(bid text,subject text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE iid text:=gen_random_uuid()::text;
BEGIN
 PERFORM private.require_manager(bid);IF subject IS NULL OR length(btrim(subject)) NOT BETWEEN 5 AND 180 THEN RAISE EXCEPTION 'INVALID_SUBJECT';END IF;
 INSERT INTO public.incidents VALUES(iid,bid,btrim(subject),'open',private.user_id(),now(),now());INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'incident.created','incident',iid,now());RETURN jsonb_build_object('id',iid);
END $$;
CREATE FUNCTION public.atry_admin_incidents() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM private.require_admin();RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT i.id,i.subject,i.state,i.created_at,b.name business_name FROM public.incidents i JOIN public.businesses b ON b.id=i.business_id ORDER BY i.created_at DESC LIMIT 100) x),'[]'::jsonb);END $$;
CREATE FUNCTION public.atry_admin_save_incident(incident_id text,state text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text:=private.require_admin();
BEGIN
 IF coalesce(state,'') NOT IN ('open','investigating','resolved') THEN RAISE EXCEPTION 'INVALID_STATUS';END IF;
 UPDATE public.incidents SET state=atry_admin_save_incident.state,updated_at=now() WHERE id=incident_id;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'incident.updated',incident_id,now());RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION public.atry_admin_operations() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM private.require_admin();RETURN jsonb_build_object('organizations',(SELECT count(*) FROM public.businesses),'queued_notifications',(SELECT count(*) FROM public.notifications WHERE state='queued'),'integrations',jsonb_build_object('email','Configuración de entrega pendiente','mercado_pago','Sin credenciales ni cobros','whatsapp','Pendiente de integración oficial'),'audit',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT action,entity,created_at FROM public.audit_log ORDER BY created_at DESC LIMIT 30) x),'[]'::jsonb));
END $$;
CREATE FUNCTION public.atry_admin_diagnostics() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE versions jsonb:='[]';
BEGIN
 PERFORM private.require_admin();IF to_regclass('private.migration_ledger') IS NOT NULL THEN SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'applied_at',applied_at)),'[]'::jsonb) INTO versions FROM private.migration_ledger;END IF;
 RETURN jsonb_build_object('integrity','Restricciones PostgreSQL activas; diagnóstico físico no disponible por API','schema_versions',versions,'mail_provider','disabled','mail_states',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT state,count(*) count FROM public.mail_jobs GROUP BY state) x),'[]'::jsonb),'errors',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT code,count(*) count,max(created_at) latest FROM public.system_errors GROUP BY code ORDER BY max(created_at) DESC LIMIT 20) x),'[]'::jsonb),'audit',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT action,entity_id,created_at FROM public.platform_audit ORDER BY created_at DESC LIMIT 50) x),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION private.require_admin() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.atry_admin_businesses(),public.atry_admin_save_business(text,jsonb),public.atry_admin_plans(),public.atry_admin_save_plan(text,jsonb),public.atry_incidents(text),public.atry_create_incident(text,text),public.atry_admin_incidents(),public.atry_admin_save_incident(text,text),public.atry_admin_operations(),public.atry_admin_diagnostics() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_admin_businesses(),public.atry_admin_save_business(text,jsonb),public.atry_admin_plans(),public.atry_admin_save_plan(text,jsonb),public.atry_incidents(text),public.atry_create_incident(text,text),public.atry_admin_incidents(),public.atry_admin_save_incident(text,text),public.atry_admin_operations(),public.atry_admin_diagnostics() TO authenticated;
