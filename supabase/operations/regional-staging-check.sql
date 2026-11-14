-- Prepared verification only. Run solely on explicitly authorized staging, after migration 006.
BEGIN READ ONLY;
DO $$BEGIN
 IF public.atry_runtime_config()->>'regional_contract' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'REGIONAL_CONTRACT_REQUIRED';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.runtime_settings WHERE id=1 AND NOT pa_public_enabled AND NOT pa_registration_enabled) THEN RAISE EXCEPTION 'PA_MUST_REMAIN_CLOSED';END IF;
 IF EXISTS(SELECT 1 FROM public.businesses WHERE (country,timezone,currency,locale) NOT IN (('UY','America/Montevideo','UYU','es-UY'),('PA','America/Panama','USD','es-PA'))) THEN RAISE EXCEPTION 'INVALID_REGIONAL_PROFILE';END IF;
 IF EXISTS(SELECT 1 FROM public.services s JOIN public.businesses b ON b.id=s.business_id WHERE s.price_minor IS NULL OR s.currency IS DISTINCT FROM b.currency OR (b.country='UY' AND s.price_minor<>s.price_uyu*100) OR (b.country='PA' AND s.price_uyu<>0)) THEN RAISE EXCEPTION 'INVALID_SERVICE_MONEY';END IF;
 IF EXISTS(SELECT 1 FROM public.bookings r JOIN public.businesses b ON b.id=r.business_id WHERE r.price_minor IS NULL OR r.currency IS DISTINCT FROM b.currency OR (b.country='UY' AND r.price_minor<>r.price_uyu*100) OR (b.country='PA' AND r.price_uyu<>0)) THEN RAISE EXCEPTION 'INVALID_BOOKING_MONEY';END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('private','public') AND p.prosecdef AND p.prokind='f' AND NOT coalesce('search_path=""'=ANY(p.proconfig),false)) THEN RAISE EXCEPTION 'UNEXPECTED_DEFINER_PATH';END IF;
END$$;
SELECT public.atry_runtime_config()->'regional_contract' AS contract;
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private') AND p.prokind='f' ORDER BY 1,2,3;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY 1,2,3;
SELECT p.pubname,t.schemaname,t.tablename FROM pg_publication p LEFT JOIN pg_publication_tables t ON t.pubname=p.pubname WHERE p.pubname='supabase_realtime';
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='staff-photos';
ROLLBACK;
