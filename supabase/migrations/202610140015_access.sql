-- Invitations bind to a verified Auth identity; matching metadata is never sufficient.
CREATE TABLE private.invitation_tokens(invitation_id text PRIMARY KEY REFERENCES public.invitations(id),token text NOT NULL);
ALTER TABLE private.invitation_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.invitation_tokens FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atry_profile(name text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN
 IF private.user_id() IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF name IS NULL OR length(btrim(name)) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'INVALID_NAME';END IF;
 UPDATE public.users SET name=btrim(name) WHERE id=private.user_id();RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION private.sync_auth_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email_confirmed_at IS NOT NULL THEN UPDATE public.users SET email=NEW.email WHERE auth_user_id=NEW.id;END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER attry_auth_email_sync AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION private.sync_auth_email();
CREATE FUNCTION public.atry_access(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN
 IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('members',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'role',m.role,'staff_id',(SELECT s.id FROM public.staff s WHERE s.business_id=bid AND s.user_id=u.id LIMIT 1))) FROM public.memberships m JOIN public.users u ON u.id=m.user_id WHERE m.business_id=bid),'[]'::jsonb),'invitations',coalesce((SELECT jsonb_agg(to_jsonb(i)-'token_hash'-'created_by') FROM public.invitations i WHERE i.business_id=bid),'[]'::jsonb));
END $$;
CREATE FUNCTION public.atry_invite(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE iid text:=gen_random_uuid()::text;token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');email text:=lower(btrim(payload->>'email'));role text:=payload->>'role';sid text:=nullif(payload->>'staff_id','');
BEGIN
 IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 IF email IS NULL OR email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(email)>150 OR coalesce(role,'') NOT IN ('manager','staff') THEN RAISE EXCEPTION 'INVALID_INVITATION';END IF;
 IF EXISTS(SELECT 1 FROM public.memberships m JOIN public.users u ON u.id=m.user_id WHERE m.business_id=bid AND lower(u.email)=email) THEN RAISE EXCEPTION 'ALREADY_MEMBER';END IF;
 IF role='staff' AND NOT EXISTS(SELECT 1 FROM public.staff WHERE id=sid AND business_id=bid AND active=1 AND user_id IS NULL) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
 UPDATE public.invitations SET revoked_at=now() WHERE business_id=bid AND lower(invitations.email)=email AND accepted_at IS NULL AND revoked_at IS NULL;
 INSERT INTO public.invitations VALUES(iid,bid,email,role,CASE WHEN role='staff' THEN sid ELSE NULL END,private.hash(token),now()+interval '48 hours',null,null,private.user_id(),now());
 INSERT INTO private.invitation_tokens VALUES(iid,token);
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'invitation.created','invitation',iid,now());
 RETURN jsonb_build_object('id',iid,'delivery','pending_configuration');
END $$;
CREATE FUNCTION public.atry_revoke_invitation(bid text,invitation_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
BEGIN
 IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 UPDATE public.invitations SET revoked_at=now() WHERE id=invitation_id AND business_id=bid AND accepted_at IS NULL AND revoked_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_UNAVAILABLE';END IF;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'invitation.revoked','invitation',invitation_id,now());RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION public.atry_invitation(token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE i public.invitations;
BEGIN
 IF coalesce(token,'')!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT * INTO i FROM public.invitations WHERE token_hash=private.hash(token) AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now();
 IF i.id IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 RETURN jsonb_build_object('email',i.email,'business_name',(SELECT name FROM public.businesses WHERE id=i.business_id),'role',i.role,'expires_at',i.expires_at,'has_account',EXISTS(SELECT 1 FROM public.users WHERE lower(email)=lower(i.email)));
END $$;
CREATE FUNCTION public.atry_accept_invitation(token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE i public.invitations;uid text:=private.user_id();verified_email text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT lower(email) INTO verified_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 IF verified_email IS NULL OR coalesce(token,'')!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'VERIFIED_EMAIL_REQUIRED';END IF;
 SELECT * INTO i FROM public.invitations WHERE token_hash=private.hash(token);
 IF i.id IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 PERFORM 1 FROM public.businesses WHERE id=i.business_id FOR UPDATE;
 SELECT * INTO i FROM public.invitations WHERE id=i.id FOR UPDATE;
 IF i.accepted_at IS NOT NULL OR i.revoked_at IS NOT NULL OR i.expires_at<=now() THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 IF lower(i.email)<>verified_email THEN RAISE EXCEPTION 'WRONG_ACCOUNT' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM public.memberships WHERE business_id=i.business_id AND user_id=uid) THEN RAISE EXCEPTION 'ALREADY_MEMBER';END IF;
 IF i.role='staff' THEN
  UPDATE public.staff SET user_id=uid WHERE id=i.staff_id AND business_id=i.business_id AND active=1 AND user_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;
 END IF;
 INSERT INTO public.memberships VALUES(uid,i.business_id,i.role);
 UPDATE public.invitations SET accepted_at=now() WHERE id=i.id;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,i.business_id,uid,'invitation.accepted','invitation',i.id,now());RETURN jsonb_build_object('business_id',i.business_id,'email',verified_email);
END $$;
REVOKE ALL ON FUNCTION private.sync_auth_email() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.atry_profile(text),public.atry_access(text),public.atry_invite(text,jsonb),public.atry_revoke_invitation(text,text),public.atry_accept_invitation(text),public.atry_invitation(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atry_profile(text),public.atry_access(text),public.atry_invite(text,jsonb),public.atry_revoke_invitation(text,text),public.atry_accept_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atry_invitation(text) TO service_role;
