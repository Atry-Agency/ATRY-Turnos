'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {nativeServer}=require('./iatry-environment.cjs'),{demoFixture}=require('./iatry-fixture.cjs');
(async()=>{const server=await nativeServer('dist/github-preview');let browser;const errors=[],external=[],routes=[];try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});context.setDefaultTimeout(15000);await context.addInitScript(demoFixture,{multi:false});
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==server.base){external.push(new URL(route.request().url()).origin);return route.abort()}return route.continue()});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 for(const view of ['inicio','agenda','servicios','clientes','equipo','disponibilidad','configuracion','configuracion-inicial','comunicacion','accesos','suscripcion','cuenta','notificaciones','turnos-fijos','lista-espera','estadisticas','smartslots','insights','soporte']){
  await p.goto(server.base+'/?demo=1&plan=3#/app/'+view);await p.locator('.main-content h1').waitFor();await p.waitForFunction(()=>!document.querySelector('.main-content')?.textContent?.includes('Cargando pantalla'));assert.equal(await p.locator('.main-content h1').count(),1);routes.push(view);
 }
 await p.goto(server.base+'/?demo=1&plan=2#/reservar/demo-negocioplan2');await p.locator('.service-option').first().waitFor();routes.push('reserva-publica-demo');
 assert.equal(await p.evaluate(()=>window.ATRY_CONFIG.supabaseUrl),'https://djoxdtloqwbrhgtgencc.supabase.co');assert.equal(await p.evaluate(()=>Boolean(window.ATRY_CONFIG.experimentalConnectionLocked)),false);
 const fresh=await browser.newContext({serviceWorkers:'block'});fresh.setDefaultTimeout(15000);await fresh.route('**/*',route=>new URL(route.request().url()).origin===server.base?route.continue():route.abort());const login=await fresh.newPage();login.on('pageerror',e=>errors.push(e.message));await login.goto(server.base+'/#/login');await login.locator('[name=email]').waitFor();await login.locator('[name=password]').waitFor();routes.push('login-anonimo-sin-envio');await fresh.close();
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);const result={passed:true,routes,errors,productionRequests:0,environment:'Packaged candidate, fictional demo for private/public routes; anonymous login without submitting credentials; all external network blocked; no screenshots/video'};
 fs.writeFileSync('docs/react-iatry-validation/RELEASE-SMOKE.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,routes:routes.length,productionRequests:0}));await context.close();
 }finally{await browser?.close();await server.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
