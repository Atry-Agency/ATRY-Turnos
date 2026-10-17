-- ATRY-Turnos djoxdtloqwbrhgtgencc only. Controlled changes always roll back.
BEGIN;
SET LOCAL statement_timeout='30s';
DO $verify$
DECLARE bid text;sid text;uid text;session_id text;windows jsonb;before_rules jsonb;after_rules jsonb;free_day int;denied boolean;
BEGIN
 SELECT b.id,s.id,u.auth_user_id::text,a.id::text INTO bid,sid,uid,session_id
 FROM public.businesses b JOIN public.staff s ON s.business_id=b.id AND s.active=1
 JOIN public.memberships m ON m.business_id=b.id AND m.role='owner'
 JOIN public.users u ON u.id=m.user_id JOIN auth.sessions a ON a.user_id=u.auth_user_id
 WHERE private.subscription_live(b.id) AND a.created_at>now()-interval '7 days' AND (a.not_after IS NULL OR a.not_after>now())
 ORDER BY a.created_at DESC LIMIT 1;
 IF bid IS NULL THEN RAISE EXCEPTION 'NO_LIVE_OWNER_SESSION_FOR_VERIFICATION';END IF;
 IF EXISTS(SELECT 1 FROM public.recurring_breaks WHERE staff_id=sid) THEN RAISE EXCEPTION 'EXISTING_BREAKS_REQUIRE_SEPARATE_FIXTURE';END IF;
 SELECT d INTO free_day FROM generate_series(0,6) d WHERE NOT EXISTS(SELECT 1 FROM public.working_hours h WHERE h.staff_id=sid AND h.weekday=d) LIMIT 1;
 IF free_day IS NULL THEN RAISE EXCEPTION 'NO_UNUSED_WEEKDAY_FOR_CONTROLLED_TEST';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('weekday',weekday,'start_min',start_min,'end_min',end_min)),'[]') INTO windows FROM public.working_hours WHERE staff_id=sid;
 windows:=windows||jsonb_build_array(jsonb_build_object('weekday',free_day,'start_min',540,'end_min',660),jsonb_build_object('weekday',free_day,'start_min',840,'end_min',900),jsonb_build_object('weekday',free_day,'start_min',1020,'end_min',1080));
 PERFORM set_config('request.jwt.claim.sub',uid,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('session_id',session_id)::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM public.atry_save_week(bid,sid,jsonb_build_object('windows',windows));
 after_rules:=public.atry_rules(bid);
 IF (SELECT count(*) FROM jsonb_array_elements(after_rules->'breaks') x WHERE x->>'staff_id'=sid AND (x->>'weekday')::int=free_day)<>2 THEN RAISE EXCEPTION 'MULTI_WINDOW_NOT_APPLIED';END IF;
 before_rules:=after_rules;denied:=false;
 BEGIN PERFORM public.atry_save_week(bid,sid,jsonb_build_object('windows',jsonb_build_array(jsonb_build_object('weekday',free_day,'start_min',540,'end_min',700),jsonb_build_object('weekday',free_day,'start_min',660,'end_min',800))));EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'OVERLAPPING_HOURS' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied OR public.atry_rules(bid)<>before_rules THEN RAISE EXCEPTION 'FAILED_SAVE_NOT_ATOMIC';END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000040',true);denied:=false;
 BEGIN PERFORM public.atry_save_week(bid,sid,jsonb_build_object('windows',windows));EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'FOREIGN_IDENTITY_ALLOWED';END IF;
 RESET ROLE;
 IF has_function_privilege('anon','public.atry_save_week(text,text,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.atry_save_week(text,text,jsonb)','EXECUTE') OR NOT has_function_privilege('authenticated','public.atry_save_week(text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'BAD_WEEK_PERMISSIONS';END IF;
END $verify$;
SELECT 'WEEKLY_AVAILABILITY_OK_ROLLED_BACK' result;
ROLLBACK;
SELECT (SELECT count(*) FROM public.businesses) businesses,(SELECT count(*) FROM public.users) users,(SELECT count(*) FROM public.bookings) bookings,(SELECT count(*) FROM public.recurring_breaks) recurring_breaks;
