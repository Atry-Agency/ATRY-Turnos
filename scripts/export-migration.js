'use strict';
// Explicit allowlist. Never exports sessions, passwords, private mail or demo rows.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const {DatabaseSync}=require('node:sqlite');
function exportMigration(db,businessIds){
 if(!Array.isArray(businessIds)||!businessIds.length)throw new Error('Seleccioná explícitamente negocios reales');
 const ids=[...new Set(businessIds)];const marks=db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='demo_records'").get()?db.prepare("SELECT entity_id FROM demo_records WHERE entity='businesses'").all().map(x=>x.entity_id):[];
 for(const bid of ids){const biz=db.prepare('SELECT * FROM businesses WHERE id=?').get(bid);if(!biz)throw new Error('Negocio no encontrado');if(marks.includes(bid)||['estudio-sofia','negocio-prueba-1'].includes(biz.slug))throw new Error('No se exportan negocios de demostración a producción');}
 const q=ids.map(()=>'?').join(','),rows={businesses:db.prepare(`SELECT * FROM businesses WHERE id IN (${q})`).all(...ids)};
 const members=db.prepare(`SELECT * FROM memberships WHERE business_id IN (${q})`).all(...ids);rows.memberships=members;const userIds=new Set(members.map(m=>m.user_id));
 for(const s of db.prepare(`SELECT * FROM staff WHERE business_id IN (${q}) AND user_id IS NOT NULL`).all(...ids))userIds.add(s.user_id);
 rows.users=[...userIds].map(uid=>{const u=db.prepare('SELECT id,name,email,created_at FROM users WHERE id=?').get(uid);if(!u)throw new Error('Referencia de usuario inválida');return {...u,auth_user_id:null,platform_admin:0};});
 for(const table of ['staff','services','customers','bookings','time_off','recurring_breaks','schedule_exceptions','holidays','resources','waitlist','notification_preferences'])rows[table]=db.prepare(`SELECT * FROM ${table} WHERE business_id IN (${q})`).all(...ids);
 for(const table of ['working_hours','staff_services'])rows[table]=db.prepare(`SELECT x.* FROM ${table} x JOIN staff s ON s.id=x.staff_id WHERE s.business_id IN (${q})`).all(...ids);
 rows.service_resources=db.prepare(`SELECT x.* FROM service_resources x JOIN services s ON s.id=x.service_id WHERE s.business_id IN (${q})`).all(...ids);
 rows.booking_resources=db.prepare(`SELECT x.* FROM booking_resources x JOIN bookings b ON b.id=x.booking_id WHERE b.business_id IN (${q})`).all(...ids);
 // Expired offers must be reissued by the new backend, never carry bearer tokens.
 rows.waitlist=rows.waitlist.map(x=>({...x,status:x.status==='offered'?'waiting':x.status,offer_token_hash:null,offer_expires_at:null,offer_starts_at:null,offer_staff_id:null}));
 const payload=JSON.stringify(rows);return {version:1,created_at:new Date().toISOString(),checksum:crypto.createHash('sha256').update(payload).digest('hex'),counts:Object.fromEntries(Object.entries(rows).map(([t,r])=>[t,r.length])),excluded:['demo','password_hash','sessions','password_resets','invitations','notifications','mail_jobs','idempotency_keys'],rows};
}
if(require.main===module){const ids=process.argv.slice(2),db=new DatabaseSync(process.env.DB_FILE||'data/atry-turnos.sqlite',{readOnly:true});try{const result=exportMigration(db,ids);const target=path.resolve('data',`migration-${Date.now()}.json`);fs.writeFileSync(target,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({file:target,counts:result.counts,checksum:result.checksum}));}finally{db.close();}}
module.exports={exportMigration};
