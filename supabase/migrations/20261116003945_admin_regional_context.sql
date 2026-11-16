-- Extend the existing private administrative view; do not change tables, rows, RLS or grants.
-- Old clients ignore these appended columns. Roll back the frontend, retaining this additive metadata.
CREATE OR REPLACE VIEW private.control_businesses AS
SELECT b.id,b.name,b.slug,b.email,b.phone,b.plan,b.created_at,b.subscription_status,b.is_active,b.paid_until,b.trial_until,b.subscription_started_at,
 private.control_status(b) AS status,coalesce(b.paid_until,b.trial_until) AS deadline,p.staff_limit,p.mail_limit,
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'email',u.email)) FROM public.memberships m JOIN public.users u ON u.id=m.user_id WHERE m.business_id=b.id AND m.role='owner'),'[]'::jsonb) AS owners,
 coalesce(c.reservation_scope,'none') AS reservation_scope,coalesce(c.mail_paused,false) AS mail_paused,coalesce(c.revision,0) AS control_revision,
 b.country,b.timezone,b.currency,b.locale
FROM public.businesses b JOIN public.plans p ON p.code=b.plan LEFT JOIN private.business_controls c ON c.business_id=b.id;
