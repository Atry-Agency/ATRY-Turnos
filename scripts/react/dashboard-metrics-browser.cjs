'use strict';
// Read-only UI tests with disposable local data and intercepted dashboard values.
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),{createPreview}=require('../international/preview.cjs');
(async()=>{const fixture=await createPreview(0),checks=[];let browser;
try{for(const engine of [chromium,webkit]){
 browser=await engine.launch(engine===chromium?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{headless:true});
 for(const [id,country]of [['b1','UY'],['pa','PA']]){
  const page=await browser.newPage({serviceWorkers:'block'});let amount=0;
  await page.route('**/api/business/*/dashboard*',async route=>{const response=await route.fetch(),data=await response.json();data.today_count=12345678;data.customers=98765432;data.staff=12;data.totals.completed_revenue=amount;data.totals.completed_revenue_minor=Math.round(amount*100);await route.fulfill({response,json:data})});
  await page.goto(fixture.base+'/#/app/inicio');await page.locator('[data-react-dashboard]').waitFor();
  if(id==='pa'){await page.locator('#business-switch').selectOption(id);await page.waitForFunction(()=>document.querySelector('.app-shell')?.dataset.businessId==='pa');}
  for(const value of [0,123456789.25,9876543210.99]){
   amount=value;await page.reload();await page.locator('.metric-value--money').waitFor();
   const expected=country==='PA'?new Intl.NumberFormat('es-PA',{style:'currency',currency:'USD',currencyDisplay:'code',minimumFractionDigits:2,maximumFractionDigits:2}).format(value):'$'+value.toLocaleString('es-UY');
   assert.equal(await page.locator('.metric-value--money').textContent(),expected,'Keep the full formatted amount without abbreviation or truncation');
   for(const width of [320,375,390,430,768,1440]){
    await page.setViewportSize({width,height:960});
    const dimensions=await page.locator('.dashboard-metrics .metric-value').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),p=n.closest('.metric').getBoundingClientRect();const range=document.createRange();range.selectNodeContents(n);return{scroll:n.scrollWidth,client:n.clientWidth,inside:Array.from(range.getClientRects()).every(b=>b.left>=p.left-1&&b.right<=p.right+1&&b.top>=p.top-1&&b.bottom<=p.bottom+1),clipped:getComputedStyle(n).textOverflow==='ellipsis'}}));
    assert.ok(dimensions.every(d=>d.scroll<=d.client+1&&d.inside&&!d.clipped),JSON.stringify({country,width,value,dimensions}));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   }
  }
  checks.push(`${engine.name()} ${country}: zero, large amounts and long counts inside cards at six widths; exact currency/precision retained`);await page.close();
 }
 await browser.close();browser=null;
}console.log(JSON.stringify({passed:true,checks},null,2));}finally{await browser?.close();await fixture.close()}})().catch(e=>{console.error(e);process.exitCode=1});
