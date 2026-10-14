ALTER TABLE businesses ADD CHECK(min_notice_min BETWEEN 0 AND 10080 AND max_days BETWEEN 1 AND 365 AND cancel_notice_hours BETWEEN 0 AND 168 AND slot_step_min BETWEEN 5 AND 60 AND auto_confirm IN (0,1) AND allow_guest IN (0,1) AND is_active IN (0,1));
ALTER TABLE working_hours ADD CHECK(start_min>=0 AND end_min<=1440);
ALTER TABLE recurring_breaks ADD CHECK(start_min>=0 AND end_min<=1440);
ALTER TABLE staff ADD CHECK(active IN (0,1));
ALTER TABLE services ADD CHECK(active IN (0,1));
ALTER TABLE resources ADD CHECK(active IN (0,1));
ALTER TABLE schedule_exceptions ADD CHECK(closed IN (0,1) AND (closed=1 OR (start_min IS NOT NULL AND end_min IS NOT NULL)));
ALTER TABLE invitations ADD FOREIGN KEY(staff_id,business_id) REFERENCES staff(id,business_id);
ALTER TABLE waitlist ADD FOREIGN KEY(staff_id,business_id) REFERENCES staff(id,business_id);
ALTER TABLE waitlist ADD FOREIGN KEY(offer_staff_id,business_id) REFERENCES staff(id,business_id);
CREATE FUNCTION private.link_tenant() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='staff_services' THEN
  IF NOT EXISTS(SELECT 1 FROM public.staff st JOIN public.services s ON s.business_id=st.business_id WHERE st.id=NEW.staff_id AND s.id=NEW.service_id) THEN RAISE EXCEPTION 'TENANT_MISMATCH';END IF;
 ELSIF TG_TABLE_NAME='service_resources' THEN
  IF NOT EXISTS(SELECT 1 FROM public.services s JOIN public.resources r ON r.business_id=s.business_id WHERE s.id=NEW.service_id AND r.id=NEW.resource_id) THEN RAISE EXCEPTION 'TENANT_MISMATCH';END IF;
 ELSE RAISE EXCEPTION 'INVALID_LINK_TABLE';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER staff_service_tenant BEFORE INSERT OR UPDATE ON staff_services FOR EACH ROW EXECUTE FUNCTION private.link_tenant();
CREATE TRIGGER service_resource_tenant BEFORE INSERT OR UPDATE ON service_resources FOR EACH ROW EXECUTE FUNCTION private.link_tenant();
