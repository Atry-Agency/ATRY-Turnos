-- Account/organization RPCs. No trust in roles supplied through user metadata.
CREATE FUNCTION public.atry_me() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u public.users;
BEGIN
 SELECT * INTO u FROM public.users WHERE auth_user_id=auth.uid();IF u.id IS NULL THEN RETURN jsonb_build_object('user',null,'businesses','[]'::jsonb);END IF;
 RETURN jsonb_build_object('user',jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'platform_admin',u.platform_admin),'businesses',coalesce((SELECT jsonb_agg(to_jsonb(b)||jsonb_build_object('role',m.role,'staff_id',(SELECT id FROM public.staff WHERE business_id=b.id AND user_id=u.id AND active=1 LIMIT 1))) FROM public.businesses b JOIN public.memberships m ON m.business_id=b.id WHERE m.user_id=u.id),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.atry_me() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_me() TO authenticated;
CREATE FUNCTION public.atry_create_organization(payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text:=private.user_id();u public.users;bid text:=gen_random_uuid()::text;sid text:=gen_random_uuid()::text;name text:=btrim(payload->>'name');slug text:=lower(btrim(payload->>'slug'));
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO u FROM public.users WHERE id=uid FOR UPDATE;
 IF (SELECT count(*) FROM public.memberships WHERE user_id=uid AND role='owner')>=10 THEN RAISE EXCEPTION 'ORGANIZATION_LIMIT';END IF;
 IF name IS NULL OR length(name)<2 OR length(name)>100 OR slug IS NULL OR slug!~'^[a-z0-9][a-z0-9-]{1,53}[a-z0-9]$' THEN RAISE EXCEPTION 'INVALID_ORGANIZATION';END IF;
 INSERT INTO public.businesses(id,slug,name,email,trial_until,created_at) VALUES(bid,slug,name,u.email,now()+interval '14 days',now());
 INSERT INTO public.memberships VALUES(uid,bid,'owner');
 INSERT INTO public.staff(id,business_id,user_id,name,email,created_at) VALUES(sid,bid,uid,u.name,u.email,now());
 INSERT INTO public.working_hours SELECT sid,d,540,1080 FROM generate_series(1,6) d;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,uid,'business.created','business',bid,now());
 RETURN jsonb_build_object('id',bid,'name',name,'slug',slug);
END $$;
REVOKE ALL ON FUNCTION public.atry_create_organization(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_create_organization(jsonb) TO authenticated;
CREATE FUNCTION public.atry_update_member(bid text,member_id text,patch jsonb,remove boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE old public.memberships;new_role text;sid text;
BEGIN
 IF private.member_role(bid)<>'owner' OR private.member_role(bid) IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 SELECT * INTO old FROM public.memberships WHERE business_id=bid AND user_id=member_id;
 IF old.user_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 new_role:=coalesce(patch->>'role',old.role);
 IF new_role NOT IN ('owner','manager','staff') THEN RAISE EXCEPTION 'INVALID_ROLE';END IF;
 IF old.role='owner' AND (remove OR new_role<>'owner') AND (SELECT count(*) FROM public.memberships WHERE business_id=bid AND role='owner')<=1 THEN RAISE EXCEPTION 'LAST_OWNER';END IF;
 IF remove THEN DELETE FROM public.memberships WHERE business_id=bid AND user_id=member_id;UPDATE public.staff SET user_id=null WHERE business_id=bid AND user_id=member_id;
 ELSE
  sid:=patch->>'staff_id';IF sid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.staff WHERE id=sid AND business_id=bid AND active=1 AND (user_id IS NULL OR user_id=member_id)) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
  UPDATE public.memberships SET role=new_role WHERE business_id=bid AND user_id=member_id;
  IF patch ? 'staff_id' THEN UPDATE public.staff SET user_id=null WHERE business_id=bid AND user_id=member_id;IF sid IS NOT NULL THEN UPDATE public.staff SET user_id=member_id WHERE id=sid AND business_id=bid;END IF;END IF;
 END IF;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),CASE WHEN remove THEN 'member.removed' ELSE 'member.updated' END,'membership',member_id,now());RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.atry_update_member(text,text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_update_member(text,text,jsonb,boolean) TO authenticated;
