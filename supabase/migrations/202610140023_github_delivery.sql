-- Same service-only permission; support the user's selected GitHub Pages deployment.
CREATE OR REPLACE FUNCTION public.atry_configure_delivery(site_url text,enabled boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (coalesce(site_url,'')!~'^https://[a-z0-9-]+\.pages\.dev/?$' AND coalesce(site_url,'') NOT IN ('https://atry-agency.github.io/ATRY-Turnos','https://atry-agency.github.io/ATRY-Turnos/')) OR enabled IS NULL THEN RAISE EXCEPTION 'INVALID_DELIVERY_CONFIG';END IF;
 UPDATE private.runtime_settings SET public_url=regexp_replace(site_url,'/$',''),mail_enabled=enabled,updated_at=now() WHERE id=1;RETURN true;
END $$;
