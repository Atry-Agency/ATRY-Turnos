'use strict';
function migrate(db){
 db.exec(`
CREATE TABLE IF NOT EXISTS invitations (
 id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),email TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('manager','staff')),staff_id TEXT REFERENCES staff(id),
 token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,accepted_at TEXT,revoked_at TEXT,
 created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS invitations_business ON invitations(business_id,email);
CREATE TABLE IF NOT EXISTS mail_jobs (
 id TEXT PRIMARY KEY,dedupe_key TEXT NOT NULL UNIQUE,business_id TEXT REFERENCES businesses(id),
 source TEXT NOT NULL,source_id TEXT NOT NULL,kind TEXT NOT NULL,recipient TEXT NOT NULL,
 subject TEXT NOT NULL,content TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'queued',
 attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TEXT NOT NULL,lease_until TEXT,
 provider_id TEXT,last_error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mail_due ON mail_jobs(state,next_attempt_at);
CREATE INDEX IF NOT EXISTS mail_source ON mail_jobs(source,source_id);
CREATE TABLE IF NOT EXISTS notification_preferences (
 business_id TEXT PRIMARY KEY REFERENCES businesses(id),confirmations INTEGER NOT NULL DEFAULT 1,
 cancellations INTEGER NOT NULL DEFAULT 1,reschedules INTEGER NOT NULL DEFAULT 1,
 reminders INTEGER NOT NULL DEFAULT 1,waitlist INTEGER NOT NULL DEFAULT 1,reminder_hours INTEGER NOT NULL DEFAULT 24
);
CREATE TABLE IF NOT EXISTS recurring_breaks (
 id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),staff_id TEXT NOT NULL REFERENCES staff(id),
 weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),start_min INTEGER NOT NULL,end_min INTEGER NOT NULL,
 CHECK(start_min<end_min)
);
CREATE TABLE IF NOT EXISTS schedule_exceptions (
 id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),staff_id TEXT NOT NULL REFERENCES staff(id),
 day TEXT NOT NULL,start_min INTEGER,end_min INTEGER,closed INTEGER NOT NULL DEFAULT 0,
 UNIQUE(staff_id,day),CHECK(closed=1 OR (start_min>=0 AND end_min<=1440 AND start_min<end_min))
);
CREATE TABLE IF NOT EXISTS holidays (
 id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),day TEXT NOT NULL,name TEXT NOT NULL,
 UNIQUE(business_id,day)
);
CREATE TABLE IF NOT EXISTS resources (
 id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS service_resources (
 service_id TEXT NOT NULL REFERENCES services(id),resource_id TEXT NOT NULL REFERENCES resources(id),
 PRIMARY KEY(service_id,resource_id)
);
CREATE TABLE IF NOT EXISTS booking_resources (
 booking_id TEXT NOT NULL REFERENCES bookings(id),resource_id TEXT NOT NULL REFERENCES resources(id),
 PRIMARY KEY(booking_id,resource_id)
);
CREATE TABLE IF NOT EXISTS idempotency_keys (
 scope TEXT NOT NULL,key_hash TEXT NOT NULL,request_hash TEXT NOT NULL,response TEXT NOT NULL,
 created_at TEXT NOT NULL,PRIMARY KEY(scope,key_hash)
);
CREATE INDEX IF NOT EXISTS recurring_staff_day ON recurring_breaks(staff_id,weekday);
CREATE INDEX IF NOT EXISTS timeoff_staff_range ON time_off(staff_id,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS booking_resource_lookup ON booking_resources(resource_id,booking_id);
CREATE TABLE IF NOT EXISTS system_errors (
 id TEXT PRIMARY KEY,code TEXT NOT NULL,created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS incidents (
 id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),subject TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'open',created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS platform_audit (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL,created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
 code TEXT PRIMARY KEY,name TEXT NOT NULL,staff_limit INTEGER NOT NULL CHECK(staff_limit BETWEEN 1 AND 100),
 smartslots INTEGER NOT NULL DEFAULT 1,resources INTEGER NOT NULL DEFAULT 1,reports INTEGER NOT NULL DEFAULT 1
);
CREATE TRIGGER IF NOT EXISTS bookings_tenant_update BEFORE UPDATE OF business_id,staff_id,service_id,customer_id ON bookings BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM staff WHERE id=NEW.staff_id AND business_id=NEW.business_id)
 OR NOT EXISTS(SELECT 1 FROM services WHERE id=NEW.service_id AND business_id=NEW.business_id)
 OR NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND business_id=NEW.business_id)
 THEN RAISE(ABORT,'booking tenant mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS resource_tenant_insert BEFORE INSERT ON booking_resources BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM bookings b JOIN resources r ON r.business_id=b.business_id WHERE b.id=NEW.booking_id AND r.id=NEW.resource_id)
 THEN RAISE(ABORT,'resource tenant mismatch') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings candidate JOIN bookings other ON other.status IN ('pending','confirmed') AND other.blocked_from<candidate.blocked_until AND other.blocked_until>candidate.blocked_from JOIN booking_resources br ON br.booking_id=other.id WHERE candidate.id=NEW.booking_id AND candidate.status IN ('pending','confirmed') AND br.resource_id=NEW.resource_id AND other.id!=candidate.id)
 THEN RAISE(ABORT,'resource overlap') END;
END;
`);
 const insertPlan=db.prepare('INSERT OR IGNORE INTO plans VALUES(?,?,?,?,?,?)');for(const [code,name,limit] of [['trial','Prueba',5],['individual','Individual',1],['negocio','Negocio',5],['pro','Pro',10]])insertPlan.run(code,name,limit,1,1,1);
 if(!db.prepare('PRAGMA table_info(notification_preferences)').all().some(c=>c.name==='business_alerts'))db.exec('ALTER TABLE notification_preferences ADD COLUMN business_alerts INTEGER NOT NULL DEFAULT 1');
 db.prepare('INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(2,?)').run(new Date().toISOString());
}
module.exports={migrate};
