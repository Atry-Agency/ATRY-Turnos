CREATE FUNCTION public.atry_health() RETURNS jsonb LANGUAGE sql SET search_path='' AS $$ SELECT jsonb_build_object('status','ok','app','Atry Turnos','version','1.2.0','backend','supabase','server_time',now()) $$;
REVOKE ALL ON FUNCTION public.atry_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atry_health() TO anon,authenticated,service_role;
CREATE FUNCTION public.atry_access_context(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN RETURN jsonb_build_object('user_valid',private.user_id() IS NOT NULL,'role',private.member_role(bid),'staff_id',(SELECT id FROM public.staff WHERE business_id=bid AND private.own_staff(id) LIMIT 1));END $$;
CREATE OR REPLACE FUNCTION public.atry_update_member(bid text,member_id text,patch jsonb,remove boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE old public.memberships;new_role text;sid text;
BEGIN
 IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;SELECT * INTO old FROM public.memberships WHERE business_id=bid AND user_id=member_id;
 IF old.user_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 new_role:=coalesce(patch->>'role',old.role);IF new_role NOT IN ('owner','manager','staff') THEN RAISE EXCEPTION 'INVALID_ROLE';END IF;
 IF old.role='owner' AND (remove OR new_role<>'owner') AND (SELECT count(*) FROM public.memberships WHERE business_id=bid AND role='owner')<=1 THEN RAISE EXCEPTION 'LAST_OWNER';END IF;
 IF remove THEN DELETE FROM public.memberships WHERE business_id=bid AND user_id=member_id;UPDATE public.staff SET user_id=null WHERE business_id=bid AND user_id=member_id;
 ELSE
  IF patch?'staff_id' THEN sid:=nullif(patch->>'staff_id','');ELSE SELECT id INTO sid FROM public.staff WHERE business_id=bid AND user_id=member_id AND active=1 LIMIT 1;END IF;
  IF new_role='staff' AND sid IS NULL THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
  IF sid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.staff WHERE id=sid AND business_id=bid AND active=1 AND (user_id IS NULL OR user_id=member_id)) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
  UPDATE public.memberships SET role=new_role WHERE business_id=bid AND user_id=member_id;
  IF patch?'staff_id' OR new_role='staff' THEN UPDATE public.staff SET user_id=null WHERE business_id=bid AND user_id=member_id;IF sid IS NOT NULL THEN UPDATE public.staff SET user_id=member_id WHERE id=sid AND business_id=bid;END IF;END IF;
 END IF;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),CASE WHEN remove THEN 'member.removed' ELSE 'member.updated' END,'membership',member_id,now());RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.atry_access_context(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_access_context(text) TO authenticated;
REVOKE ALL ON FUNCTION private.new_auth_user() FROM PUBLIC,anon,authenticated,service_role;
