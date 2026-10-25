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
 const c=config(env,options);require('./react/package.cjs').packageReact(dest,c);
 fs.writeFileSync(path.join(dest,'_redirects'),'/* /index.html 200\n');
 fs.writeFileSync(path.join(dest,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: SAMEORIGIN\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n');return {destination:dest,backend:c.backend};
}
if(require.main===module)build(process.env).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={config,build};
