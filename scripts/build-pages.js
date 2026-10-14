'use strict';
const fs=require('node:fs'),path=require('node:path');
function config(env,{verificationOnly=false}={}){
 const url=env.PUBLIC_SUPABASE_URL,key=env.PUBLIC_SUPABASE_KEY;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||''))throw new Error('PUBLIC_SUPABASE_URL inválida');
 if(!key||/^sb_secret_/.test(key))throw new Error('Solo una clave pública de Supabase');
 if(key.startsWith('eyJ')){let payload;try{payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());}catch{throw new Error('Clave inválida');}if(payload.role!=='anon')throw new Error('Clave privilegiada prohibida');throw new Error('Usá la clave pública sb_publishable del proyecto');}
 if(!key.startsWith('sb_publishable_'))throw new Error('Formato de clave pública inválido');
 if(env.CLOUD_BACKEND_VALIDATED!=='1'&&!verificationOnly)throw new Error('Publicación bloqueada: falta validar equivalencia completa del backend cloud');
 return {supabaseUrl:url,supabaseKey:key,backend:'supabase',turnstileSiteKey:env.PUBLIC_TURNSTILE_SITE_KEY||'',...(verificationOnly?{verificationOnly:true}:{})};
}
async function build(env,dest=path.resolve('dist/pages'),options={}){
 const c=config(env,options);fs.mkdirSync(dest,{recursive:true});fs.cpSync(path.resolve(__dirname,'../web'),dest,{recursive:true});
 await require('esbuild').build({entryPoints:[path.resolve(__dirname,'../cloud/browser-entry.mjs')],bundle:true,format:'iife',platform:'browser',target:['es2022'],outfile:path.join(dest,'cloud-backend.js'),minify:true,sourcemap:false});
 await require('esbuild').build({entryPoints:[path.resolve(__dirname,'../cloud/proof-worker.mjs')],bundle:true,format:'iife',platform:'browser',target:['es2022'],outfile:path.join(dest,'proof-worker.js'),minify:true,sourcemap:false});
 fs.writeFileSync(path.join(dest,'runtime-config.js'),'window.ATRY_CONFIG='+JSON.stringify(c)+';');
 const file=path.join(dest,'index.html'),html=fs.readFileSync(file,'utf8');fs.writeFileSync(file,html.replace('<script src="./app.js','<script src="./runtime-config.js" defer></script><script src="./cloud-backend.js" defer></script><script src="./app.js'));
 fs.writeFileSync(path.join(dest,'_redirects'),'/* /index.html 200\n');
 fs.writeFileSync(path.join(dest,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n');return {destination:dest,backend:c.backend};
}
if(require.main===module)build(process.env).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={config,build};
