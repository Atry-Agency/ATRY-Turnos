CREATE OR REPLACE FUNCTION private.own_staff(sid text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.staff s WHERE s.id=sid AND s.user_id=private.user_id() AND s.active=1 AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.business_id=s.business_id AND m.user_id=s.user_id))
$$;
CREATE OR REPLACE FUNCTION private.new_auth_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE name text:=left(btrim(coalesce(NEW.raw_user_meta_data->>'name','Usuario')),100);
BEGIN
 IF length(name)<2 THEN name:='Usuario';END IF;
 INSERT INTO public.users(id,auth_user_id,name,email,created_at) VALUES(NEW.id::text,NEW.id,name,NEW.email,now());RETURN NEW;
END $$;
CREATE FUNCTION public.atry_finish_registration() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid text:=private.user_id();meta jsonb;name text;slug text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users WHERE id=uid FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.memberships WHERE user_id=uid) THEN RETURN jsonb_build_object('ok',true);END IF;
 SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 name:=nullif(btrim(meta->>'requested_business_name'),'');slug:=nullif(meta->>'requested_business_slug','');
 IF name IS NULL THEN RETURN jsonb_build_object('ok',true);END IF;
 RETURN public.atry_create_organization(jsonb_build_object('name',name,'slug',slug));
END $$;
CREATE FUNCTION public.atry_add_member(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text;role text:=payload->>'role';sid text:=nullif(payload->>'staff_id','');
BEGIN
 IF private.member_role(bid) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
 IF coalesce(role,'') NOT IN ('manager','staff') THEN RAISE EXCEPTION 'INVALID_ROLE';END IF;
 SELECT u.id INTO uid FROM public.users u JOIN auth.users a ON a.id=u.auth_user_id WHERE lower(a.email)=lower(btrim(payload->>'email')) AND a.email_confirmed_at IS NOT NULL;
 IF uid IS NULL THEN RAISE EXCEPTION 'VERIFIED_ACCOUNT_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM public.memberships WHERE business_id=bid AND user_id=uid) THEN RAISE EXCEPTION 'ALREADY_MEMBER';END IF;
 IF role='staff' THEN UPDATE public.staff SET user_id=uid WHERE id=sid AND business_id=bid AND active=1 AND user_id IS NULL;IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT';END IF;END IF;
 INSERT INTO public.memberships VALUES(uid,bid,role);INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,private.user_id(),'member.added','user',uid,now());RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION private.guard_catalog_future() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='staff' THEN
  IF OLD.active=1 AND NEW.active=0 AND EXISTS(SELECT 1 FROM public.bookings WHERE staff_id=NEW.id AND ends_at>now() AND status IN ('confirmed','pending')) THEN RAISE EXCEPTION 'FUTURE_BOOKINGS';END IF;
 ELSE
  IF (OLD.duration_min IS DISTINCT FROM NEW.duration_min OR OLD.buffer_before_min IS DISTINCT FROM NEW.buffer_before_min OR OLD.buffer_after_min IS DISTINCT FROM NEW.buffer_after_min OR (OLD.active=1 AND NEW.active=0)) AND EXISTS(SELECT 1 FROM public.bookings WHERE service_id=NEW.id AND ends_at>now() AND status IN ('confirmed','pending')) THEN RAISE EXCEPTION 'FUTURE_BOOKINGS';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER staff_future_guard BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION private.guard_catalog_future();
CREATE TRIGGER service_future_guard BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION private.guard_catalog_future();
CREATE FUNCTION private.guard_future_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.staff_services WHERE staff_id=OLD.staff_id AND service_id=OLD.service_id) AND EXISTS(SELECT 1 FROM public.bookings WHERE staff_id=OLD.staff_id AND service_id=OLD.service_id AND ends_at>now() AND status IN ('confirmed','pending')) THEN RAISE EXCEPTION 'FUTURE_BOOKINGS';END IF;RETURN OLD;
END $$;
CREATE CONSTRAINT TRIGGER future_assignment_guard AFTER DELETE ON public.staff_services DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.guard_future_assignment();
CREATE FUNCTION private.touch_catalog_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.calendar_revisions(business_id,revision,updated_at) VALUES(NEW.business_id,1,now()) ON CONFLICT(business_id) DO UPDATE SET revision=public.calendar_revisions.revision+1,updated_at=now();RETURN NEW;
END $$;
CREATE TRIGGER staff_revision AFTER INSERT OR UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION private.touch_catalog_revision();
CREATE TRIGGER service_revision AFTER INSERT OR UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION private.touch_catalog_revision();
CREATE INDEX IF NOT EXISTS bookings_export_page ON public.bookings(business_id,starts_at,id);
CREATE FUNCTION public.atry_export_bookings(bid text,after_start timestamptz DEFAULT NULL,after_id text DEFAULT '',page_size integer DEFAULT 500) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE rows jsonb;cursor jsonb;revision bigint;final_revision bigint;
BEGIN
 PERFORM private.require_manager(bid);
 IF (SELECT reports FROM public.plans p JOIN public.businesses b ON b.plan=p.code WHERE b.id=bid)=0 THEN RAISE EXCEPTION 'FEATURE_DISABLED' USING ERRCODE='42501';END IF;
 IF page_size NOT BETWEEN 1 AND 1000 OR page_size IS NULL THEN RAISE EXCEPTION 'INVALID_PAGE';END IF;
 SELECT coalesce(calendar_revisions.revision,0) INTO revision FROM public.calendar_revisions WHERE business_id=bid;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO rows FROM (SELECT b.id,b.starts_at,b.ends_at,b.status,s.name service,st.name professional,coalesce(b.customer_name_snapshot,c.name) customer,coalesce(b.customer_email_snapshot,c.email) email,coalesce(b.customer_phone_snapshot,c.phone) phone,b.price_uyu FROM public.bookings b JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id JOIN public.customers c ON c.id=b.customer_id WHERE b.business_id=bid AND (after_start IS NULL OR (b.starts_at,b.id)>(after_start,after_id)) ORDER BY b.starts_at,b.id LIMIT page_size) x;
 IF jsonb_array_length(rows)=page_size THEN cursor:=jsonb_build_object('start',rows->-1->>'starts_at','id',rows->-1->>'id');END IF;
 SELECT coalesce(calendar_revisions.revision,0) INTO final_revision FROM public.calendar_revisions WHERE business_id=bid;
 IF coalesce(revision,0)<>coalesce(final_revision,0) THEN RAISE EXCEPTION 'EXPORT_CHANGED';END IF;
 RETURN jsonb_build_object('rows',rows,'next_cursor',cursor,'revision',coalesce(revision,0));
END $$;
REVOKE ALL ON FUNCTION private.guard_catalog_future(),private.guard_future_assignment(),private.touch_catalog_revision() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.atry_finish_registration(),public.atry_add_member(text,jsonb),public.atry_export_bookings(text,timestamptz,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_finish_registration(),public.atry_add_member(text,jsonb),public.atry_export_bookings(text,timestamptz,text,integer) TO authenticated;
