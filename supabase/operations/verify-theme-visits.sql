-- Controlled verification only. Every fixture and queued event is rolled back.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='60s';
DO $fixture$
DECLARE original public.businesses;bid text:=gen_random_uuid()::text;slug text:='release-'||replace(gen_random_uuid()::text,'-','');uid text;auth_id uuid;session_id uuid;sid text;vid text;ids jsonb:='[]';i int;day int;
BEGIN
 SELECT * INTO original FROM public.businesses ORDER BY created_at LIMIT 1;
 SELECT u.id,u.auth_user_id,s.id INTO uid,auth_id,session_id FROM public.users u JOIN public.memberships m ON m.user_id=u.id JOIN auth.sessions s ON s.user_id=u.auth_user_id WHERE m.role='owner' AND s.created_at>now()-interval '7 days' AND (s.not_after IS NULL OR s.not_after>now()) AND NOT EXISTS(SELECT 1 FROM private.user_controls c WHERE c.user_id=u.id AND c.blocked) LIMIT 1;
 IF original.id IS NULL OR uid IS NULL THEN RAISE EXCEPTION 'VERIFICATION_REQUIRES_EXISTING_OWNER';END IF;
 INSERT INTO public.businesses SELECT (jsonb_populate_record(NULL::public.businesses,to_jsonb(original)||jsonb_build_object('id',bid,'name','Verificación temporal','slug',slug,'email','','phone','','address','','description','','logo_url','','plan','pro','subscription_status','active','subscription_started_at',now()-interval '1 day','paid_until',now()+interval '30 days','is_active',1,'auto_confirm',1,'allow_guest',1,'multi_service_enabled',1,'theme_config','{}'::jsonb,'theme_revision',0,'created_at',now()))).*;
 INSERT INTO public.memberships(user_id,business_id,role) VALUES(uid,bid,'owner');
 INSERT INTO public.notification_preferences(business_id,confirmations,cancellations,reschedules,reminders,waitlist,business_alerts) VALUES(bid,0,0,0,0,0,0);
 FOR i IN 1..3 LOOP
  sid:=gen_random_uuid()::text;vid:=gen_random_uuid()::text;
  INSERT INTO public.staff(id,business_id,name,email,active,color,created_at) VALUES(sid,bid,'Profesional de prueba '||i,'',1,'#4754E6',now());
  INSERT INTO public.services(id,business_id,name,duration_min,price_uyu,created_at) VALUES(vid,bid,'Servicio de prueba '||i,CASE i WHEN 1 THEN 20 WHEN 2 THEN 35 ELSE 45 END,i*100,now());
  INSERT INTO public.staff_services VALUES(sid,vid);
  FOR day IN 0..6 LOOP INSERT INTO public.working_hours VALUES(sid,day,540,1140);END LOOP;
  ids:=ids||jsonb_build_array(vid);
 END LOOP;
 PERFORM set_config('atry.release_fixture',jsonb_build_object('bid',bid,'slug',slug,'ids',ids,'auth_id',auth_id,'session_id',session_id)::text,true);
END $fixture$;
SET LOCAL ROLE service_role;
DO $public_test$
DECLARE fixture jsonb:=current_setting('atry.release_fixture')::jsonb;available jsonb;chosen jsonb;body jsonb;created jsonb;again jsonb;
BEGIN
 available:=public.atry_public_visit_availability(fixture->>'slug',jsonb_build_object('date',(now() AT TIME ZONE 'America/Montevideo')::date+7,'service_ids',fixture->'ids'));
 chosen:=available->'options'->0;
 IF chosen IS NULL OR chosen->>'duration_min'<>'100' OR chosen->>'price_uyu'<>'600' THEN RAISE EXCEPTION 'REMOTE_VISIT_AVAILABILITY_FAILED';END IF;
 body:=jsonb_build_object('legs',chosen->'legs','quote',chosen->'quote','customer_name','Verificación sin envío','customer_phone','000000000','accept_policy',true,'idempotency_key','release_verification_043_044');
 created:=public.atry_public_visit_book(fixture->>'slug',body);again:=public.atry_public_visit_book(fixture->>'slug',body);
 IF created IS DISTINCT FROM again OR jsonb_array_length(created->'legs')<>3 THEN RAISE EXCEPTION 'REMOTE_VISIT_IDEMPOTENCY_FAILED';END IF;
 IF public.atry_manage(created->>'manage_token')->>'id' IS DISTINCT FROM created->>'id' THEN RAISE EXCEPTION 'REMOTE_VISIT_MANAGEMENT_FAILED';END IF;
 PERFORM public.atry_manage_change(created->>'manage_token','cancel','{}');
 IF public.atry_manage(created->>'manage_token')->>'status'<>'cancelled' THEN RAISE EXCEPTION 'REMOTE_VISIT_CANCEL_FAILED';END IF;
END $public_test$;
RESET ROLE;
DO $claims$ BEGIN PERFORM set_config('request.jwt.claim.sub',current_setting('atry.release_fixture')::jsonb->>'auth_id',true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('atry.release_fixture')::jsonb->>'auth_id','session_id',current_setting('atry.release_fixture')::jsonb->>'session_id')::text,true);END $claims$;
SET LOCAL ROLE authenticated;
DO $owner_test$
DECLARE bid text:=current_setting('atry.release_fixture')::jsonb->>'bid';saved jsonb;
BEGIN
 saved:=public.atry_save_appearance(bid,'{"theme_config":{"primary":"#A44B6D","sidebar":"#ED80A6"},"expected_revision":0}');
 IF saved->>'theme_revision'<>'1' OR saved->'theme_config'->>'sidebar'<>'#ED80A6' THEN RAISE EXCEPTION 'REMOTE_APPEARANCE_FAILED';END IF;
END $owner_test$;
RESET ROLE;
DO $permissions$
BEGIN
 IF has_function_privilege('anon','public.atry_public_visit_book(text,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.atry_public_visit_book(text,jsonb)','EXECUTE') OR has_table_privilege('authenticated','public.booking_visits','SELECT') THEN RAISE EXCEPTION 'REMOTE_VISIT_PERMISSIONS_FAILED';END IF;
END $permissions$;
ROLLBACK;
SELECT 'REMOTE_THEME_VISITS_OK_ROLLED_BACK' AS result,(SELECT count(*) FROM public.businesses) AS businesses_preserved,(SELECT count(*) FROM public.bookings) AS bookings_preserved;
