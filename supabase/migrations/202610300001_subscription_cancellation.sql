-- Ordinary cancellation records non-renewal without touching business/plan/data rows.
-- Existing admin/step-up authorization, row locking and idempotency remain unchanged.
DO $migration$
DECLARE source text; original text; source_hash text;
BEGIN
 SELECT pg_get_functiondef(p.oid),p.prosrc,md5(p.prosrc) INTO source,original,source_hash FROM pg_proc p WHERE p.oid='private.control_save_business_base(text,jsonb)'::regprocedure;
 IF source_hash NOT IN ('d4d59e44f5e7449e484727fd237a323b','d82bb568298876d9ed3504e5be723093') THEN RAISE EXCEPTION 'CANCELLATION_PRECONDITION_MISMATCH';END IF;
 IF NOT (SELECT prosecdef AND proconfig=ARRAY['search_path=""'] FROM pg_proc WHERE oid='private.control_save_business_base(text,jsonb)'::regprocedure) THEN RAISE EXCEPTION 'CANCELLATION_SECURITY_MISMATCH';END IF;
 IF position($old$ELSIF act='cancel' THEN b.subscription_status:='cancelled';$old$ IN source)=0 OR position($anchor$ IF payload?'plan' THEN$anchor$ IN source)=0 THEN RAISE EXCEPTION 'CANCELLATION_PATCH_MISMATCH';END IF;
 source:=replace(source,$anchor$ IF payload?'plan' THEN$anchor$,$insert$ IF act='cancel' THEN
  -- ORDINARY_CANCELLATION_AT_PERIOD_END_V1: audit only; never revoke paid access.
  IF (payload - ARRAY['subscription_action','request_id','note','amount_uyu']) <> '{}'::jsonb OR amt<>0 THEN RAISE EXCEPTION 'INVALID_SUBSCRIPTION';END IF;
  INSERT INTO public.subscription_events(business_id,actor_id,action,request_key,request_hash,before_state,after_state,amount_uyu,reference,note)
  VALUES(bid,uid,act,key,digest,before_data,before_data||jsonb_build_object('cancel_at_period_end',true),0,'',memo) RETURNING * INTO previous;
  INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'subscription.cancel',bid,now());
  RETURN jsonb_build_object('ok',true,'event_id',previous.id,'cancel_at_period_end',true,'access_until',CASE WHEN b.subscription_status='trialing' THEN b.trial_until ELSE b.paid_until END);
 END IF;
 IF payload?'plan' THEN$insert$);
 source:=replace(source,$old$ELSIF act='cancel' THEN b.subscription_status:='cancelled';$old$,$new$ELSIF act='cancel' THEN NULL; -- handled before subscription mutation$new$);
 EXECUTE source;
END $migration$;
