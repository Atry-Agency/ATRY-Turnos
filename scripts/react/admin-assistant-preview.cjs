'use strict';
// Local, disposable SQLite fixture. Never connects to Supabase or a mail provider.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {connect}=require('../../server/db'),{seedDemo}=require('../../server/seed'),{createApp}=require('../../server/app');
async function createAdminPreview(port=3361){
 const db=connect(':memory:');seedDemo(db);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atry-admin-preview-'));
 const source=path.resolve('frontend/react/dist');
 for(const name of fs.readdirSync(source))fs.symlinkSync(path.join(source,name),path.join(directory,name));
 const index=path.join(directory,'index.html');fs.unlinkSync(index);
 fs.writeFileSync(index,fs.readFileSync(path.join(source,'index.html'),'utf8').replace('</body>','<div style="position:fixed;bottom:0;left:0;right:0;z-index:20;background:#fff4d8;color:#584117;font:12px/1.5 system-ui;padding:7px 12px;text-align:center;pointer-events:none">Administración local · Datos ficticios · Los cambios se descartan al reiniciar</div></body>'));
 const server=createApp({db,webRoot:directory}).createServer(),listeners=server.listeners('request');server.removeAllListeners('request');
 server.on('request',(req,res)=>{
  if(!/^127\.0\.0\.1(?::\d+)?$/.test(req.headers.host||'')){res.writeHead(403);res.end();return}
  if(req.url==='/__admin-preview'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end('<!doctype html><meta charset="utf-8"><title>ATRY · Administración local</title><p>Preparando el panel con datos ficticios…</p><script>fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"admin.prueba@example.com",password:"AtryAdmin2026!"})}).then(r=>{if(!r.ok)throw Error("No se pudo abrir la sesión local");location.replace("/#/admin/inicio")}).catch(e=>document.querySelector("p").textContent=e.message)</script>');return}
  for(const listener of listeners)listener.call(server,req,res);
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
 return {db,base:'http://127.0.0.1:'+server.address().port,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();fs.rmSync(directory,{recursive:true,force:true})}};
}
module.exports={createAdminPreview};
if(require.main===module)createAdminPreview(Number(process.env.PORT)||3361).then(s=>{console.log('LOCAL ONLY: '+s.base+'/__admin-preview');for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void s.close().finally(()=>process.exit()))}).catch(e=>{console.error(e);process.exitCode=1});
