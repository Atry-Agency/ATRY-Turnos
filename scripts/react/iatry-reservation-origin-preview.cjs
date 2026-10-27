'use strict';
// A disposable browser-only local override. Never uploads assets, changes headers/Origin,
// disables CORS, forwards credentials, or modifies the hosting/Supabase configuration.
if(process.env.ATRY_EXPLICIT_RESERVATION_WINDOW!=='1'){console.error('Ensayo suspendido. No se abrirá ninguna ventana.');process.exit(1)}
const {chromium}=require('playwright');
const prefix='/__iatry-local-reservations/',local='http://127.0.0.1:3337',origin='https://atryturnos.com',supabase='https://djoxdtloqwbrhgtgencc.supabase.co';
(async()=>{const browser=await chromium.launch({headless:false,args:['--window-position=80,80','--window-size=1280,900'],executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});
await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin===supabase){await route.continue();return}if(url.origin!==origin||!url.pathname.startsWith(prefix)||req.method()!=='GET'){await route.abort();return}
 const path=url.pathname.slice(prefix.length);if(path.includes('..')||!(path===''||/^(?:trial\.(?:js|css)|config\.js|theme-core\.js|assets\/[A-Za-z0-9_./-]+)$/.test(path))){await route.abort();return}
 const response=await fetch(local+'/'+path,{redirect:'error'});let body=Buffer.from(await response.arrayBuffer());const headers=Object.fromEntries(response.headers);delete headers['content-length'];delete headers['transfer-encoding'];
 if(path===''){body=Buffer.from(body.toString().replaceAll('src="/','src="'+prefix).replaceAll('href="/','href="'+prefix).replace('<title>IAtry · Ensayo autorizado Pelu</title>','<title>IAtry · Ensayo LOCAL aislado · No publicado</title>'))}
 await route.fulfill({status:response.status,headers,body});
});const page=await context.newPage();await page.goto(origin+prefix);await page.bringToFront();console.log('Ventana aislada: candidato servido desde loopback; origen HTTPS normal; sin publicación ni cambios de CORS. Iniciar sesión normalmente.');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await browser.close();process.exit()});await new Promise(resolve=>browser.on('disconnected',resolve));})().catch(()=>{console.error('No se pudo abrir la ventana local aislada. No se ejecutaron escrituras.');process.exitCode=1});
