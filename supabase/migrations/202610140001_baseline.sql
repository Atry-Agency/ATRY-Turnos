-- PostgreSQL baseline. No demonstration rows or legacy credentials.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET search_path=public,extensions;
CREATE TABLE users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, auth_user_id UUID UNIQUE REFERENCES auth.users(id),
 platform_admin INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE TABLE businesses (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, sector TEXT NOT NULL DEFAULT 'Belleza y bienestar',
 description TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
 address TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT 'Montevideo',
 primary_color TEXT NOT NULL DEFAULT '#1d806e', logo_url TEXT NOT NULL DEFAULT '',
 timezone TEXT NOT NULL DEFAULT 'America/Montevideo',
 min_notice_min INTEGER NOT NULL DEFAULT 60, max_days INTEGER NOT NULL DEFAULT 60,
 cancel_notice_hours INTEGER NOT NULL DEFAULT 12, slot_step_min INTEGER NOT NULL DEFAULT 15,
 auto_confirm INTEGER NOT NULL DEFAULT 1, allow_guest INTEGER NOT NULL DEFAULT 1,
 plan TEXT NOT NULL DEFAULT 'trial', subscription_status TEXT NOT NULL DEFAULT 'trialing',
 trial_until TIMESTAMPTZ NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL
, onboarding_completed INTEGER NOT NULL DEFAULT 0);
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE TABLE memberships (
 user_id TEXT NOT NULL REFERENCES users(id), business_id TEXT NOT NULL REFERENCES businesses(id),
 role TEXT NOT NULL CHECK(role IN ('owner','manager','staff')),
 PRIMARY KEY(user_id,business_id)
);
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
CREATE TABLE staff (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), user_id TEXT REFERENCES users(id),
 name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1,
 color TEXT NOT NULL DEFAULT '#2c907b', created_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
CREATE TABLE services (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', duration_min INTEGER NOT NULL,
 price_uyu INTEGER NOT NULL DEFAULT 0, deposit_percent INTEGER NOT NULL DEFAULT 0,
 buffer_before_min INTEGER NOT NULL DEFAULT 0, buffer_after_min INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE TABLE staff_services (
 staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
 service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
 PRIMARY KEY(staff_id,service_id)
);
ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;
CREATE TABLE working_hours (
 staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
 weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 start_min INTEGER NOT NULL, end_min INTEGER NOT NULL,
 PRIMARY KEY(staff_id,weekday), CHECK(start_min < end_min)
);
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
CREATE TABLE time_off (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), staff_id TEXT NOT NULL REFERENCES staff(id),
 starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, reason TEXT NOT NULL DEFAULT ''
);
ALTER TABLE time_off ENABLE ROW LEVEL SECURITY;
CREATE TABLE customers (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
 name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '', marketing_consent INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE TABLE bookings (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
 staff_id TEXT NOT NULL REFERENCES staff(id), service_id TEXT NOT NULL REFERENCES services(id),
 customer_id TEXT NOT NULL REFERENCES customers(id),
 starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, blocked_from TIMESTAMPTZ NOT NULL, blocked_until TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','confirmed','completed','cancelled','no_show')),
 source TEXT NOT NULL DEFAULT 'public', notes TEXT NOT NULL DEFAULT '',
 payment_status TEXT NOT NULL DEFAULT 'not_required', price_uyu INTEGER NOT NULL DEFAULT 0,
 manage_token_hash TEXT UNIQUE, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE TABLE waitlist (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), service_id TEXT NOT NULL REFERENCES services(id),
 staff_id TEXT REFERENCES staff(id), desired_date TEXT NOT NULL,
 customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, customer_phone TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','offered','booked','cancelled')),
 offered_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL
, offer_token_hash TEXT, offer_expires_at TIMESTAMPTZ, offer_starts_at TIMESTAMPTZ, offer_staff_id TEXT);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE TABLE notifications (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), booking_id TEXT REFERENCES bookings(id),
 channel TEXT NOT NULL DEFAULT 'email', kind TEXT NOT NULL, recipient TEXT NOT NULL,
 subject TEXT NOT NULL, content TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued', created_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE TABLE audit_log (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
 user_id TEXT, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE TABLE invitations (
 id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),email TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('manager','staff')),staff_id TEXT REFERENCES staff(id),
 token_hash TEXT NOT NULL UNIQUE,expires_at TIMESTAMPTZ NOT NULL,accepted_at TIMESTAMPTZ,revoked_at TIMESTAMPTZ,
 created_by TEXT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE TABLE mail_jobs (
 id TEXT PRIMARY KEY,dedupe_key TEXT NOT NULL UNIQUE,business_id TEXT REFERENCES businesses(id),
 source TEXT NOT NULL,source_id TEXT NOT NULL,kind TEXT NOT NULL,recipient TEXT NOT NULL,
 subject TEXT NOT NULL,content TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'queued',
 attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TIMESTAMPTZ NOT NULL,lease_until TIMESTAMPTZ,
 provider_id TEXT,last_error TEXT,created_at TIMESTAMPTZ NOT NULL,updated_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE mail_jobs ENABLE ROW LEVEL SECURITY;
CREATE TABLE notification_preferences (
 business_id TEXT PRIMARY KEY REFERENCES businesses(id),confirmations INTEGER NOT NULL DEFAULT 1,
 cancellations INTEGER NOT NULL DEFAULT 1,reschedules INTEGER NOT NULL DEFAULT 1,
 reminders INTEGER NOT NULL DEFAULT 1,waitlist INTEGER NOT NULL DEFAULT 1,reminder_hours INTEGER NOT NULL DEFAULT 24
, business_alerts INTEGER NOT NULL DEFAULT 1);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE TABLE recurring_breaks (
 id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),staff_id TEXT NOT NULL REFERENCES staff(id),
 weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),start_min INTEGER NOT NULL,end_min INTEGER NOT NULL,
 CHECK(start_min<end_min)
);
ALTER TABLE recurring_breaks ENABLE ROW LEVEL SECURITY;
CREATE TABLE schedule_exceptions (
 id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),staff_id TEXT NOT NULL REFERENCES staff(id),
 day TEXT NOT NULL,start_min INTEGER,end_min INTEGER,closed INTEGER NOT NULL DEFAULT 0,
 UNIQUE(staff_id,day),CHECK(closed=1 OR (start_min>=0 AND end_min<=1440 AND start_min<end_min))
);
ALTER TABLE schedule_exceptions ENABLE ROW LEVEL SECURITY;
CREATE TABLE holidays (
 id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),day TEXT NOT NULL,name TEXT NOT NULL,
 UNIQUE(business_id,day)
);
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
CREATE TABLE resources (
 id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE TABLE service_resources (
 service_id TEXT NOT NULL REFERENCES services(id),resource_id TEXT NOT NULL REFERENCES resources(id),
 PRIMARY KEY(service_id,resource_id)
);
ALTER TABLE service_resources ENABLE ROW LEVEL SECURITY;
CREATE TABLE booking_resources (
 booking_id TEXT NOT NULL REFERENCES bookings(id),resource_id TEXT NOT NULL REFERENCES resources(id),
 PRIMARY KEY(booking_id,resource_id)
);
ALTER TABLE booking_resources ENABLE ROW LEVEL SECURITY;
CREATE TABLE idempotency_keys (
 scope TEXT NOT NULL,key_hash TEXT NOT NULL,request_hash TEXT NOT NULL,response TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL,PRIMARY KEY(scope,key_hash)
);
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE TABLE system_errors (
 id TEXT PRIMARY KEY,code TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE system_errors ENABLE ROW LEVEL SECURITY;
CREATE TABLE incidents (
 id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),subject TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'open',created_by TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL,updated_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
CREATE TABLE platform_audit (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE platform_audit ENABLE ROW LEVEL SECURITY;
CREATE TABLE plans (
 code TEXT PRIMARY KEY,name TEXT NOT NULL,staff_limit INTEGER NOT NULL CHECK(staff_limit BETWEEN 1 AND 100),
 smartslots INTEGER NOT NULL DEFAULT 1,resources INTEGER NOT NULL DEFAULT 1,reports INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Cross-tenant composite foreign keys protect privileged writes too.
ALTER TABLE staff ADD UNIQUE(id,business_id);
ALTER TABLE services ADD UNIQUE(id,business_id);
ALTER TABLE customers ADD UNIQUE(id,business_id);
ALTER TABLE resources ADD UNIQUE(id,business_id);
ALTER TABLE bookings ADD UNIQUE(id,business_id);
ALTER TABLE bookings ADD FOREIGN KEY(staff_id,business_id) REFERENCES staff(id,business_id);
ALTER TABLE bookings ADD FOREIGN KEY(service_id,business_id) REFERENCES services(id,business_id);
ALTER TABLE bookings ADD FOREIGN KEY(customer_id,business_id) REFERENCES customers(id,business_id);
ALTER TABLE time_off ADD FOREIGN KEY(staff_id,business_id) REFERENCES staff(id,business_id);
ALTER TABLE recurring_breaks ADD FOREIGN KEY(staff_id,business_id) REFERENCES staff(id,business_id);
ALTER TABLE schedule_exceptions ADD FOREIGN KEY(staff_id,business_id) REFERENCES staff(id,business_id);
ALTER TABLE waitlist ADD FOREIGN KEY(service_id,business_id) REFERENCES services(id,business_id);
CREATE INDEX ON bookings(business_id,starts_at);
CREATE INDEX ON memberships(business_id,user_id);
CREATE INDEX ON mail_jobs(state,next_attempt_at);
