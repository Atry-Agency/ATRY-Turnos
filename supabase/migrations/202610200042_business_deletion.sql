-- Explicit, administrator-only business deletion. No automatic cleanup.
CREATE FUNCTION private.business_purge_allowed(bid text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT current_setting('atry.business_purge',true)=bid AND EXISTS(SELECT 1 FROM public.users WHERE auth_user_id=auth.uid() AND platform_admin=1)
$$;
REVOKE ALL ON FUNCTION private.business_purge_allowed(text) FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE source text;BEGIN
 SELECT pg_get_functiondef('private.guard_subscription_write()'::regprocedure) INTO source;
 source:=replace(source,'IF NOT private.subscription_live(bid) THEN','IF TG_OP=''DELETE'' AND private.business_purge_allowed(bid) THEN RETURN OLD;END IF; IF NOT private.subscription_live(bid) THEN');EXECUTE source;
 SELECT pg_get_functiondef('private.guard_commercial_module()'::regprocedure) INTO source;
 source:=replace(source,'PERFORM private.require_feature(bid,feature);','IF TG_OP=''DELETE'' AND private.business_purge_allowed(bid) THEN RETURN OLD;END IF; PERFORM private.require_feature(bid,feature);');EXECUTE source;
END $$;
CREATE FUNCTION private.business_purge_plan(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_column
DECLARE t record;fk record;condition text;changed int;added int;count_rows bigint;counts jsonb:='{}';content text:='';part text;business public.businesses;crossed boolean;
BEGIN
 PERFORM private.require_admin();SELECT * INTO business FROM public.businesses WHERE id=bid;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 DROP TABLE IF EXISTS pg_temp.atry_purge_rows;
 CREATE TEMP TABLE atry_purge_rows(rel oid,tuple text,PRIMARY KEY(rel,tuple)) ON COMMIT DROP;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'public.businesses'::regclass,ctid::text FROM public.businesses WHERE id=bid;
 FOR t IN SELECT c.oid,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private') AND c.relkind='r' AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='business_id' AND NOT a.attisdropped) LOOP
  EXECUTE format('INSERT INTO pg_temp.atry_purge_rows SELECT %s,ctid::text FROM %I.%I WHERE business_id=$1 ON CONFLICT DO NOTHING',t.oid,t.nspname,t.relname) USING bid;
 END LOOP;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'private.control_requests'::regclass,ctid::text FROM private.control_requests WHERE entity_type='business' AND entity_id=bid ON CONFLICT DO NOTHING;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'private.control_events'::regclass,ctid::text FROM private.control_events WHERE entity_id=bid ON CONFLICT DO NOTHING;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'public.platform_audit'::regclass,ctid::text FROM public.platform_audit WHERE entity_id=bid ON CONFLICT DO NOTHING;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'public.idempotency_keys'::regclass,ctid::text FROM public.idempotency_keys WHERE position(bid IN scope)>0 ON CONFLICT DO NOTHING;
 LOOP
  changed:=0;
  FOR fk IN SELECT c.oid,c.conrelid,c.confrelid,n.nspname,t.relname,pn.nspname parent_schema,pt.relname parent_name,c.conkey,c.confkey FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_class pt ON pt.oid=c.confrelid JOIN pg_namespace pn ON pn.oid=pt.relnamespace WHERE c.contype='f' AND n.nspname IN ('public','private') AND EXISTS(SELECT 1 FROM pg_temp.atry_purge_rows r WHERE r.rel=c.confrelid) LOOP
   IF fk.conrelid='public.users'::regclass THEN RAISE EXCEPTION 'PROTECTED_ACCOUNT_DEPENDENCY';END IF;
   SELECT string_agg(format('child.%I=parent.%I',ca.attname,pa.attname),' AND ' ORDER BY k.i) INTO condition FROM generate_subscripts(fk.conkey,1) k(i) JOIN pg_attribute ca ON ca.attrelid=fk.conrelid AND ca.attnum=fk.conkey[k.i] JOIN pg_attribute pa ON pa.attrelid=fk.confrelid AND pa.attnum=fk.confkey[k.i];
   EXECUTE format('INSERT INTO pg_temp.atry_purge_rows SELECT %s,child.ctid::text FROM %I.%I child JOIN %I.%I parent ON %s JOIN pg_temp.atry_purge_rows selected ON selected.rel=%s AND selected.tuple=parent.ctid::text ON CONFLICT DO NOTHING',fk.conrelid,fk.nspname,fk.relname,fk.parent_schema,fk.parent_name,condition,fk.confrelid);
   GET DIAGNOSTICS added=ROW_COUNT;changed:=changed+added;
  END LOOP;
  EXIT WHEN changed=0;
 END LOOP;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'public.public_rate_buckets'::regclass,ctid::text FROM public.public_rate_buckets WHERE split_part(scope,':',2)=business.slug ON CONFLICT DO NOTHING;
 INSERT INTO pg_temp.atry_purge_rows SELECT 'public.idempotency_keys'::regclass,k.ctid::text FROM public.idempotency_keys k JOIN private.offer_tokens o ON k.scope='offer:'||private.hash(o.token) JOIN public.waitlist w ON w.id=o.waitlist_id WHERE w.business_id=bid ON CONFLICT DO NOTHING;
 -- Receipts are provider-linked rather than FK-linked. Include only this business's jobs.
 INSERT INTO pg_temp.atry_purge_rows SELECT 'private.mail_receipts'::regclass,r.ctid::text FROM private.mail_receipts r JOIN public.mail_jobs j ON j.provider_id=r.provider_id WHERE j.business_id=bid ON CONFLICT DO NOTHING;
 FOR t IN SELECT r.rel,n.nspname,c.relname FROM pg_temp.atry_purge_rows r JOIN pg_class c ON c.oid=r.rel JOIN pg_namespace n ON n.oid=c.relnamespace GROUP BY r.rel,n.nspname,c.relname ORDER BY n.nspname,c.relname LOOP
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=t.rel AND attname='business_id' AND NOT attisdropped) THEN
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I d JOIN pg_temp.atry_purge_rows r ON r.rel=%s AND r.tuple=d.ctid::text WHERE d.business_id IS NOT NULL AND d.business_id<>$1)',t.nspname,t.relname,t.rel) INTO crossed USING bid;
   IF crossed THEN RAISE EXCEPTION 'CROSS_BUSINESS_DEPENDENCY';END IF;
  END IF;
  EXECUTE format('SELECT count(*),coalesce(string_agg(to_jsonb(d)::text,''|'' ORDER BY d.ctid::text),'''') FROM %I.%I d JOIN pg_temp.atry_purge_rows r ON r.rel=%s AND r.tuple=d.ctid::text',t.nspname,t.relname,t.rel) INTO count_rows,part;
  counts:=counts||jsonb_build_object(t.nspname||'.'||t.relname,count_rows);content:=content||t.nspname||'.'||t.relname||part;
 END LOOP;
 RETURN jsonb_build_object('id',business.id,'name',business.name,'slug',business.slug,'counts',counts,'token',private.hash(content),'total',(SELECT count(*) FROM pg_temp.atry_purge_rows),'execution_enabled',NOT EXISTS(SELECT 1 FROM public.mail_jobs WHERE business_id=bid AND state='processing'),'accounts_preserved',true);
END $$;
REVOKE ALL ON FUNCTION private.business_purge_plan(text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atry_business_delete_preview(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_column
BEGIN RETURN jsonb_build_object('checked_at',now(),'data',private.business_purge_plan(bid));END $$;
CREATE FUNCTION public.atry_delete_business(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_column
DECLARE uid text:=private.require_admin();data jsonb;key text:=payload->>'request_id';digest text:=private.hash(jsonb_build_object('business',bid,'payload',payload-'request_id')::text);previous private.control_events;t record;pending int;removed int;operation text:=gen_random_uuid()::text;objects_exist boolean:=false;
BEGIN
 PERFORM private.control_stepup();IF key IS NULL OR key!~'^[A-Za-z0-9_-]{16,100}$' OR length(btrim(coalesce(payload->>'reason',''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'REASON_REQUIRED';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('business-delete:'||key,0));SELECT * INTO previous FROM private.control_events WHERE request_key=key;
 IF FOUND THEN IF previous.actor_id<>uid OR previous.request_hash<>digest THEN RAISE EXCEPTION 'IDEMPOTENCY_MISMATCH';END IF;RETURN jsonb_build_object('ok',true,'operation_id',previous.id,'replayed',true);END IF;
 IF (SELECT count(*) FROM private.control_events WHERE actor_id=uid AND created_at>now()-interval '1 minute')>=30 THEN RAISE EXCEPTION 'ADMIN_RATE_LIMIT';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 PERFORM 1 FROM public.mail_jobs WHERE business_id=bid FOR UPDATE;
 data:=private.business_purge_plan(bid);
 IF payload->>'confirm_slug' IS DISTINCT FROM data->>'slug' OR payload->>'preview_token' IS DISTINCT FROM data->>'token' THEN RAISE EXCEPTION 'DELETE_PREVIEW_CHANGED';END IF;
 IF NOT (data->>'execution_enabled')::boolean THEN RAISE EXCEPTION 'MAIL_PROCESSING';END IF;
 IF to_regclass('storage.objects') IS NOT NULL THEN EXECUTE 'SELECT EXISTS(SELECT 1 FROM storage.objects WHERE metadata->>''business_id''=$1 OR name LIKE ''businesses/''||$1||''/%'')' INTO objects_exist USING bid;END IF;
 IF objects_exist THEN RAISE EXCEPTION 'STORAGE_CLEANUP_REQUIRED';END IF;
 PERFORM set_config('atry.business_purge',bid,true);
 LOOP
  SELECT count(*) INTO pending FROM pg_temp.atry_purge_rows;EXIT WHEN pending=0;removed:=0;
  FOR t IN SELECT DISTINCT r.rel,n.nspname,c.relname FROM pg_temp.atry_purge_rows r JOIN pg_class c ON c.oid=r.rel JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT EXISTS(SELECT 1 FROM pg_constraint fk WHERE fk.contype='f' AND fk.confrelid=r.rel AND fk.conrelid<>r.rel AND EXISTS(SELECT 1 FROM pg_temp.atry_purge_rows child WHERE child.rel=fk.conrelid)) LOOP
   EXECUTE format('DELETE FROM %I.%I d USING pg_temp.atry_purge_rows r WHERE r.rel=%s AND r.tuple=d.ctid::text',t.nspname,t.relname,t.rel);
   DELETE FROM pg_temp.atry_purge_rows WHERE rel=t.rel;removed:=removed+1;
  END LOOP;
  IF removed=0 THEN RAISE EXCEPTION 'UNRESOLVED_DELETE_DEPENDENCY';END IF;
 END LOOP;
 PERFORM set_config('atry.business_purge','',true);
 INSERT INTO private.control_events(id,actor_id,action,entity_id,business_id,reason,after_state,request_key,request_hash) VALUES(operation,uid,'business.deleted','deleted-business',NULL,'Eliminación definitiva confirmada',jsonb_build_object('deleted',true,'counts',data->'counts','accounts_preserved',true),key,digest);
 RETURN jsonb_build_object('ok',true,'operation_id',operation,'after',jsonb_build_object('deleted',true,'counts',data->'counts','accounts_preserved',true));
END $$;
REVOKE ALL ON FUNCTION public.atry_business_delete_preview(text),public.atry_delete_business(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.atry_business_delete_preview(text),public.atry_delete_business(text,jsonb) TO authenticated;
-- Expose capability only after this migration is installed; older servers stay usable.
ALTER FUNCTION public.atry_control_read(text,jsonb) RENAME TO control_read_delete_base;
ALTER FUNCTION public.control_read_delete_base(text,jsonb) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.control_read_delete_base(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atry_control_read(section text,params jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 result:=private.control_read_delete_base(section,params);
 IF section='business' THEN result:=jsonb_set(result,'{data,deletion_enabled}','true'::jsonb);END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.atry_control_read(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.atry_control_read(text,jsonb) TO authenticated;
