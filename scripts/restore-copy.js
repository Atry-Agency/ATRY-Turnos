'use strict';
// Restaura a un archivo NUEVO. Nunca reemplaza la base que está en uso.
const fs=require('node:fs'),path=require('node:path');const {DatabaseSync}=require('node:sqlite');
const [sourceArg,targetArg]=process.argv.slice(2);if(!sourceArg||!targetArg)throw new Error('Uso: node scripts/restore-copy.js copia.sqlite data/restaurada-nueva.sqlite');
const source=path.resolve(sourceArg),target=path.resolve(targetArg);if(source===target||fs.existsSync(target))throw new Error('El destino debe ser un archivo nuevo y diferente de la copia');
const db=new DatabaseSync(source,{readOnly:true});try{if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('La copia no pasó integridad');fs.mkdirSync(path.dirname(target),{recursive:true});db.exec("VACUUM INTO '"+target.replace(/'/g,"''")+"'");console.log('Copia restaurada y verificada:',target);}finally{db.close();}
