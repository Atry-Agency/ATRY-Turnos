-- Create an incident received outside the customer portal, with a recent admin session.
CREATE FUNCTION public.atry_admin_report_incident(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid text;bid text:=payload->>'business_id';iid text:=gen_random_uuid()::text;
 subject_value text:=btrim(coalesce(payload->>'subject',''));description_value text:=btrim(coalesce(payload->>'description',''));
 category_value text:=coalesce(payload->>'category','service');priority_value text:=coalesce(payload->>'priority','normal');
 state_value text:=coalesce(payload->>'state','open');assignee_value text:=nullif(payload->>'assignee','');
 reason_value text:=btrim(coalesce(payload->>'reason',''));request_key_value text:=payload->>'request_id';request_hash_value text;previous private.control_events;
BEGIN
 PERFORM private.control_stepup();uid:=private.user_id();
 IF jsonb_typeof(payload) IS DISTINCT FROM 'object' OR bid IS NULL OR length(subject_value) NOT BETWEEN 5 AND 180 OR length(description_value) NOT BETWEEN 5 AND 2000
 OR category_value NOT IN ('service','access','booking','mail','subscription') OR priority_value NOT IN ('low','normal','high','critical') OR state_value NOT IN ('open','investigating')
 OR length(reason_value) NOT BETWEEN 5 AND 500 OR request_key_value IS NULL OR request_key_value!~'^[A-Za-z0-9_-]{16,100}$'
 THEN RAISE EXCEPTION 'INVALID_INCIDENT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=bid) THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF assignee_value IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=assignee_value AND u.platform_admin=1 AND NOT EXISTS(SELECT 1 FROM private.user_controls c WHERE c.user_id=u.id AND c.blocked)) THEN RAISE EXCEPTION 'INVALID_ASSIGNEE';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('incident:'||request_key_value,0));
 request_hash_value:=private.hash((payload-'request_id')::text);
 SELECT * INTO previous FROM private.control_events WHERE request_key=request_key_value;
 IF FOUND THEN
  IF previous.actor_id<>uid OR previous.action<>'incident_create' OR previous.request_hash<>request_hash_value THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';END IF;
  RETURN jsonb_build_object('id',previous.entity_id,'replayed',true);
 END IF;
 IF (SELECT count(*) FROM private.control_events WHERE actor_id=uid AND created_at>now()-interval '1 minute')>=30 THEN RAISE EXCEPTION 'ADMIN_RATE_LIMIT';END IF;
 INSERT INTO public.incidents(id,business_id,subject,state,created_by,created_at,updated_at,description,category,priority,assignee)
 VALUES(iid,bid,subject_value,state_value,uid,now(),now(),description_value,category_value,priority_value,coalesce(assignee_value,uid));
 INSERT INTO private.control_events(actor_id,action,entity_id,business_id,reason,before_state,after_state,request_key,request_hash)
 VALUES(uid,'incident_create',iid,bid,reason_value,NULL,jsonb_build_object('state',state_value,'priority',priority_value,'category',category_value,'assignee',coalesce(assignee_value,uid)),request_key_value,request_hash_value);
 RETURN jsonb_build_object('id',iid,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.atry_admin_report_incident(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_admin_report_incident(jsonb) TO authenticated;
