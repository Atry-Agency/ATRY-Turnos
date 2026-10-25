'use strict';
const {createApp}=require('./app');
const {seedDemo}=require('./seed');
if(process.env.NODE_ENV==='production'){
 if(process.env.SEED_DEMO==='1')throw new Error('SEED_DEMO está prohibido en producción');
 if(!/^https:\/\//.test(process.env.PUBLIC_URL||''))throw new Error('Producción requiere PUBLIC_URL con HTTPS');
}
const path=require('node:path'),fs=require('node:fs');
const webRoot=path.resolve(__dirname,process.env.ATRY_LEGACY_REFERENCE==='1'?'../web':'../frontend/react/dist');
if(!fs.existsSync(path.join(webRoot,'index.html')))throw Error('Falta compilar React. Ejecutá npm run build.');
const app=createApp({webRoot});
if(process.env.NODE_ENV==='production'&&app.db.prepare("SELECT id FROM users WHERE email IN ('usuario1@example.com','admin.prueba@example.com')").get())throw new Error('La base contiene cuentas de demo. Usá una base productiva sin credenciales públicas.');
if(process.env.SEED_DEMO==='1'){
 if(process.env.NODE_ENV==='production')throw new Error('SEED_DEMO está prohibido en producción: contiene credenciales públicas.');
 seedDemo(app.db);
}
const port=Number(process.env.PORT||3300),host=process.env.HOST||'127.0.0.1';
if(process.env.MAIL_WORKER!=='0')require('./mail').createWorker(app.db).start();
app.createServer().listen(port,host,()=>{console.log(`\nATRY TURNOS · preview funcional\nhttp://${host}:${port}\n`);});
