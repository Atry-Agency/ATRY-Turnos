-- Manual preparation in a NEW disposable test project only. Never run in production.
-- Set the correct project reference and disable deployed mail/payment workers first.
CREATE TABLE IF NOT EXISTS public.atry_test_environment (
 id text PRIMARY KEY CHECK(id='react-iatry-qa'),
 project_ref text NOT NULL,
 disposable boolean NOT NULL CHECK(disposable),
 mail_disabled boolean NOT NULL CHECK(mail_disabled),
 whatsapp_disabled boolean NOT NULL CHECK(whatsapp_disabled),
 payments_disabled boolean NOT NULL CHECK(payments_disabled)
);
ALTER TABLE public.atry_test_environment ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atry_test_environment FROM anon,authenticated;
GRANT SELECT ON public.atry_test_environment TO service_role;
-- Deliberately no INSERT: a human must attest isolation with the actual test project reference.
