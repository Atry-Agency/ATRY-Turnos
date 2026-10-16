'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const hashToken = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`;
}
function verifyPassword(password, stored) {
  try {
    const [salt,hex] = stored.split(':');
    const expected = Buffer.from(hex,'hex');
    const actual = crypto.scryptSync(password,salt,expected.length);
    return crypto.timingSafeEqual(actual,expected);
  } catch { return false; }
}
function connect(filename = process.env.DB_FILE || './data/atry-turnos.sqlite') {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)),{recursive:true});
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  init(db);
  return db;
}
function init(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 platform_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS businesses (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, sector TEXT NOT NULL DEFAULT 'Belleza y bienestar',
 description TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
 address TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT 'Montevideo',
 primary_color TEXT NOT NULL DEFAULT '#1d806e', logo_url TEXT NOT NULL DEFAULT '',
 timezone TEXT NOT NULL DEFAULT 'America/Montevideo',
 min_notice_min INTEGER NOT NULL DEFAULT 60, max_days INTEGER NOT NULL DEFAULT 60,
 cancel_notice_hours INTEGER NOT NULL DEFAULT 12, slot_step_min INTEGER NOT NULL DEFAULT 15,
 auto_confirm INTEGER NOT NULL DEFAULT 1, allow_guest INTEGER NOT NULL DEFAULT 1,
 plan TEXT NOT NULL DEFAULT 'trial', subscription_status TEXT NOT NULL DEFAULT 'trialing',
 trial_until TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
 user_id TEXT NOT NULL REFERENCES users(id), business_id TEXT NOT NULL REFERENCES businesses(id),
 role TEXT NOT NULL CHECK(role IN ('owner','manager','staff')),
 PRIMARY KEY(user_id,business_id)
);
CREATE TABLE IF NOT EXISTS staff (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), user_id TEXT REFERENCES users(id),
 name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1,
 color TEXT NOT NULL DEFAULT '#2c907b', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS services (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', duration_min INTEGER NOT NULL,
 price_uyu INTEGER NOT NULL DEFAULT 0, deposit_percent INTEGER NOT NULL DEFAULT 0,
 buffer_before_min INTEGER NOT NULL DEFAULT 0, buffer_after_min INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS staff_services (
 staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
 service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
 PRIMARY KEY(staff_id,service_id)
);
CREATE TABLE IF NOT EXISTS working_hours (
 staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
 weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 start_min INTEGER NOT NULL, end_min INTEGER NOT NULL,
 PRIMARY KEY(staff_id,weekday), CHECK(start_min < end_min)
);
CREATE TABLE IF NOT EXISTS time_off (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), staff_id TEXT NOT NULL REFERENCES staff(id),
 starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, reason TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS customers (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
 name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '', marketing_consent INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
 staff_id TEXT NOT NULL REFERENCES staff(id), service_id TEXT NOT NULL REFERENCES services(id),
 customer_id TEXT NOT NULL REFERENCES customers(id),
 starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, blocked_from TEXT NOT NULL, blocked_until TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','confirmed','completed','cancelled','no_show')),
 source TEXT NOT NULL DEFAULT 'public', notes TEXT NOT NULL DEFAULT '',
 payment_status TEXT NOT NULL DEFAULT 'not_required', price_uyu INTEGER NOT NULL DEFAULT 0,
 manage_token_hash TEXT UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS waitlist (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), service_id TEXT NOT NULL REFERENCES services(id),
 staff_id TEXT REFERENCES staff(id), desired_date TEXT NOT NULL,
 customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, customer_phone TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','offered','booked','cancelled')),
 offered_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_waitlist_business_day ON waitlist(business_id,desired_date,status);
CREATE TABLE IF NOT EXISTS notifications (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), booking_id TEXT REFERENCES bookings(id),
 channel TEXT NOT NULL DEFAULT 'email', kind TEXT NOT NULL, recipient TEXT NOT NULL,
 subject TEXT NOT NULL, content TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
 user_id TEXT, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_staff_range ON bookings(staff_id,blocked_from,blocked_until,status);
CREATE INDEX IF NOT EXISTS idx_bookings_business_date ON bookings(business_id,starts_at);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_business ON staff(business_id);
CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS password_resets (
 token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL,used_at TEXT,created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS system_outbox (
 id TEXT PRIMARY KEY,kind TEXT NOT NULL,recipient TEXT NOT NULL,content TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'queued',created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
`);
  const columns=db.prepare('PRAGMA table_info(businesses)').all().map(x=>x.name);
  if(!columns.includes('onboarding_completed'))db.exec('ALTER TABLE businesses ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0');
  const waitColumns=db.prepare('PRAGMA table_info(waitlist)').all().map(x=>x.name);
  for(const column of ['offer_token_hash','offer_expires_at','offer_starts_at','offer_staff_id'])if(!waitColumns.includes(column))db.exec(`ALTER TABLE waitlist ADD COLUMN ${column} TEXT`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_offer_token ON waitlist(offer_token_hash);
CREATE TRIGGER IF NOT EXISTS bookings_tenant_insert BEFORE INSERT ON bookings BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM staff WHERE id=NEW.staff_id AND business_id=NEW.business_id)
 OR NOT EXISTS(SELECT 1 FROM services WHERE id=NEW.service_id AND business_id=NEW.business_id)
 OR NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND business_id=NEW.business_id)
 THEN RAISE(ABORT,'booking tenant mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS bookings_overlap_insert BEFORE INSERT ON bookings WHEN NEW.status IN ('pending','confirmed') BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings WHERE staff_id=NEW.staff_id AND status IN ('pending','confirmed') AND blocked_from<NEW.blocked_until AND blocked_until>NEW.blocked_from)
 THEN RAISE(ABORT,'booking overlap') END;
END;
CREATE TRIGGER IF NOT EXISTS bookings_overlap_update BEFORE UPDATE ON bookings WHEN NEW.status IN ('pending','confirmed') BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings WHERE id!=NEW.id AND staff_id=NEW.staff_id AND status IN ('pending','confirmed') AND blocked_from<NEW.blocked_until AND blocked_until>NEW.blocked_from)
 THEN RAISE(ABORT,'booking overlap') END;
END;`);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(1,?)').run(now());
  require('./schema-v2').migrate(db);
  require('./recurring').migrate(db);
  require('./subscriptions').migrate(db);
  require('./commercial').migrate(db);
}
function transaction(db,fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}
function audit(db,businessId,userId,action,entity,entityId) {
  db.prepare('INSERT INTO audit_log (id,business_id,user_id,action,entity,entity_id,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id(),businessId,userId||null,action,entity,entityId,now());
}
module.exports = {connect,init,id,now,hashToken,randomToken,passwordHash,verifyPassword,transaction,audit};
