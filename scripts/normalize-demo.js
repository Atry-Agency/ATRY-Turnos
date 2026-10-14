'use strict';
const {verifyPassword,transaction}=require('../server/db');
function normalizeDemo(db){
 const owner=db.prepare('SELECT * FROM users WHERE email=? AND name=?').get('demo@atryturnos.test','Sofía Martínez');
 const business=db.prepare("SELECT b.* FROM businesses b JOIN memberships m ON m.business_id=b.id WHERE b.slug='estudio-sofia' AND b.name='Estudio Sofía' AND m.user_id=? AND m.role='owner'").get(owner?.id||'');
 if(!owner||!business||!verifyPassword('AtryDemo2026!',owner.password_hash))return {changed:false};
 return transaction(db,()=>{
  db.exec('CREATE TABLE IF NOT EXISTS demo_records(entity TEXT NOT NULL,entity_id TEXT NOT NULL,PRIMARY KEY(entity,entity_id))');
  const mark=db.prepare('INSERT OR IGNORE INTO demo_records VALUES(?,?)');mark.run('users',owner.id);mark.run('businesses',business.id);
  db.prepare('UPDATE users SET name=?,email=? WHERE id=?').run('Usuario Prueba 1','usuario1@example.com',owner.id);
  db.prepare('UPDATE businesses SET name=?,slug=?,description=?,email=?,address=?,sector=? WHERE id=?').run('Negocio Prueba 1','negocio-prueba-1','Negocio genérico de demostración.','negocio1@example.com','Dirección de prueba 1','General',business.id);
  const admin=db.prepare('SELECT * FROM users WHERE email=?').get('admin@atryturnos.test');
  if(admin&&verifyPassword('AtryAdmin2026!',admin.password_hash)){db.prepare('UPDATE users SET name=?,email=? WHERE id=?').run('Administrador Prueba','admin.prueba@example.com',admin.id);mark.run('users',admin.id);}
  let n=0;for(const row of db.prepare('SELECT * FROM staff WHERE business_id=? ORDER BY created_at,id').all(business.id)){
   if(!['Sofía Martínez','Camila Torres','Martín Pereira'].includes(row.name)||!['sofia@example.test','camila@example.test','martin@example.test'].includes(row.email))continue;
   n++;db.prepare('UPDATE staff SET name=?,email=? WHERE id=?').run('Empleado '+n,`empleado${n}@example.com`,row.id);mark.run('staff',row.id);
  }
  n=0;for(const row of db.prepare('SELECT * FROM services WHERE business_id=? ORDER BY created_at,id').all(business.id)){
   if(!['Corte de pelo','Corte + brushing','Color y tratamiento','Barba y perfilado'].includes(row.name))continue;
   n++;db.prepare('UPDATE services SET name=?,description=? WHERE id=?').run('Servicio '+n,'Descripción del servicio '+n,row.id);mark.run('services',row.id);
  }
  n=0;for(const row of db.prepare('SELECT * FROM customers WHERE business_id=? ORDER BY created_at,id').all(business.id)){
   if(!/^cliente\d+@ejemplo\.test$/.test(row.email)||!['Valentina Rodríguez','Lucía Fernández','Matías López','Carolina Silva','Agustina Díaz'].includes(row.name))continue;
   n++;db.prepare('UPDATE customers SET name=?,email=? WHERE id=?').run('Cliente '+n,`cliente${n}@example.com`,row.id);mark.run('customers',row.id);
  }
  db.prepare("UPDATE notifications SET state='skipped' WHERE business_id=? AND state='queued'").run(business.id);
  db.prepare("UPDATE mail_jobs SET state='skipped' WHERE business_id=? AND state IN ('queued','retry')").run(business.id);
  return {changed:true,business_id:business.id};
 });
}
if(require.main===module){if(process.env.NODE_ENV==='production')throw new Error('Normalización demo solo en desarrollo');const {connect}=require('../server/db');const db=connect();console.log(normalizeDemo(db));console.log(db.prepare('PRAGMA integrity_check').get());db.close();}
module.exports={normalizeDemo};
