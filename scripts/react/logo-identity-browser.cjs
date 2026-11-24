'use strict';
// Fictional demo only: all external requests and non-GET requests are blocked. Nothing is saved.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const base=process.env.ATRY_LOGO_BASE||'http://127.0.0.1:3381';
const out=process.env.ATRY_LOGO_OUTPUT||'/tmp/atry-logo-identity';
const widths=(process.env.ATRY_LOGO_WIDTHS||'320,375,390,430,768,1440').split(',').map(Number);
fs.mkdirSync(out,{recursive:true});
const results=[];
(async()=>{
 for(const [engine,type]of[['chrome',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true,...(engine==='chrome'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  try{
   for(const width of widths)for(const mode of['light','dark'])for(const hasLogo of[true,false]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<1001,hasTouch:width<1001,reducedMotion:'reduce',serviceWorkers:'block'});
    let blocked=0;
    await context.route('**/*',r=>{
     if(r.request().method()!=='GET'||new URL(r.request().url()).origin!==base){blocked++;return r.abort()}
     return r.continue();
    });
    if(!hasLogo)await context.addInitScript(()=>{
     let demo;
     Object.defineProperty(window,'ATRY_DEMO',{configurable:true,get:()=>demo,set(value){
      demo=value;if(!value?.request)return;
      const original=value.request;
      const withoutLogo=data=>Array.isArray(data)?data.map(withoutLogo):data&&typeof data==='object'?Object.fromEntries(Object.entries(data).map(([k,v])=>[k,k==='logo_url'?'':withoutLogo(v)])):data;
      value.request=async(...args)=>withoutLogo(await original(...args));
     }});
    });
    const p=await context.newPage();
    await p.goto(base+'/?demo=1&plan=3&demo_theme='+encodeURIComponent(JSON.stringify({version:1,mode}))+'#/app/configuracion/apariencia');
    await p.locator('.logo-identity').waitFor();await p.waitForLoadState('networkidle');await p.evaluate(()=>document.fonts.ready);
    const card=p.locator('.logo-identity'),edit=card.getByRole('button',{name:'Editar recorte',exact:true}),remove=card.getByRole('button',{name:'Eliminar logo',exact:true});
    assert.equal(await edit.isVisible(),hasLogo);assert.equal(await remove.isVisible(),hasLogo);
    const geometry=await card.evaluate(e=>({uploadStyle:(()=>{const s=getComputedStyle(e.querySelector('.logo-identity-upload'));return{fg:s.color,bg:s.backgroundColor}})(),width:e.clientWidth,scroll:e.scrollWidth,height:e.getBoundingClientRect().height,preview:e.querySelector('.logo-identity-preview').getBoundingClientRect().width,targets:[...e.querySelectorAll('button,.upload-trigger')].filter(x=>x.getClientRects().length).map(x=>{const r=x.getBoundingClientRect();return{text:x.getAttribute('aria-label')||x.textContent.trim(),width:r.width,height:r.height}})}));
    assert.ok(geometry.scroll<=geometry.width+1,JSON.stringify(geometry));
    if(!geometry.targets.every(x=>x.width>=44&&x.height>=44)){console.log('STYLE DEBUG',await p.evaluate(()=>({links:[...document.querySelectorAll('link[rel=stylesheet]')].map(e=>({href:e.href,loaded:!!e.sheet})),body:document.body.className})));await p.screenshot({path:path.join(out,'geometry-error.png'),fullPage:true})}assert.ok(geometry.targets.every(x=>x.width>=44&&x.height>=44),JSON.stringify(geometry.targets));
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const states=await p.locator('.ts-semantic-status').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e);return{text:e.textContent,fg:s.color,bg:s.backgroundColor,image:s.backgroundImage}}));
    assert.equal(states.length,3);assert.ok(states.every(x=>x.fg==='rgb(255, 255, 255)'),JSON.stringify(states));
    const palette=await p.locator('.ts-identity-palette').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,inputs:[...e.querySelectorAll('input')].map(e=>({type:e.type,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,font:getComputedStyle(e).fontSize}))}));
    assert.ok(palette.scroll<=palette.width+1);assert.ok(palette.inputs.every(x=>x.height>=44));
    if(engine==='chrome'&&[320,390,1440].includes(width)){
     await card.screenshot({path:path.join(out,`logo-${mode}-${width}-${hasLogo?'saved':'empty'}.png`)});if(hasLogo){await p.locator('.ts-identity-palette').screenshot({path:path.join(out,`palette-${mode}-${width}.png`)});await p.locator('.ts-semantic').screenshot({path:path.join(out,`states-${mode}-${width}.png`)});}
     if(hasLogo&&[390,1440].includes(width))await p.screenshot({path:path.join(out,`appearance-${mode}-${width}.png`),fullPage:true});
    }
    if(width===390&&mode==='light'&&hasLogo){
     const primary=p.getByRole('textbox',{name:'Color principal en HEX',exact:true});await primary.fill('#123456');assert.equal(await p.getByLabel('Color principal',{exact:true}).inputValue(),'#123456');await primary.fill('#4754E6');
     await edit.click();await p.getByRole('region',{name:'Editor de logo'}).waitFor();
     await p.getByRole('button',{name:'Aplicar recorte',exact:true}).waitFor({state:'visible'});
     await p.locator('.logo-crop-controls input[type=range]').first().fill('1.2');
     await p.getByRole('button',{name:'Girar 90°',exact:true}).click();
     await p.getByRole('button',{name:'Aplicar recorte',exact:true}).click();
     await p.locator('.logo-crop-editor').waitFor({state:'hidden'});
     assert.match(await card.locator('.logo-identity-status').textContent(),/pendiente de guardar/);
     assert.match(await card.locator('img').getAttribute('src'),/^data:image/);
     await remove.click();const confirmation=p.getByRole('dialog',{name:'¿Eliminar este logo?',exact:true});await confirmation.waitFor();const beforeCancel=await card.locator('img').getAttribute('src');await confirmation.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await card.locator('img').getAttribute('src'),beforeCancel);await remove.click();await confirmation.waitFor();if(engine==='chrome')await p.screenshot({path:path.join(out,'confirm-delete-390.png')});await confirmation.getByRole('button',{name:'Sí, eliminar logo',exact:true}).click();assert.equal(await edit.isVisible(),false);assert.equal(await card.locator('.logo-identity-preview img').count(),0);
     const buffer=Buffer.from(await p.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=80;const x=c.getContext('2d');x.fillStyle='#4754e6';x.fillRect(0,0,80,80);return c.toDataURL('image/png').split(',')[1]}),'base64');
     await p.locator('#business-logo-react').setInputFiles({name:'logo-ficticio.png',mimeType:'image/png',buffer});
     await p.locator('.logo-crop-editor').waitFor();await p.getByRole('button',{name:'Aplicar recorte',exact:true}).click();await p.locator('.logo-crop-editor').waitFor({state:'hidden'});
     assert.equal(await edit.isVisible(),true);assert.match(await card.locator('img').getAttribute('src'),/^data:image/);
     await edit.focus();assert.equal(await edit.evaluate(e=>e===document.activeElement),true);
    }
    assert.equal(blocked,0,'Unexpected outbound request');
    results.push({engine,viewport:width,mode,hasLogo,palette,states,...geometry});await context.close();
    console.log('PASS logo',engine,width,mode,hasLogo?'saved':'empty');
   }
  }finally{await browser.close()}
 }
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)));
