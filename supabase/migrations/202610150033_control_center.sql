-- Misión 005: additive operator console. No customer content or credentials returned.
CREATE TABLE private.control_settings(id int PRIMARY KEY CHECK(id=1),operational_mail_paused boolean NOT NULL DEFAULT false,revision bigint NOT NULL DEFAULT 1);
INSERT INTO private.control_settings(id) VALUES(1);
CREATE TABLE private.business_controls(business_id text PRIMARY KEY REFERENCES public.businesses(id),reservation_scope text NOT NULL DEFAULT 'none' CHECK(reservation_scope IN ('none','public','all')),mail_paused boolean NOT NULL DEFAULT false,revision bigint NOT NULL DEFAULT 1);
CREATE TABLE private.user_controls(user_id text PRIMARY KEY REFERENCES public.users(id),blocked boolean NOT NULL DEFAULT false);
CREATE TABLE private.control_events(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,actor_id text NOT NULL,action text NOT NULL,entity_id text NOT NULL,business_id text,reason text NOT NULL,before_state jsonb,after_state jsonb,result text NOT NULL DEFAULT 'confirmed',request_key text NOT NULL UNIQUE,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE private.worker_health(id int PRIMARY KEY CHECK(id=1),started_at timestamptz,finished_at timestamptz,result text);
INSERT INTO private.worker_health(id) VALUES(1);
CREATE TABLE private.control_requests(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,entity_type text NOT NULL CHECK(entity_type IN ('business','user')),entity_id text NOT NULL,kind text NOT NULL CHECK(kind IN ('delete','anonymize')),reason text NOT NULL,actor_id text NOT NULL,state text NOT NULL DEFAULT 'policy_review',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE private.commercial_followups(request_id text PRIMARY KEY REFERENCES public.plan_requests(id),note text NOT NULL DEFAULT '',next_contact date,assignee text REFERENCES public.users(id),revision bigint NOT NULL DEFAULT 1);
CREATE TABLE private.payment_reviews(event_id text PRIMARY KEY REFERENCES public.subscription_events(id),verified_by text NOT NULL,reason text NOT NULL,verified_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.incidents ADD COLUMN description text NOT NULL DEFAULT '',ADD COLUMN category text NOT NULL DEFAULT 'service',ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','critical')),ADD COLUMN assignee text REFERENCES public.users(id),ADD COLUMN resolution text NOT NULL DEFAULT '',ADD COLUMN closed_at timestamptz,ADD COLUMN revision bigint NOT NULL DEFAULT 1;
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['control_settings','business_controls','user_controls','control_events','worker_health','control_requests','commercial_followups','payment_reviews'] LOOP EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON private.%I FROM PUBLIC,anon,authenticated,service_role',t);END LOOP;END $$;
CREATE INDEX control_events_business_date ON private.control_events(business_id,created_at DESC);
CREATE INDEX control_events_actor_date ON private.control_events(actor_id,created_at DESC);
CREATE INDEX incidents_priority_date ON public.incidents(state,priority,created_at);
CREATE INDEX businesses_admin_lookup ON public.businesses(created_at DESC,id);

CREATE FUNCTION private.control_status(b public.businesses) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT CASE WHEN b.subscription_status='cancelled' THEN 'cancelled' WHEN b.is_active=0 OR b.subscription_status='suspended' THEN 'suspended' WHEN b.subscription_status='pending' THEN 'pending' WHEN b.subscription_started_at>now() THEN 'scheduled' WHEN private.subscription_live(b.id) THEN 'active' ELSE 'expired' END
$$;
CREATE VIEW private.control_businesses AS SELECT b.id,b.name,b.slug,b.email,b.phone,b.plan,b.created_at,b.subscription_status,b.is_active,b.paid_until,b.trial_until,b.subscription_started_at,private.control_status(b) status,coalesce(b.paid_until,b.trial_until) deadline,p.staff_limit,p.mail_limit,
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'email',u.email)) FROM public.memberships m JOIN public.users u ON u.id=m.user_id WHERE m.business_id=b.id AND m.role='owner'),'[]'::jsonb) owners,
 coalesce(c.reservation_scope,'none') reservation_scope,coalesce(c.mail_paused,false) mail_paused,coalesce(c.revision,0) control_revision
 FROM public.businesses b JOIN public.plans p ON p.code=b.plan LEFT JOIN private.business_controls c ON c.business_id=b.id;
REVOKE ALL ON private.control_businesses FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.control_stepup() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM private.require_admin();
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(auth.jwt()->'amr','[]')) a WHERE a->>'method' IN ('password','totp','otp','webauthn') AND (a->>'timestamp')::numeric>extract(epoch FROM now())-600) THEN RAISE EXCEPTION 'RECENT_AUTH_REQUIRED' USING ERRCODE='42501';END IF;
END $$;
-- A blocked identity cannot use any private RPC or tenant RLS path, even with a live JWT.
CREATE OR REPLACE FUNCTION private.user_id() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT u.id FROM public.users u WHERE u.auth_user_id=auth.uid()
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=u.auth_user_id AND s.id::text=auth.jwt()->>'session_id' AND s.created_at>now()-interval '7 days' AND (s.not_after IS NULL OR s.not_after>now()))
 AND NOT EXISTS(SELECT 1 FROM private.user_controls c WHERE c.user_id=u.id AND c.blocked)
$$;
GRANT EXECUTE ON FUNCTION private.user_id() TO authenticated;
-- Existing functions call private.user_id by name; original SQL policies are replaced to rebind OID.
ALTER POLICY self_read ON public.users USING(id=private.user_id());
CREATE FUNCTION private.control_booking_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE scope text;
BEGIN SELECT reservation_scope INTO scope FROM private.business_controls WHERE business_id=NEW.business_id;
 IF scope='all' OR (scope='public' AND NEW.source='public') THEN RAISE EXCEPTION 'RESERVATIONS_PAUSED' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
CREATE TRIGGER control_booking_pause BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION private.control_booking_guard();
-- Do not omit paused mail: leave it queued. Essential security messages remain eligible.
DO $$ DECLARE src text;BEGIN SELECT pg_get_functiondef('public.atry_mail_claim(integer)'::regprocedure) INTO src;
 src:=replace(src,'  ceiling:=',E'  IF j.kind NOT IN (''invitation'',''password_reset'',''auth'',''security'') AND ((SELECT operational_mail_paused FROM private.control_settings WHERE id=1) OR coalesce((SELECT mail_paused FROM private.business_controls WHERE business_id=j.business_id),false)) THEN CONTINUE;END IF;\n  ceiling:=');
 IF position('operational_mail_paused' IN src)=0 THEN RAISE EXCEPTION 'CONTROL_PATCH_MISMATCH';END IF;EXECUTE src;END $$;
CREATE FUNCTION public.atry_control_worker(phase text,outcome text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF phase='start' THEN UPDATE private.worker_health SET started_at=now() WHERE id=1;ELSIF phase='finish' AND outcome IN ('ok','error') THEN UPDATE private.worker_health SET finished_at=now(),result=outcome WHERE id=1;ELSE RAISE EXCEPTION 'INVALID_WORKER_STATE';END IF;RETURN true;END $$;
REVOKE ALL ON FUNCTION public.atry_control_worker(text,text) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.atry_control_worker(text,text) TO service_role;

CREATE FUNCTION public.atry_control_read(section text,params jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q text:=left(coalesce(params->>'q',''),100);bid text:=params->>'business_id';lim int:=least(greatest(coalesce((params->>'limit')::int,25),1),100);off int:=greatest(coalesce((params->>'offset')::int,0),0);rows jsonb;total bigint;data jsonb;ts timestamptz:=clock_timestamp();
BEGIN
 PERFORM private.require_admin();
 IF section IN ('businesses','search') THEN
  SELECT count(*) INTO total FROM private.control_businesses b WHERE (q='' OR concat_ws(' ',b.id,b.name,b.slug,b.email,b.phone,b.owners::text) ILIKE '%'||q||'%' OR EXISTS(SELECT 1 FROM public.plan_requests r WHERE r.business_id=b.id AND r.code ILIKE '%'||q||'%')) AND (coalesce(params->>'status','')='' OR b.status=params->>'status') AND (coalesce(params->>'plan','')='' OR b.plan=params->>'plan') AND (coalesce(params->>'days','')='' OR (b.status='active' AND b.deadline BETWEEN now() AND now()+make_interval(days=>least((params->>'days')::int,365))));
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT * FROM private.control_businesses b WHERE (q='' OR concat_ws(' ',b.id,b.name,b.slug,b.email,b.phone,b.owners::text) ILIKE '%'||q||'%' OR EXISTS(SELECT 1 FROM public.plan_requests r WHERE r.business_id=b.id AND r.code ILIKE '%'||q||'%')) AND (coalesce(params->>'status','')='' OR b.status=params->>'status') AND (coalesce(params->>'plan','')='' OR b.plan=params->>'plan') AND (coalesce(params->>'days','')='' OR (b.status='active' AND b.deadline BETWEEN now() AND now()+make_interval(days=>least((params->>'days')::int,365)))) ORDER BY CASE WHEN params->>'sort'='name' THEN b.name END,CASE WHEN params->>'sort'='deadline' THEN b.deadline END ASC NULLS LAST,b.created_at DESC,b.id LIMIT lim OFFSET off) x;
 ELSIF section='business' THEN
  SELECT to_jsonb(b)||jsonb_build_object('bookings',(SELECT count(*) FROM public.bookings WHERE business_id=bid),'customers_count',(SELECT count(*) FROM public.customers WHERE business_id=bid),'active_staff',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') FROM public.staff WHERE business_id=bid AND active=1),'mail_usage',(SELECT jsonb_build_object('accepted',coalesce(u.accepted,0),'reserved',coalesce(u.reserved,0),'cycle_start',c.cycle_start,'cycle_end',c.cycle_end) FROM private.commercial_cycle(bid) c LEFT JOIN public.business_mail_usage u ON u.business_id=bid AND u.cycle_start=c.cycle_start),'license_history',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT se.id,se.action,se.before_state,se.after_state,se.amount_uyu,se.reference,se.note,se.created_at,u.name actor_name FROM public.subscription_events se LEFT JOIN public.users u ON u.id=se.actor_id WHERE se.business_id=bid ORDER BY se.created_at DESC LIMIT 25) e),'[]')) INTO data FROM private.control_businesses b WHERE b.id=bid;
  IF data IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;RETURN jsonb_build_object('data',data,'checked_at',ts);
 ELSIF section='overview' THEN
  RETURN jsonb_build_object('checked_at',ts,'source','PostgreSQL / suscripciones / cola / incidencias','businesses',(SELECT jsonb_object_agg(status,n) FROM (SELECT status,count(*) n FROM private.control_businesses GROUP BY status)x),'expiring',(SELECT count(*) FROM private.control_businesses WHERE status='active' AND deadline BETWEEN now() AND now()+interval '7 days'),'requests',(SELECT count(*) FROM public.plan_requests WHERE state IN ('pending_contact','pending_payment','pending_verification')),'incidents',(SELECT count(*) FROM public.incidents WHERE state<>'resolved'),'mail',(SELECT coalesce(jsonb_object_agg(state,n),'{}') FROM (SELECT state,count(*) n FROM public.mail_jobs GROUP BY state)x),'worker',(SELECT to_jsonb(w) FROM private.worker_health w WHERE id=1),'settings',(SELECT to_jsonb(s) FROM private.control_settings s),'attention',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM (SELECT 'business' kind,id entity_id,name title,created_at since,2 priority,'pending' code FROM private.control_businesses WHERE status='pending' UNION ALL SELECT 'incident',id,subject,created_at,CASE WHEN priority='critical' THEN 0 WHEN priority='high' THEN 1 ELSE 3 END,'open' FROM public.incidents WHERE state<>'resolved' UNION ALL SELECT 'mail',id,kind,created_at,1,state FROM public.mail_jobs WHERE state IN ('failed','delivery_unknown','quota_exhausted') ORDER BY priority,since LIMIT 30)a),'[]'));
 ELSIF section='mail' THEN
  SELECT count(*) INTO total FROM public.mail_jobs j WHERE (bid IS NULL OR j.business_id=bid) AND (coalesce(params->>'state','')='' OR j.state=params->>'state');
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT j.id,j.business_id,b.name business_name,j.kind,j.state,j.attempts,j.provider_id,j.last_error,j.next_attempt_at,j.created_at,j.updated_at FROM public.mail_jobs j LEFT JOIN public.businesses b ON b.id=j.business_id WHERE (bid IS NULL OR j.business_id=bid) AND (coalesce(params->>'state','')='' OR j.state=params->>'state') ORDER BY j.created_at DESC,j.id LIMIT lim OFFSET off)x;
 ELSIF section='users' THEN
  SELECT count(*) INTO total FROM public.users u WHERE concat_ws(' ',u.id,u.name,u.email) ILIKE '%'||q||'%';
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT u.id,u.name,u.email,u.created_at,u.platform_admin,(a.email_confirmed_at IS NOT NULL) confirmed,coalesce(c.blocked,false) blocked,(SELECT count(*) FROM auth.sessions WHERE user_id=u.auth_user_id AND (not_after IS NULL OR not_after>now()) AND created_at>now()-interval '7 days') sessions,coalesce((SELECT jsonb_agg(jsonb_build_object('business_id',m.business_id,'business_name',b.name,'role',m.role)) FROM public.memberships m JOIN public.businesses b ON b.id=m.business_id WHERE m.user_id=u.id),'[]') memberships FROM public.users u LEFT JOIN auth.users a ON a.id=u.auth_user_id LEFT JOIN private.user_controls c ON c.user_id=u.id WHERE concat_ws(' ',u.id,u.name,u.email) ILIKE '%'||q||'%' ORDER BY u.created_at DESC,u.id LIMIT lim OFFSET off)x;
 ELSIF section='requests' THEN
  SELECT count(*) INTO total FROM public.plan_requests r WHERE (bid IS NULL OR r.business_id=bid) AND (coalesce(params->>'state','')='' OR r.state=params->>'state') AND concat_ws(' ',r.code,r.phone,r.plan) ILIKE '%'||q||'%';
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT r.id,r.code,r.business_id,b.name business_name,r.plan,r.price_uyu,r.phone,r.state,r.payment_state,r.created_at,f.note,f.next_contact,f.assignee,coalesce(f.revision,0) revision FROM public.plan_requests r JOIN public.businesses b ON b.id=r.business_id LEFT JOIN private.commercial_followups f ON f.request_id=r.id WHERE (bid IS NULL OR r.business_id=bid) AND (coalesce(params->>'state','')='' OR r.state=params->>'state') AND concat_ws(' ',r.code,r.phone,r.plan) ILIKE '%'||q||'%' ORDER BY r.created_at,r.id LIMIT lim OFFSET off)x;
 ELSIF section='incidents' THEN
  SELECT count(*) INTO total FROM public.incidents WHERE (bid IS NULL OR business_id=bid) AND (coalesce(params->>'state','')='' OR state=params->>'state');
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT i.*,b.name business_name,p.features->>'priority_support'='true' priority_support FROM public.incidents i JOIN public.businesses b ON b.id=i.business_id JOIN public.plans p ON p.code=b.plan WHERE (bid IS NULL OR i.business_id=bid) AND (coalesce(params->>'state','')='' OR i.state=params->>'state') ORDER BY CASE i.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,CASE WHEN p.features->>'priority_support'='true' THEN 0 ELSE 1 END,i.created_at,i.id LIMIT lim OFFSET off)x;
 ELSIF section='audit' THEN
  SELECT count(*) INTO total FROM private.control_events e WHERE (bid IS NULL OR e.business_id=bid) AND concat_ws(' ',e.action,e.actor_id,e.entity_id,e.id) ILIKE '%'||q||'%' AND (coalesce(params->>'actor','')='' OR e.actor_id=params->>'actor') AND (coalesce(params->>'from','')='' OR e.created_at>=(params->>'from')::date) AND (coalesce(params->>'until','')='' OR e.created_at<(params->>'until')::date+interval '1 day');
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT e.*,u.name actor_name FROM private.control_events e LEFT JOIN public.users u ON u.id=e.actor_id WHERE (bid IS NULL OR e.business_id=bid) AND concat_ws(' ',e.action,e.actor_id,e.entity_id,e.id) ILIKE '%'||q||'%' AND (coalesce(params->>'actor','')='' OR e.actor_id=params->>'actor') AND (coalesce(params->>'from','')='' OR e.created_at>=(params->>'from')::date) AND (coalesce(params->>'until','')='' OR e.created_at<(params->>'until')::date+interval '1 day') ORDER BY e.created_at DESC,e.id LIMIT lim OFFSET off)x;
 ELSIF section='finance' THEN
  RETURN jsonb_build_object('checked_at',ts,'declared_uyu',(SELECT coalesce(sum(amount_uyu),0) FROM public.subscription_events WHERE action IN ('activate','renew') AND (coalesce(params->>'from','')='' OR created_at>=(params->>'from')::date) AND (coalesce(params->>'until','')='' OR created_at<(params->>'until')::date+interval '1 day')),'operator_verified_uyu',(SELECT coalesce(sum(e.amount_uyu),0) FROM public.subscription_events e JOIN private.payment_reviews p ON p.event_id=e.id WHERE (coalesce(params->>'from','')='' OR e.created_at>=(params->>'from')::date) AND (coalesce(params->>'until','')='' OR e.created_at<(params->>'until')::date+interval '1 day')),'courtesies',(SELECT count(*) FROM public.subscription_events WHERE action IN ('activate','renew') AND amount_uyu=0 AND (coalesce(params->>'from','')='' OR created_at>=(params->>'from')::date) AND (coalesce(params->>'until','')='' OR created_at<(params->>'until')::date+interval '1 day')),'monthly_estimate_uyu',(SELECT coalesce(sum(p.price_uyu),0) FROM public.businesses b JOIN public.plans p ON p.code=b.plan WHERE b.plan<>'trial' AND private.subscription_live(b.id)),'bank_reconciliation',false);
 ELSIF section='storage' THEN
  RETURN jsonb_build_object('checked_at',ts,'postgres_database_bytes',pg_database_size(current_database()),'logical_rows',(SELECT jsonb_build_object('users',(SELECT count(*) FROM public.users),'businesses',(SELECT count(*) FROM public.businesses),'bookings',(SELECT count(*) FROM public.bookings),'mail_jobs',(SELECT count(*) FROM public.mail_jobs),'customers',(SELECT count(*) FROM public.customers))),'storage_bytes',NULL,'destructive_enabled',false,'backup',jsonb_build_object('status','unknown','last_verified',NULL,'restore_enabled',false));
 ELSIF section='system' THEN
  RETURN jsonb_build_object('checked_at',ts,'database','operational','evidence','Consulta administrativa PostgreSQL ejecutada','auth','unknown','public_booking','unknown','edge','unknown','realtime','unknown','brevo','unknown','worker',(SELECT to_jsonb(w) FROM private.worker_health w),'budget',(SELECT to_jsonb(d) FROM public.mail_daily_budget d WHERE day=(now() AT TIME ZONE 'UTC')::date),'errors',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT code,count(*) count,max(created_at) latest FROM public.system_errors GROUP BY code ORDER BY max(created_at) DESC LIMIT 20)x),'[]'));
 ELSIF section='deletion_preview' THEN
  IF params->>'type'='business' THEN SELECT jsonb_build_object('id',b.id,'name',b.name,'owners',b.owners,'members',(SELECT count(*) FROM public.memberships WHERE business_id=b.id),'customers',(SELECT count(*) FROM public.customers WHERE business_id=b.id),'bookings',(SELECT count(*) FROM public.bookings WHERE business_id=b.id),'payments',(SELECT count(*) FROM public.subscription_events WHERE business_id=b.id),'execution_enabled',false,'reason','Requiere política de retención y validación de Auth y Storage') INTO data FROM private.control_businesses b WHERE id=params->>'id';
  ELSE SELECT jsonb_build_object('id',u.id,'name',u.name,'memberships',(SELECT count(*) FROM public.memberships WHERE user_id=u.id),'platform_admin',u.platform_admin,'execution_enabled',false) INTO data FROM public.users u WHERE id=params->>'id';END IF;
  RETURN jsonb_build_object('data',data,'checked_at',ts);
 ELSE RAISE EXCEPTION 'INVALID_SECTION';END IF;
 RETURN jsonb_build_object('rows',rows,'total',total,'limit',lim,'offset',off,'checked_at',ts);
END $$;

CREATE FUNCTION public.atry_control_command(action text,entity_id text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid text:=private.require_admin();key text:=payload->>'request_id';memo text:=btrim(coalesce(payload->>'reason',''));digest text:=private.hash(jsonb_build_object('action',action,'entity',entity_id,'payload',payload-'request_id')::text);old jsonb;newdata jsonb;previous private.control_events;bid text;v bigint;j public.mail_jobs;target public.users;counter int;
BEGIN
 PERFORM private.control_stepup();
 IF key IS NULL OR key!~'^[A-Za-z0-9_-]{16,100}$' OR length(memo) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'REASON_REQUIRED';END IF;
 -- Lock each idempotency key before effects; concurrent retries cannot double-apply.
 PERFORM pg_advisory_xact_lock(hashtextextended('control:'||key,0));
 SELECT * INTO previous FROM private.control_events WHERE request_key=key;
 IF FOUND THEN IF previous.request_hash<>digest OR previous.actor_id<>uid THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';END IF;RETURN jsonb_build_object('ok',true,'operation_id',previous.id,'replayed',true);END IF;
 SELECT count(*) INTO counter FROM private.control_events WHERE actor_id=uid AND created_at>now()-interval '1 minute';IF counter>=30 THEN RAISE EXCEPTION 'ADMIN_RATE_LIMIT';END IF;
 IF action IN ('reservations','business_mail') THEN
  bid:=entity_id;PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  SELECT to_jsonb(c),revision INTO old,v FROM private.business_controls c WHERE business_id=bid;
  IF coalesce(v,0) IS DISTINCT FROM (payload->>'revision')::bigint OR NOT(payload?'revision') THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
  INSERT INTO private.business_controls(business_id) VALUES(bid) ON CONFLICT DO NOTHING;
  IF action='reservations' THEN UPDATE private.business_controls SET reservation_scope=payload->>'scope',revision=revision+1 WHERE business_id=bid;ELSE UPDATE private.business_controls SET mail_paused=(payload->>'paused')::boolean,revision=revision+1 WHERE business_id=bid;END IF;
  SELECT to_jsonb(c) INTO newdata FROM private.business_controls c WHERE business_id=bid;
 ELSIF action='global_mail' THEN
  SELECT to_jsonb(c),revision INTO old,v FROM private.control_settings c WHERE id=1 FOR UPDATE;
  IF v IS DISTINCT FROM (payload->>'revision')::bigint OR NOT(payload?'revision') THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
  UPDATE private.control_settings SET operational_mail_paused=(payload->>'paused')::boolean,revision=revision+1 WHERE id=1;SELECT to_jsonb(c) INTO newdata FROM private.control_settings c;
 ELSIF action IN ('block_user','revoke_sessions','remove_membership') THEN
  SELECT * INTO target FROM public.users WHERE id=entity_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  -- A global lock protects the last administrator against simultaneous actions.
  PERFORM pg_advisory_xact_lock(hashtextextended('control:administrators',0));
  IF action='block_user' AND (payload->>'blocked')::boolean AND (target.id=uid OR (target.platform_admin=1 AND (SELECT count(*) FROM public.users u WHERE u.platform_admin=1 AND NOT EXISTS(SELECT 1 FROM private.user_controls c WHERE c.user_id=u.id AND c.blocked))<=1)) THEN RAISE EXCEPTION 'LAST_ADMIN';END IF;
  old:=jsonb_build_object('user_id',target.id,'blocked',coalesce((SELECT blocked FROM private.user_controls WHERE user_id=target.id),false));
  IF action='block_user' THEN INSERT INTO private.user_controls VALUES(target.id,(payload->>'blocked')::boolean) ON CONFLICT(user_id) DO UPDATE SET blocked=EXCLUDED.blocked;END IF;
  IF action='revoke_sessions' OR (action='block_user' AND (payload->>'blocked')::boolean) THEN DELETE FROM auth.sessions WHERE user_id=target.auth_user_id;END IF;
  IF action='remove_membership' THEN
   bid:=payload->>'business_id';PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
   IF EXISTS(SELECT 1 FROM public.memberships WHERE user_id=target.id AND business_id=bid AND role='owner') AND (SELECT count(*) FROM public.memberships WHERE business_id=bid AND role='owner')<=1 THEN RAISE EXCEPTION 'LAST_OWNER';END IF;
   UPDATE public.staff SET user_id=NULL WHERE business_id=bid AND user_id=target.id;DELETE FROM public.memberships WHERE business_id=bid AND user_id=target.id;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  END IF;newdata:=jsonb_build_object('action',action,'blocked',coalesce((SELECT blocked FROM private.user_controls WHERE user_id=target.id),false));
 ELSIF action IN ('mail_cancel','mail_retry') THEN
  SELECT * INTO j FROM public.mail_jobs WHERE id=entity_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;bid:=j.business_id;
  old:=jsonb_build_object('state',j.state,'attempts',j.attempts);
  IF action='mail_cancel' THEN
   IF j.state NOT IN ('queued','retry','quota_exhausted') OR j.kind IN ('auth','security','password_reset','invitation') THEN RAISE EXCEPTION 'UNSAFE_MAIL_ACTION';END IF;
   UPDATE public.mail_jobs SET state='skipped',last_error='ADMIN_CANCELLED',updated_at=now() WHERE id=j.id;
  ELSE
   IF j.state<>'failed' OR j.provider_id IS NOT NULL OR j.last_error NOT IN ('BREVO_QUOTA','BREVO_HTTP_429','BREVO_HTTP_400','BREVO_HTTP_401','BREVO_HTTP_403') THEN RAISE EXCEPTION 'UNSAFE_MAIL_ACTION';END IF;
   UPDATE public.mail_jobs SET state='retry',attempts=0,next_attempt_at=now(),updated_at=now() WHERE id=j.id;
  END IF;SELECT jsonb_build_object('state',state,'attempts',attempts) INTO newdata FROM public.mail_jobs WHERE id=j.id;
 ELSIF action='incident' THEN
  SELECT to_jsonb(i),i.revision,i.business_id INTO old,v,bid FROM public.incidents i WHERE id=entity_id FOR UPDATE;
  IF old IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  IF v IS DISTINCT FROM (payload->>'revision')::bigint OR NOT(payload?'revision') THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
  IF payload->>'state' NOT IN ('open','investigating','resolved') OR payload->>'priority' NOT IN ('low','normal','high','critical') OR (payload->>'state'='resolved' AND length(btrim(coalesce(payload->>'resolution','')))<5) THEN RAISE EXCEPTION 'RESOLUTION_REQUIRED';END IF;
  UPDATE public.incidents SET state=payload->>'state',priority=payload->>'priority',resolution=left(coalesce(payload->>'resolution',''),1000),assignee=uid,closed_at=CASE WHEN payload->>'state'='resolved' THEN now() END,updated_at=now(),revision=revision+1 WHERE id=entity_id;
  SELECT to_jsonb(i) INTO newdata FROM public.incidents i WHERE id=entity_id;
 ELSIF action='followup' THEN
  SELECT business_id INTO bid FROM public.plan_requests WHERE id=entity_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  SELECT to_jsonb(f),f.revision INTO old,v FROM private.commercial_followups f WHERE request_id=entity_id;
  IF coalesce(v,0) IS DISTINCT FROM (payload->>'revision')::bigint OR NOT(payload?'revision') THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
  INSERT INTO private.commercial_followups(request_id,note,next_contact,assignee) VALUES(entity_id,left(coalesce(payload->>'note',''),1000),nullif(payload->>'next_contact','')::date,uid) ON CONFLICT(request_id) DO UPDATE SET note=EXCLUDED.note,next_contact=EXCLUDED.next_contact,assignee=uid,revision=private.commercial_followups.revision+1;
  SELECT to_jsonb(f) INTO newdata FROM private.commercial_followups f WHERE request_id=entity_id;
 ELSIF action='verify_payment' THEN
  SELECT to_jsonb(e),e.business_id INTO old,bid FROM public.subscription_events e WHERE e.id=entity_id AND e.action IN ('activate','renew') AND amount_uyu>0;IF old IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  INSERT INTO private.payment_reviews VALUES(entity_id,uid,memo,now());newdata:=jsonb_build_object('verified_by_operator',uid,'automatic_bank_check',false);
 ELSIF action='deletion_request' THEN
  IF payload->>'type'='business' THEN PERFORM 1 FROM public.businesses WHERE id=entity_id;bid:=entity_id;ELSE PERFORM 1 FROM public.users WHERE id=entity_id;END IF;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
  INSERT INTO private.control_requests(entity_type,entity_id,kind,reason,actor_id) VALUES(payload->>'type',entity_id,payload->>'kind',memo,uid);newdata:=jsonb_build_object('state','policy_review','execution_enabled',false);
 ELSE RAISE EXCEPTION 'INVALID_ACTION';END IF;
 INSERT INTO private.control_events(actor_id,action,entity_id,business_id,reason,before_state,after_state,request_key,request_hash) VALUES(uid,action,entity_id,bid,memo,old,newdata,key,digest) RETURNING * INTO previous;
 RETURN jsonb_build_object('ok',true,'operation_id',previous.id,'after',newdata);
END $$;
REVOKE ALL ON FUNCTION public.atry_control_read(text,jsonb),public.atry_control_command(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_control_read(text,jsonb),public.atry_control_command(text,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION private.control_status(public.businesses),private.control_stepup(),private.control_booking_guard() FROM PUBLIC,anon,authenticated,service_role;
