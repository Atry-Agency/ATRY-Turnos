-- Native verification of manual subscriptions. Fixtures never commit and send no email.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.migration_ledger WHERE version='202610150028') THEN RAISE EXCEPTION 'MIGRATION_028_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id IN ('22222222-2222-4222-8222-222222222201','22222222-2222-4222-8222-222222222202')) THEN RAISE EXCEPTION 'FIXTURE_COLLISION';END IF;
END $$;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
('22222222-2222-4222-8222-222222222201','qa-sub-owner@example.com',now(),'{"name":"Usuario Prueba Suscripción","platform_admin":true}'),
('22222222-2222-4222-8222-222222222202','qa-sub-operator@example.com',now(),'{"name":"Operador Prueba Suscripción"}');
INSERT INTO auth.sessions(id,user_id,created_at,updated_at) SELECT id,id,now(),now() FROM auth.users WHERE id IN ('22222222-2222-4222-8222-222222222201','22222222-2222-4222-8222-222222222202');
UPDATE public.users SET platform_admin=1 WHERE id='22222222-2222-4222-8222-222222222202';
SET LOCAL request.jwt.claim.sub='22222222-2222-4222-8222-222222222201';
SET LOCAL request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222201","role":"authenticated","session_id":"22222222-2222-4222-8222-222222222201"}';
SET LOCAL ROLE authenticated;
DO $$ DECLARE b jsonb;state jsonb;BEGIN
 b:=public.atry_create_organization('{"name":"Negocio Prueba Suscripción","slug":"qa-subscriptions-20261015","sector":"Barbería","subscription_status":"active","paid_until":"2099-01-01"}');PERFORM set_config('atry.qa.subscription_bid',b->>'id',true);
 state:=public.atry_business(b->>'id');IF state->>'subscription_status'<>'pending' OR state->>'paid_until' IS NOT NULL THEN RAISE EXCEPTION 'SELF_ACTIVATION_ALLOWED';END IF;
 IF (public.atry_me()->'user'->>'platform_admin')::int<>0 THEN RAISE EXCEPTION 'METADATA_GRANTED_ADMIN';END IF;
 BEGIN PERFORM public.atry_save_customer(b->>'id',NULL,'{"name":"Cliente Prueba","phone":"099555028"}');RAISE EXCEPTION 'PENDING_WRITE_ALLOWED';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'SUBSCRIPTION_REQUIRED' THEN RAISE;END IF;END;
 BEGIN PERFORM public.atry_admin_save_business(b->>'id','{"subscription_action":"trial","until_day":"2030-01-01"}');RAISE EXCEPTION 'OWNER_GRANTED_ACCESS';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='22222222-2222-4222-8222-222222222202';
SET LOCAL request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222202","role":"authenticated","session_id":"22222222-2222-4222-8222-222222222202"}';
SET LOCAL ROLE authenticated;
DO $$ DECLARE bid text:=current_setting('atry.qa.subscription_bid');p jsonb;r jsonb;BEGIN
 p:=jsonb_build_object('subscription_action','activate','plan','negocio','until_day',(now() AT TIME ZONE 'America/Montevideo')::date+30,'amount_uyu',1190,'reference','QA-TRANSFER-028-001','note','Prueba transaccional; no es un pago real','request_id','native_subscription_activate_028');r:=public.atry_admin_save_business(bid,p);
 IF public.atry_admin_save_business(bid,p)->>'event_id'<>r->>'event_id' THEN RAISE EXCEPTION 'ACTIVATION_NOT_IDEMPOTENT';END IF;
 BEGIN PERFORM public.atry_admin_save_business(bid,p||jsonb_build_object('subscription_action','renew','until_day',(now() AT TIME ZONE 'America/Montevideo')::date+60,'request_id','native_subscription_duplicate_028'));RAISE EXCEPTION 'DUPLICATE_TRANSFER_ALLOWED';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'DUPLICATE_TRANSFER' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='22222222-2222-4222-8222-222222222201';
SET LOCAL request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222201","role":"authenticated","session_id":"22222222-2222-4222-8222-222222222201"}';
SET LOCAL ROLE authenticated;
DO $$ DECLARE bid text:=current_setting('atry.qa.subscription_bid');sid text;vid text;r jsonb;d date:=(now() AT TIME ZONE 'America/Montevideo')::date+2;BEGIN
 WHILE extract(dow FROM d)=0 LOOP d:=d+1;END LOOP;
 SELECT id INTO sid FROM public.staff WHERE business_id=bid LIMIT 1;
 r:=public.atry_save_service(bid,NULL,jsonb_build_object('name','Servicio Prueba Suscripción','duration_min',30,'price_uyu',500,'staff_ids',jsonb_build_array(sid)));vid:=r->>'id';
 r:=public.atry_create_booking(bid,jsonb_build_object('staff_id',sid,'service_id',vid,'customer_name','Cliente Prueba','customer_phone','099555028','starts_at',(d+time '14:00') AT TIME ZONE 'America/Montevideo','idempotency_key','native_subscription_booking_028'));PERFORM set_config('atry.qa.subscription_booking',r->>'id',true);PERFORM set_config('atry.qa.subscription_day',d::text,true);
 r:=public.atry_create_recurring(bid,jsonb_build_object('staff_id',sid,'service_id',vid,'customer_name','Cliente Fijo Prueba','customer_phone','099555029','start_day',d+7,'time','15:00','interval_weeks',1,'idempotency_key','native_subscription_fixed_028'));PERFORM set_config('atry.qa.subscription_fixed',r->>'id',true);
END $$;
RESET ROLE;
-- Simulate passage of time only on the uncommitted fixture.
UPDATE public.businesses SET paid_until=now()-interval '1 second' WHERE id=current_setting('atry.qa.subscription_bid');
DO $$ DECLARE bid text:=current_setting('atry.qa.subscription_bid');BEGIN
 IF private.subscription_live(bid) OR (public.atry_public_info('qa-subscriptions-20261015')->>'bookable')::boolean THEN RAISE EXCEPTION 'EXPIRED_PUBLIC_ACCESS';END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE bid text:=current_setting('atry.qa.subscription_bid');c text;BEGIN
 SELECT id INTO c FROM public.customers WHERE business_id=bid LIMIT 1;
 IF c IS NULL THEN RAISE EXCEPTION 'HISTORY_LOST';END IF;
 BEGIN PERFORM public.atry_save_customer(bid,c,'{"notes":"No permitido"}');RAISE EXCEPTION 'EXPIRED_CRM_WRITE';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'SUBSCRIPTION_REQUIRED' THEN RAISE;END IF;END;
 BEGIN PERFORM public.atry_save_business(bid,'{"paid_until":"2099-01-01","name":"No permitido"}');RAISE EXCEPTION 'EXPIRED_SETTINGS_WRITE';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'SUBSCRIPTION_REQUIRED' THEN RAISE;END IF;END;
 BEGIN PERFORM public.atry_update_booking(bid,current_setting('atry.qa.subscription_booking'),'{"status":"completed"}');RAISE EXCEPTION 'EXPIRED_OPERATION';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'SUBSCRIPTION_REQUIRED' THEN RAISE;END IF;END;
 PERFORM public.atry_update_booking(bid,current_setting('atry.qa.subscription_booking'),'{"status":"cancelled"}');
 PERFORM public.atry_end_recurring(bid,current_setting('atry.qa.subscription_fixed'),(now() AT TIME ZONE 'America/Montevideo')::date);
 PERFORM public.atry_bookings(bid,current_setting('atry.qa.subscription_day')::date,1);
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='22222222-2222-4222-8222-222222222202';
SET LOCAL request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222202","role":"authenticated","session_id":"22222222-2222-4222-8222-222222222202"}';
SET LOCAL ROLE authenticated;
DO $$ DECLARE bid text:=current_setting('atry.qa.subscription_bid');p jsonb;row jsonb;BEGIN
 p:=jsonb_build_object('subscription_action','trial','until_day',(now() AT TIME ZONE 'America/Montevideo')::date+7,'note','Prueba transaccional autorizada','request_id','native_subscription_trial_028');PERFORM public.atry_admin_save_business(bid,p);
 PERFORM public.atry_admin_save_business(bid,'{"subscription_action":"suspend","request_id":"native_subscription_suspend_028"}');
 PERFORM public.atry_admin_save_business(bid,'{"subscription_action":"restore","request_id":"native_subscription_restore_028"}');
 SELECT value INTO row FROM jsonb_array_elements(public.atry_admin_businesses()) WHERE value->>'id'=bid;
 IF jsonb_array_length(row->'license_history')<>4 OR (row->>'access_enabled')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'HISTORY_OR_RESTORE_FAILED';END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASSED: pending registration, manual approval, expiry, duplicate transfer, idempotency, read-only history, cancellation, recurrence end, trials, suspension and restoration. All fixtures rolled back.' result,
(SELECT count(*) FROM public.businesses WHERE slug='qa-subscriptions-20261015') fixture_businesses,
(SELECT count(*) FROM auth.users WHERE id IN ('22222222-2222-4222-8222-222222222201','22222222-2222-4222-8222-222222222202')) fixture_users;
