-- Operator-only bootstrap after explicit authorization of the account owner.
-- Set atry.bootstrap_email in the operator session; never infer admin from signup metadata.
BEGIN;
DO $$
DECLARE target_user text;target_email text:=lower(current_setting('atry.bootstrap_email'));
BEGIN
 SELECT u.id INTO target_user FROM public.users u JOIN auth.users a ON a.id=u.auth_user_id
 WHERE lower(u.email)=target_email AND lower(a.email)=target_email AND a.email_confirmed_at IS NOT NULL
 AND NOT (coalesce(a.raw_user_meta_data,'{}'::jsonb)?'atry_test_run');
 IF target_user IS NULL THEN RAISE EXCEPTION 'VERIFIED_REAL_OPERATOR_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM public.users WHERE platform_admin=1 AND id<>target_user) THEN RAISE EXCEPTION 'EXISTING_OPERATOR_REQUIRES_REVIEW';END IF;
 UPDATE public.users SET platform_admin=1 WHERE id=target_user AND platform_admin=0;
 IF FOUND THEN INSERT INTO public.platform_audit VALUES(gen_random_uuid()::text,target_user,'operator.bootstrap',target_user,now());END IF;
END $$;
COMMIT;
SELECT name,platform_admin FROM public.users WHERE lower(email)=lower(current_setting('atry.bootstrap_email'));
