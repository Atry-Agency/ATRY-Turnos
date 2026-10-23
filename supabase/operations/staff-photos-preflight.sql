-- Read only. Run against the explicitly selected staging/production project before approval.
BEGIN READ ONLY;
SELECT to_regclass('storage.buckets') buckets,to_regclass('storage.objects') objects,to_regclass('public.staff_photos') unexpected_photo_table;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='staff-photos';
SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass;
SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.staff'::regclass AND contype IN ('p','u');
SELECT to_regprocedure('private.member_role(text)'),to_regprocedure('private.user_id()'),to_regprocedure('auth.uid()');
SELECT policyname,permissive,roles,cmd FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
COMMIT;
