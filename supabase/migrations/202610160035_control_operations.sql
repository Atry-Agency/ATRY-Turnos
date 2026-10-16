-- Explicit operator retention policy. Nothing is purged or scheduled automatically.
ALTER TABLE private.control_settings ADD COLUMN mail_terminal_days int CHECK(mail_terminal_days BETWEEN 30 AND 3650);
CREATE TABLE private.mail_archives(job_id text PRIMARY KEY REFERENCES public.mail_jobs(id),archived_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.mail_archives ENABLE ROW LEVEL SECURITY;REVOKE ALL ON private.mail_archives FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.atry_control_read(text,jsonb) RENAME TO control_read_base;
ALTER FUNCTION public.control_read_base(text,jsonb) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.control_read_base(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atry_control_read(section text,params jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
ALTER FUNCTION public.atry_control_command(text,text,jsonb) RENAME TO control_command_base;
ALTER FUNCTION public.control_command_base(text,text,jsonb) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.control_command_base(text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atry_control_command(action text,entity_id text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.atry_control_read(text,jsonb),public.atry_control_command(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_control_read(text,jsonb),public.atry_control_command(text,text,jsonb) TO authenticated;
-- Rebind explicit argument references after moving the implementation (if any).
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('private.control_read_base(text,jsonb)'::regprocedure) INTO src;src:=replace(src,'atry_control_read.','control_read_base.');src:=replace(src,'OR i.state=params->>''state''','OR i.state=params->>''state'' OR (params->>''state''=''unresolved'' AND i.state<>''resolved'')');src:=replace(src,'OR state=params->>''state''','OR state=params->>''state'' OR (params->>''state''=''unresolved'' AND state<>''resolved'')');EXECUTE src;
 SELECT pg_get_functiondef('private.control_command_base(text,text,jsonb)'::regprocedure) INTO src;src:=replace(src,'atry_control_command.','control_command_base.');
 src:=replace(src,' SELECT count(*) INTO counter',E' PERFORM pg_advisory_xact_lock(hashtextextended(''control:actor:''||uid,0));\n SELECT count(*) INTO counter');EXECUTE src;
 SELECT pg_get_functiondef('public.atry_public_info(text)'::regprocedure) INTO src;
 src:=replace(src,'''bookable'',b.allow_guest=1 AND private.subscription_live(b.id)',E'''bookable'',b.allow_guest=1 AND private.subscription_live(b.id) AND NOT EXISTS(SELECT 1 FROM private.business_controls c WHERE c.business_id=b.id AND c.reservation_scope IN (''public'',''all''))');EXECUTE src;
 SELECT pg_get_functiondef('public.atry_save_notification_preferences(text,jsonb)'::regprocedure) INTO src;
 src:=replace(src,'j.state IN (''queued'',''retry'',''skipped'')',E'j.state IN (''queued'',''retry'',''skipped'') AND coalesce(j.last_error,'''')<>''ADMIN_CANCELLED''');EXECUTE src;
END $$;
-- Essential support is available to every confirmed business member, irrespective of plan.
CREATE FUNCTION public.atry_report_support(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid text:=private.user_id();iid text:=gen_random_uuid()::text;subject text:=btrim(coalesce(payload->>'subject',''));description text:=btrim(coalesce(payload->>'description',''));category text:=coalesce(payload->>'category','service');
BEGIN
 IF uid IS NULL OR private.member_role(bid) IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF length(subject) NOT BETWEEN 5 AND 180 OR length(description)>2000 OR category NOT IN ('service','access','booking','mail','subscription') THEN RAISE EXCEPTION 'INVALID_INCIDENT';END IF;
 IF (SELECT count(*) FROM public.incidents WHERE created_by=uid AND created_at>now()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'ADMIN_RATE_LIMIT';END IF;
 INSERT INTO public.incidents(id,business_id,subject,state,created_by,created_at,updated_at,description,category) VALUES(iid,bid,subject,'open',uid,now(),now(),description,category);RETURN jsonb_build_object('id',iid);
END $$;
REVOKE ALL ON FUNCTION public.atry_report_support(text,jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.atry_report_support(text,jsonb) TO authenticated;
CREATE FUNCTION private.control_plan_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid text:=private.user_id();
BEGIN IF uid IS NOT NULL AND EXISTS(SELECT 1 FROM public.users WHERE id=uid AND platform_admin=1) THEN
 INSERT INTO private.control_events(actor_id,action,entity_id,reason,before_state,after_state,request_key,request_hash) VALUES(uid,'plan.updated',NEW.code,left(coalesce(nullif(current_setting('atry.control_reason',true),''),'Configuración global de plan'),500),to_jsonb(OLD),to_jsonb(NEW),gen_random_uuid()::text,'trigger');END IF;RETURN NEW;END $$;
CREATE TRIGGER control_plan_changed AFTER UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION private.control_plan_audit();
REVOKE ALL ON FUNCTION private.control_plan_audit() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE src text;BEGIN SELECT pg_get_functiondef('public.atry_admin_save_plan(text,jsonb)'::regprocedure) INTO src;src:=replace(src,' RETURN private.control_save_plan_base',E' PERFORM set_config(''atry.control_reason'',left(coalesce(payload->>''reason'',''Configuración global de plan''),500),true);\n RETURN private.control_save_plan_base');EXECUTE src;END $$;
