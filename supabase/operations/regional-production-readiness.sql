-- READ ONLY: select the EXISTING ATRY Turnos project djoxdtloqwbrhgtgencc in Dashboard first.
-- No application RPCs, user rows, secrets, backups, migrations or writes are invoked.
-- Returns one JSON row for offline comparison. The label is not proof of the connection target.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
WITH
functions AS (
 SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS args,
 md5(regexp_replace(pg_get_functiondef(p.oid),'[[:space:]]','','g')) AS hash,
 p.prosecdef AS security_definer,p.proconfig AS settings,
 coalesce((SELECT jsonb_agg(jsonb_build_object('role',coalesce(r.rolname,'PUBLIC'),'privilege',a.privilege_type) ORDER BY coalesce(r.rolname,'PUBLIC'),a.privilege_type) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a LEFT JOIN pg_roles r ON r.oid=a.grantee),'[]') AS grants
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private') AND p.prokind='f'
),
relations AS (
 SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls,
 pg_total_relation_size(c.oid) AS bytes,c.reltuples::bigint AS estimated_rows
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private') AND c.relkind='r'
),
columns AS (
 SELECT table_schema AS schema,table_name AS relation,column_name AS name,data_type,udt_name,is_nullable,column_default,ordinal_position
 FROM information_schema.columns WHERE table_schema IN ('public','private')
),
policies AS (
 SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','storage')
),
constraints AS (
 SELECT n.nspname AS schema,c.relname AS relation,k.conname AS name,pg_get_constraintdef(k.oid) AS definition
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private')
),
privileges AS (
 SELECT n.nspname AS schema,c.relname AS relation,coalesce(r.rolname,'PUBLIC') AS grantee,a.privilege_type,a.is_grantable
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a LEFT JOIN pg_roles r ON r.oid=a.grantee
 WHERE n.nspname IN ('public','private') AND c.relkind='r'
),
triggers AS (
 SELECT n.nspname AS schema,c.relname AS relation,t.tgname AS name,pg_get_triggerdef(t.oid) AS definition
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','private','auth','storage')
)
SELECT jsonb_build_object(
 'captured_at',now(),'database_version',version(),
 'functions',(SELECT jsonb_agg(to_jsonb(f) ORDER BY schema,name,args) FROM functions f),
 'relations',(SELECT jsonb_agg(to_jsonb(r) ORDER BY schema,name) FROM relations r),
 'columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY schema,relation,ordinal_position) FROM columns c),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM policies p),
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY schema,relation,name) FROM constraints c),
 'privileges',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schema,relation,grantee,privilege_type) FROM privileges p),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY schema,relation,name) FROM triggers t),
 'schema_grants',(SELECT jsonb_agg(jsonb_build_object('schema',nspname,'grants',nspacl::text) ORDER BY nspname) FROM pg_namespace WHERE nspname IN ('public','private')),
 'extensions',(SELECT jsonb_agg(jsonb_build_object('name',extname,'version',extversion) ORDER BY extname) FROM pg_extension),
 'timezone_summary',(SELECT jsonb_agg(x) FROM (SELECT timezone,count(*) AS businesses FROM public.businesses GROUP BY timezone ORDER BY timezone)x),
 'region_summary',(SELECT jsonb_agg(x) FROM (SELECT coalesce(to_jsonb(b)->>'country','UY') AS country,coalesce(to_jsonb(b)->>'currency','UYU') AS currency,count(*) FROM public.businesses b GROUP BY 1,2 ORDER BY 1,2)x),
 'money_summary',jsonb_build_object(
  'services',(SELECT jsonb_build_object('rows',count(*),'invalid_uyu',count(*) FILTER(WHERE price_uyu IS NULL OR price_uyu<0 OR price_uyu::numeric<>trunc(price_uyu::numeric)),'total_uyu',coalesce(sum(price_uyu::numeric),0)) FROM public.services),
  'bookings',(SELECT jsonb_build_object('rows',count(*),'invalid_uyu',count(*) FILTER(WHERE price_uyu IS NULL OR price_uyu<0 OR price_uyu::numeric<>trunc(price_uyu::numeric)),'total_uyu',coalesce(sum(price_uyu::numeric),0)) FROM public.bookings)),
 'regional_flags',(SELECT jsonb_build_object('registration',to_jsonb(s)->'pa_registration_enabled','public',to_jsonb(s)->'pa_public_enabled') FROM private.runtime_settings s WHERE id=1),
 'migration_history_present',to_regclass('supabase_migrations.schema_migrations') IS NOT NULL
) AS regional_readiness;
ROLLBACK;
