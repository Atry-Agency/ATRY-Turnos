'use strict';
const assert=require('node:assert/strict'),{chromium,webkit}=require('playwright'),{createPreview}=require('../international/preview.cjs');
(async()=>{const server=await createPreview(0);try{
 const slug=(await server.db.query("SELECT slug FROM businesses WHERE id='b1'")).rows[0].slug;
 for(const [name,type] of [['Chrome',chromium],['WebKit',webkit]]){
  const browser=await type.launch({headless:true,...(name==='Chrome'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  try{for(const width of [320,375,390,430,768,1440]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',extraHTTPHeaders:{'x-atry-local-fixture-id':name+'-'+width}});await context.route('**/*',route=>new URL(route.request().url()).origin===server.base?route.continue():route.abort());const page=await context.newPage();
   await page.goto(server.base+'/#/reservar/'+slug);await page.locator('.book-step').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForLoadState('networkidle');
   const check=async state=>{const rows=await page.locator('.book-step').evaluateAll(steps=>steps.map(step=>{const circle=step.querySelector('.num'),heading=step.querySelector('h2'),r=circle.getBoundingClientRect(),h=heading.getBoundingClientRect();return{width:r.width,height:r.height,flexShrink:getComputedStyle(circle).flexShrink,right:h.right,parentRight:step.getBoundingClientRect().right}}));assert.ok(rows.length>=3);for(const row of rows){assert.ok(Math.abs(row.width-row.height)<.5,JSON.stringify({name,width,state,row}));assert.equal(row.flexShrink,'0');assert.ok(row.right<=row.parentRight+1)}assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);};
   await check('initial');await page.locator('.service-option').first().click();await check('selected service');
   await page.locator('.book-step h2').nth(1).evaluate(node=>{node.textContent='¿Con qué profesional de nuestro equipo querés reservar esta atención?'});await check('long heading');
   console.log('PASS',name,width,'all step badges round before/after selection and with wrapped long titles; no captures');await context.close();
  }}finally{await browser.close()}
 }
}finally{await server.close()}})().catch(error=>{console.error(error.stack);process.exitCode=1});
