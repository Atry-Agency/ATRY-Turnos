-- JWT validity alone is insufficient for immediate logout/revocation.
-- Verify the corresponding live Auth session on every private authorization path.
CREATE OR REPLACE FUNCTION private.user_id() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT u.id FROM public.users u WHERE u.auth_user_id=auth.uid() AND EXISTS(
  SELECT 1 FROM auth.sessions s WHERE s.user_id=u.auth_user_id AND s.id::text=auth.jwt()->>'session_id'
  AND s.created_at>now()-interval '7 days' AND (s.not_after IS NULL OR s.not_after>now())
 )
$$;
DROP POLICY self_read ON users;
CREATE POLICY self_read ON users FOR SELECT TO authenticated USING(id=private.user_id());
CREATE OR REPLACE FUNCTION public.atry_me() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u public.users;
BEGIN
 SELECT * INTO u FROM public.users WHERE id=private.user_id();IF u.id IS NULL THEN RETURN jsonb_build_object('user',null,'businesses','[]'::jsonb);END IF;
 RETURN jsonb_build_object('user',jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'platform_admin',u.platform_admin),'businesses',coalesce((SELECT jsonb_agg(to_jsonb(b)||jsonb_build_object('role',m.role,'staff_id',(SELECT id FROM public.staff WHERE business_id=b.id AND user_id=u.id AND active=1 LIMIT 1))) FROM public.businesses b JOIN public.memberships m ON m.business_id=b.id WHERE m.user_id=u.id),'[]'::jsonb));
END $$;
CREATE FUNCTION public.atry_sessions() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF private.user_id() IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'created_at',s.created_at,'expires_at',least(coalesce(s.not_after,s.created_at+interval '7 days'),s.created_at+interval '7 days'),'current',s.id::text=auth.jwt()->>'session_id')) FROM auth.sessions s WHERE s.user_id=auth.uid() AND s.created_at>now()-interval '7 days' AND (s.not_after IS NULL OR s.not_after>now())),'[]'::jsonb);
END $$;
CREATE FUNCTION public.atry_revoke_session(session_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF private.user_id() IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 DELETE FROM auth.sessions WHERE id::text=session_id AND user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.atry_sessions(),public.atry_revoke_session(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_sessions(),public.atry_revoke_session(text) TO authenticated;
