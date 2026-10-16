-- Legacy reports is a compatibility flag; each modern report module keeps its own entitlement.
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.atry_admin_save_plan(text,jsonb)'::regprocedure) INTO src;
 src:=replace(src,'reports=(f->>''advanced'')::boolean::int','reports=((f->>''advanced'')::boolean OR (f->>''exports'')::boolean)::int');EXECUTE src;
END $$;
