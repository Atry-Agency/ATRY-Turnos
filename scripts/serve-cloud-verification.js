'use strict';
// Local-only browser QA. This does not publish or certify the production build.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
async function main(){
 const config=JSON.parse(fs.readFileSync('data/cloud-private/connection.json','utf8'));if(config.url!=='https://djoxdtloqwbrhgtgencc.supabase.co'||!config.publicKey.startsWith('sb_publishable_'))throw new Error('TARGET_MISMATCH');
 const directory=path.resolve('dist/verification');fs.mkdirSync(directory,{recursive:true});fs.cpSync('web',directory,{recursive:true});
 await require('esbuild').build({entryPoints:['cloud/browser-entry.mjs'],bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:path.join(directory,'cloud-backend.js')});
 await require('esbuild').build({entryPoints:['cloud/proof-worker.mjs'],bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:path.join(directory,'proof-worker.js')});
 fs.writeFileSync(path.join(directory,'runtime-config.js'),'window.ATRY_CONFIG='+JSON.stringify({supabaseUrl:config.url,supabaseKey:config.publicKey,backend:'supabase',verificationOnly:true})+';');
 const index=path.join(directory,'index.html');fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('<script src="./app.js','<script src="./runtime-config.js" defer></script><script src="./cloud-backend.js" defer></script><script src="./app.js'));
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
 http.createServer((req,res)=>{
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  const file=path.resolve(directory,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(directory+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store','referrer-policy':'no-referrer'});fs.createReadStream(file).pipe(res);
 }).listen(3301,'127.0.0.1',()=>console.log('Verificación local con Supabase real: http://localhost:3301/'));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
