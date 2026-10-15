-- Manual commercial access. Existing identities and operational history remain intact.
ALTER TABLE public.businesses ADD COLUMN paid_until timestamptz;
ALTER TABLE public.businesses ALTER COLUMN subscription_status SET DEFAULT 'pending';
CREATE TABLE public.subscription_events(
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,business_id text NOT NULL REFERENCES public.businesses(id),actor_id text NOT NULL REFERENCES public.users(id),
 action text NOT NULL,request_key text NOT NULL,request_hash text NOT NULL,before_state jsonb NOT NULL,after_state jsonb NOT NULL,
 amount_uyu integer NOT NULL DEFAULT 0 CHECK(amount_uyu>=0),reference text NOT NULL DEFAULT '',note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,request_key)
);
CREATE UNIQUE INDEX subscription_transfer_reference ON public.subscription_events(business_id,lower(btrim(reference))) WHERE action IN ('activate','renew') AND reference<>'';
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_events FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.subscription_live(bid text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT is_active=1 AND ((subscription_status='trialing' AND trial_until>now()) OR (subscription_status='active' AND paid_until>now())) FROM public.businesses WHERE id=bid),false)
$$;
REVOKE ALL ON FUNCTION private.subscription_live(text) FROM PUBLIC,anon,authenticated,service_role;

-- Enforce at the database boundary, including RPCs, public booking and materializers.
CREATE FUNCTION private.guard_subscription_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb;bid text;
BEGIN
 data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 bid:=data->>'business_id';
 IF bid IS NULL AND data?'staff_id' THEN SELECT business_id INTO bid FROM public.staff WHERE id=data->>'staff_id';END IF;
 IF bid IS NULL AND data?'service_id' THEN SELECT business_id INTO bid FROM public.services WHERE id=data->>'service_id';END IF;
 IF NOT private.subscription_live(bid) THEN
  IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('bookings','waitlist') AND data->>'status'='cancelled' AND (to_jsonb(NEW)-'status'-'updated_at')=(to_jsonb(OLD)-'status'-'updated_at') THEN RETURN NEW;END IF;
  IF TG_OP='UPDATE' AND TG_TABLE_NAME='waitlist' AND data->>'status'='cancelled' AND data->>'offer_token_hash' IS NULL AND data->>'offer_expires_at' IS NULL AND (to_jsonb(NEW)-'status'-'updated_at'-'offer_token_hash'-'offer_expires_at')=(to_jsonb(OLD)-'status'-'updated_at'-'offer_token_hash'-'offer_expires_at') THEN RETURN NEW;END IF;
  IF TG_OP='UPDATE' AND TG_TABLE_NAME='invitations' AND data->>'revoked_at' IS NOT NULL AND (to_jsonb(NEW)-'revoked_at')=(to_jsonb(OLD)-'revoked_at') THEN RETURN NEW;END IF;
  IF TG_OP='UPDATE' AND TG_TABLE_NAME='recurring_appointments' AND data->>'end_day' IS NOT NULL AND (to_jsonb(OLD)->>'end_day' IS NULL OR (data->>'end_day')::date<=(to_jsonb(OLD)->>'end_day')::date) AND (data->>'active')::int<=(to_jsonb(OLD)->>'active')::int AND (to_jsonb(NEW)-'end_day'-'active'-'updated_at')=(to_jsonb(OLD)-'end_day'-'active'-'updated_at') THEN RETURN NEW;END IF;
  RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $$;
REVOKE ALL ON FUNCTION private.guard_subscription_write() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['staff','services','customers','working_hours','staff_services','time_off','recurring_breaks','schedule_exceptions','holidays','resources','service_resources','bookings','waitlist','notification_preferences','recurring_appointments','invitations'] LOOP
  EXECUTE format('CREATE TRIGGER subscription_write BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.guard_subscription_write()',t);
 END LOOP;
END $$;

-- Preserve OIDs and ACLs while adding guards to existing private entry points.
DO $$ DECLARE source text;BEGIN
 SELECT pg_get_functiondef('private.check_slot(text,text,text,timestamptz,text,boolean)'::regprocedure) INTO source;
 source:=replace(source,E'BEGIN\n',E'BEGIN\n IF NOT private.subscription_live(bid) THEN RAISE EXCEPTION ''SUBSCRIPTION_REQUIRED'';END IF;\n');
 source:=replace(source,E'BEGIN\r\n',E'BEGIN\r\n IF NOT private.subscription_live(bid) THEN RAISE EXCEPTION ''SUBSCRIPTION_REQUIRED'';END IF;\r\n');IF position('private.subscription_live(bid)' in source)=0 THEN RAISE EXCEPTION 'GUARD_PATCH_MISMATCH';END IF;EXECUTE source;
 SELECT pg_get_functiondef('public.atry_save_business(text,jsonb)'::regprocedure) INTO source;source:=replace(source,'PERFORM private.require_manager(bid);','PERFORM private.require_manager(bid);IF NOT private.subscription_live(bid) THEN RAISE EXCEPTION ''SUBSCRIPTION_REQUIRED'';END IF;');EXECUTE source;
 SELECT pg_get_functiondef('private.expand_recurring(text,date,int,boolean,text)'::regprocedure) INTO source;
 source:=replace(source,E'BEGIN\n',E'BEGIN\n IF NOT private.subscription_live(bid) THEN RETURN false;END IF;\n');
 source:=replace(source,E'BEGIN\r\n',E'BEGIN\r\n IF NOT private.subscription_live(bid) THEN RETURN false;END IF;\r\n');EXECUTE source;
END $$;

-- New businesses bootstrap their initial owner/staff atomically, then close before commit.
DO $$ DECLARE source text;BEGIN
 SELECT pg_get_functiondef('public.atry_create_organization(jsonb)'::regprocedure) INTO source;
 source:=replace(source,'id,slug,name,email,sector,trial_until,created_at','id,slug,name,email,sector,subscription_status,trial_until,created_at');
 source:=replace(source,'''General''),now()+interval ''14 days''','''General''),''trialing'',now()+interval ''14 days''');
 source:=replace(source,'RETURN jsonb_build_object(''id'',bid',E'UPDATE public.businesses SET subscription_status=''pending'',trial_until=now() WHERE id=bid;\n RETURN jsonb_build_object(''id'',bid');IF position('subscription_status=''pending''' in source)=0 THEN RAISE EXCEPTION 'REGISTRATION_PATCH_MISMATCH';END IF;EXECUTE source;
END $$;

DO $$ DECLARE source text;BEGIN
 SELECT pg_get_functiondef('public.atry_public_info(text)'::regprocedure) INTO source;
 source:=replace(source,'''bookable'',b.allow_guest=1 AND (b.subscription_status=''active'' OR (b.subscription_status=''trialing'' AND b.trial_until>now()))','''bookable'',b.allow_guest=1 AND private.subscription_live(b.id)');EXECUTE source;
END $$;

CREATE OR REPLACE FUNCTION public.atry_admin_save_business(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text:=private.require_admin();b public.businesses;before_data jsonb;act text:=coalesce(payload->>'subscription_action','adjust');key text:=coalesce(payload->>'request_id',gen_random_uuid()::text);digest text:=private.hash((payload-'request_id')::text);previous public.subscription_events;until_time timestamptz;amt integer:=coalesce((payload->>'amount_uyu')::int,0);ref text:=btrim(coalesce(payload->>'reference',''));memo text:=btrim(coalesce(payload->>'note',''));
BEGIN
 SELECT * INTO b FROM public.businesses WHERE id=bid FOR UPDATE;IF b.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF act NOT IN ('adjust','activate','renew','trial','suspend','restore') OR key!~'^[A-Za-z0-9_-]{16,100}$' OR amt<0 OR amt>10000000 OR length(ref)>160 OR length(memo)>500 THEN RAISE EXCEPTION 'INVALID_SUBSCRIPTION';END IF;
 SELECT * INTO previous FROM public.subscription_events e WHERE e.business_id=bid AND e.request_key=key;
 IF FOUND THEN IF previous.request_hash<>digest THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';END IF;RETURN jsonb_build_object('ok',true,'event_id',previous.id);END IF;
 before_data:=jsonb_build_object('plan',b.plan,'status',b.subscription_status,'paid_until',b.paid_until,'trial_until',b.trial_until,'is_active',b.is_active);
 IF payload?'plan' THEN IF coalesce(payload->>'plan','') NOT IN ('trial','individual','negocio','pro') THEN RAISE EXCEPTION 'INVALID_PLAN';END IF;b.plan:=payload->>'plan';END IF;
 IF act IN ('activate','renew','trial') THEN
  IF coalesce(payload->>'until_day','')!~'^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
  until_time:=((payload->>'until_day')::date+1)::timestamp AT TIME ZONE 'America/Montevideo';
  IF until_time<=now() OR until_time>now()+interval '5 years' THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
  IF act IN ('activate','renew') THEN
   IF b.plan='trial' OR (ref='' AND memo='') OR (amt>0 AND ref='') THEN RAISE EXCEPTION 'PAYMENT_REFERENCE_REQUIRED';END IF;
   IF act='renew' AND until_time<=greatest(coalesce(b.paid_until,now()),now()) THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
   IF act='activate' AND b.paid_until>until_time THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
   IF ref<>'' AND EXISTS(SELECT 1 FROM public.subscription_events e WHERE e.business_id=bid AND e.action IN ('activate','renew') AND lower(btrim(e.reference))=lower(ref)) THEN RAISE EXCEPTION 'DUPLICATE_TRANSFER';END IF;
   b.subscription_status:='active';b.paid_until:=until_time;
  ELSE b.subscription_status:='trialing';b.plan:='trial';b.trial_until:=until_time;b.paid_until:=NULL;
  END IF;b.is_active:=1;
 ELSIF act='suspend' THEN b.subscription_status:='suspended';
 ELSIF act='restore' THEN
  IF b.paid_until>now() THEN b.subscription_status:='active';ELSIF b.trial_until>now() THEN b.subscription_status:='trialing';ELSE RAISE EXCEPTION 'INVALID_PERIOD';END IF;b.is_active:=1;
 ELSE
  IF payload?'subscription_status' THEN IF coalesce(payload->>'subscription_status','') NOT IN ('pending','trialing','active','past_due','suspended') THEN RAISE EXCEPTION 'INVALID_SUBSCRIPTION';END IF;b.subscription_status:=payload->>'subscription_status';END IF;
  IF payload?'is_active' THEN IF coalesce(payload->>'is_active','') NOT IN ('0','1') THEN RAISE EXCEPTION 'INVALID_STATUS';END IF;b.is_active:=(payload->>'is_active')::int;END IF;
  IF b.subscription_status='active' AND coalesce(b.paid_until,now())<=now() THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
 END IF;
 UPDATE public.businesses SET plan=b.plan,subscription_status=b.subscription_status,paid_until=b.paid_until,trial_until=b.trial_until,is_active=b.is_active WHERE id=bid;
 INSERT INTO public.subscription_events(business_id,actor_id,action,request_key,request_hash,before_state,after_state,amount_uyu,reference,note) VALUES(bid,uid,act,key,digest,before_data,jsonb_build_object('plan',b.plan,'status',b.subscription_status,'paid_until',b.paid_until,'trial_until',b.trial_until,'is_active',b.is_active),amt,ref,memo) RETURNING * INTO previous;
 INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'subscription.'||act,bid,now());
 RETURN jsonb_build_object('ok',true,'event_id',previous.id);
END $$;
CREATE OR REPLACE FUNCTION public.atry_admin_businesses() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM private.require_admin();RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT b.id,b.name,b.slug,b.email,b.plan,b.subscription_status,b.paid_until,b.trial_until,b.created_at,b.is_active,private.subscription_live(b.id) access_enabled,
 (SELECT count(*) FROM public.bookings WHERE business_id=b.id) bookings,(SELECT count(*) FROM public.memberships WHERE business_id=b.id) members,
 coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT se.id,se.action,se.actor_id,(SELECT u.name FROM public.users u WHERE u.id=se.actor_id) actor_name,se.after_state,se.amount_uyu,se.reference,se.note,se.created_at FROM public.subscription_events se WHERE se.business_id=b.id ORDER BY se.created_at DESC LIMIT 20) e),'[]'::jsonb) license_history
 FROM public.businesses b ORDER BY created_at DESC) x),'[]'::jsonb);
END $$;
