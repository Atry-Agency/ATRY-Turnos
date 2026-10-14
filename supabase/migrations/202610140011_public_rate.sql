CREATE TABLE public_rate_buckets(key_hash text NOT NULL,scope text NOT NULL,bucket timestamptz NOT NULL,attempts int NOT NULL DEFAULT 1,PRIMARY KEY(key_hash,scope,bucket));
ALTER TABLE public_rate_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public_rate_buckets FROM anon,authenticated;
CREATE FUNCTION public.atry_public_rate(key_hash text,request_scope text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE attempts int;
BEGIN
 IF key_hash!~'^[a-f0-9]{64}$' OR length(request_scope)>80 THEN RAISE EXCEPTION 'INVALID_RATE_KEY';END IF;
 DELETE FROM public.public_rate_buckets WHERE ctid IN(SELECT ctid FROM public.public_rate_buckets WHERE bucket<now()-interval '1 day' LIMIT 1000);
 INSERT INTO public.public_rate_buckets VALUES(key_hash,request_scope,date_trunc('minute',now()),1) ON CONFLICT ON CONSTRAINT public_rate_buckets_pkey DO UPDATE SET attempts=public.public_rate_buckets.attempts+1 RETURNING public_rate_buckets.attempts INTO attempts;
 RETURN attempts<=10;
END $$;
REVOKE ALL ON FUNCTION public.atry_public_rate(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atry_public_rate(text,text) TO service_role;
-- Route all public traffic through Edge so rate controls cannot be bypassed.
REVOKE EXECUTE ON FUNCTION public.atry_public_info(text),public.atry_public_availability(text,text,date,text) FROM anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atry_public_info(text),public.atry_public_availability(text,text,date,text) TO service_role;
