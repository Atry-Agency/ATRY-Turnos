const {DatabaseSync}=require('node:sqlite');
const before=new DatabaseSync(process.argv[2]||'data/backup-mision002.sqlite',{readOnly:true});
const after=new DatabaseSync('data/atry-turnos.sqlite',{readOnly:true});
for(const table of ['users','businesses','staff','services','customers','bookings']){
 const ids=before.prepare(`SELECT id FROM ${table}`).all();const check=after.prepare(`SELECT id FROM ${table} WHERE id=?`);
 if(ids.some(x=>!check.get(x.id)))throw new Error('Faltan registros originales en '+table);
 console.log(`${table}: ${ids.length} registros originales conservados`);
}
console.log('Integridad:',after.prepare('PRAGMA integrity_check').get().integrity_check);
before.close();after.close();
