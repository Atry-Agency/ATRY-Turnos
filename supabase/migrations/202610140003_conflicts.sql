-- One exclusion constraint covers professional and shared-resource occupancy.
CREATE TABLE booking_blocks(
 booking_id text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
 business_id text NOT NULL REFERENCES businesses(id),
 target text NOT NULL,
 occupied tstzrange NOT NULL,
 PRIMARY KEY(booking_id,target),
 EXCLUDE USING gist(target WITH =,occupied WITH &&)
);
ALTER TABLE booking_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_blocks FROM anon,authenticated;
CREATE FUNCTION private.refresh_blocks() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings;
BEGIN
 IF TG_TABLE_NAME='bookings' THEN b:=NEW; ELSE SELECT * INTO b FROM public.bookings WHERE id=coalesce(NEW.booking_id,OLD.booking_id) FOR UPDATE; END IF;
 DELETE FROM public.booking_blocks WHERE booking_id=b.id;
 IF b.status IN ('pending','confirmed') THEN
  INSERT INTO public.booking_blocks VALUES(b.id,b.business_id,'staff:'||b.staff_id,tstzrange(b.blocked_from,b.blocked_until,'[)'));
  INSERT INTO public.booking_blocks SELECT b.id,b.business_id,'resource:'||r.id,tstzrange(b.blocked_from,b.blocked_until,'[)') FROM public.booking_resources br JOIN public.resources r ON r.id=br.resource_id WHERE br.booking_id=b.id;
 END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER booking_blocks_sync AFTER INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION private.refresh_blocks();
CREATE TRIGGER resources_blocks_sync AFTER INSERT OR DELETE ON booking_resources FOR EACH ROW EXECUTE FUNCTION private.refresh_blocks();
CREATE FUNCTION private.resource_tenant() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.bookings b JOIN public.resources r ON r.business_id=b.business_id WHERE b.id=NEW.booking_id AND r.id=NEW.resource_id) THEN RAISE EXCEPTION 'resource tenant mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER resource_tenant BEFORE INSERT OR UPDATE ON booking_resources FOR EACH ROW EXECUTE FUNCTION private.resource_tenant();
ALTER TABLE bookings ADD CHECK(starts_at<ends_at AND blocked_from<=starts_at AND blocked_until>=ends_at);
ALTER TABLE time_off ADD CHECK(starts_at<ends_at);
ALTER TABLE services ADD CHECK(duration_min BETWEEN 5 AND 1440 AND buffer_before_min BETWEEN 0 AND 1440 AND buffer_after_min BETWEEN 0 AND 1440 AND price_uyu>=0);
