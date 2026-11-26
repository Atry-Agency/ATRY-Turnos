'use strict';
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),{createPreview}=require('../international/preview.cjs');
(async()=>{const fixture=await createPreview(0,{adminChat:true}),checks=[];let browser;
try{for(const engine of [chromium,webkit]){
 browser=await engine.launch(engine===chromium?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{headless:true});const page=await browser.newPage({serviceWorkers:'block',reducedMotion:'reduce'});
 for(const [route,selector,expected]of [['/app/configuracion/apariencia','.sidebar .navlink>.i',20],['/admin/inicio','.cc-sidebar nav a>.i',20]]){
  await page.goto(fixture.base+'/#'+route);await page.locator(selector).first().waitFor({state:'attached'});
  for(const width of [320,390,430,768,1060,1440]){
   await page.setViewportSize({width,height:960});const trigger=page.getByRole('button',{name:'Abrir menú',exact:true});if(await trigger.isVisible())await trigger.click();
   const icons=await page.locator(selector).evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),parent=n.parentElement.getBoundingClientRect(),c=getComputedStyle(n);return{width:r.width,height:r.height,stroke:parseFloat(c.strokeWidth),center:Math.abs(r.top+r.height/2-parent.top-parent.height/2),left:r.left,viewBox:n.getAttribute('viewBox'),target:parent.height}}));
   assert.ok(icons.length>=8);assert.ok(icons.every(i=>i.width===expected&&i.height===expected&&i.stroke===1.7&&i.center<1&&i.viewBox==='0 0 24 24'&&i.target>=44),JSON.stringify({route,width,icons}));
   assert.ok(Math.max(...icons.map(i=>i.left))-Math.min(...icons.map(i=>i.left))<1,`${route} ${width}: shared icon column`);
   if(route.startsWith('/app')){
    const settings=page.getByRole('button',{name:'Configuración',exact:true});if(await settings.getAttribute('aria-expanded')!=='true')await settings.click();
    const sub=await page.locator('.settings-nav-link>.i').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),p=n.parentElement.getBoundingClientRect();return{w:r.width,h:r.height,c:Math.abs(r.top+r.height/2-p.top-p.height/2)}}));assert.ok(sub.every(i=>i.w===16&&i.h===16&&i.c<1));
   }
   const close=page.locator('.sidebar .sidebar-close');if(await close.isVisible())await close.click();checks.push(`${engine.name()} ${route} ${width}: icon column, stroke, center, touch target and hierarchy`);
  }
 }
 await browser.close();browser=null;
}console.log(JSON.stringify({passed:true,checks},null,2));}finally{await browser?.close();await fixture.close()}})().catch(e=>{console.error(e);process.exitCode=1});
