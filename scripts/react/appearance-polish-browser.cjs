'use strict';
// Local disposable fixtures only. No screenshots, external services or production writes.
const assert=require('node:assert/strict'),{chromium,webkit}=require('playwright'),{createPreview}=require('../international/preview.cjs');
(async()=>{const fixture=await createPreview(0),checks=[];let browser;
try{
 await fixture.db.exec(`RESET ROLE;INSERT INTO businesses SELECT (jsonb_populate_record(NULL::businesses,to_jsonb(b)||jsonb_build_object('id','essential','name','ATRY · Esencial local','slug','esencial-local','plan','individual'))).* FROM businesses b WHERE id='b1';INSERT INTO memberships VALUES('00000000-0000-0000-0000-000000000001','essential','owner');SET ROLE authenticated;`);
 for(const engine of [chromium,webkit]){
  browser=await engine.launch(engine===chromium?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:960},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];let writes=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/appearance')&&r.method()==='PATCH')writes++});
  await page.goto(fixture.base+'/#/app/configuracion/apariencia');await page.getByRole('button',{name:'Temas',exact:true}).click();
  assert.equal(await page.locator('.ts-theme-option,.ts-palettes').count(),0);assert.equal(await page.getByRole('button',{name:'Guardar cambios',exact:true}).isDisabled(),true);
  for(const width of [320,375,390,430,768,1060,1440]){
   await page.setViewportSize({width,height:960});
   for(const tab of ['Identidad','Temas','Detalles','Página pública']){
    await page.locator('.ts-tabs').getByRole('button',{name:tab,exact:true}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${engine.name()} ${width} ${tab} overflow`);
    const header=await page.locator('.topbar').evaluate(el=>{const box=el.getBoundingClientRect();return Array.from(el.querySelectorAll('.actions>.btn')).map(n=>{const r=n.getBoundingClientRect();return{inside:r.top>=box.top-1&&r.bottom<=box.bottom+1&&r.left>=box.left-1&&r.right<=box.right+1}})});
    assert.ok(header.every(x=>x.inside),`${width}: topbar must contain all actions`);
    const arrows=await page.locator('.ts-select-control').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{const select=n.querySelector('select'),icon=n.querySelector('svg'),s=select.getBoundingClientRect(),i=icon.getBoundingClientRect();return{center:Math.abs(i.top+i.height/2-s.top-s.height/2),gap:s.right-i.right,padding:parseFloat(getComputedStyle(select).paddingRight),appearance:getComputedStyle(select).appearance}}));
    assert.ok(arrows.every(a=>a.center<1&&a.gap>=12&&a.gap<=16&&a.padding>=40&&a.appearance==='none'),JSON.stringify({width,tab,arrows}));
    const sizes=await page.locator('.ts-tabs button,.ts-savebar .btn,.ts-disclosure>summary:visible').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect().height));assert.ok(sizes.every(h=>h>=44));
   }
   checks.push(`${engine.name()} four panes + header containment ${width}`);
  }
  await page.setViewportSize({width:1440,height:960});
  await page.locator('.ts-tabs').getByRole('button',{name:'Temas',exact:true}).click();await page.getByRole('button',{name:/^Velvet Vice,/}).click();
  await page.getByText('Personalizar colores',{exact:true}).click();await page.getByRole('textbox',{name:'Color principal en HEX',exact:true}).fill('#123');
  await page.locator('.ts-tabs').getByRole('button',{name:'Identidad',exact:true}).click();await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Color principal en HEX');assert.equal(await page.locator('[data-react-studio-panel=themes]').isVisible(),true);
  await page.getByRole('textbox',{name:'Color principal en HEX',exact:true}).fill('#55263D');
  await page.locator('.ts-tabs').getByRole('button',{name:'Detalles',exact:true}).click();await page.getByText('Opciones avanzadas',{exact:false}).click();
  await page.getByRole('button',{name:'ATRY Profesional',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Guardar cambios',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Volver a mi borrador',exact:true}).click();
  assert.equal(writes,0,'Changing panes/palette/manual fields/exploration must not save');
  await page.getByRole('button',{name:'Descartar',exact:true}).click();await page.getByRole('button',{name:'Descartar cambios',exact:true}).click();
  await page.locator('#business-switch').selectOption('pa');await page.waitForFunction(()=>document.querySelector('.app-shell')?.dataset.businessId==='pa');await page.goto(fixture.base+'/#/app/configuracion/apariencia');await page.waitForFunction(()=>document.querySelector('.ts-plan')?.textContent.includes('Profesional'));
  await page.locator('.ts-tabs').getByRole('button',{name:'Detalles',exact:true}).click();await page.getByRole('combobox',{name:'Modo del panel',exact:true}).selectOption('dark');
  await page.locator('.ts-tabs').getByRole('button',{name:'Temas',exact:true}).click();await page.getByText('Tus estilos guardados',{exact:true}).click();await page.getByRole('textbox',{name:'Nombre del estilo',exact:true}).fill('Mi estilo QA');await page.getByRole('button',{name:'Guardar estilo en borrador',exact:true}).click();await page.getByRole('button',{name:'Mi estilo QA',exact:true}).waitFor();
  await page.locator('.ts-tabs').getByRole('button',{name:'Identidad',exact:true}).click();
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#4754E6';x.fillRect(0,0,64,64);return c.toDataURL('image/png').split(',')[1]});
  await page.locator('#business-logo-react').setInputFiles({name:'logo-local.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.getByText('Lista para ajustar.',{exact:true}).waitFor();await page.getByRole('button',{name:'Aplicar recorte',exact:true}).click();
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByRole('button',{name:'Aplicar apariencia',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.appearanceMode==='dark'&&document.querySelector('.ts-savebar')?.textContent.includes('Todo guardado'));
  assert.equal(writes,1);await page.getByRole('button',{name:'Eliminar logo',exact:true}).click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await page.locator('.logo-identity-preview img').count(),1);
  await page.locator('.ts-tabs').getByRole('button',{name:'Temas',exact:true}).click();await page.getByText('Tus estilos guardados',{exact:true}).click();await page.getByRole('button',{name:'Mi estilo QA',exact:true}).waitFor();
  await page.locator('#business-switch').selectOption('essential');await page.waitForFunction(()=>document.querySelector('.app-shell')?.dataset.businessId==='essential');await page.goto(fixture.base+'/#/app/configuracion/apariencia');await page.waitForFunction(()=>document.querySelector('.ts-plan')?.textContent.includes('Esencial'));
  await page.locator('.ts-tabs').getByRole('button',{name:'Temas',exact:true}).click();assert.equal(await page.locator('.cc-card:disabled').count(),9);await page.getByText('Personalizar colores',{exact:true}).click();assert.equal(await page.locator('.ts-essential-colors button').count(),3);
  await page.locator('.ts-tabs').getByRole('button',{name:'Detalles',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:/Contornos/}).isDisabled(),true);
  assert.deepEqual(errors,[]);checks.push(`${engine.name()} manual validation reveals hidden field; draft/explore isolation; Pro style + crop + explicit save + cancel deletion; essential gates`);
  await browser.close();browser=null;
  // Reset only the test business before testing the next browser engine.
  await fixture.db.query('SELECT atry_save_appearance($1,$2::jsonb)',['pa',JSON.stringify({theme_config:{version:1,primary:'#4754E6',secondary:'#00A5E2',mode:'light',presets:[]},logo_url:''})]);
 }
 console.log(JSON.stringify({passed:true,checks},null,2));
}finally{await browser?.close();await fixture.close()}})().catch(e=>{console.error(e);process.exitCode=1});
