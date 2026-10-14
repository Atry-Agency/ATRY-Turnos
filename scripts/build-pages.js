'use strict';
const fs=require('node:fs'),path=require('node:path');
function config(env){
 const url=env.PUBLIC_SUPABASE_URL,key=env.PUBLIC_SUPABASE_KEY;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||''))throw new Error('PUBLIC_SUPABASE_URL inválida');
 if(!key||/^sb_secret_/.test(key))throw new Error('Solo una clave pública de Supabase');
 if(key.startsWith('eyJ')){let payload;try{payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());}catch{throw new Error('Clave inválida');}if(payload.role!=='anon')throw new Error('Clave privilegiada prohibida');}
 else if(!key.startsWith('sb_publishable_'))throw new Error('Formato de clave pública inválido');
 // Fail closed until every legacy route has a verified equivalent.
 if(env.CLOUD_BACKEND_VALIDATED!=='1')throw new Error('Publicación bloqueada: falta validar equivalencia completa del backend cloud');
 return {supabaseUrl:url,supabaseKey:key,backend:'supabase'};
}
if(require.main===module){const c=config(process.env);if(!fs.existsSync('web/cloud-backend.js'))throw new Error('Falta el adaptador cloud completo: no se publica una aplicación incompleta');const dest=path.resolve('dist');fs.mkdirSync(dest,{recursive:true});fs.cpSync('web',dest,{recursive:true});fs.writeFileSync(path.join(dest,'runtime-config.js'),'window.ATRY_CONFIG='+JSON.stringify(c)+';');fs.writeFileSync(path.join(dest,'_redirects'),'/* /index.html 200\n');fs.writeFileSync(path.join(dest,'_headers'),`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`);console.log('Bundle estático generado sin datos locales');}
module.exports={config};
