-- Solo metadatos y huellas: no lee filas de clientes, usuarios o reservas.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
WITH metadata(category, item) AS (
 SELECT 'columnas', jsonb_build_array(table_schema,table_name,column_name,udt_name,is_nullable,column_default)::text
 FROM information_schema.columns WHERE table_schema IN ('public','private')
 UNION ALL
 SELECT 'funciones', jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid),p.prosecdef,p.proconfig)::text
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private') AND p.prokind='f'
 UNION ALL
 SELECT 'politicas', jsonb_build_array(schemaname,tablename,policyname,roles,cmd,qual,with_check)::text
 FROM pg_policies WHERE schemaname IN ('public','private','storage')
 UNION ALL
 SELECT 'rls', jsonb_build_array(n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity)::text
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p')
 UNION ALL
 SELECT 'permisos', jsonb_build_array(n.nspname,c.relname,c.relacl::text)::text
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private')
 UNION ALL
 SELECT 'permisos_funciones', jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.proacl::text)::text
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.prokind='f'
 UNION ALL
 SELECT 'restricciones', jsonb_build_array(n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid))::text
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private')
 UNION ALL
 SELECT 'triggers', jsonb_build_array(n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid),t.tgenabled)::text
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal AND n.nspname IN ('public','private','auth','storage')
 UNION ALL
 SELECT 'extensiones', jsonb_build_array(extname,extversion)::text FROM pg_extension
)
SELECT category AS categoria,count(*) AS cantidad,md5(string_agg(item,E'\n' ORDER BY item COLLATE "C")) AS huella
FROM metadata GROUP BY category
UNION ALL SELECT 'postgresql',1,current_setting('server_version')
ORDER BY categoria;
ROLLBACK;
