'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {nativeServer}=require('./iatry-environment.cjs');
const {demoFixture}=require('./iatry-fixture.cjs');
const phase=process.argv[2]||'before';
const directory='docs/react-iatry-validation/evidence/services-navigation';
fs.mkdirSync(directory,{recursive:true});
(async()=>{
 const native=await nativeServer(),plain=await nativeServer('web');let browser;
 const rows=[];
 try{
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  for(let iteration=0;iteration<7;iteration++)for(const [variant,server] of iteration%2?[['react',native],['original',plain]]:[['original',plain],['react',native]]){
   const context=await browser.newContext({viewport:{width:1440,height:960},serviceWorkers:'block',reducedMotion:'no-preference'});
   await context.addInitScript(demoFixture,{multi:false});
   const page=await context.newPage(),cdp=await context.newCDPSession(page);
   await page.goto(server.base+'/?demo=1&plan=2#/app/inicio');
   await page.waitForSelector(variant==='react'?'[data-react-dashboard]':'.dashboard-overview');
   await page.evaluate(()=>document.fonts.ready);
   await cdp.send('Performance.enable');
   if(iteration===0){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,v8,loading',transferMode:'ReturnAsStream'});}
   const start=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
   const row=await page.evaluate(async()=>{
    const start=performance.now(),requests=window.__iatryRequests.length,events=[];let last='';
    const observer=new MutationObserver(()=>{const main=document.querySelector('.main-content');const state=main?.querySelector('.grid3')?'catalog':main?.textContent?.includes('Cargando pantalla')?'suspense-fallback':main?.textContent?.includes('Cargando servicios')?'services-loading':'other';if(state!==last){events.push({state,ms:performance.now()-start});last=state}});
    observer.observe(document.querySelector('.main-content'),{childList:true,subtree:true});
    performance.mark('services-navigation-start');location.hash='/app/servicios';
    while(document.querySelector('.main-content h1')?.textContent!=='Servicios'||!document.querySelector('.main-content .grid3'))await new Promise(requestAnimationFrame);
    const navigationMs=performance.now()-start;performance.mark('services-catalog-ready');observer.disconnect();
    return {navigationMs,events,requests:window.__iatryRequests.slice(requests),resources:performance.getEntriesByType('resource').filter(r=>r.startTime>=start).map(r=>({name:new URL(r.name).pathname,startMs:r.startTime-start,durationMs:r.duration,responseEndMs:r.responseEnd-start})),services:document.querySelectorAll('.grid3 .card').length};
   });
   const end=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
   row.cpuTaskMs=1000*(end.TaskDuration-start.TaskDuration);row.cpuScriptMs=1000*(end.ScriptDuration-start.ScriptDuration);row.layoutMs=1000*(end.LayoutDuration-start.LayoutDuration);
   if(iteration===0){const profile=(await cdp.send('Profiler.stop')).profile;fs.writeFileSync(`${directory}/${phase}-${variant}.cpuprofile`,JSON.stringify(profile));const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const {stream}=await done;let trace='';for(;;){const chunk=await cdp.send('IO.read',{handle:stream});trace+=chunk.data;if(chunk.eof)break}await cdp.send('IO.close',{handle:stream});fs.writeFileSync(`${directory}/${phase}-${variant}-trace.json`,trace);}
   rows.push({variant,iteration,...row});
   await context.close();
  }
  const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)],summary={};
  for(const variant of ['original','react'])summary[variant]=Object.fromEntries(['navigationMs','cpuTaskMs','cpuScriptMs','layoutMs'].map(k=>[k,median(rows.filter(r=>r.variant===variant).map(r=>r[k]))]));
  const result={phase,protocol:'7 fresh contexts per runtime, alternating order, Chrome headless 1440x960, fictional demo, SW blocked; identical original navigation marker; first run instrumented CPU/timeline, no screenshots/video',summary,rows};
  fs.writeFileSync(`${directory}/${phase}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(summary,null,2));
  if(phase==='after'){assert.ok(summary.react.navigationMs<100,'Services navigation regressed above 100 ms');assert.ok(rows.filter(r=>r.variant==='react').every(r=>!r.events.some(e=>e.state==='suspense-fallback')),'Services must not suspend on a cold visit');}
 }finally{await browser?.close();await native.close();await plain.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
