-- Additive appearance storage. Existing businesses keep their published identity.
ALTER TABLE public.businesses ADD COLUMN theme_config jsonb NOT NULL DEFAULT '{}',
 ADD COLUMN theme_revision integer NOT NULL DEFAULT 0 CHECK(theme_revision>=0),
 ADD COLUMN multi_service_enabled integer NOT NULL DEFAULT 0 CHECK(multi_service_enabled IN(0,1));

CREATE FUNCTION private.theme_defaults(plan text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('version',1,'primary','#4754E6','secondary','#00A5E2','mode','light','radius',CASE WHEN plan IN('negocio','pro') THEN 'round' ELSE 'soft' END,'font','atry','cards','elevated','density','comfortable','buttons','solid','agenda','soft','public_mode','inherit','public_layout','calm')
$$;
CREATE FUNCTION private.validate_theme(config jsonb,plan text,stored boolean DEFAULT false,nested boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE pair record;p jsonb;result jsonb:='{"version":1}';enums jsonb:='{"mode":["light","dark"],"radius":["soft","round","straight"],"font":["atry","system"],"cards":["elevated","outlined","flat"],"density":["comfortable","compact"],"buttons":["solid","outline"],"agenda":["soft","contrast"],"public_mode":["inherit","light","dark"],"public_layout":["calm","editorial"]}';rank int:=CASE plan WHEN 'pro' THEN 2 WHEN 'negocio' THEN 1 ELSE 0 END;value text;items jsonb:='[]';def jsonb:=private.theme_defaults(plan);
BEGIN
 IF jsonb_typeof(config) IS DISTINCT FROM 'object' OR octet_length(config::text)>20000 THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
 FOR pair IN SELECT * FROM jsonb_each(config) LOOP
  value:=pair.value#>>'{}';
  IF pair.key='version' THEN IF pair.value IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
  ELSIF pair.key IN('primary','secondary','background','surface','sidebar') THEN
   IF jsonb_typeof(pair.value)<>'string' OR value!~'^#[a-fA-F0-9]{6}$' THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
   result:=result||jsonb_build_object(pair.key,upper(value));
  ELSIF enums ? pair.key THEN
   IF jsonb_typeof(pair.value)<>'string' OR NOT (enums->pair.key ? value) THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
   result:=result||jsonb_build_object(pair.key,value);
  ELSIF pair.key='presets' THEN
   IF nested OR jsonb_typeof(pair.value)<>'array' THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
   IF jsonb_array_length(pair.value)>6 THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
   FOR p IN SELECT * FROM jsonb_array_elements(pair.value) LOOP
    IF jsonb_typeof(p)<>'object' OR jsonb_typeof(p->'name') IS DISTINCT FROM 'string' OR length(btrim(p->>'name')) NOT BETWEEN 2 AND 40 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN('name','config')) THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
    items:=items||jsonb_build_array(jsonb_build_object('name',btrim(p->>'name'),'config',private.validate_theme(p->'config','pro',true,true)));
   END LOOP;
   result:=result||jsonb_build_object('presets',items);
  ELSE RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
 END LOOP;
 IF NOT stored THEN
  IF rank=0 AND ((result ? 'primary' AND result->>'primary' NOT IN('#4754E6','#2056A0','#187459')) OR (result ? 'secondary' AND result->>'secondary'<>'#00A5E2')) THEN RAISE EXCEPTION 'APPEARANCE_PLAN_REQUIRED' USING ERRCODE='42501';END IF;
  FOR pair IN SELECT * FROM jsonb_each(result) LOOP
   IF rank<2 AND pair.key IN('background','surface','sidebar','font','cards','density','buttons','agenda','presets') AND
    (CASE WHEN pair.key='presets' THEN pair.value<>'[]'::jsonb ELSE pair.value IS DISTINCT FROM def->pair.key END) THEN RAISE EXCEPTION 'APPEARANCE_PLAN_REQUIRED' USING ERRCODE='42501';END IF;
   IF rank=0 AND pair.key IN('radius','public_mode','public_layout') AND pair.value IS DISTINCT FROM def->pair.key THEN RAISE EXCEPTION 'APPEARANCE_PLAN_REQUIRED' USING ERRCODE='42501';END IF;
  END LOOP;
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION private.project_theme(b public.businesses) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE result jsonb;rank int:=CASE b.plan WHEN 'pro' THEN 2 WHEN 'negocio' THEN 1 ELSE 0 END;
BEGIN
 result:=CASE WHEN b.theme_config='{}'::jsonb THEN jsonb_build_object('version',1,'primary',CASE WHEN b.primary_color='#1D806E' THEN '#4754E6' ELSE b.primary_color END,'secondary',b.secondary_color,'mode',b.appearance_mode) ELSE private.theme_defaults(b.plan)||b.theme_config END;
 result:=result-'presets';
 IF rank<2 THEN result:=result-ARRAY['background','surface','sidebar','presets']||jsonb_build_object('font','atry','cards','elevated','density','comfortable','buttons','solid','agenda','soft');END IF;
 IF rank=0 THEN
  IF result ? 'primary' AND result->>'primary' NOT IN('#4754E6','#2056A0','#187459') THEN result:=result||'{"primary":"#4754E6"}'::jsonb;END IF;
  result:=result||'{"secondary":"#00A5E2","radius":"soft","public_mode":"inherit","public_layout":"calm"}'::jsonb;
 END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.atry_save_appearance(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE b public.businesses;incoming jsonb;config jsonb;defaults jsonb;logo text;
BEGIN
 IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM public.businesses WHERE id=bid FOR UPDATE;IF b.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF NOT private.subscription_live(bid) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';END IF;
 IF jsonb_typeof(payload) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(payload) k WHERE k NOT IN('theme_config','expected_revision','reset_theme','primary_color','secondary_color','appearance_mode','logo_url')) THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
 IF payload ? 'expected_revision' AND (jsonb_typeof(payload->'expected_revision')<>'number' OR (payload->>'expected_revision')!~'^[0-9]+$' OR (payload->>'expected_revision')::numeric<>b.theme_revision) THEN RAISE EXCEPTION 'STALE_REVISION';END IF;
 IF payload ? 'reset_theme' AND jsonb_typeof(payload->'reset_theme')<>'boolean' THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
 incoming:=coalesce(payload->'theme_config','{}');
 IF jsonb_typeof(incoming)<>'object' THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
 IF payload ? 'primary_color' THEN incoming:=incoming||jsonb_build_object('primary',payload->'primary_color');END IF;
 IF payload ? 'secondary_color' THEN incoming:=incoming||jsonb_build_object('secondary',payload->'secondary_color');END IF;
 IF payload ? 'appearance_mode' THEN incoming:=incoming||jsonb_build_object('mode',payload->'appearance_mode');END IF;
 config:=private.validate_theme(incoming,b.plan);
 defaults:=CASE WHEN payload->'reset_theme'='true'::jsonb THEN private.theme_defaults(b.plan) WHEN b.theme_config='{}'::jsonb THEN jsonb_build_object('primary',b.primary_color,'secondary',b.secondary_color,'mode',b.appearance_mode) ELSE b.theme_config END;
 config:=defaults||config;logo:=b.logo_url;
 IF payload ? 'logo_url' THEN
  logo:=payload->>'logo_url';
  IF jsonb_typeof(payload->'logo_url')<>'string' OR length(logo)>140000 OR (logo<>'' AND logo!~'^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') THEN RAISE EXCEPTION 'INVALID_APPEARANCE';END IF;
  IF b.plan NOT IN('negocio','pro') AND logo<>'' THEN RAISE EXCEPTION 'APPEARANCE_PLAN_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 UPDATE public.businesses SET theme_config=config,theme_revision=theme_revision+1,primary_color=coalesce(config->>'primary',primary_color),secondary_color=coalesce(config->>'secondary',secondary_color),appearance_mode=coalesce(config->>'mode',appearance_mode),logo_url=logo WHERE id=bid;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'business.appearance.updated','business',bid,now());
 RETURN public.atry_business(bid);
END $$;
-- The old general settings endpoint cannot bypass owner/plan/revision validation.
ALTER FUNCTION public.atry_save_business(text,jsonb) RENAME TO save_business_theme_base;
ALTER FUNCTION public.save_business_theme_base(text,jsonb) SET SCHEMA private;
CREATE FUNCTION public.atry_save_business(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE appearance jsonb;result jsonb;
BEGIN
 PERFORM private.require_manager(bid);
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO appearance FROM jsonb_each(payload) WHERE key IN('primary_color','secondary_color','appearance_mode','logo_url','theme_config','expected_revision','reset_theme');
 result:=private.save_business_theme_base(bid,payload-ARRAY['primary_color','secondary_color','appearance_mode','logo_url','theme_config','expected_revision','reset_theme','multi_service_enabled']);
 IF payload ? 'multi_service_enabled' THEN
  IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
  IF payload->'multi_service_enabled' NOT IN('0'::jsonb,'1'::jsonb) THEN RAISE EXCEPTION 'INVALID_SETTING';END IF;
  UPDATE public.businesses SET multi_service_enabled=(payload->>'multi_service_enabled')::int WHERE id=bid;
 END IF;
 IF appearance<>'{}'::jsonb THEN PERFORM public.atry_save_appearance(bid,appearance);END IF;
 RETURN public.atry_business(bid);
END $$;
ALTER FUNCTION public.atry_public_info(text) RENAME TO public_info_theme_base;
ALTER FUNCTION public.public_info_theme_base(text) SET SCHEMA private;
DO $$ DECLARE source text;BEGIN
 SELECT pg_get_functiondef('private.public_info_theme_base(text)'::regprocedure) INTO source;
 EXECUTE replace(source,'atry_public_info.','public_info_theme_base.');
END $$;
CREATE FUNCTION public.atry_public_info(slug text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;b public.businesses;
BEGIN
 result:=private.public_info_theme_base(slug);SELECT * INTO b FROM public.businesses WHERE businesses.slug=atry_public_info.slug;
 RETURN jsonb_set(result,'{business}',result->'business'||jsonb_build_object('plan',b.plan,'theme_config',private.project_theme(b),'multi_service_enabled',b.multi_service_enabled,'logo_url',CASE WHEN b.plan IN('negocio','pro') THEN b.logo_url ELSE '' END));
END $$;
REVOKE ALL ON FUNCTION private.theme_defaults(text),private.validate_theme(jsonb,text,boolean,boolean),private.project_theme(public.businesses),private.save_business_theme_base(text,jsonb),private.public_info_theme_base(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.atry_save_business(text,jsonb),public.atry_save_appearance(text,jsonb),public.atry_public_info(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.atry_save_business(text,jsonb),public.atry_save_appearance(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atry_public_info(text) TO service_role;
