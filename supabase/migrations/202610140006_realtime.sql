-- Publish only a revision, never contact details or management bearer tokens.
CREATE TABLE calendar_revisions(business_id text PRIMARY KEY REFERENCES businesses(id),revision bigint NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE calendar_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON calendar_revisions FROM anon,authenticated;
GRANT SELECT ON calendar_revisions TO authenticated;
CREATE POLICY tenant ON calendar_revisions FOR SELECT TO authenticated USING(private.member_role(business_id) IS NOT NULL);
CREATE FUNCTION private.calendar_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.calendar_revisions(business_id,revision) VALUES(NEW.business_id,1) ON CONFLICT(business_id) DO UPDATE SET revision=public.calendar_revisions.revision+1,updated_at=now();RETURN NEW;
END $$;
CREATE TRIGGER calendar_changed AFTER INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION private.calendar_change();
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE calendar_revisions;END IF;END $$;
