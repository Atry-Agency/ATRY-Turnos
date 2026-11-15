'use strict';
// Isolated public demo only. No sessions, submitted forms or backend requests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
(async()=>{
 const root=path.resolve('dist/github-preview');
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res)});
 if(!process.env.ATRY_DEMO_TEST_URL)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.ATRY_DEMO_TEST_URL||'http://127.0.0.1:'+server.address().port;let writes=0;
 try{for(const[name,type]of Object.entries({chromium,webkit})){
  const browser=await type.launch(name==='chromium'?{headless:true,executablePath:process.env.ATRY_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{headless:true});
  try{for(const width of [320,390,430,844,1280]){
   const context=await browser.newContext({viewport:{width,height:width===844?390:844},isMobile:width<1000,hasTouch:width<1000,serviceWorkers:'block'});
   await context.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(q.method()!=='GET'){writes++;return r.abort()}return u.origin===base&&!u.pathname.startsWith('/api/')?r.continue():r.abort()});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   for(const plan of [1,2,3]){
    await page.goto(base+'/?demo=1&plan='+plan+'#/app/inicio');await page.locator('.page-header h1').waitFor();
    const notice=page.locator('.demo-notice');await notice.waitFor();assert(await notice.isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(width<1000){
     await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
     const close=page.locator('#sidebar').getByRole('button',{name:'Cerrar menú',exact:true});await close.waitFor();
     await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#sidebar')).transform).m41)<0.01);
     await page.waitForFunction(()=>{const e=document.querySelector('#sidebar .sidebar-close'),b=e.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('button')===e});
     const hit=await close.evaluate(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return{width:b.width,height:b.height,top:b.top,left:b.left,visible:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('button')===e,paddingTop:parseFloat(s.top)}});
     assert(hit.width>=44&&hit.height>=44&&hit.top>=14&&hit.left>=0&&hit.visible,JSON.stringify(hit));
     assert(await notice.isVisible(),'Notice is retained behind the drawer');
     await close.click();assert.equal(await page.locator('.sidebar.open').count(),0);
     assert(await notice.isVisible());
     // Exercise the same env() rules with non-zero notch/home/landscape insets.
     if(width===390&&plan===2){
      const css=fs.readFileSync('web/business-polish.css','utf8').replace(/env\(safe-area-inset-(top|bottom|left|right),0px\)/g,(_,edge)=>({top:'47px',bottom:'34px',left:'12px',right:'12px'}[edge]));
      await page.addStyleTag({content:css});assert.equal(await notice.evaluate(e=>parseFloat(getComputedStyle(e).paddingTop)),59);
      await page.getByRole('button',{name:'Abrir menú',exact:true}).click();assert((await close.boundingBox()).y>=61);await close.click();
     }
    }else assert.equal(await page.locator('#sidebar .sidebar-close').isVisible(),false);
   }
   assert.deepEqual(errors,[]);await context.close();console.log('PASS demo drawer',name,width,'all three plans, notice retained, direct close, safe-area rules, zero writes');
  }}finally{await browser.close()}
 }}finally{if(server.listening)await new Promise(resolve=>server.close(resolve))}
 assert.equal(writes,0);
})().catch(e=>{console.error(e.stack);process.exitCode=1});
