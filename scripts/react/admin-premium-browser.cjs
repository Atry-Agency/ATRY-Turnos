'use strict';
// Local administrative presentation and interaction checks. No captures or real writes.
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {createPreview}=require('../international/preview.cjs');
const sections=['inicio','negocios','usuarios','comercial','correos','sistema','soporte','datos','auditoria','configuracion'];
(async()=>{const server=await createPreview(0,{adminChat:true});try{
 for(const [name,type] of [['Chrome',chromium],['WebKit',webkit]].filter(([n])=>!process.env.ATRY_ADMIN_ENGINE||n===process.env.ATRY_ADMIN_ENGINE)){
  const browser=await type.launch({headless:true,...(name==='Chrome'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  try{for(const width of (process.env.ATRY_ADMIN_WIDTHS?process.env.ATRY_ADMIN_WIDTHS.split(',').map(Number):[320,375,390,430,768,1440])){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<768,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[],writes=[];
   page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',r=>{const request=r.request(),url=new URL(request.url());if(url.origin!==server.base)return r.abort();if(request.method()!=='GET'){writes.push(request.url());return r.abort()}return r.continue()});
   const fit=async section=>{
    await page.evaluate(()=>document.fonts.ready);
    const result=await page.evaluate(()=>{
     const main=document.querySelector('.cc-main').getBoundingClientRect();
     const clipped=[...document.querySelectorAll('.cc-plan-card,.cc-plan-card>*,.cc-cell,.cc-context-links>a,.cc-global-input,.cc-business-entry')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return{cls:e.className,width:e.clientWidth,scroll:e.scrollWidth,left:r.left,right:r.right,parentLeft:p.left,parentRight:p.right}}).filter(e=>e.scroll>e.width+1||e.left<main.left-1||e.right>main.right+1);
     return{documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,clipped};
    });
    assert.ok(result.documentWidth<=width+1,JSON.stringify({name,width,section,result}));assert.deepEqual(result.clipped,[],JSON.stringify({name,width,section,result}));
   };
   for(const section of sections){
    await page.goto(server.base+'/#/admin/'+section);await page.locator('#cc-content > .cc-source').waitFor();assert.equal(await page.locator('#cc-content [role=alert]').count(),0,section);await fit(section);
    const shortcuts=page.locator('.cc-context-links a');for(const item of await shortcuts.all()){const box=await item.boundingBox();assert.ok(box.height>=44);assert.match(await item.getAttribute('href'),/^#\/admin\//)}
    if(section==='negocios'){
     const disclosure=page.locator('.cc-filter-options>summary');if(await disclosure.isVisible())await disclosure.click();
     const filters=await page.locator('.cc-filter-fields').evaluate(e=>({rows:[...new Set([...e.children].map(c=>Math.round(c.getBoundingClientRect().top)))].length,selects:[...e.querySelectorAll('select')].map(c=>({appearance:getComputedStyle(c).appearance,padding:parseFloat(getComputedStyle(c).paddingRight)}))}));assert.ok(filters.rows<=2,JSON.stringify({name,width,filters}));assert.ok(filters.selects.every(s=>s.appearance==='none'&&s.padding>=35));
     const dates=await page.locator('.cc-business-state>small').evaluateAll(nodes=>nodes.map(e=>{const range=document.createRange();range.selectNodeContents(e);const rect=e.getBoundingClientRect(),parent=e.closest('.cc-business-entry').getBoundingClientRect();return{lines:new Set([...range.getClientRects()].map(r=>Math.round(r.top))).size,right:rect.right,parent:parent.right,text:e.textContent}}));for(const date of dates){assert.equal(date.lines,1,JSON.stringify({name,width,date}));assert.ok(date.right<=date.parent-10,JSON.stringify(date))}
     const quick=page.getByRole('navigation',{name:'Accesos rápidos de esta sección'}).getByRole('link',{name:'Por habilitar',exact:true});await quick.click();await page.locator('#cc-content > .cc-source').waitFor();assert.match(page.url(),/status=pending/);await fit(section)
    }
    if(section==='configuracion'){
     const cards=page.locator('.cc-plan-card');await cards.first().waitFor();assert.ok(await cards.count()>=3,'Expected current plans: '+await cards.count());for(const card of await cards.all()){assert.equal(await card.locator('.cc-plan-limits>div').count(),2);assert.equal(await card.locator('.cc-plan-features li').count(),3);assert.match(await card.locator('.cc-plan-price').innerText(),/UYU \/ mes/)}
     await cards.first().getByRole('button',{name:'Ajustar plan',exact:true}).click();await page.locator('[data-react-form=admin-plan]').waitFor();for(const field of ['price_uyu','staff_limit','mail_limit','reason'])assert.equal(await page.getByRole('dialog').locator('[name='+field+']').count(),1);await page.getByRole('button',{name:'Cerrar ventana',exact:true}).click();
     await cards.first().locator('h3').evaluate(e=>e.textContent='ATRY · Plan con un nombre extenso para comprobar la composición');await fit('long plan');
    }
   }
   // Keyboard-visible focus and drawer reachability, without executing operations.
   const menu=page.getByRole('button',{name:'Abrir menú',exact:true});if(await menu.isVisible()){await menu.click();await page.locator('.cc-sidebar.open').waitFor();await page.keyboard.press('Escape');await page.locator('.cc-sidebar.open').waitFor({state:'hidden'})}
   await page.locator('#cc-global').focus();await page.keyboard.press(name==='WebKit'?'Alt+Tab':'Tab');assert.equal(await page.locator('[data-react-form=admin-global] button').evaluate(e=>e===document.activeElement),true);
   await page.getByRole('button',{name:'Pedir ayuda',exact:true}).click();await page.locator('#cc-chat-message').waitFor();await page.locator('#cc-chat-message').fill('hola');await page.locator('#cc-chat-message').press('Enter');await page.locator('.cc-assistant-log p').first().waitFor();assert.equal(await page.locator('.cc-chat-confirm').count(),0);await fit('assistant');
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('PASS',name,width,'10 sections; inner bounds, 44px shortcuts, filtered navigation, preserved plan dialog, long names, keyboard/drawer, IAtry greeting; zero writes/captures');await context.close();
  }}finally{await browser.close()}
 }
}finally{await server.close()}})().catch(e=>{console.error(e.stack);process.exitCode=1});
