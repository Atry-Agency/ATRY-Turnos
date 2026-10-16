-- ONLY ATRY-Turnos djoxdtloqwbrhgtgencc. Session/role simulation, not a login test.
-- All command changes are rolled back. No messages or bookings are created.
BEGIN;
SET LOCAL statement_timeout='60s';
DO $$ DECLARE claims jsonb; BEGIN
 IF (SELECT count(*) FROM private.migration_ledger WHERE version IN ('202610150033','202610150034','202610160035','202610160036','202610160037'))<>5 THEN RAISE EXCEPTION 'MIGRATIONS_REQUIRED';END IF;
 IF has_function_privilege('anon','public.atry_control_read(text,jsonb)','EXECUTE') OR has_function_privilege('anon','public.atry_control_command(text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'ANONYMOUS_ADMIN_ACCESS';END IF;
 IF has_function_privilege('authenticated','public.atry_record_mail_receipt(text,text,text,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'RECEIPT_SERVICE_ONLY';END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND c.relkind='r' AND (NOT c.relrowsecurity OR has_table_privilege('authenticated',c.oid,'SELECT'))) THEN RAISE EXCEPTION 'PRIVATE_TABLE_EXPOSED';END IF;
 SELECT jsonb_build_object('sub',u.auth_user_id,'session_id',s.id,'amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch FROM now())))) INTO claims FROM public.users u JOIN auth.sessions s ON s.user_id=u.auth_user_id WHERE u.platform_admin=1 AND s.created_at>now()-interval '7 days' AND (s.not_after IS NULL OR s.not_after>now()) ORDER BY s.created_at DESC LIMIT 1;
 IF claims IS NULL THEN RAISE EXCEPTION 'ADMIN_SESSION_REQUIRED';END IF;
 PERFORM set_config('request.jwt.claims',claims::text,true);PERFORM set_config('request.jwt.claim.sub',claims->>'sub',true);
 PERFORM set_config('test.admin_claims',claims::text,true);PERFORM set_config('test.settings_revision',(SELECT revision::text FROM private.control_settings WHERE id=1),true);
END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE section text;result jsonb;key text:='mission005-smoke-'||gen_random_uuid()::text; BEGIN
 FOREACH section IN ARRAY ARRAY['overview','businesses','users','requests','finance','mail','system','incidents','storage','audit','settings','retention'] LOOP
  result:=public.atry_control_read(section,'{}');IF result IS NULL THEN RAISE EXCEPTION 'EMPTY_SECTION:%',section;END IF;
 END LOOP;
 result:=public.atry_control_command('global_mail','platform',jsonb_build_object('paused',true,'reason','Prueba remota transaccional; rollback obligatorio','revision',current_setting('test.settings_revision')::bigint,'request_id',key));
 IF result IS NULL THEN RAISE EXCEPTION 'COMMAND_FAILED';END IF;
 PERFORM public.atry_control_command('global_mail','platform',jsonb_build_object('paused',true,'reason','Prueba remota transaccional; rollback obligatorio','revision',current_setting('test.settings_revision')::bigint,'request_id',key));
 BEGIN
  PERFORM public.atry_control_command('global_mail','platform',jsonb_build_object('paused',false,'reason','Prueba de revision obsoleta; rollback obligatorio','revision',current_setting('test.settings_revision')::bigint,'request_id',gen_random_uuid()::text));
  RAISE EXCEPTION 'REVISION_GUARD_NOT_ENFORCED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%STALE%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
DO $$ DECLARE claims jsonb;BEGIN
 claims:=current_setting('test.admin_claims')::jsonb||'{"amr":[]}'::jsonb;PERFORM set_config('request.jwt.claims',claims::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.atry_control_command('global_mail','platform',jsonb_build_object('paused',false,'reason','Prueba sin autenticacion reciente','revision',1,'request_id',gen_random_uuid()::text));RAISE EXCEPTION 'STEPUP_BYPASSED';
 EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM<>'RECENT_AUTH_REQUIRED' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
DO $$ DECLARE claims jsonb;BEGIN
 SELECT jsonb_build_object('sub',u.auth_user_id,'session_id',s.id) INTO claims FROM public.users u JOIN auth.sessions s ON s.user_id=u.auth_user_id WHERE u.platform_admin=0 AND s.created_at>now()-interval '7 days' ORDER BY s.created_at DESC LIMIT 1;
 IF claims IS NULL THEN RAISE EXCEPTION 'TENANT_SESSION_REQUIRED';END IF;PERFORM set_config('request.jwt.claims',claims::text,true);PERFORM set_config('request.jwt.claim.sub',claims->>'sub',true);
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM public.atry_control_read('users','{}');RAISE EXCEPTION 'TENANT_ADMIN_ACCESS';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS' AS remote_control_smoke,'12 admin sections; anonymous/private grants; idempotency; stale revision; recent auth; tenant denial; all mutations rolled back' AS checks;
