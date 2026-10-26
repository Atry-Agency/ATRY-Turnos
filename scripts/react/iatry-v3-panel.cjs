'use strict';
const assert=require('node:assert/strict'),{chromium,webkit}=require('playwright'),{createLocalPreview}=require('./iatry-v3-preview.cjs');
const luminance=rgb=>rgb.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
(async()=>{for(const[name,engine]of Object.entries({chromium,webkit})){
 const server=await createLocalPreview(),browser=await engine.launch(name==='chromium'?{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{headless:true}),p=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce',serviceWorkers:'block'}),requests=[];
 await p.route('**/*',r=>new URL(r.request().url()).origin===server.base?r.continue():r.abort());
 p.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.method()+' '+new URL(r.url()).pathname)});
 try{
  await p.goto(server.base+'/local-assistant');const dock=p.locator('.iatry-call');await dock.waitFor();await p.locator('[data-react-dashboard]').waitFor();await p.evaluate(()=>document.fonts.ready);
  const snapshot=()=>p.evaluate(()=>['.sidebar','.navlink','.metric','.page-header h1'].map(selector=>{const n=document.querySelector(selector),s=getComputedStyle(n);return{selector,color:s.color,background:s.backgroundColor,font:s.fontFamily,size:s.fontSize,radius:s.borderRadius,border:s.borderColor}}));
  const before=await snapshot(),original=await p.locator('[data-react-dashboard]').boundingBox(),count=requests.length;
  await dock.click();const panel=p.getByRole('dialog',{name:'IAtry, conversación guiada'});await p.locator('#iatry-intent').waitFor();assert.deepEqual(await snapshot(),before,'Assistant styles must not change application typography/colors/cards/navigation');assert.equal(requests.length,count,'Opening must not add data queries');assert.match(await p.locator('.iatry-panel-intro h2').evaluate(n=>getComputedStyle(n).fontFamily),/system-ui/);assert.equal(await p.locator('label[for=iatry-intent]').evaluate(n=>getComputedStyle(n).position),'absolute');assert.equal((await p.locator('label[for=iatry-intent]').boundingBox()).width,1);
  for(const width of [320,390,768,1024,1440,1920]){
   await p.setViewportSize({width,height:960});await p.waitForTimeout(50);const bounds=await panel.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);assert.ok(bounds.y>=0&&bounds.y+bounds.height<=961);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(width>=1440){const content=await p.locator('[data-react-dashboard]').boundingBox();assert.ok(content.width>=650);assert.ok(content.x+content.width<bounds.x)}
   if(width<=600)assert.ok(bounds.y+bounds.height>=930,'Mobile panel is anchored near the bottom');
  }
  await p.setViewportSize({width:1440,height:960});
  // Test custom colors on the surrounding system without changing its theme controls.
  await p.evaluate(()=>{document.body.style.setProperty('--surface','#11251d');document.body.style.setProperty('--ink','#edfbee');document.body.style.setProperty('--muted','#c0e8ce');document.body.style.setProperty('--accent','#f2ba36')});
  assert.equal(await panel.evaluate(n=>getComputedStyle(n).color),'rgb(17, 28, 72)');
  for(const selector of ['.iatry-panel-intro p','.iatry-suggestion-copy small','.iatry-mode-menu summary','.iatry-v2-preferences summary']){
   const color=await p.locator(selector).first().evaluate(n=>getComputedStyle(n).color.match(/[\d.]+/g).slice(0,3).map(Number));assert.ok(contrast(color,[233,237,255])>=4.5,selector+' contrast');
  }
  await p.evaluate(()=>{for(const key of ['--surface','--ink','--muted','--accent'])document.body.style.removeProperty(key)});
  await p.getByRole('button',{name:'Cerrar IAtry',exact:true}).click();assert.deepEqual(await snapshot(),before);const restored=await p.locator('[data-react-dashboard]').boundingBox();assert.deepEqual(restored,original,'Closing restores original application geometry');
  assert.equal(requests.filter(x=>!x.startsWith('GET ')).length,0);
  console.log('PASS',name,'isolated presentation; original app restored; clear desktop rail; mobile/tablet bounds; custom theme contrast; no data queries or writes');
 }finally{await browser.close();await server.close()}
}})().catch(e=>{console.error(e);process.exitCode=1});
