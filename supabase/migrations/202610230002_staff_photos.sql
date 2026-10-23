-- Profile photographs. Private Storage bucket, optional public reads checked on every download.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE public.staff_photos(staff_id text PRIMARY KEY,business_id text NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,path text NOT NULL UNIQUE,show_public boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 1,FOREIGN KEY(staff_id,business_id) REFERENCES public.staff(id,business_id) ON DELETE CASCADE);
CREATE INDEX staff_photos_business ON public.staff_photos(business_id);
ALTER TABLE public.staff_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_photos FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('staff-photos','staff-photos',false,65536,ARRAY['image/webp']);

CREATE FUNCTION public.staff_photo_storage_access(object_path text,writing boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE bid text:=split_part(object_path,'/',1);sid text:=split_part(object_path,'/',2);r text;
BEGIN
 IF object_path!~'^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\.webp$' OR NOT EXISTS(SELECT 1 FROM public.staff WHERE id=sid AND business_id=bid) THEN RETURN false;END IF;
 IF NOT writing AND EXISTS(SELECT 1 FROM public.staff_photos p JOIN public.staff s ON s.id=p.staff_id JOIN public.businesses b ON b.id=p.business_id WHERE p.path=object_path AND p.show_public AND s.active=1 AND b.is_active=1) THEN RETURN true;END IF;
 IF auth.uid() IS NULL THEN RETURN false;END IF;
 r:=private.member_role(bid);
 RETURN CASE WHEN writing THEN coalesce(r IN ('owner','manager'),false) ELSE coalesce(r IN ('owner','manager','staff'),false) END;
END $$;
REVOKE ALL ON FUNCTION public.staff_photo_storage_access(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_photo_storage_access(text,boolean) TO anon,authenticated;
CREATE POLICY staff_photo_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='staff-photos' AND public.staff_photo_storage_access(name,false));
CREATE POLICY staff_photo_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='staff-photos' AND public.staff_photo_storage_access(name,true));
CREATE POLICY staff_photo_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='staff-photos' AND public.staff_photo_storage_access(name,true));
-- Restrictive fences keep any pre-existing broad policies from opening this private bucket.
CREATE POLICY staff_photo_read_fence ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC USING(bucket_id<>'staff-photos' OR public.staff_photo_storage_access(name,false));
CREATE POLICY staff_photo_insert_fence ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(bucket_id<>'staff-photos' OR public.staff_photo_storage_access(name,true));
CREATE POLICY staff_photo_update_fence ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(bucket_id<>'staff-photos') WITH CHECK(bucket_id<>'staff-photos');
CREATE POLICY staff_photo_delete_fence ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC USING(bucket_id<>'staff-photos' OR public.staff_photo_storage_access(name,true));

CREATE FUNCTION public.atry_staff_photos(bid text,public_view boolean DEFAULT false,sid text DEFAULT NULL,payload jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text;old_revision integer;old_path text;new_path text;result jsonb;
BEGIN
 IF NOT public_view OR payload IS NOT NULL THEN
  r:=private.member_role(bid);IF coalesce(r,'') NOT IN ('owner','manager','staff') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 END IF;
 IF payload IS NULL THEN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.staff_photos p JOIN public.staff s ON s.id=p.staff_id JOIN public.businesses b ON b.id=p.business_id WHERE p.business_id=bid AND (NOT public_view OR p.show_public AND s.active=1 AND b.is_active=1)),'[]');
 END IF;
 IF r NOT IN ('owner','manager') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.staff WHERE id=sid AND business_id=bid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 SELECT path,revision INTO old_path,old_revision FROM public.staff_photos WHERE staff_id=sid AND business_id=bid;
 IF NOT(payload ? 'expected_path') OR (payload->>'expected_path') IS DISTINCT FROM old_path OR coalesce((payload->>'expected_revision')::integer,-1)<>coalesce(old_revision,0) THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
 IF jsonb_typeof(payload->'show_public') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'INVALID_VISIBILITY';END IF;
 new_path:=CASE WHEN payload ? 'path' THEN payload->>'path' ELSE old_path END;
 IF new_path IS NULL THEN DELETE FROM public.staff_photos WHERE staff_id=sid AND business_id=bid;
 ELSE
  IF split_part(new_path,'/',1)<>bid OR split_part(new_path,'/',2)<>sid OR NOT public.staff_photo_storage_access(new_path,true) THEN RAISE EXCEPTION 'INVALID_PHOTO_PATH';END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='staff-photos' AND name=new_path AND metadata->>'mimetype'='image/webp' AND (metadata->>'size')::bigint BETWEEN 16 AND 65536) THEN RAISE EXCEPTION 'INVALID_PHOTO_OBJECT';END IF;
  INSERT INTO public.staff_photos VALUES(sid,bid,new_path,(payload->>'show_public')::boolean,coalesce(old_revision,0)+1) ON CONFLICT(staff_id) DO UPDATE SET path=excluded.path,show_public=excluded.show_public,revision=excluded.revision;
 END IF;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'staff.photo.updated','staff',sid,now());
 SELECT to_jsonb(p) INTO result FROM public.staff_photos p WHERE staff_id=sid AND business_id=bid;
 RETURN jsonb_build_object('photo',result,'old_path',old_path);
END $$;
REVOKE ALL ON FUNCTION public.atry_staff_photos(text,boolean,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.atry_staff_photos(text,boolean,text,jsonb) TO anon,authenticated;
COMMIT;
