-- Run transactionally only if this release must be reverted. No data deletion.
DO $rollback$
DECLARE source text; restored text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO source FROM pg_proc WHERE oid='private.control_save_business_base(text,jsonb)'::regprocedure;
 IF position('ORDINARY_CANCELLATION_AT_PERIOD_END_V1' IN source)=0 THEN RAISE EXCEPTION 'CANCELLATION_ROLLBACK_MISMATCH';END IF;
 source:=replace(source,$block$ IF act='cancel' THEN
  -- ORDINARY_CANCELLATION_AT_PERIOD_END_V1: audit only; never revoke paid access.
  IF (payload - ARRAY['subscription_action','request_id','note','amount_uyu']) <> '{}'::jsonb OR amt<>0 THEN RAISE EXCEPTION 'INVALID_SUBSCRIPTION';END IF;
  INSERT INTO public.subscription_events(business_id,actor_id,action,request_key,request_hash,before_state,after_state,amount_uyu,reference,note)
  VALUES(bid,uid,act,key,digest,before_data,before_data||jsonb_build_object('cancel_at_period_end',true),0,'',memo) RETURNING * INTO previous;
  INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'subscription.cancel',bid,now());
  RETURN jsonb_build_object('ok',true,'event_id',previous.id,'cancel_at_period_end',true,'access_until',CASE WHEN b.subscription_status='trialing' THEN b.trial_until ELSE b.paid_until END);
 END IF;
$block$,'');
 source:=replace(source,$new$ELSIF act='cancel' THEN NULL; -- handled before subscription mutation$new$,$old$ELSIF act='cancel' THEN b.subscription_status:='cancelled';$old$);
 -- CREATE OR REPLACE keeps owner, ACL, security definer and search_path.
 EXECUTE source;
 SELECT md5(prosrc) INTO restored FROM pg_proc WHERE oid='private.control_save_business_base(text,jsonb)'::regprocedure;
 IF restored NOT IN ('d4d59e44f5e7449e484727fd237a323b','d82bb568298876d9ed3504e5be723093') THEN RAISE EXCEPTION 'CANCELLATION_ROLLBACK_SOURCE_CHANGED';END IF;
END $rollback$;
