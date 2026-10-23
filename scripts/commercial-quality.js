/* Nonvisual QA gate for the local-only capture fixture. Never part of web/. */
(function(root){
 function inspect(doc,style){
  const failures=[],required=['.pb-signature','.pb-facts','.pb-facts>span'];
  if(doc.querySelector('.pb-identity')){
   for(const selector of required)if(!doc.querySelector(selector))failures.push('Missing '+selector);
   const signature=doc.querySelector('.pb-signature'),facts=doc.querySelector('.pb-facts'),fact=doc.querySelector('.pb-facts>span');
   if(signature&&style(signature).display!=='flex')failures.push('Signature layout');
   if(facts&&!['grid','flex'].includes(style(facts).display))failures.push('Business facts layout');
   if(fact&&parseFloat(style(fact).gap)<8)failures.push('Icon/text gap');
  }
  for(const img of doc.querySelectorAll('img')){const r=img.getBoundingClientRect();if(r.width&&r.bottom>0&&r.top<doc.documentElement.clientHeight&&(!img.complete||!img.naturalWidth))failures.push('Unloaded image');}
  if(doc.documentElement.scrollWidth>doc.documentElement.clientWidth+1)failures.push('Horizontal overflow');
  return {ready:failures.length===0,failures};
 }
 if(typeof module==='object'&&module.exports){module.exports={inspect};return;}
 let pending=false;
 function schedule(){if(pending)return;pending=true;Promise.resolve(document.fonts?.ready).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
  const result=inspect(document,getComputedStyle);document.documentElement.dataset.captureReady=String(result.ready);document.documentElement.dataset.captureFailures=result.failures.join(', ');pending=false;
 })));}
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});addEventListener('load',schedule);addEventListener('resize',schedule);addEventListener('hashchange',schedule);schedule();
})(typeof globalThis==='object'?globalThis:this);
