-- Misión 006: additive, scoped appearance. Existing colours/logos remain unchanged.
ALTER TABLE public.businesses
 ADD COLUMN secondary_color text NOT NULL DEFAULT '#00A5E2' CHECK (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
 ADD COLUMN appearance_mode text NOT NULL DEFAULT 'light' CHECK (appearance_mode IN ('light','dark'));

CREATE FUNCTION public.atry_save_appearance(bid text,payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE b public.businesses;primary_value text;secondary_value text;mode_value text;logo_value text;
BEGIN
 IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(payload) IS DISTINCT FROM 'object' OR
    EXISTS(SELECT 1 FROM jsonb_object_keys(payload) key WHERE key NOT IN ('primary_color','secondary_color','appearance_mode','logo_url'))
 THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
 SELECT * INTO b FROM public.businesses WHERE id=bid FOR UPDATE;
 IF b.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 primary_value:=coalesce(payload->>'primary_color',b.primary_color);
 secondary_value:=coalesce(payload->>'secondary_color',b.secondary_color);
 mode_value:=coalesce(payload->>'appearance_mode',b.appearance_mode);
 logo_value:=coalesce(payload->>'logo_url',b.logo_url);
 IF primary_value!~'^#[0-9a-fA-F]{6}$' OR secondary_value!~'^#[0-9a-fA-F]{6}$' OR mode_value NOT IN ('light','dark') OR
    length(logo_value)>140000 OR (logo_value<>'' AND logo_value!~'^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')
 THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
 UPDATE public.businesses SET primary_color=upper(primary_value),secondary_color=upper(secondary_value),appearance_mode=mode_value,logo_url=logo_value WHERE id=bid;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'business.appearance.updated','business',bid,now());
 RETURN public.atry_business(bid);
END $$;
REVOKE ALL ON FUNCTION public.atry_save_appearance(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_save_appearance(text,jsonb) TO authenticated;

-- Patch the current definition so subscription, plan and pause guards remain intact.
DO $$ DECLARE source_sql text;BEGIN
 SELECT pg_get_functiondef('public.atry_public_info(text)'::regprocedure) INTO source_sql;
 IF position('''primary_color'',b.primary_color,''logo_url''' IN source_sql)=0 THEN RAISE EXCEPTION 'PUBLIC_APPEARANCE_PATCH_MISMATCH';END IF;
 source_sql:=replace(source_sql,'''primary_color'',b.primary_color,''logo_url''','''primary_color'',b.primary_color,''secondary_color'',b.secondary_color,''appearance_mode'',b.appearance_mode,''logo_url''');
 EXECUTE source_sql;
END $$;
