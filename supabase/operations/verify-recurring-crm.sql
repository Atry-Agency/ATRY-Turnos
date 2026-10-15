-- ATRY-Turnos djoxdtloqwbrhgtgencc only. All fixtures are rolled back.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $$ BEGIN
 IF (SELECT count(*) FROM private.migration_ledger WHERE version IN ('202610150026','202610150027'))<>2 THEN RAISE EXCEPTION 'MIGRATIONS_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM public.businesses WHERE id LIKE 'qa_026_20261015_%') THEN RAISE EXCEPTION 'FIXTURE_ID_COLLISION';END IF;
END $$;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
('11111111-1111-4111-8111-111111111101','qa026-owner1@example.com',now(),'{"name":"Usuario Prueba 026-1"}'),
('11111111-1111-4111-8111-111111111102','qa026-owner2@example.com',now(),'{"name":"Usuario Prueba 026-2"}'),
('11111111-1111-4111-8111-111111111103','qa026-staff@example.com',now(),'{"name":"Usuario Prueba 026-3"}'),
('11111111-1111-4111-8111-111111111104','qa026-new@example.com',now(),'{"name":"Usuario Prueba 026-4","requested_business_name":"Negocio Prueba 026-4","requested_business_slug":"qa-026-20261015-new","requested_business_sector":"Taller de cerámica","platform_admin":true}');
INSERT INTO auth.sessions(id,user_id,created_at,updated_at) SELECT id,id,now(),now() FROM auth.users WHERE id IN ('11111111-1111-4111-8111-111111111101','11111111-1111-4111-8111-111111111102','11111111-1111-4111-8111-111111111103','11111111-1111-4111-8111-111111111104');
INSERT INTO public.businesses(id,slug,name,trial_until,created_at,min_notice_min,subscription_status) VALUES
('qa_026_20261015_a','qa-026-20261015-a','Negocio Prueba 026-1',now()+interval '1 year',now(),0,'trialing'),
('qa_026_20261015_b','qa-026-20261015-b','Negocio Prueba 026-2',now()+interval '1 year',now(),0,'trialing');
INSERT INTO public.memberships VALUES('11111111-1111-4111-8111-111111111101','qa_026_20261015_a','owner'),('11111111-1111-4111-8111-111111111102','qa_026_20261015_b','owner'),('11111111-1111-4111-8111-111111111103','qa_026_20261015_a','staff');
INSERT INTO public.staff(id,business_id,user_id,name,created_at) VALUES('qa_026_staff_a','qa_026_20261015_a','11111111-1111-4111-8111-111111111103','Empleado Prueba 026-1',now()),('qa_026_staff_b','qa_026_20261015_b',null,'Empleado Prueba 026-2',now());
INSERT INTO public.services(id,business_id,name,duration_min,created_at) VALUES('qa_026_service_a','qa_026_20261015_a','Servicio Prueba 026-1',30,now()),('qa_026_service_b','qa_026_20261015_b','Servicio Prueba 026-2',30,now());
INSERT INTO public.staff_services VALUES('qa_026_staff_a','qa_026_service_a'),('qa_026_staff_b','qa_026_service_b');
INSERT INTO public.working_hours SELECT id,d,540,1140 FROM public.staff CROSS JOIN generate_series(0,6) d WHERE id IN ('qa_026_staff_a','qa_026_staff_b');
SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111101';
SET LOCAL request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111101","role":"authenticated","session_id":"11111111-1111-4111-8111-111111111101"}';
SET LOCAL ROLE authenticated;
DO $$ DECLARE d date:=(now() AT TIME ZONE 'America/Montevideo')::date+14;c jsonb;r jsonb;p jsonb;rows jsonb;event public.bookings;blocked boolean:=false;BEGIN
 c:=public.atry_save_customer('qa_026_20261015_a',NULL,'{"name":"Cliente Prueba 026","email":"qa026-client@example.com","phone":"099 555 026"}');
 IF jsonb_array_length(public.atry_customers('qa_026_20261015_a','099555026'))<>1 THEN RAISE EXCEPTION 'SEARCH_FAILED';END IF;
 BEGIN PERFORM public.atry_save_customer('qa_026_20261015_a',NULL,'{"name":"Duplicado Prueba","phone":"099-555-026"}');RAISE EXCEPTION 'DUPLICATE_ALLOWED';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'CONTACT_CONFLICT' THEN RAISE;END IF;END;
 p:=jsonb_build_object('staff_id','qa_026_staff_a','service_id','qa_026_service_a','customer_name','Cliente Prueba 026','customer_email','qa026-client@example.com','customer_phone','099 555 026','start_day',d,'time','14:00','interval_weeks',1,'idempotency_key','native_recurring_026_001');
 PERFORM set_config('atry.qa.customer',c->>'id',true);r:=public.atry_create_recurring('qa_026_20261015_a',p);PERFORM set_config('atry.qa.recurring',r->>'id',true);
 IF public.atry_create_recurring('qa_026_20261015_a',p)->>'id'<>r->>'id' THEN RAISE EXCEPTION 'IDEMPOTENCY_FAILED';END IF;
 IF (SELECT count(*) FROM public.bookings WHERE recurring_id=r->>'id')<>6 THEN RAISE EXCEPTION 'EXPANSION_FAILED';END IF;
END $$;
DO $$ DECLARE d date:=(now() AT TIME ZONE 'America/Montevideo')::date+14;c jsonb:=jsonb_build_object('id',current_setting('atry.qa.customer'));r jsonb:=jsonb_build_object('id',current_setting('atry.qa.recurring'));event public.bookings;BEGIN
 BEGIN PERFORM public.atry_create_booking('qa_026_20261015_a',jsonb_build_object('staff_id','qa_026_staff_a','service_id','qa_026_service_a','customer_name','Otro Cliente Prueba','customer_phone','099555027','starts_at',((d+3640)+time '14:00') AT TIME ZONE 'America/Montevideo','idempotency_key','native_far_conflict_026'));RAISE EXCEPTION 'INDEFINITE_GUARD_FAILED';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'RECURRING_CONFLICT' THEN RAISE;END IF;END;
 SELECT * INTO event FROM public.bookings WHERE recurring_id=r->>'id' ORDER BY starts_at LIMIT 1;
 PERFORM public.atry_update_booking('qa_026_20261015_a',event.id,'{"status":"cancelled"}');
 PERFORM public.atry_create_booking('qa_026_20261015_a',jsonb_build_object('staff_id','qa_026_staff_a','service_id','qa_026_service_a','customer_id',c->>'id','customer_name','Cliente Prueba 026','customer_email','qa026-client@example.com','customer_phone','099 555 026','starts_at',event.starts_at,'idempotency_key','native_cancel_exception_026'));
 SELECT * INTO event FROM public.bookings WHERE recurring_id=r->>'id' AND status='confirmed' ORDER BY starts_at LIMIT 1;
 PERFORM public.atry_update_booking('qa_026_20261015_a',event.id,jsonb_build_object('starts_at',event.starts_at+interval '1 hour'));
 PERFORM public.atry_create_booking('qa_026_20261015_a',jsonb_build_object('staff_id','qa_026_staff_a','service_id','qa_026_service_a','customer_name','Cliente Prueba 026','customer_email','qa026-client@example.com','customer_phone','099 555 026','starts_at',event.starts_at,'idempotency_key','native_move_exception_026'));
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111102';
SET LOCAL request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111102","role":"authenticated","session_id":"11111111-1111-4111-8111-111111111102"}';
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb;BEGIN
 IF EXISTS(SELECT 1 FROM public.customers WHERE business_id='qa_026_20261015_a') THEN RAISE EXCEPTION 'RLS_LEAK';END IF;
 BEGIN PERFORM public.atry_recurring('qa_026_20261015_a');RAISE EXCEPTION 'FOREIGN_RPC_ALLOWED';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 r:=public.atry_create_booking('qa_026_20261015_b',jsonb_build_object('staff_id','qa_026_staff_b','service_id','qa_026_service_b','customer_name','Cliente Prueba Otro Negocio','customer_phone','099555028','starts_at',(((now() AT TIME ZONE 'America/Montevideo')::date+14)+time '14:00') AT TIME ZONE 'America/Montevideo','idempotency_key','native_foreign_booking_026'));
 PERFORM set_config('atry.qa.foreign',r->>'id',true);
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111103';
SET LOCAL request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111103","role":"authenticated","session_id":"11111111-1111-4111-8111-111111111103"}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.atry_recurring('qa_026_20261015_a');RAISE EXCEPTION 'STAFF_CRM_ALLOWED';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF EXISTS(SELECT 1 FROM public.customers) THEN RAISE EXCEPTION 'STAFF_CRM_LEAK';END IF;
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111101';
SET LOCAL request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111101","role":"authenticated","session_id":"11111111-1111-4111-8111-111111111101"}';
SET LOCAL ROLE authenticated;
SELECT public.atry_end_recurring('qa_026_20261015_a',current_setting('atry.qa.recurring'),(now() AT TIME ZONE 'America/Montevideo')::date+14);
RESET ROLE;
DO $$ BEGIN
 IF (SELECT status FROM public.bookings WHERE id=current_setting('atry.qa.foreign'))<>'confirmed' THEN RAISE EXCEPTION 'END_CHANGED_OTHER_BUSINESS';END IF;
 IF (SELECT count(*) FROM public.bookings WHERE business_id='qa_026_20261015_a' AND recurring_id IS NULL AND status='confirmed')<>2 THEN RAISE EXCEPTION 'END_CHANGED_MANUAL_BOOKINGS';END IF;
END $$;
SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111104';
SET LOCAL request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111104","role":"authenticated","session_id":"11111111-1111-4111-8111-111111111104"}';
SET LOCAL ROLE authenticated;
DO $$ DECLARE m jsonb;BEGIN
 PERFORM public.atry_finish_registration();PERFORM public.atry_finish_registration();m:=public.atry_me();
 IF jsonb_array_length(m->'businesses')<>1 OR m->'businesses'->0->>'sector'<>'Taller de cerámica' OR (m->'user'->>'platform_admin')::int<>0 THEN RAISE EXCEPTION 'ONBOARDING_FAILED';END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASSED: CRM, recurrence, idempotency, individual exceptions, RLS, roles, onboarding; all fixtures rolled back' result,
(SELECT count(*) FROM public.businesses WHERE id LIKE 'qa_026_20261015_%' OR slug='qa-026-20261015-new') fixture_businesses,
(SELECT count(*) FROM auth.users WHERE id IN ('11111111-1111-4111-8111-111111111101','11111111-1111-4111-8111-111111111102','11111111-1111-4111-8111-111111111103','11111111-1111-4111-8111-111111111104')) fixture_users;
