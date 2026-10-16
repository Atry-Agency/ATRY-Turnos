-- Run only in ATRY-Turnos (djoxdtloqwbrhgtgencc). All fixtures roll back. No worker or mail provider is invoked.
BEGIN;
SET LOCAL lock_timeout='8s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM auth.users WHERE id IN ('44444444-4444-4444-8444-444444444491','44444444-4444-4444-8444-444444444492')) THEN RAISE EXCEPTION 'FIXTURE_COLLISION';END IF;END $$;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
('44444444-4444-4444-8444-444444444491','qa-commercial-owner@example.com',now(),'{"name":"QA Comercial Propietario"}'),
('44444444-4444-4444-8444-444444444492','qa-commercial-operator@example.com',now(),'{"name":"QA Comercial Operador"}');
INSERT INTO auth.sessions(id,user_id,created_at,updated_at) VALUES('44444444-4444-4444-8444-444444444491','44444444-4444-4444-8444-444444444491',now(),now()),('44444444-4444-4444-8444-444444444492','44444444-4444-4444-8444-444444444492',now(),now());
UPDATE public.users SET platform_admin=1 WHERE id='44444444-4444-4444-8444-444444444492';
SET LOCAL request.jwt.claim.sub='44444444-4444-4444-8444-444444444491';
SET LOCAL request.jwt.claims='{"role":"authenticated","session_id":"44444444-4444-4444-8444-444444444491"}';
SET LOCAL ROLE authenticated;
DO $$ DECLARE b jsonb;r jsonb;again jsonb;payload jsonb:='{"plan":"individual","phone":"+59893802328","request_id":"native_commercial_request_004"}';BEGIN
 b:=public.atry_create_organization('{"name":"QA Misión 004","slug":"qa-mission004-native"}');PERFORM set_config('atry.qa.commercial_bid',b->>'id',true);
 r:=public.atry_request_plan(b->>'id',payload);again:=public.atry_request_plan(b->>'id',payload);
 IF r->'requests'->0->>'id' IS DISTINCT FROM again->'requests'->0->>'id' OR (r->'entitlements'->>'access_enabled')::boolean THEN RAISE EXCEPTION 'REQUEST_IDEMPOTENCY_OR_EARLY_ACCESS';END IF;
 IF r->'requests'->0->>'payment_state'<>'unverified' OR r->'requests'->0->>'state'<>'pending_contact' THEN RAISE EXCEPTION 'INVALID_INITIAL_REQUEST';END IF;
 PERFORM set_config('atry.qa.commercial_request',r->'requests'->0->>'id',true);
 BEGIN PERFORM public.atry_admin_commercial();RAISE EXCEPTION 'OWNER_HAS_ADMIN';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='44444444-4444-4444-8444-444444444492';
SET LOCAL request.jwt.claims='{"role":"authenticated","session_id":"44444444-4444-4444-8444-444444444492"}';
SET LOCAL ROLE authenticated;
DO $$ DECLARE bid text:=current_setting('atry.qa.commercial_bid');payload jsonb;first jsonb;BEGIN
 BEGIN PERFORM public.atry_subscription(bid);RAISE EXCEPTION 'ADMIN_READ_FOREIGN_SUBSCRIPTION';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM public.atry_admin_request_state(current_setting('atry.qa.commercial_request'),'pending_verification');
 payload:=jsonb_build_object('subscription_action','activate','plan','individual','until_day',(now() AT TIME ZONE 'America/Montevideo')::date+30,'amount_uyu',790,'reference','QA-ONLY-ROLLBACK-004','plan_request_id',current_setting('atry.qa.commercial_request'),'request_id','native_commercial_activation_004');first:=public.atry_admin_save_business(bid,payload);
 IF public.atry_admin_save_business(bid,payload)->>'event_id' IS DISTINCT FROM first->>'event_id' THEN RAISE EXCEPTION 'ACTIVATION_NOT_IDEMPOTENT';END IF;
 BEGIN PERFORM public.atry_admin_save_business(bid,payload||jsonb_build_object('subscription_action','renew','until_day',(now() AT TIME ZONE 'America/Montevideo')::date+60,'request_id','native_commercial_duplicate_004'));RAISE EXCEPTION 'DUPLICATE_PAYMENT_ALLOWED';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'DUPLICATE_TRANSFER' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='44444444-4444-4444-8444-444444444491';
SET LOCAL request.jwt.claims='{"role":"authenticated","session_id":"44444444-4444-4444-8444-444444444491"}';
SET LOCAL ROLE authenticated;
DO $$ DECLARE bid text:=current_setting('atry.qa.commercial_bid');caps jsonb;r jsonb;BEGIN
 caps:=public.atry_entitlements(bid);IF (caps->>'staff_limit')::int<>1 OR (caps->>'mail_limit')::int<>0 OR (caps->'features'->>'exports')::boolean THEN RAISE EXCEPTION 'INDIVIDUAL_CAPABILITIES';END IF;
 IF jsonb_array_length(public.atry_rules(bid)->'hours')<>6 THEN RAISE EXCEPTION 'OWN_HOURS_BLOCKED';END IF;
 BEGIN PERFORM public.atry_smartslots(bid,current_date+1);RAISE EXCEPTION 'INDIVIDUAL_SMARTSLOTS';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.atry_insights(bid);RAISE EXCEPTION 'INDIVIDUAL_INSIGHTS';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.atry_export_bookings(bid);RAISE EXCEPTION 'INDIVIDUAL_EXPORT';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.atry_recurring(bid);RAISE EXCEPTION 'INDIVIDUAL_RECURRING';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.atry_waitlist(bid);RAISE EXCEPTION 'INDIVIDUAL_WAITLIST';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.atry_access(bid);RAISE EXCEPTION 'INDIVIDUAL_TEAM';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.atry_mail_jobs(bid);RAISE EXCEPTION 'INDIVIDUAL_MAIL';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF EXISTS(SELECT 1 FROM public.resources WHERE business_id=bid) THEN RAISE EXCEPTION 'RLS_RESOURCE_LEAK';END IF;
 BEGIN PERFORM public.atry_save_staff(bid,NULL,'{"name":"No permitido"}');RAISE EXCEPTION 'STAFF_LIMIT_BYPASS';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'STAFF_LIMIT' THEN RAISE;END IF;END;
 r:=public.atry_request_plan(bid,'{"plan":"pro","phone":"+59893802328","request_id":"native_commercial_upgrade_004"}');IF r->'entitlements'->>'code'<>'individual' THEN RAISE EXCEPTION 'EARLY_UPGRADE';END IF;
END $$;
RESET ROLE;
-- Only fixture-owned rows are used for quota reservation; no claim of the production queue.
DO $$ DECLARE bid text:=current_setting('atry.qa.commercial_bid');a public.mail_jobs;b public.mail_jobs;used int;BEGIN
 UPDATE public.businesses SET plan='negocio' WHERE id=bid;
 UPDATE public.plans SET mail_limit=1 WHERE code='negocio';
 INSERT INTO public.mail_jobs(id,dedupe_key,business_id,source,source_id,kind,recipient,subject,content,next_attempt_at,created_at,updated_at) VALUES('qa-004-mail-a','qa-004-mail-a',bid,'system','','confirmed','qa@atry-unit-mail.com','QA','Sin envío',now(),now(),now()),('qa-004-mail-b','qa-004-mail-b',bid,'system','','confirmed','qa@atry-unit-mail.com','QA','Sin envío',now(),now(),now());
 SELECT * INTO a FROM public.mail_jobs WHERE id='qa-004-mail-a';SELECT * INTO b FROM public.mail_jobs WHERE id='qa-004-mail-b';
 IF NOT private.mail_reserve(a) OR private.mail_reserve(b) THEN RAISE EXCEPTION 'QUOTA_OVERFLOW';END IF;
 UPDATE public.mail_jobs SET state='delivery_unknown' WHERE id=a.id;
 IF (SELECT reserved FROM public.business_mail_usage WHERE business_id=bid)<>1 THEN RAISE EXCEPTION 'UNCERTAIN_MAIL_FREED_QUOTA';END IF;
 UPDATE public.mail_jobs SET state='provider_accepted',provider_id='QA-NOT-SENT' WHERE id=a.id;
 UPDATE public.mail_jobs SET state='provider_accepted' WHERE id=a.id;
 SELECT accepted INTO used FROM public.business_mail_usage WHERE business_id=bid;IF used<>1 THEN RAISE EXCEPTION 'MAIL_DOUBLE_COUNT';END IF;
END $$;
ROLLBACK;
SELECT 'MISION_004_NATIVE_OK_ROLLED_BACK' AS result;
