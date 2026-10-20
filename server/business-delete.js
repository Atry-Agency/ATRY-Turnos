'use strict';
const crypto=require('node:crypto');
const activeConnections=new WeakSet(),quote=v=>'"'+v.replaceAll('"','""')+'"';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
function collect(db,bid){
 const business=db.prepare('SELECT id,name,slug FROM businesses WHERE id=?').get(bid);if(!business)fail(404,'Negocio no encontrado');
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>({name,rows:db.prepare('SELECT rowid AS __rowid,* FROM '+quote(name)).all(),columns:db.prepare('PRAGMA table_info('+quote(name)+')').all(),fks:db.prepare('PRAGMA foreign_key_list('+quote(name)+')').all(),selected:new Set()}));
 const protectedTables=new Set(['users','sessions','password_resets','user_controls','plans','schema_migrations','commercial_settings','control_settings','worker_health','mail_global_budget','system_outbox']);
 for(const t of tables)if(!protectedTables.has(t.name))for(const r of t.rows)if(t.name==='businesses'?r.id===bid:r.business_id===bid||t.name==='control_requests'&&r.entity_type==='business'&&r.entity_id===bid||['control_events','platform_audit','audit_log'].includes(t.name)&&r.entity_id===bid||t.name==='idempotency_keys'&&String(r.scope).includes(bid))t.selected.add(r.__rowid);
 let changed=true;while(changed){changed=false;for(const t of tables){if(protectedTables.has(t.name))continue;const groups=new Map();for(const f of t.fks){if(!groups.has(f.id))groups.set(f.id,[]);groups.get(f.id).push(f);}for(const r of t.rows){if(t.selected.has(r.__rowid))continue;for(const parts of groups.values()){const parent=tables.find(x=>x.name===parts[0].table);if(parent?.rows.some(p=>parent.selected.has(p.__rowid)&&parts.every(f=>r[f.from]!=null&&String(r[f.from])===String(p[f.to||parent.columns.find(c=>c.pk)?.name])))){t.selected.add(r.__rowid);changed=true;break;}}}}}
 for(const t of tables)for(const r of t.rows)if(t.selected.has(r.__rowid)&&r.business_id!=null&&r.business_id!==bid)fail(409,'Hay dependencias de otro negocio. No se puede eliminar.');
 const selected=tables.filter(t=>t.selected.size),snapshot=selected.map(t=>[t.name,t.rows.filter(r=>t.selected.has(r.__rowid))]),token=crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 const processing=selected.find(t=>t.name==='mail_jobs')?.rows.some(r=>selected.find(t=>t.name==='mail_jobs').selected.has(r.__rowid)&&r.state==='processing');
 return {business,selected,token,processing};
}
function preview(db,bid){const c=collect(db,bid);return {checked_at:new Date().toISOString(),data:{...c.business,token:c.token,counts:Object.fromEntries(c.selected.map(t=>[t.name,t.selected.size])),total:c.selected.reduce((n,t)=>n+t.selected.size,0),execution_enabled:!c.processing,blocker:c.processing?'Hay un envío en proceso. Esperá a que termine antes de borrar.':null,accounts_preserved:true}};}
function purge(db,bid,payload){
 const c=collect(db,bid);if(payload.confirm_slug!==c.business.slug||payload.preview_token!==c.token)fail(409,'El negocio cambió o la confirmación no coincide. Volvé a revisar la eliminación.');if(c.processing)fail(409,'Hay envíos en proceso. No se puede borrar todavía.');
 activeConnections.add(db);try{db.exec('PRAGMA defer_foreign_keys=ON');for(const t of c.selected)for(const rid of t.selected)db.prepare('DELETE FROM '+quote(t.name)+' WHERE rowid=?').run(rid);if(db.prepare('PRAGMA foreign_key_check').all().length)fail(409,'No se puede completar la eliminación sin dejar dependencias.');return {deleted:true,counts:Object.fromEntries(c.selected.map(t=>[t.name,t.selected.size])),accounts_preserved:true};}finally{activeConnections.delete(db);}
}
module.exports={preview,purge,active:db=>activeConnections.has(db)?1:0};
