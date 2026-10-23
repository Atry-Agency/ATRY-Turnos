-- Read only. Expected: private bucket, metadata RLS and no direct API table access.
BEGIN READ ONLY;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='staff-photos';
SELECT relrowsecurity FROM pg_class WHERE oid='public.staff_photos'::regclass;
SELECT role,has_table_privilege(role,'public.staff_photos','SELECT') direct_read,has_table_privilege(role,'public.staff_photos','INSERT') direct_write,has_function_privilege(role,'public.atry_staff_photos(text,boolean,text,jsonb)','EXECUTE') rpc FROM unnest(ARRAY['anon','authenticated','service_role']) role;
SELECT policyname,permissive,roles,cmd FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'staff_photo_%' ORDER BY policyname;
SELECT business_id,count(*) photos,count(*) FILTER(WHERE show_public) public_photos FROM public.staff_photos GROUP BY business_id;
COMMIT;
