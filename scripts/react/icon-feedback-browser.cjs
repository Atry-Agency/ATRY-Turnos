'use strict';
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),{createPreview}=require('../international/preview.cjs');
(async()=>{const fixture=await createPreview(0,{adminChat:true}),checks=[];let browser;
try{for(const engine of [chromium,webkit]){
 browser=await engine.launch(engine===chromium?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{headless:true});const page=await browser.newPage({serviceWorkers:'block',permissions:['clipboard-read','clipboard-write'] .filter(()=>engine===chromium)});
 page.setDefaultTimeout(12000);await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}},configurable:true})});await page.goto(fixture.base+'/#/app');await page.locator('.sidebar .navlink>.i').first().waitFor({state:'attached'});
 // Render each unchanged upstream glyph at both navigation sizes to detect clipping.
 const dir='frontend/react/src/domain/icon-library/',manifest=JSON.parse(fs.readFileSync(dir+'sources.json'));
 const glyphs=manifest.icons.map(e=>({name:e.name,svg:fs.readFileSync(dir+e.name+'.svg','utf8')}));
 await page.evaluate(glyphs=>{const box=document.createElement('section');box.id='icon-geometry-verification';for(const size of [16,20])for(const g of glyphs){const cell=document.createElement('span');cell.innerHTML=g.svg;const svg=cell.firstElementChild;svg.setAttribute('width',String(size));svg.setAttribute('height',String(size));svg.setAttribute('stroke-width','1.7');svg.setAttribute('data-source',g.name);box.append(cell)}document.body.append(box)},glyphs);
 const bounds=await page.locator('#icon-geometry-verification svg').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBBox();return{name:n.getAttribute('data-source'),x:b.x,y:b.y,right:b.x+b.width,bottom:b.y+b.height}}));assert.ok(bounds.every(b=>b.x>=.8&&b.y>=.8&&b.right<=23.2&&b.bottom<=23.2),JSON.stringify(bounds.filter(b=>b.x<.8||b.y<.8||b.right>23.2||b.bottom>23.2)));
 await page.locator('#icon-geometry-verification').evaluate(n=>n.remove());
 for(const width of [320,390,430,768,1060,1440]){await page.setViewportSize({width,height:960});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 // A real copy action, with editable data untouched, drives a finite confirmation.
 await page.setViewportSize({width:1440,height:960});await page.getByRole('button',{name:'Copiar enlace de reservas',exact:true}).click();const check=page.locator('.topbar [data-icon-motion="confirm"]');await check.waitFor();assert.equal(await check.evaluate(n=>getComputedStyle(n).animationIterationCount),'1');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await check.evaluate(n=>getComputedStyle(n).animationName),'none');
 await page.emulateMedia({reducedMotion:'no-preference'});const navAnimations=await page.locator('.sidebar .i').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).animationName));assert.ok(navAnimations.every(a=>a==='none'));
 checks.push(engine.name()+': '+glyphs.length+' official glyphs at 16/20 px, six widths, real copy confirmation, reduced motion and static navigation');await browser.close();browser=null;
}console.log(JSON.stringify({passed:true,checks},null,2));}finally{await browser?.close();await fixture.close()}})().catch(e=>{console.error(e);process.exitCode=1});
