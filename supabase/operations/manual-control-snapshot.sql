-- One-time read-only snapshot. ONLY project djoxdtloqwbrhgtgencc.
-- Export the complete result as JSON to a private local folder outside Git.
-- Contains private application data and token records: never commit the export.
-- Scope: public/private table rows, Auth users/identities, Storage metadata,
-- function definitions, policies, triggers and column metadata.
-- Excludes Vault secrets, session/refresh tokens, provider configuration,
-- physical Storage object bytes and platform configuration. Not a full project backup.
WITH tables AS (
 SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind='r' AND (n.nspname IN ('public','private','storage') OR (n.nspname='auth' AND c.relname IN ('users','identities')))
), rows AS (
 SELECT 'table' AS kind,t.nspname||'.'||t.relname AS name,x.data::jsonb AS data
 FROM tables t CROSS JOIN LATERAL XMLTABLE('/table/row' PASSING query_to_xml(format('SELECT coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb)::text AS data FROM %I.%I r',t.nspname,t.relname),true,false,'') COLUMNS data text PATH 'data') x
), functions AS (
 SELECT 'function' AS kind,n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS name,to_jsonb(pg_get_functiondef(p.oid)) AS data
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.prokind='f'
), metadata AS (
 SELECT 'metadata' AS kind,'columns' AS name,coalesce(jsonb_agg(to_jsonb(c)),'[]') AS data FROM information_schema.columns c WHERE table_schema IN ('public','private')
 UNION ALL SELECT 'metadata','policies',coalesce(jsonb_agg(to_jsonb(p)),'[]') FROM pg_policies p WHERE schemaname IN ('public','private')
 UNION ALL SELECT 'metadata','triggers',coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'definition',pg_get_triggerdef(t.oid))),'[]') FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private') AND NOT t.tgisinternal
)
SELECT jsonb_build_object('project','djoxdtloqwbrhgtgencc','captured_at',now(),'entries',(SELECT jsonb_agg(to_jsonb(e) ORDER BY kind,name) FROM (SELECT * FROM rows UNION ALL SELECT * FROM functions UNION ALL SELECT * FROM metadata)e)) AS snapshot;
