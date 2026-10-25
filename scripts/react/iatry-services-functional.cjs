'use strict';
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {nativeServer}=require('./iatry-environment.cjs'),{demoFixture}=require('./iatry-fixture.cjs');
(async()=>{
 const server=await nativeServer(),results=[];
 try{for(const [engine,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{headless:true});
  try{
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
   await context.addInitScript(demoFixture,{empty:true});context.setDefaultTimeout(15000);const p=await context.newPage(),errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto(server.base+'/?demo=1&plan=2#/app/configuracion-inicial');
   await p.getByRole('heading',{name:'¡Hola! Soy IAtry.',exact:true}).waitFor();
   await p.getByRole('button',{name:'Mostrame dónde',exact:true}).click();await p.locator('.setup-step.iatry-target').click();
   await p.locator('[name=name].iatry-target').waitFor();await p.locator('.iatry-context [data-iatry=next]').click();
   await p.locator('[data-react-action=add-service].iatry-target').waitFor();console.log(engine,'check',checks.length+1);checks.push('Guía IAtry navega a Servicios y apunta al botón real');
   await p.locator('[data-react-action=add-service]').click();await p.locator('[data-react-form=create-service]').waitFor();await p.locator('.iatry-context').waitFor({state:'hidden'});
   await p.locator('[name=name]').fill('Servicio de prueba');await p.locator('[name=duration_min]').fill('45');await p.getByRole('button',{name:'Guardar servicio',exact:true}).click();
   await p.getByRole('heading',{name:'¡Bien! Tu servicio ya está activo.',exact:true}).waitFor();console.log(engine,'check',checks.length+1);checks.push('Crear servicio conserva modal, guardado y celebración confirmada');
   await p.locator('[data-react-action=edit-service]').last().click();await p.locator('[data-react-form=update-service]').waitFor();await p.locator('[name=name]').fill('Servicio editado');
   await p.getByRole('button',{name:'Guardar servicio',exact:true}).click();await p.getByRole('heading',{name:'Servicio editado',exact:true}).waitFor();console.log(engine,'check',checks.length+1);checks.push('Edición persiste y actualiza el catálogo');
   const card=p.locator('.grid3 .card').filter({has:p.getByRole('heading',{name:'Servicio editado',exact:true})});
   await card.getByRole('button',{name:'Ocultar',exact:true}).click();await p.getByRole('button',{name:'Ocultar servicio',exact:true}).click();await card.getByRole('button',{name:'Publicar',exact:true}).waitFor();
   await card.getByRole('button',{name:'Publicar',exact:true}).click();await card.getByRole('button',{name:'Ocultar',exact:true}).waitFor();console.log(engine,'check',checks.length+1);checks.push('Ocultar y publicar conservan confirmación y estado');
   await card.getByRole('button',{name:'Editar',exact:true}).click();await p.locator('[name=name]').fill('Borrador sin guardar');await p.evaluate(()=>location.hash='/app/inicio');
   await p.getByRole('button',{name:'Volver',exact:true}).click();assert.equal(await p.locator('[name=name]').inputValue(),'Borrador sin guardar');
   await p.evaluate(()=>location.hash='/app/inicio');await p.getByRole('button',{name:'Cerrar sin guardar',exact:true}).click();await p.locator('[data-react-dashboard]').waitFor();console.log(engine,'check',checks.length+1);checks.push('Navegación protege el borrador y permite descartarlo explícitamente');
   for(let i=0;i<3;i++){await p.evaluate(()=>location.hash='/app/servicios');await p.locator('[data-react-services-list]').waitFor();assert.equal(await p.locator('[data-react-services-list]').count(),1);await p.evaluate(()=>location.hash='/app/inicio');await p.locator('[data-react-dashboard]').waitFor()}
   console.log(engine,'check',checks.length+1);checks.push('Tres ciclos Inicio/Servicios conservan una sola lista y navegación funcional');assert.deepEqual(errors,[]);await context.close();
   for(const role of ['manager','staff']){const c=await browser.newContext({serviceWorkers:'block'});c.setDefaultTimeout(15000);await c.addInitScript(demoFixture,{role});const page=await c.newPage();await page.goto(server.base+'/?demo=1&plan=2#/app/servicios');if(role==='manager'){await page.locator('[data-react-services-list]').waitFor();assert.equal(await page.locator('[data-react-action=add-service]').isEnabled(),true)}else{await page.locator('.ag-workspace').waitFor();assert.equal(await page.locator('[data-react-services-list]').count(),0)}await c.close()}
   console.log(engine,'check',checks.length+1);checks.push('Manager mantiene acceso; staff es dirigido a Agenda');results.push({engine,passed:true,checks,errors});console.log(engine,checks.length);
  }finally{await browser.close()}
 }}finally{await server.close();fs.writeFileSync('docs/react-iatry-validation/evidence/services-navigation/functional.json',JSON.stringify({environment:'Local fictional demo, no media recording, no production requests',results},null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
