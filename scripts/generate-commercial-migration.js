'use strict';
const fs=require('node:fs');const plans=require('../config/commercial-plans.json');
let sql=`-- Misión 004. Additive commercial catalog; no business or booking is deleted.\nALTER TABLE public.plans ADD COLUMN price_uyu integer NOT NULL DEFAULT 0 CHECK(price_uyu>=0),ADD COLUMN mail_limit integer NOT NULL DEFAULT 0 CHECK(mail_limit>=0),ADD COLUMN features jsonb NOT NULL DEFAULT '{}';\n`;
for(const [code,p] of Object.entries(plans))sql+=`UPDATE public.plans SET name='${p.name}',staff_limit=${p.staff_limit},price_uyu=${p.price_uyu},mail_limit=${p.mail_limit},smartslots=${+p.features.smartslots},resources=${+p.features.resources},reports=${+p.features.advanced},features='${JSON.stringify(p.features)}' WHERE code='${code}';\n`;
sql+=`UPDATE public.plans SET features='${JSON.stringify(plans.pro.features)}',mail_limit=900 WHERE code='trial';\n`;
fs.writeFileSync('supabase/migrations/202610150029_commercial.sql',sql+fs.readFileSync('supabase/commercial-tail.sql','utf8'));
