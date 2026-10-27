'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {createLocalPreview}=require('./iatry-v3-preview.cjs');
(async()=>{for(const [name,engine]of Object.entries({chromium,webkit})){
 const server=await createLocalPreview(),browser=await engine.launch(name==='chromium'?{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:960},serviceWorkers:'block'}),p=await context.newPage();
 await p.route('**/*',r=>new URL(r.request().url()).origin===server.base?r.continue():r.abort());
 try{
  await p.goto(server.base+'/local-assistant');
  const dock=p.locator('.iatry-v3 .iatry-call'),root=p.locator('.iatry-v3');await dock.waitFor();
  const dashboard=p.locator('[data-react-dashboard]');await dashboard.waitFor();await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);const before=await dashboard.boundingBox();
  await dock.click();await p.locator('#iatry-intent').waitFor();
  const after=await dashboard.boundingBox();assert.ok(after.width>=650);const panel=await p.locator('.iatry-v2-panel').boundingBox();assert.ok(after.x+after.width<=panel.x-12,'Desktop rail must keep content controls clear');
  assert.ok(await p.locator('[data-iatry-tool]').count()<=3);
  assert.equal(await p.locator('.iatry-operation-areas').count(),0);
  assert.match(await p.locator('[data-iatry-operations]').innerText(),/Hola/);
  await p.getByRole('button',{name:'Ver todas las funciones',exact:true}).click();
  assert.ok(await p.locator('.iatry-operation-areas button').count()>3);
  await p.getByRole('button',{name:'Volver a sugerencias',exact:true}).click();
  await p.locator('[data-iatry-tool="services.create"]').click();await p.locator('input[name=name]').fill('Borrador conservado');await p.getByRole('button',{name:'Minimizar IAtry',exact:true}).click();assert.equal(await dock.getAttribute('aria-expanded'),'false');await dock.click();assert.equal(await p.locator('input[name=name]').inputValue(),'Borrador conservado');await p.getByRole('button',{name:'Cancelar operación',exact:true}).click();
  const avatar=p.locator('.iatry-v2-panel .iatry-liquid');
  await p.waitForFunction(()=>document.querySelector('.iatry-v2-panel .iatry-liquid')?.dataset.energyVisible==='true');
  assert.match(await avatar.locator('img').getAttribute('src'),/assets\/brand\/atry.png$/);
  for(const state of ['rest','interaction','preparation','confirmation','success','error','farewell']){
   await root.evaluate((n,state)=>n.dataset.energyState=state,state);
   const animation=await avatar.locator('.iatry-current-a').evaluate(n=>({name:getComputedStyle(n).animationName,state:getComputedStyle(n).animationPlayState,frames:n.getAnimations()[0]?.effect.getKeyframes()}));
   assert.equal(animation.name,'iatry-liquid-tide-a');assert.equal(animation.state,'running');
   for(const frame of animation.frames||[])for(const key of Object.keys(frame))assert.ok(['offset','computedOffset','easing','composite','transform','opacity'].includes(key),key);
  }
  // Current rest frames change only transforms; no layout is scheduled by energy.
  if(name==='chromium'){
   await root.evaluate(n=>n.dataset.energyState='interaction');await p.waitForTimeout(100);
   const cdp=await context.newCDPSession(p);await cdp.send('Performance.enable');
   const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
   const a=await metrics();await p.waitForTimeout(1000);const b=await metrics();assert.equal(b.LayoutCount-a.LayoutCount,0);
   console.log('PASS compositor sample: no layout; script ms',((b.ScriptDuration-a.ScriptDuration)*1000).toFixed(2));
  }
  await p.locator('.iatry-v2-preferences summary').click();
  await p.getByRole('button',{name:'Pausar movimiento',exact:true}).click();
  assert.equal(await avatar.locator('.iatry-current-a').evaluate(n=>getComputedStyle(n).animationPlayState),'paused');
  await p.getByRole('button',{name:'Activar movimiento',exact:true}).click();
  await p.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await avatar.locator('.iatry-current-a').evaluate(n=>getComputedStyle(n).animationName),'none');
  await p.emulateMedia({reducedMotion:'no-preference'});
  await avatar.evaluate(n=>n.style.transform='translateX(-3000px)');
  await p.waitForFunction(()=>document.querySelector('.iatry-v2-panel .iatry-liquid')?.dataset.energyVisible==='false');
  assert.equal(await avatar.locator('.iatry-current-a').evaluate(n=>getComputedStyle(n).animationPlayState),'paused');
  await avatar.evaluate(n=>n.style.transform='');
  for(const width of [320,390,1440]){
   await p.setViewportSize({width,height:844});await p.waitForTimeout(100);const box=await p.locator('.iatry-v2-panel').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.ok(box.y>=0&&box.y+box.height<=845);
  }
  await p.locator('#iatry-intent').focus();await p.keyboard.press('Escape');
  assert.equal(await dock.getAttribute('aria-expanded'),'false');await dock.evaluate(n=>{if(document.activeElement!==n)throw Error('Focus did not return')});
  console.log('PASS',name,'seven energy states; official emblem; max three suggestions; secondary explorer; desktop rail; preserved minimized draft; pause/reduced motion/offscreen; 320/390/1440; Escape and focus');
 }finally{await context.close();await browser.close();await server.close()}
}})().catch(e=>{console.error(e);process.exitCode=1});
