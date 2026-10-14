'use strict';
// Uso: ATRY_ADMIN_EMAIL=admin@dominio.com ATRY_ADMIN_PASSWORD='clave-larga' npm run admin
const {connect,id,now,passwordHash}=require('./db');
const email=(process.env.ATRY_ADMIN_EMAIL||'').trim().toLowerCase();
const password=process.env.ATRY_ADMIN_PASSWORD||'';
const name=(process.env.ATRY_ADMIN_NAME||'Administración Atry').slice(0,100);
if(!/^\S+@\S+\.\S+$/.test(email)||password.length<14){
 console.error('Especificá ATRY_ADMIN_EMAIL y ATRY_ADMIN_PASSWORD (mínimo 14 caracteres) en el entorno.');process.exit(1);
}
const db=connect();
const existing=db.prepare('SELECT id FROM users WHERE email=?').get(email);
if(existing){db.prepare('UPDATE users SET platform_admin=1,password_hash=? WHERE id=?').run(passwordHash(password),existing.id);console.log('Administrador actualizado:',email);}
else{db.prepare('INSERT INTO users(id,name,email,password_hash,platform_admin,created_at) VALUES(?,?,?,?,1,?)').run(id(),name,email,passwordHash(password),now());console.log('Administrador creado:',email);}
db.close();
