-- Explicit grants: table identifiers alone never confer access.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
CREATE FUNCTION private.user_id() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT id FROM public.users WHERE auth_user_id=auth.uid()
$$;
CREATE FUNCTION private.member_role(bid text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT role FROM public.memberships WHERE user_id=private.user_id() AND business_id=bid
$$;
CREATE FUNCTION private.own_staff(sid text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.staff WHERE id=sid AND user_id=private.user_id() AND active=1)
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT SELECT(id,name,email,auth_user_id,created_at) ON users TO authenticated;
CREATE POLICY self_read ON users FOR SELECT TO authenticated USING(auth_user_id=auth.uid());
GRANT SELECT ON memberships,businesses,staff,services,working_hours,staff_services,time_off,recurring_breaks,schedule_exceptions,holidays,resources,service_resources,customers,bookings,booking_resources,waitlist,notification_preferences,incidents,plans TO authenticated;
CREATE POLICY tenant ON memberships FOR SELECT TO authenticated USING(private.member_role(business_id) IS NOT NULL);
CREATE POLICY tenant ON businesses FOR SELECT TO authenticated USING(private.member_role(id) IS NOT NULL);
CREATE POLICY tenant ON staff FOR SELECT TO authenticated USING(private.member_role(business_id) IN ('owner','manager') OR private.own_staff(id));
CREATE POLICY tenant ON services FOR SELECT TO authenticated USING(private.member_role(business_id) IS NOT NULL);
CREATE POLICY tenant ON working_hours FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.staff s WHERE s.id=staff_id));
CREATE POLICY tenant ON staff_services FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.staff s WHERE s.id=staff_id));
CREATE POLICY tenant ON time_off FOR SELECT TO authenticated USING(private.member_role(business_id) IN ('owner','manager') OR private.own_staff(staff_id));
CREATE POLICY tenant ON recurring_breaks FOR SELECT TO authenticated USING(private.member_role(business_id) IN ('owner','manager') OR private.own_staff(staff_id));
CREATE POLICY tenant ON schedule_exceptions FOR SELECT TO authenticated USING(private.member_role(business_id) IN ('owner','manager') OR private.own_staff(staff_id));
CREATE POLICY tenant ON holidays FOR SELECT TO authenticated USING(private.member_role(business_id) IS NOT NULL);
CREATE POLICY tenant ON resources FOR SELECT TO authenticated USING(private.member_role(business_id) IN ('owner','manager'));
CREATE POLICY tenant ON service_resources FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.resources r WHERE r.id=resource_id));
CREATE POLICY tenant ON customers FOR SELECT TO authenticated USING(private.member_role(business_id) IN ('owner','manager'));
CREATE POLICY tenant ON bookings FOR SELECT TO authenticated USING(private.member_role(business_id) IN ('owner','manager') OR (private.member_role(business_id)='staff' AND private.own_staff(staff_id)));
CREATE POLICY tenant ON booking_resources FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=booking_id));
CREATE POLICY tenant ON waitlist FOR SELECT TO authenticated USING(private.member_role(business_id) IN ('owner','manager'));
CREATE POLICY tenant ON notification_preferences FOR SELECT TO authenticated USING(private.member_role(business_id) IN ('owner','manager'));
CREATE POLICY tenant ON incidents FOR SELECT TO authenticated USING(private.member_role(business_id) IN ('owner','manager'));
CREATE POLICY plans_read ON plans FOR SELECT TO authenticated USING(true);
-- All direct writes remain denied. Sensitive queues/audit/tokens have no read grants.
-- New identities do not inherit any existing account by matching email.
CREATE FUNCTION private.new_auth_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.users(id,auth_user_id,name,email,created_at) VALUES(NEW.id::text,NEW.id,coalesce(NEW.raw_user_meta_data->>'name','Usuario'),NEW.email,now());
 RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.new_auth_user();
