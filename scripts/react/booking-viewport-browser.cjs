'use strict';
// Rendered local checks: inner scrolling, focus and safe-area layout; no screenshots.
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {createPreview}=require('../international/preview.cjs');
(async()=>{
 const server=await createPreview(0);
 try{
  const slug=(await server.db.query("SELECT slug FROM businesses WHERE id='b1'")).rows[0].slug;
  for(const [name,type] of [['Chrome',chromium],['WebKit',webkit]]){
   const browser=await type.launch({headless:true,...(name==='Chrome'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
   try{for(const width of [320,375,390,430,768,1440]){
    const context=await browser.newContext({viewport:{width,height:852},hasTouch:width<768,isMobile:name==='WebKit'&&width<768,serviceWorkers:'block',reducedMotion:'reduce',extraHTTPHeaders:{'x-atry-local-fixture-id':'viewport-'+name+'-'+width}});
    await context.route('**/*',r=>new URL(r.request().url()).origin===server.base?r.continue():r.abort());
    const page=await context.newPage();page.setDefaultTimeout(15000);
    await page.goto(server.base+'/#/app/inicio');await page.locator('.app-shell').waitFor();
    const menu=page.getByRole('button',{name:'Abrir menú',exact:true});if(await menu.isVisible())await menu.click();
    await page.locator('#business-switch').selectOption('b1');await page.waitForFunction(()=>document.querySelector('.app-shell')?.dataset.businessId==='b1');
    const close=page.locator('.sidebar.open .sidebar-close');if(await close.isVisible())await close.click();
    await page.getByRole('button',{name:'Crear turno',exact:true}).click();await page.locator('[name=service_id]').waitFor();await page.evaluate(()=>document.fonts.ready);
    const fit=async()=>{
     const geometry=await page.locator('.ui-dialog-body').evaluate(body=>{
      const r=body.getBoundingClientRect(),s=getComputedStyle(body);
      return{overflow:s.overflowX,touch:s.touchAction,width:body.clientWidth,scrollWidth:body.scrollWidth,left:body.scrollLeft,clipped:[...body.querySelectorAll('form,.field,form>.form-full,input:not([type=hidden]),select,textarea')].filter(e=>e.getClientRects().length).map(e=>({name:e.getAttribute('name')||e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(e=>e.left<r.left-1||e.right>r.right+1)};
     });
     assert.equal(geometry.overflow,'hidden');assert.match(geometry.touch,/pan-y/);assert.ok(geometry.scrollWidth<=geometry.width+1,JSON.stringify({name,width,geometry}));assert.equal(geometry.left,0);assert.deepEqual(geometry.clipped,[],JSON.stringify({name,width,geometry}));
    };
    await fit();
    for(const selector of ['#react-customer-query','[name=date]','[name=time]','[name=customer_name]','[name=customer_email]']){await page.locator(selector).focus();await fit()}
    await page.locator('.ui-dialog-body').evaluate(body=>{body.scrollLeft=180;body.scrollTop=body.scrollHeight});await fit();
    await page.getByRole('dialog').getByRole('button',{name:'Guardar reserva',exact:true}).scrollIntoViewIfNeeded();
    await page.setViewportSize({width,height:500});await page.waitForTimeout(100);await fit();
    const bounds=await page.getByRole('dialog').evaluate(e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,height:visualViewport.height}));assert.ok(bounds.top>=0&&bounds.bottom<=bounds.height+1,JSON.stringify(bounds));
    await page.getByRole('button',{name:'Elegir un horario disponible',exact:true}).click();await page.locator('[data-react-time-finder]').waitFor();await fit();await page.locator('[data-react-time-finder] input[type=date]').focus();await fit();await page.getByRole('button',{name:'Volver sin cambiar el horario',exact:true}).click();await page.locator('[name=service_id]').waitFor();await fit();
    await page.getByRole('button',{name:'Cerrar ventana',exact:true}).click();
    await page.setViewportSize({width,height:852});
    await page.goto(server.base+'/#/reservar/'+slug);await page.locator('.pb-identity h1').waitFor();await page.evaluate(()=>document.fonts.ready);
    if(width<=600){
     const identity=await page.locator('.pb-identity').evaluate(e=>{const a=e.querySelector('.pb-logo').getBoundingClientRect(),b=e.querySelector('h1').getBoundingClientRect();return{gap:b.left-a.right,vertical:Math.abs((a.top+a.bottom-b.top-b.bottom)/2),align:getComputedStyle(e.querySelector('h1')).textAlign}});
     assert.ok(identity.gap>=10&&identity.gap<=20,JSON.stringify(identity));assert.ok(identity.vertical<1,JSON.stringify(identity));assert.equal(identity.align,'start');
    }
    // Exercise authored safe-area declarations with a synthetic 47px inset.
    // Playwright has no physical iPhone safe-area env; this is a layout simulation.
    const nav=page.locator('.public-nav');const initial=await nav.evaluate(e=>parseFloat(getComputedStyle(e).paddingTop));
    await page.evaluate(()=>{
     const output=[];
     const walk=rules=>{for(const rule of rules){if(rule instanceof CSSMediaRule){if(matchMedia(rule.conditionText).matches)walk(rule.cssRules)}else if(rule instanceof CSSStyleRule&&rule.selectorText==='.public-nav'&&rule.style.cssText.includes('safe-area-inset-top'))output.push(rule.cssText.replace(/env\(safe-area-inset-top[^)]*\)/g,'47px'));}};
     for(const sheet of document.styleSheets){try{walk(sheet.cssRules)}catch{}}
     if(!output.length)throw Error('Missing authored safe-area clearance');const style=document.createElement('style');style.textContent=output.join('\n');document.head.append(style);
    });
    assert.ok((await nav.evaluate(e=>parseFloat(getComputedStyle(e).paddingTop)))>=initial+46);
    if(width<=600){await page.evaluate(()=>window.scrollTo(0,300));const header=await nav.evaluate(e=>({top:e.getBoundingClientRect().top,childTop:e.querySelector('a').getBoundingClientRect().top}));assert.ok(Math.abs(header.top)<1,JSON.stringify(header));assert.ok(header.childTop>=47,JSON.stringify(header));}
    await page.locator('.public-nav a').last().scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    console.log('PASS',name,width,'inner form bounds/focus/lateral lock, vertical actions, reduced viewport, identity alignment and header clearance; no captures');await context.close();
   }}finally{await browser.close()}
  }
 }finally{await server.close()}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
