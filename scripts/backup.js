'use strict';
const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');
const source=process.env.DB_FILE||'data/atry-turnos.sqlite';
const target=path.resolve(process.argv[2]||`data/backup-${Date.now()}.sqlite`);
const db=new DatabaseSync(source);
db.exec("VACUUM INTO '"+target.replace(/'/g,"''")+"'");
db.close();
console.log('Copia consistente creada: '+target);
