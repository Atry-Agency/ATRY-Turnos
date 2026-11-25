'use strict';
// Disposable local database only. Rendered DOM/geometry checks; deliberately no screenshots.
const assert=require('node:assert/strict'),{chromium,webkit}=require('playwright'),{createPreview}=require('../international/preview.cjs'),T=require('../../web/theme-core');
(async()=>{
 const fixture=await createPreview(0),checks=[];let browser;
 try{
  for(const engine of [chromium,webkit]){
   browser=await engine.launch(engine===chromium?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{headless:true});
   const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];let writes=0;
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/appearance')&&r.method()!=='GET')writes++});
   await page.goto(fixture.base+'/#/app/configuracion/apariencia');await page.getByRole('button',{name:'Temas',exact:true}).click();
   await page.locator('.cc-card').first().waitFor();assert.equal(await page.locator('.cc-card').count(),9);
   for(const width of [320,375,390,430,768,1440]){
    await page.setViewportSize({width,height:1000});
    for(const category of ['Calma','Energía','Actitud','Todas']){
     await page.getByRole('button',{name:category,exact:true}).click();assert.equal(await page.locator('.cc-card').count(),category==='Todas'?9:3);
     const geometry=await page.locator('.cc-card,.cc-filters button,.cc-original').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{width:r.width,height:r.height,left:r.left,right:r.right,scroll:n.scrollWidth,client:n.clientWidth}}));
     assert.ok(geometry.every(r=>r.height>=44&&r.left>=0&&r.right<=width+1&&r.scroll<=r.client+1),JSON.stringify({width,category,geometry}));
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${engine.name()} ${width} page overflow`);
    checks.push(`${engine.name()} layout ${width}`);
   }
   await page.setViewportSize({width:390,height:1000});
   for(const mode of ['light','dark']){
    await page.getByRole('combobox',{name:'Modo del panel',exact:true}).selectOption(mode);
    for(const p of T.colorClub){
     await page.getByRole('button',{name:new RegExp('^'+p.name+',')}).click();
     assert.equal(await page.getByRole('button',{name:new RegExp('^'+p.name+',')}).getAttribute('aria-pressed'),'true');
     for(const view of ['Panel','Reservas']){
      await page.getByRole('button',{name:view,exact:true}).click();
      const actual=await page.locator('.ts-preview-frame').evaluate(el=>{const c=getComputedStyle(el);return{primary:c.getPropertyValue('--sp-action').trim(),secondary:c.getPropertyValue('--sp-secondary').trim(),accent:c.getPropertyValue('--sp-accent').trim(),id:el.dataset.colorClub}});
      assert.deepEqual(actual,{primary:p.primary,secondary:p.secondary,accent:p.accent,id:p.id});
     }
    }
   }
   assert.equal(writes,0,'Selection/filter/view changes must not autosave');
   await page.getByRole('button',{name:'Ver publicada',exact:true}).click();assert.equal(await page.locator('.ts-preview-frame').getAttribute('data-color-club'),null);
   await page.getByRole('button',{name:'Ver borrador',exact:true}).click();assert.equal(await page.locator('.ts-preview-frame').getAttribute('data-color-club'),'afterburn');
   await page.getByRole('button',{name:/^ATRY Original/}).click();assert.equal(await page.locator('.ts-preview-frame').getAttribute('data-color-club'),null);
   await page.getByRole('button',{name:'Calma',exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.cc-card').count(),3);
   assert.deepEqual(errors,[]);checks.push(`${engine.name()} 9 triples × light/dark × panel/public; keyboard; draft isolation; no autosave`);
   // Verify existing PostgreSQL persistence, public projection and actual page tokens.
   for(const [id,slug] of [['b1','negocio-prueba-1'],['pa','panama-local']]){
    for(const p of T.colorClub){
     await fixture.db.query('SELECT atry_save_appearance($1,$2::jsonb)',[id,JSON.stringify({theme_config:{version:1,primary:p.primary,secondary:p.secondary,mode:'dark'}})]);
     const stored=(await fixture.db.query('SELECT atry_business($1) v',[id])).rows[0].v;
     assert.equal(T.effective(stored).accent,p.accent);assert.equal(stored.theme_config.accent,undefined);
    }
    const publicPage=await browser.newPage({viewport:{width:390,height:1000},serviceWorkers:'block'});
    await publicPage.goto(fixture.base+'/#/reservar/'+slug);await publicPage.locator('.book-step .num').first().waitFor();
    const actual=await publicPage.locator('html').evaluate(el=>{const c=getComputedStyle(el);return{primary:c.getPropertyValue('--brand-primary'),secondary:c.getPropertyValue('--brand-secondary-raw'),accent:c.getPropertyValue('--brand-accent'),collection:el.dataset.themeCollection}});
    assert.deepEqual(actual,{primary:'#28282B',secondary:'#F9F9F9',accent:'#FF4200',collection:'color-club'});await publicPage.close();
   }
   // Restore the fixture before the next engine's published-versus-draft check.
   for(const id of ['b1','pa'])await fixture.db.query('SELECT atry_save_appearance($1,$2::jsonb)',[id,JSON.stringify({theme_config:{version:1,primary:'#4754E6',secondary:'#00A5E2',mode:'light'}})]);
   checks.push(`${engine.name()} UY/PA existing SQL save/read and public page with exact three tokens`);
   await browser.close();browser=null;
  }
  console.log(JSON.stringify({passed:true,checks},null,2));
 }finally{await browser?.close();await fixture.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
