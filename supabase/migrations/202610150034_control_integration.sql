-- Complete integration with existing commercial history and configuration.
CREATE VIEW private.control_audit AS
 SELECT * FROM private.control_events
 UNION ALL SELECT e.id,e.actor_id,'subscription.'||e.action,e.business_id,e.business_id,e.note,e.before_state,e.after_state,'confirmed',e.request_key,e.request_hash,e.created_at FROM public.subscription_events e
 UNION ALL SELECT a.id,a.user_id,a.action,a.entity_id,CASE WHEN EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=a.entity_id) THEN a.entity_id END,'',NULL::jsonb,NULL::jsonb,'confirmed',a.id,'',a.created_at FROM public.platform_audit a WHERE a.action NOT LIKE 'subscription.%';
REVOKE ALL ON private.control_audit FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.atry_control_read(text,jsonb)'::regprocedure) INTO src;
 src:=replace(src,'FROM private.control_events e','FROM private.control_audit e');
 src:=replace(src,' ELSIF section=''overview'' THEN',E' ELSIF section=''settings'' THEN\n RETURN jsonb_build_object(''checked_at'',ts,''plans'',(SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object(''expected_revision'',(SELECT revision FROM private.commercial_settings WHERE id=1))) FROM public.plans p),''settings'',(SELECT to_jsonb(s) FROM private.commercial_settings s),''capacity'',jsonb_build_object(''monthly_available'',(SELECT (provider_daily_limit-security_reserve)*28 FROM private.commercial_settings WHERE id=1),''monthly_committed'',(SELECT coalesce(sum(p.mail_limit),0) FROM public.businesses b JOIN public.plans p ON p.code=b.plan WHERE private.subscription_live(b.id))));\n ELSIF section=''overview'' THEN');
 EXECUTE src;
 SELECT pg_get_functiondef('public.atry_mail_claim(integer)'::regprocedure) INTO src;
 src:=replace(src,'AND next_attempt_at<=now() ORDER BY',E'AND next_attempt_at<=now() AND (kind IN (''invitation'',''password_reset'',''auth'',''security'') OR (NOT (SELECT operational_mail_paused FROM private.control_settings WHERE id=1) AND NOT coalesce((SELECT c.mail_paused FROM private.business_controls c WHERE c.business_id=mail_jobs.business_id),false))) ORDER BY');EXECUTE src;
END $$;
-- Compare-and-swap for Control Center forms; legacy clients retain existing signatures.
ALTER FUNCTION public.atry_admin_save_plan(text,jsonb) RENAME TO control_save_plan_base;
ALTER FUNCTION public.control_save_plan_base(text,jsonb) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.control_save_plan_base(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atry_admin_save_plan(code text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v bigint;
BEGIN PERFORM private.require_admin();SELECT revision INTO v FROM private.commercial_settings WHERE id=1 FOR UPDATE;
 IF payload?'expected_revision' AND (payload->>'expected_revision')::bigint IS DISTINCT FROM v THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
 IF payload?'price_uyu' AND (payload->>'price_uyu')::int NOT BETWEEN 0 AND 1000000 OR payload?'mail_limit' AND (payload->>'mail_limit')::int NOT BETWEEN 0 AND 1000000 THEN RAISE EXCEPTION 'INVALID_LIMIT';END IF;
 RETURN private.control_save_plan_base(code,payload);
END $$;
ALTER FUNCTION public.atry_admin_save_commercial(jsonb) RENAME TO control_save_commercial_base;
ALTER FUNCTION public.control_save_commercial_base(jsonb) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.control_save_commercial_base(jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atry_admin_save_commercial(payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v bigint;
BEGIN PERFORM private.require_admin();SELECT revision INTO v FROM private.commercial_settings WHERE id=1 FOR UPDATE;
 IF payload?'expected_revision' AND (payload->>'expected_revision')::bigint IS DISTINCT FROM v THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
 RETURN private.control_save_commercial_base(payload);
END $$;
REVOKE ALL ON FUNCTION public.atry_admin_save_plan(text,jsonb),public.atry_admin_save_commercial(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_admin_save_plan(text,jsonb),public.atry_admin_save_commercial(jsonb) TO authenticated;
-- Preserve the legacy incidence API while maintaining a history of subsequent changes.
CREATE FUNCTION private.control_incident_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid text:=private.user_id();
BEGIN IF TG_OP='UPDATE' AND NEW.state='resolved' AND OLD.state<>'resolved' AND length(btrim(NEW.resolution))<5 THEN RAISE EXCEPTION 'RESOLUTION_REQUIRED';END IF;
 IF uid IS NOT NULL THEN INSERT INTO private.control_events(actor_id,action,entity_id,business_id,reason,before_state,after_state,request_key,request_hash) VALUES(uid,'incident.'||lower(TG_OP),NEW.id,NEW.business_id,CASE WHEN TG_OP='INSERT' THEN 'Incidencia registrada' ELSE 'Actualización de incidencia' END,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END,to_jsonb(NEW),gen_random_uuid()::text,'trigger');END IF;RETURN NEW;END $$;
-- INSERT only: existing legacy update clients can still close; new console requires resolution.
CREATE TRIGGER control_incident_created AFTER INSERT ON public.incidents FOR EACH ROW EXECUTE FUNCTION private.control_incident_audit();
REVOKE ALL ON FUNCTION private.control_incident_audit() FROM PUBLIC,anon,authenticated,service_role;
-- Rebind the function's explicit argument qualifier after moving its implementation.
DO $$ DECLARE src text;BEGIN SELECT pg_get_functiondef('private.control_save_plan_base(text,jsonb)'::regprocedure) INTO src;src:=replace(src,'atry_admin_save_plan.code','control_save_plan_base.code');EXECUTE src;END $$;
DO $$ DECLARE src text;BEGIN SELECT pg_get_functiondef('public.atry_create_incident(text,text)'::regprocedure) INTO src;src:=replace(src,'INSERT INTO public.incidents VALUES','INSERT INTO public.incidents(id,business_id,subject,state,created_by,created_at,updated_at) VALUES');EXECUTE src;END $$;
-- Existing subscription transactions are reused, with recent authentication at the public boundary.
ALTER FUNCTION public.atry_admin_save_business(text,jsonb) RENAME TO control_save_business_base;
ALTER FUNCTION public.control_save_business_base(text,jsonb) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.control_save_business_base(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atry_admin_save_business(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM private.control_stepup();RETURN private.control_save_business_base(bid,payload);END $$;
REVOKE ALL ON FUNCTION public.atry_admin_save_business(text,jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.atry_admin_save_business(text,jsonb) TO authenticated;
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.atry_admin_save_plan(text,jsonb)'::regprocedure) INTO src;src:=replace(src,'PERFORM private.require_admin();','PERFORM private.control_stepup();');EXECUTE src;
 SELECT pg_get_functiondef('public.atry_admin_save_commercial(jsonb)'::regprocedure) INTO src;src:=replace(src,'PERFORM private.require_admin();','PERFORM private.control_stepup();');EXECUTE src;
END $$;
