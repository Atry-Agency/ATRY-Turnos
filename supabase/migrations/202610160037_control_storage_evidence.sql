-- Live, aggregate evidence only; never exposes object names, owners or cron commands.
ALTER FUNCTION public.atry_control_read(text,jsonb) RENAME TO control_read_operations;
ALTER FUNCTION public.control_read_operations(text,jsonb) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.control_read_operations(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atry_control_read(section text,params jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE data jsonb;objects jsonb;schedule jsonb;
BEGIN
 PERFORM private.require_admin();data:=private.control_read_operations(section,params);
 IF section='storage' AND to_regclass('storage.objects') IS NOT NULL THEN
  EXECUTE 'SELECT jsonb_build_object(''objects'',count(*),''reported_bytes'',coalesce(sum(CASE WHEN metadata->>''size'' ~ ''^[0-9]{1,18}$'' THEN (metadata->>''size'')::bigint ELSE 0 END),0),''unknown_sizes'',count(*) FILTER(WHERE metadata->>''size'' IS NULL OR metadata->>''size'' !~ ''^[0-9]{1,18}$'')) FROM storage.objects' INTO objects;
  data:=data||jsonb_build_object('storage',objects,'storage_bytes',CASE WHEN (objects->>'unknown_sizes')::bigint=0 THEN objects->'reported_bytes' ELSE NULL END);
 ELSIF section='system' AND to_regclass('cron.job') IS NOT NULL THEN
  EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''name'',jobname,''schedule'',schedule,''active'',active)),''[]''::jsonb) FROM cron.job WHERE jobname=''atry-turnos-mail''' INTO schedule;
  data:=data||jsonb_build_object('mail_schedule',schedule);
 END IF;
 RETURN data;
END $$;
REVOKE ALL ON FUNCTION public.atry_control_read(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.atry_control_read(text,jsonb) TO authenticated;
