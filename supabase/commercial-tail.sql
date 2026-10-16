CREATE TABLE private.commercial_settings(id integer PRIMARY KEY CHECK(id=1),whatsapp text NOT NULL CHECK(whatsapp~'^[1-9][0-9]{7,14}$'),tax_status text NOT NULL DEFAULT 'pending' CHECK(tax_status IN ('pending','included','excluded')),provider_daily_limit integer NOT NULL DEFAULT 200 CHECK(provider_daily_limit BETWEEN 1 AND 100000),security_reserve integer NOT NULL DEFAULT 30 CHECK(security_reserve>=0),revision bigint NOT NULL DEFAULT 1,CHECK(security_reserve<provider_daily_limit));
INSERT INTO private.commercial_settings(id,whatsapp) VALUES(1,'59893802328');
ALTER TABLE private.commercial_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.commercial_settings FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.plan_requests(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,code text NOT NULL UNIQUE DEFAULT 'ATRY-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),business_id text NOT NULL REFERENCES public.businesses(id),requested_by text NOT NULL REFERENCES public.users(id),plan text NOT NULL REFERENCES public.plans(code),price_uyu integer NOT NULL CHECK(price_uyu>=0),phone text NOT NULL CHECK(phone~'^\+[1-9][0-9]{7,14}$'),state text NOT NULL DEFAULT 'pending_contact' CHECK(state IN ('pending_contact','pending_payment','pending_verification','active','cancelled')),payment_state text NOT NULL DEFAULT 'unverified' CHECK(payment_state IN ('unverified','verified','waived')),request_key text NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(business_id,request_key));
CREATE UNIQUE INDEX one_open_plan_request ON public.plan_requests(business_id) WHERE state IN ('pending_contact','pending_payment','pending_verification');
CREATE TABLE public.plan_request_events(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,request_id text NOT NULL REFERENCES public.plan_requests(id),actor_id text NOT NULL REFERENCES public.users(id),state text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.plan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_request_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_requests,public.plan_request_events FROM PUBLIC,anon,authenticated,service_role;
-- Direct reads also enforce the commercial boundary, in addition to existing tenant policies.
CREATE FUNCTION private.has_feature(bid text,feature text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((p.features->>feature)::boolean,false) FROM public.businesses b JOIN public.plans p ON p.code=b.plan WHERE b.id=bid
$$;
CREATE FUNCTION private.require_feature(bid text,feature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT coalesce(private.has_feature(bid,feature),false) THEN RAISE EXCEPTION 'FEATURE_DISABLED' USING ERRCODE='42501';END IF;END $$;
REVOKE ALL ON FUNCTION private.has_feature(text,text),private.require_feature(text,text) FROM PUBLIC,anon,authenticated,service_role;
-- RLS policies execute this function as authenticated without exposing any data beyond a boolean.
GRANT EXECUTE ON FUNCTION private.has_feature(text,text) TO authenticated;
CREATE FUNCTION private.commercial_cycle(bid text) RETURNS TABLE(cycle_start timestamptz,cycle_end timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE anchor int;month_start date;candidate date;today date:=(now() AT TIME ZONE 'America/Montevideo')::date;
BEGIN
 SELECT extract(day FROM created_at AT TIME ZONE 'America/Montevideo')::int INTO anchor FROM public.businesses WHERE id=bid;
 month_start:=date_trunc('month',today)::date;candidate:=month_start+least(anchor,extract(day FROM month_start+interval '1 month - 1 day')::int)-1;
 IF candidate>today THEN month_start:=(month_start-interval '1 month')::date;END IF;
 cycle_start:=(month_start+least(anchor,extract(day FROM month_start+interval '1 month - 1 day')::int)-1)::timestamp AT TIME ZONE 'America/Montevideo';month_start:=(month_start+interval '1 month')::date;
 cycle_end:=(month_start+least(anchor,extract(day FROM month_start+interval '1 month - 1 day')::int)-1)::timestamp AT TIME ZONE 'America/Montevideo';RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION private.commercial_cycle(text) FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.business_mail_usage(business_id text NOT NULL REFERENCES public.businesses(id),cycle_start timestamptz NOT NULL,accepted integer NOT NULL DEFAULT 0 CHECK(accepted>=0),reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0),PRIMARY KEY(business_id,cycle_start));
CREATE TABLE private.mail_reservations(job_id text PRIMARY KEY REFERENCES public.mail_jobs(id),business_id text NOT NULL REFERENCES public.businesses(id),cycle_start timestamptz NOT NULL,state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','accepted')));
ALTER TABLE public.business_mail_usage ENABLE ROW LEVEL SECURITY;ALTER TABLE private.mail_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_mail_usage,private.mail_reservations FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.atry_entitlements(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE result jsonb;c record;
BEGIN
 IF private.member_role(bid) IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM private.commercial_cycle(bid);
 SELECT to_jsonb(p)||jsonb_build_object('access_enabled',private.subscription_live(bid),'revision',(SELECT revision FROM private.commercial_settings WHERE id=1),'staff_count',(SELECT count(*) FROM public.staff WHERE business_id=bid AND active=1),'mail_usage',jsonb_build_object('accepted',coalesce(u.accepted,0),'reserved',coalesce(u.reserved,0),'limit',p.mail_limit,'cycle_start',c.cycle_start,'cycle_end',c.cycle_end)) INTO result FROM public.businesses b JOIN public.plans p ON p.code=b.plan LEFT JOIN public.business_mail_usage u ON u.business_id=b.id AND u.cycle_start=c.cycle_start WHERE b.id=bid;
 RETURN result;
END $$;
CREATE FUNCTION public.atry_subscription(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE caps jsonb:=public.atry_entitlements(bid);biz public.businesses;contact jsonb;
BEGIN
 SELECT * INTO biz FROM public.businesses WHERE id=bid;SELECT jsonb_build_object('whatsapp',whatsapp,'tax_status',tax_status) INTO contact FROM private.commercial_settings WHERE id=1;
 RETURN jsonb_build_object('plans',(SELECT jsonb_agg(to_jsonb(p) ORDER BY price_uyu) FROM public.plans p WHERE code<>'trial'),'settings',contact,'entitlements',caps,'requests',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('message','Hola, quiero contratar Atry Turnos.'||chr(10)||'Negocio: '||biz.name||chr(10)||'Plan solicitado: '||(SELECT name FROM public.plans WHERE code=r.plan)||chr(10)||'Precio mensual propuesto: $'||r.price_uyu||' UYU'||chr(10)||'Código de solicitud: '||r.code||chr(10)||'Me gustaría coordinar la transferencia y habilitación de mi cuenta.') ORDER BY r.created_at DESC) FROM public.plan_requests r WHERE r.business_id=bid),'[]'::jsonb));
END $$;
CREATE FUNCTION public.atry_request_plan(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE p public.plans;phone text:=regexp_replace(coalesce(payload->>'phone',''),'[ ()-]','','g');key text:=payload->>'request_id';digest text;old public.plan_requests;rid text;
BEGIN
 IF private.member_role(bid)<>'owner' OR private.member_role(bid) IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 SELECT * INTO p FROM public.plans WHERE code=payload->>'plan' AND code<>'trial';
 IF p.code IS NULL OR phone!~'^\+[1-9][0-9]{7,14}$' OR key IS NULL OR key!~'^[A-Za-z0-9_-]{16,100}$' THEN RAISE EXCEPTION 'INVALID_PLAN_REQUEST';END IF;
 digest:=private.hash(jsonb_build_object('plan',p.code,'phone',phone)::text);
 SELECT * INTO old FROM public.plan_requests WHERE business_id=bid AND request_key=key;
 IF FOUND THEN IF old.request_hash<>digest THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';END IF;RETURN public.atry_subscription(bid);END IF;
 IF EXISTS(SELECT 1 FROM public.plan_requests WHERE business_id=bid AND state IN ('pending_contact','pending_payment','pending_verification')) THEN RAISE EXCEPTION 'OPEN_REQUEST_EXISTS';END IF;
 INSERT INTO public.plan_requests(business_id,requested_by,plan,price_uyu,phone,request_key,request_hash) VALUES(bid,private.user_id(),p.code,p.price_uyu,phone,key,digest) RETURNING id INTO rid;
 UPDATE public.businesses SET phone=phone WHERE id=bid;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'plan.requested','plan_request',rid,now());RETURN public.atry_subscription(bid);
END $$;
CREATE FUNCTION public.atry_cancel_plan_request(bid text,request_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN
 IF coalesce(private.member_role(bid),'')<>'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 UPDATE public.plan_requests SET state='cancelled',updated_at=now() WHERE id=request_id AND business_id=bid AND state IN ('pending_contact','pending_payment','pending_verification');
 IF FOUND THEN INSERT INTO public.plan_request_events(request_id,actor_id,state) VALUES(request_id,private.user_id(),'cancelled');END IF;RETURN public.atry_subscription(bid);
END $$;
CREATE FUNCTION public.atry_admin_commercial() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.commercial_settings;committed bigint;
BEGIN
 PERFORM private.require_admin();SELECT * INTO s FROM private.commercial_settings WHERE id=1;
 SELECT coalesce(sum(p.mail_limit),0) INTO committed FROM public.businesses b JOIN public.plans p ON p.code=b.plan WHERE private.subscription_live(b.id);
 RETURN jsonb_build_object('settings',to_jsonb(s),'capacity',jsonb_build_object('monthly_committed',committed,'monthly_available',(s.provider_daily_limit-s.security_reserve)*28,'warning',committed>(s.provider_daily_limit-s.security_reserve)*28),'requests',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('business_name',b.name,'history',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at) FROM public.plan_request_events e WHERE e.request_id=r.id),'[]'::jsonb)) ORDER BY r.created_at DESC) FROM public.plan_requests r JOIN public.businesses b ON b.id=r.business_id),'[]'::jsonb));
END $$;
CREATE FUNCTION public.atry_admin_save_commercial(payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid text:=private.require_admin();s private.commercial_settings;
BEGIN
 SELECT * INTO s FROM private.commercial_settings WHERE id=1 FOR UPDATE;
 UPDATE private.commercial_settings SET whatsapp=coalesce(payload->>'whatsapp',s.whatsapp),tax_status=coalesce(payload->>'tax_status',s.tax_status),provider_daily_limit=coalesce((payload->>'provider_daily_limit')::int,s.provider_daily_limit),security_reserve=coalesce((payload->>'security_reserve')::int,s.security_reserve),revision=revision+1 WHERE id=1;
 INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'commercial.updated','settings',now());RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION public.atry_admin_request_state(request_id text,state text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text:=private.require_admin();
BEGIN
 IF state NOT IN ('pending_payment','pending_verification','cancelled') THEN RAISE EXCEPTION 'INVALID_REQUEST_STATE';END IF;
 UPDATE public.plan_requests SET state=atry_admin_request_state.state,updated_at=now() WHERE id=request_id AND plan_requests.state IN ('pending_contact','pending_payment','pending_verification');IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_CHANGED';END IF;
 INSERT INTO public.plan_request_events(request_id,actor_id,state) VALUES(request_id,uid,state);INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'plan.request.'||state,request_id,now());RETURN jsonb_build_object('ok',true);
END $$;
-- Extend the existing activation transaction, keeping its idempotency and transfer uniqueness.
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.atry_admin_save_business(text,jsonb)'::regprocedure) INTO src;
 src:=replace(src,' UPDATE public.businesses SET plan=b.plan',E' IF payload?''starts_day'' AND ((payload->>''starts_day'')::date>(now() AT TIME ZONE ''America/Montevideo'')::date OR (payload->>''starts_day'')::date>=coalesce(b.paid_until,b.trial_until)::date) THEN RAISE EXCEPTION ''INVALID_START'';END IF;\n PERFORM private.resolve_downgrade(bid,b.plan,payload);\n UPDATE public.businesses SET plan=b.plan');
 src:=replace(src,' INSERT INTO public.platform_audit VALUES',E' IF act IN (''activate'',''renew'') AND payload?''plan_request_id'' THEN\n UPDATE public.plan_requests SET state=''active'',payment_state=CASE WHEN ref<>'''' THEN ''verified'' ELSE ''waived'' END,updated_at=now() WHERE id=payload->>''plan_request_id'' AND business_id=bid AND plan=b.plan AND state IN (''pending_contact'',''pending_payment'',''pending_verification'');IF NOT FOUND THEN RAISE EXCEPTION ''REQUEST_CHANGED'';END IF;\n INSERT INTO public.plan_request_events(request_id,actor_id,state) VALUES(payload->>''plan_request_id'',uid,''active'');END IF;\n INSERT INTO public.platform_audit VALUES');
 src:=replace(src,'''is_active'',b.is_active),amt,ref,memo)',E'''is_active'',b.is_active,''starts_day'',payload->>''starts_day''),amt,ref,memo)');
 IF position('private.resolve_downgrade' IN src)=0 THEN RAISE EXCEPTION 'PATCH_MISMATCH';END IF;EXECUTE src;
END $$;
CREATE FUNCTION private.resolve_downgrade(bid text,plan_code text,payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE lim int;total int;keep jsonb:=payload->'keep_staff_ids';
BEGIN
 SELECT staff_limit INTO lim FROM public.plans WHERE code=plan_code;
 SELECT count(*) INTO total FROM public.staff WHERE business_id=bid AND active=1;
 IF payload?'plan' AND total>lim THEN
  IF jsonb_typeof(keep) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'DOWNGRADE_STAFF_SELECTION_REQUIRED';END IF;
  IF jsonb_array_length(keep) NOT BETWEEN 1 AND lim OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(keep))<>jsonb_array_length(keep) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(keep) k WHERE NOT EXISTS(SELECT 1 FROM public.staff WHERE id=k.value AND business_id=bid AND active=1)) THEN RAISE EXCEPTION 'INVALID_STAFF_SELECTION';END IF;
  -- Existing bookings and recurrence rows are preserved. Future creation with inactive staff is rejected.
  UPDATE public.staff SET active=0 WHERE business_id=bid AND active=1 AND NOT(keep?staff.id);
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.resolve_downgrade(text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.atry_admin_save_plan(code text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text:=private.require_admin();p public.plans;f jsonb;k text;newlim int;
BEGIN
 SELECT * INTO p FROM public.plans WHERE plans.code=atry_admin_save_plan.code FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 f:=p.features||coalesce(payload->'features','{}');FOR k IN SELECT jsonb_object_keys(f) LOOP IF NOT(p.features?k) OR jsonb_typeof(f->k)<>'boolean' THEN RAISE EXCEPTION 'INVALID_FEATURE';END IF;END LOOP;
 FOREACH k IN ARRAY ARRAY['smartslots','resources','reports'] LOOP IF payload?k THEN IF payload->>k NOT IN ('0','1') THEN RAISE EXCEPTION 'INVALID_FEATURE';END IF;f:=jsonb_set(f,ARRAY[CASE WHEN k='reports' THEN 'advanced' ELSE k END],to_jsonb((payload->>k)::int=1));END IF;END LOOP;
 newlim:=coalesce((payload->>'staff_limit')::int,p.staff_limit);
 IF newlim NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM public.staff s JOIN public.businesses b ON b.id=s.business_id WHERE b.plan=code AND s.active=1 GROUP BY s.business_id HAVING count(*)>newlim) THEN RAISE EXCEPTION 'STAFF_LIMIT';END IF;
 UPDATE public.plans SET staff_limit=newlim,price_uyu=coalesce((payload->>'price_uyu')::int,p.price_uyu),mail_limit=coalesce((payload->>'mail_limit')::int,p.mail_limit),features=f,smartslots=(f->>'smartslots')::boolean::int,resources=(f->>'resources')::boolean::int,reports=(f->>'advanced')::boolean::int WHERE plans.code=atry_admin_save_plan.code;
 UPDATE private.commercial_settings SET revision=revision+1 WHERE id=1;UPDATE public.calendar_revisions SET revision=revision+1,updated_at=now() WHERE business_id IN(SELECT id FROM public.businesses WHERE plan=code);
 INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,uid,'plan.updated',code,now());RETURN jsonb_build_object('ok',true);
END $$;
-- Business plan changes notify existing realtime subscriptions, with no customer data.
CREATE FUNCTION private.commercial_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN INSERT INTO public.calendar_revisions(business_id,revision) VALUES(NEW.id,1) ON CONFLICT(business_id) DO UPDATE SET revision=public.calendar_revisions.revision+1,updated_at=now();RETURN NEW;END $$;
CREATE TRIGGER commercial_changed AFTER UPDATE OF plan,subscription_status,paid_until,is_active ON public.businesses FOR EACH ROW EXECUTE FUNCTION private.commercial_change();
REVOKE ALL ON FUNCTION private.commercial_change() FROM PUBLIC,anon,authenticated,service_role;
-- RPC guards preserve signatures, OIDs and existing grants. Patterns refer to stable parameter names.
DO $$ DECLARE item record;src text;BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('atry_recurring','recurring'),('atry_create_recurring','recurring'),('atry_waitlist','waitlist'),('atry_update_waitlist','waitlist'),('atry_smartslots','smartslots'),('atry_insights','advanced'),('atry_export_bookings','exports'),('atry_access','access'),('atry_invite','access'),('atry_add_member','access'),('atry_update_member','access'),('atry_revoke_invitation','access'),('atry_notification_preferences','operational_mail'),('atry_save_notification_preferences','operational_mail'),('atry_mail_jobs','operational_mail'),('atry_notifications','operational_mail')) v(fn,feature) LOOP
  FOR src IN SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=item.fn LOOP
   src:=regexp_replace(src,'\mBEGIN\M',format('BEGIN PERFORM private.require_feature(bid,%L);',item.feature),'i');EXECUTE src;
  END LOOP;
 END LOOP;
END $$;
-- Module writes cannot bypass RPCs, including automated recurring expansion.
CREATE FUNCTION private.guard_commercial_module() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;bid text;feature text:=TG_ARGV[0];
BEGIN
 bid:=data->>'business_id';IF bid IS NULL THEN SELECT business_id INTO bid FROM public.services WHERE id=data->>'service_id';END IF;
 IF TG_TABLE_NAME='recurring_appointments' AND TG_OP='UPDATE' AND data->>'end_day' IS NOT NULL AND (to_jsonb(OLD)->>'end_day' IS NULL OR data->>'end_day'<=to_jsonb(OLD)->>'end_day') AND (to_jsonb(NEW)-'end_day'-'active'-'updated_at')=(to_jsonb(OLD)-'end_day'-'active'-'updated_at') AND (data->>'active')::int<=(to_jsonb(OLD)->>'active')::int THEN RETURN NEW;END IF;
 PERFORM private.require_feature(bid,feature);IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $$;
DO $$ DECLARE item record;BEGIN
 FOR item IN SELECT * FROM (VALUES ('recurring_appointments','recurring'),('waitlist','waitlist'),('resources','resources'),('service_resources','resources'),('invitations','access')) v(tbl,feature) LOOP
 EXECUTE format('CREATE TRIGGER commercial_module BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.guard_commercial_module(%L)',item.tbl,item.feature);
 IF item.tbl<>'service_resources' THEN EXECUTE format('CREATE POLICY commercial_read ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING(private.has_feature(business_id,%L))',item.tbl,item.feature);END IF;
 END LOOP;
END $$;
CREATE FUNCTION private.guard_staff_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE lim int;
BEGIN
 IF NEW.active=1 AND (TG_OP='INSERT' OR OLD.active=0) THEN
  PERFORM 1 FROM public.businesses WHERE id=NEW.business_id FOR UPDATE;SELECT p.staff_limit INTO lim FROM public.plans p JOIN public.businesses b ON b.plan=p.code WHERE b.id=NEW.business_id;
  IF (SELECT count(*) FROM public.staff WHERE business_id=NEW.business_id AND active=1 AND id<>NEW.id)>=lim THEN RAISE EXCEPTION 'STAFF_LIMIT' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER commercial_staff_limit BEFORE INSERT OR UPDATE OF active ON public.staff FOR EACH ROW EXECUTE FUNCTION private.guard_staff_limit();
REVOKE ALL ON FUNCTION private.guard_staff_limit(),private.guard_commercial_module() FROM PUBLIC,anon,authenticated,service_role;
-- Automatic offers require Pro. A basic waitlist never sends automatic offers.
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('private.offer_cancelled_booking()'::regprocedure) INTO src;
 src:=regexp_replace(src,'\mBEGIN\M',E'BEGIN IF NOT private.has_feature(NEW.business_id,''auto_offers'') THEN RETURN NEW;END IF;','i');EXECUTE src;
 SELECT pg_get_functiondef('private.expand_recurring(text,date,int,boolean,text)'::regprocedure) INTO src;
 src:=regexp_replace(src,'\mBEGIN\M',E'BEGIN IF NOT private.has_feature(bid,''recurring'') THEN RETURN false;END IF;','i');EXECUTE src;
END $$;
-- Public waitlist entry checks its business capability before persisting anything.
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.atry_public_waitlist(text,jsonb)'::regprocedure) INTO src;
 src:=regexp_replace(src,'\mBEGIN\M',E'BEGIN PERFORM private.require_feature((SELECT id FROM public.businesses WHERE businesses.slug=atry_public_waitlist.slug),''waitlist'');','i');EXECUTE src;
END $$;
-- Runtime prices are read from the persistent catalog, including the tax-status disclaimer.
CREATE OR REPLACE FUNCTION public.atry_runtime_config() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('app','Atry Turnos','version','1.3.0','currency','UYU','timezone','America/Montevideo','payments_live',false,'whatsapp_live',false,'mail_provider',CASE WHEN mail_enabled THEN 'brevo' ELSE 'disabled' END,'automatic_email_live',mail_enabled,'tax_status',(SELECT tax_status FROM private.commercial_settings WHERE id=1),'plans',(SELECT jsonb_agg(to_jsonb(p) ORDER BY price_uyu) FROM public.plans p WHERE code<>'trial')) FROM private.runtime_settings WHERE id=1
$$;
REVOKE ALL ON FUNCTION public.atry_subscription(text),public.atry_request_plan(text,jsonb),public.atry_cancel_plan_request(text,text),public.atry_admin_commercial(),public.atry_admin_save_commercial(jsonb),public.atry_admin_request_state(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_subscription(text),public.atry_request_plan(text,jsonb),public.atry_cancel_plan_request(text,text),public.atry_admin_commercial(),public.atry_admin_save_commercial(jsonb),public.atry_admin_request_state(text,text) TO authenticated;

DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.atry_save_rule(text,text,text,jsonb,boolean)'::regprocedure) INTO src;
 src:=replace(src,'kind NOT IN (''time_off'',''hours'')','kind IN (''resources'',''service_resources'')');EXECUTE src;
END $$;
CREATE FUNCTION public.atry_statistics(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM private.require_manager(bid);PERFORM private.require_feature(bid,'statistics');RETURN (SELECT jsonb_build_object('total',count(*),'completed',count(*) FILTER(WHERE status='completed'),'cancelled',count(*) FILTER(WHERE status='cancelled')) FROM public.bookings WHERE business_id=bid AND starts_at>=now()-interval '30 days' AND starts_at<now());END $$;
REVOKE ALL ON FUNCTION public.atry_statistics(text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.atry_statistics(text) TO authenticated;
CREATE POLICY commercial_read ON public.service_resources AS RESTRICTIVE FOR SELECT TO authenticated USING(private.has_feature((SELECT business_id FROM public.services WHERE id=service_id),'resources'));
-- Filter mixed essential/paid responses without exposing protected resource catalogs via a definer.
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.atry_rules(text)'::regprocedure) INTO src;
 src:=replace(src,'FROM public.resources x WHERE business_id=bid','FROM public.resources x WHERE business_id=bid AND private.has_feature(bid,''resources'')');
 src:=replace(src,'FROM public.service_resources x JOIN public.services s ON s.id=x.service_id WHERE s.business_id=bid','FROM public.service_resources x JOIN public.services s ON s.id=x.service_id WHERE s.business_id=bid AND private.has_feature(bid,''resources'')');EXECUTE src;
 SELECT pg_get_functiondef('public.atry_public_info(text)'::regprocedure) INTO src;
 src:=replace(src,'''business'',',E'''waitlist_enabled'',private.has_feature(b.id,''waitlist''),''operational_mail'',private.has_feature(b.id,''operational_mail''),''business'',');EXECUTE src;
 SELECT pg_get_functiondef('private.check_slot(text,text,text,timestamptz,text,boolean)'::regprocedure) INTO src;
 src:=replace(src,'WHERE a.business_id=bid AND private.recurring_applies','WHERE a.business_id=bid AND private.has_feature(bid,''recurring'') AND private.recurring_applies');EXECUTE src;
END $$;
-- Billing cycles are anchored to the first activation (or the existing creation date), not reset on renewal.
ALTER TABLE public.businesses ADD COLUMN subscription_started_at timestamptz;
CREATE OR REPLACE FUNCTION private.subscription_live(bid text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT is_active=1 AND coalesce(subscription_started_at,created_at)<=now() AND ((subscription_status='trialing' AND trial_until>now()) OR (subscription_status='active' AND paid_until>now())) FROM public.businesses WHERE id=bid),false)
$$;
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('private.commercial_cycle(text)'::regprocedure) INTO src;src:=replace(src,'extract(day FROM created_at AT TIME ZONE','extract(day FROM coalesce(subscription_started_at,created_at) AT TIME ZONE');EXECUTE src;
 SELECT pg_get_functiondef('public.atry_admin_save_business(text,jsonb)'::regprocedure) INTO src;
 src:=replace(src,'''starts_day'')::date>(now() AT TIME ZONE ''America/Montevideo'')::date OR ','''starts_day'')::date>now()::date+1825 OR ');
 src:=replace(src,' UPDATE public.businesses SET plan=b.plan',E' UPDATE public.businesses SET subscription_started_at=CASE WHEN payload?''starts_day'' THEN (payload->>''starts_day'')::date::timestamp AT TIME ZONE ''America/Montevideo'' WHEN act IN (''activate'',''trial'') THEN coalesce(subscription_started_at,now()) ELSE subscription_started_at END WHERE id=bid;\n UPDATE public.businesses SET plan=b.plan');EXECUTE src;
 SELECT pg_get_functiondef('private.resolve_downgrade(text,text,jsonb)'::regprocedure) INTO src;
 src:=replace(src,'  UPDATE public.staff SET active=0',E'  IF EXISTS(SELECT 1 FROM public.bookings b JOIN public.staff st ON st.id=b.staff_id WHERE b.business_id=bid AND b.ends_at>now() AND b.status IN (''pending'',''confirmed'') AND st.active=1 AND NOT(keep?st.id)) THEN RAISE EXCEPTION ''DOWNGRADE_FUTURE_BOOKINGS_REASSIGN_REQUIRED'';END IF;\n  UPDATE public.staff SET active=0');EXECUTE src;
 SELECT pg_get_functiondef('public.atry_save_customer(text,text,jsonb)'::regprocedure) INTO src;
 src:=replace(src,'WHERE r.business_id=bid AND r.customer_email','WHERE r.business_id=bid AND private.has_feature(bid,''recurring'') AND r.customer_email');EXECUTE src;
 -- Retain essential dashboard activity; Individual does not receive paid aggregate statistics.
 SELECT pg_get_functiondef('public.atry_dashboard(text)'::regprocedure) INTO src;
 src:=replace(src,'RETURN private.dashboard_before_recurring(bid);',E'IF NOT private.has_feature(bid,''statistics'') THEN RETURN private.dashboard_before_recurring(bid)-''totals''-''daily''-''insights''-''waitlist'' || jsonb_build_object(''totals'',''{}''::jsonb,''daily'',''[]''::jsonb,''insights'',''[]''::jsonb,''waitlist'',0);END IF;RETURN private.dashboard_before_recurring(bid);');EXECUTE src;
END $$;
-- Existing accepted messages are included in the current cycle; never reset historical consumption on rollout.
INSERT INTO public.business_mail_usage(business_id,cycle_start,accepted)
SELECT b.id,c.cycle_start,count(j.id) FROM public.businesses b CROSS JOIN LATERAL private.commercial_cycle(b.id) c LEFT JOIN public.mail_jobs j ON j.business_id=b.id AND j.updated_at>=c.cycle_start AND j.updated_at<c.cycle_end AND j.state IN ('provider_accepted','smtp_accepted','stored_local','delivered') AND j.kind NOT IN ('invitation','password_reset','security','auth') GROUP BY b.id,c.cycle_start ON CONFLICT DO NOTHING;
-- Backward-compatible administrative reports flag maps to both historical report capabilities.
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.atry_admin_save_plan(text,jsonb)'::regprocedure) INTO src;
 src:=replace(src,' newlim:=',E' IF payload?''reports'' THEN f:=f||jsonb_build_object(''exports'',(payload->>''reports'')::int=1,''statistics'',(payload->>''reports'')::int=1);END IF;\n newlim:=');EXECUTE src;
END $$;
CREATE OR REPLACE FUNCTION private.has_feature(bid text,feature text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((p.features->>feature)::boolean,false) AND b.subscription_status<>'pending' FROM public.businesses b JOIN public.plans p ON p.code=b.plan WHERE b.id=bid
$$;
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.atry_entitlements(text)'::regprocedure) INTO src;
 src:=replace(src,'''access_enabled'',',E'''features'',CASE WHEN (SELECT subscription_status FROM public.businesses WHERE id=bid)=''pending'' THEN (SELECT jsonb_object_agg(key,false) FROM jsonb_object_keys(p.features) key) ELSE p.features END,''access_enabled'',');EXECUTE src;
 SELECT pg_get_functiondef('public.atry_admin_businesses()'::regprocedure) INTO src;
 src:=replace(src,'SELECT b.id,b.name,b.slug,b.email,b.plan',E'SELECT b.id,b.name,b.slug,b.email,b.phone,(SELECT coalesce(jsonb_agg(jsonb_build_object(''id'',s.id,''name'',s.name)),''[]''::jsonb) FROM public.staff s WHERE s.business_id=b.id AND s.active=1) active_staff,b.plan');
 src:=replace(src,'ORDER BY se.created_at DESC LIMIT 20','ORDER BY se.created_at DESC');EXECUTE src;
END $$;
-- Historical references are retained. New transfers cannot reuse a reference across businesses.
CREATE FUNCTION private.guard_transfer_reference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.action IN ('activate','renew') AND btrim(NEW.reference)<>'' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('transfer:'||lower(btrim(NEW.reference)),0));
  IF EXISTS(SELECT 1 FROM public.subscription_events WHERE action IN ('activate','renew') AND lower(btrim(reference))=lower(btrim(NEW.reference))) THEN RAISE EXCEPTION 'DUPLICATE_TRANSFER';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER commercial_transfer_reference BEFORE INSERT ON public.subscription_events FOR EACH ROW EXECUTE FUNCTION private.guard_transfer_reference();
REVOKE ALL ON FUNCTION private.guard_transfer_reference() FROM PUBLIC,anon,authenticated,service_role;
-- An old bearer link cannot grant a module after a downgrade.
DO $$ DECLARE src text;fn text;BEGIN
 FOREACH fn IN ARRAY ARRAY['atry_offer','atry_accept_offer'] LOOP
  SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=fn;
  src:=regexp_replace(src,'\mBEGIN\M',format('BEGIN IF EXISTS(SELECT 1 FROM public.waitlist WHERE offer_token_hash=private.hash(%I.token)) THEN PERFORM private.require_feature((SELECT business_id FROM public.waitlist WHERE offer_token_hash=private.hash(%I.token)),''waitlist'');END IF;',fn,fn),'i');EXECUTE src;
 END LOOP;
 SELECT pg_get_functiondef('public.atry_accept_invitation(text)'::regprocedure) INTO src;
 src:=regexp_replace(src,'\mBEGIN\M',E'BEGIN PERFORM private.require_feature((SELECT business_id FROM public.invitations WHERE token_hash=private.hash(atry_accept_invitation.token)),''access'');','i');EXECUTE src;
END $$;
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.atry_admin_save_business(text,jsonb)'::regprocedure) INTO src;
 src:=replace(src,'''trial'',''suspend'',''restore'')','''trial'',''suspend'',''restore'',''cancel'')');
 src:=replace(src,' ELSIF act=''suspend'' THEN',E' ELSIF act=''cancel'' THEN b.subscription_status:=''cancelled'';\n ELSIF act=''suspend'' THEN');
 src:=replace(src,'''past_due'',''suspended'')','''past_due'',''suspended'',''cancelled'')');EXECUTE src;
END $$;
