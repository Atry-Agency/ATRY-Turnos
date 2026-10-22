'use strict';
// This bridge exists only inside a disposable demo embedded by our own landing.
// It accepts inert theme values; it never changes a real business or its plan.
function startShowcasePreview(){
 if(!window.ATRY_DEMO?.showcase)return;
 document.documentElement.dataset.showcase='true';
 let pending=null,running=false;
 async function update(){
  if(running)return;
  running=true;
  try{while(pending){
   const input=pending;pending=null;
   const b=window.ATRY_DEMO.showcase.apply(input),y=scrollY;
   readCache.clear();state.businesses=[b];
   if(state.business)state.business=b;
   if(state.public)state.public.business=b;
   const destination=input.view==='panel'&&!path().startsWith('/app/')?'/app/inicio':input.view==='reservas'&&!path().startsWith('/reservar/')?'/reservar/'+b.slug:null;
   if(destination){history.replaceState(null,'',location.pathname+location.search+'#'+destination);await router();scrollTo(0,0);}
   else{if(path().startsWith('/reservar/'))await publicView(b.slug);else if(path().startsWith('/app'))await renderApp();scrollTo(0,y);}
   parent.postMessage({type:'atry-showcase-applied',name:b.name},location.origin);
  }}catch{parent.postMessage({type:'atry-showcase-error'},location.origin);}
  finally{running=false;}
 }
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='atry-showcase-theme')return;
  pending=event.data;void update();
 });
 // Keep exploration within the fictional app; no login, external or real-page navigation.
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-action=logout]')){event.preventDefault();event.stopImmediatePropagation();return;}
  const link=event.target.closest('a[href]');if(!link)return;
  const href=link.getAttribute('href');
  if(!href.startsWith('#/app')&&!href.startsWith('#/reservar/')&&!href.startsWith('#/gestionar/')){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 parent.postMessage({type:'atry-showcase-ready'},location.origin);
}
