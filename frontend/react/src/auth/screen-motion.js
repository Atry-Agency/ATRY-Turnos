// Restored from web/app.js renderAuthScreen (657ea0f). One opaque surface,
// mirrored brand anchors, form crossfade; snapshots never retain field values.
let authScreenMotion=null;
let savedScreen=null;
export function rememberAuthScreen(root,mode){
 authScreenMotion?.cancel();
 if(!['login','register'].includes(mode)){savedScreen=null;return;}
 const panel=root.querySelector('.auth-artwork'),form=root.querySelector('.auth-right');
 if(!panel||!form)return;
 const clean=node=>{const copy=node.cloneNode(true);copy.querySelectorAll('input,textarea').forEach(x=>{x.value='';x.removeAttribute('value')});return copy};
 savedScreen={at:performance.now(),mode,className:root.className,panel:clean(panel),form:clean(form),panelRect:panel.getBoundingClientRect(),formRect:form.getBoundingClientRect(),radius:getComputedStyle(panel).borderRadius,anchors:['.logo','.auth-signature'].map(selector=>{const element=panel.querySelector(':scope > '+selector);return{selector,element:clean(element),rect:element.getBoundingClientRect()}})};
}
export async function playAuthScreen(current,mode){
 authScreenMotion?.cancel();
 const old=savedScreen;savedScreen=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 if(!old||performance.now()-old.at>1000||old.mode===mode||!['login','register'].includes(mode))return;
 if(innerWidth<=800)window.scrollTo(0,0);
 if(reduced.matches||!Element.prototype.animate)return;
 const previous=old;
 const duration=innerWidth<=800?440:680;
 const easing='cubic-bezier(.4,0,.2,1)';
 const animations=[];
 let stage=null;
 // Freeze the two existing layers before replacing the form; no bitmap capture or layout tween.
 const oldPanel=previous.panel,oldForm=previous.form;
 const oldPanelRect=previous.panelRect,oldFormRect=previous.formRect;
 const oldRadius=previous.radius;
 const brandAnchors=previous.anchors;
 const desktop=innerWidth>800;
 const ghost=(element,rect)=>{
  const copy=element.cloneNode(true);
  copy.style.cssText='position:absolute;left:'+rect.left+'px;top:'+rect.top+'px;width:'+rect.width+'px;height:'+rect.height+'px;min-height:0;margin:0;box-sizing:border-box;';
  for(const item of [copy,...copy.querySelectorAll('[id],[data-dirty]')]){item.removeAttribute('id');item.removeAttribute('data-dirty');}
  return copy;
 };
 let oldLayer,oldPanelCopy,oldPanelContent;
 if(desktop){
  stage=document.createElement('div');stage.className='auth-motion-stage';stage.inert=true;stage.setAttribute('aria-hidden','true');
  oldLayer=document.createElement('div');oldLayer.className=previous.className+' auth-motion-layer';
  oldPanelCopy=ghost(oldPanel,oldPanelRect);
  oldPanelCopy.classList.add('auth-motion-surface');
  oldPanelContent=oldPanel.cloneNode(true);
  oldPanelContent.style.cssText='position:absolute;inset:0;width:100%;height:100%;min-height:0;margin:0;background:transparent;border-radius:0;';
  for(const item of oldPanelContent.querySelectorAll('[id],[data-dirty]')){item.removeAttribute('id');item.removeAttribute('data-dirty');}
  oldPanelCopy.replaceChildren(oldPanelContent);
  const departingForm=ghost(oldForm,oldFormRect);departingForm.style.background='transparent';
  oldLayer.append(departingForm,oldPanelCopy);stage.append(oldLayer);
 }
 const newPanel=current.querySelector('.auth-artwork'),newForm=current.querySelector('.auth-right'),panelZ=newPanel.style.zIndex;
 const play=(element,frames,options={})=>{const animation=element.animate(frames,{duration,easing,fill:'both',...options});animations.push(animation);return animation;};
 let finished=false;
 const cleanup=()=>{
  if(finished)return;finished=true;
  for(const animation of animations)animation.cancel();
  stage?.remove();newPanel.style.removeProperty('visibility');newPanel.style.zIndex=panelZ;
  window.removeEventListener('resize',cancel);reduced.removeEventListener('change',cancel);
  if(authScreenMotion?.cancel===cancel)authScreenMotion=null;
 };
 const cancel=()=>cleanup();authScreenMotion={cancel};
 window.addEventListener('resize',cancel,{once:true});reduced.addEventListener('change',cancel,{once:true});
 try{
  if(desktop){
   const target=newPanel.getBoundingClientRect();
   const newLayer=document.createElement('div');newLayer.className='auth-motion-content auth-shell--'+mode;
   const newPanelCopy=ghost(newPanel,{left:0,top:0,width:target.width,height:target.height});
   newPanelCopy.style.background='transparent';newPanelCopy.style.borderRadius='0';
   // Keep a single, fully opaque logo/signature in both directions; animate their anchors.
   for(const anchor of brandAnchors){
    const destination=newPanel.querySelector(':scope > '+anchor.selector).getBoundingClientRect();
    const copy=ghost(anchor.element,{left:anchor.rect.left-oldPanelRect.left,top:anchor.rect.top-oldPanelRect.top,width:anchor.rect.width,height:anchor.rect.height});
    copy.classList.add('auth-motion-anchor');
    oldPanelContent.querySelector(':scope > '+anchor.selector).style.visibility='hidden';
    newPanelCopy.querySelector(':scope > '+anchor.selector).style.visibility='hidden';
    oldPanelCopy.append(copy);
    play(copy,[{transform:'translate3d(0,0,0)'},{transform:'translate3d('+(destination.left-target.left-anchor.rect.left+oldPanelRect.left)+'px,'+(destination.top-target.top-anchor.rect.top+oldPanelRect.top)+'px,0)'}]);
   }
   newLayer.append(newPanelCopy);oldPanelCopy.append(newLayer);document.body.append(stage);
   newPanel.style.visibility='hidden';
   // One opaque surface owns the contour; only its transparent content layers crossfade.
   // This prevents the two old/new rounded backgrounds from forming a rectangular halo.
   play(oldPanelCopy,[
    {transform:'translate3d(0,0,0)',borderRadius:oldRadius},
    {transform:'translate3d('+(target.left-oldPanelRect.left)+'px,'+(target.top-oldPanelRect.top)+'px,0)',borderRadius:getComputedStyle(newPanel).borderRadius}
   ]);
   play(oldPanelContent,[{opacity:1},{opacity:0}],{easing:'linear'});
   play(newLayer,[{opacity:0},{opacity:1}],{easing:'linear'});
   play(oldLayer.querySelector('.auth-right'),[{opacity:1,offset:0},{opacity:0,offset:.24},{opacity:0,offset:1}],{easing:'linear'});
   play(newForm,[{opacity:0,transform:'translate3d('+(mode==='register'?'-14':'14')+'px,0,0)',offset:0},{opacity:0,transform:'translate3d('+(mode==='register'?'-14':'14')+'px,0,0)',offset:.28},{opacity:1,transform:'translate3d(0,0,0)',offset:1}]);
  }else{
   const target=newPanel.getBoundingClientRect();
   newPanel.style.zIndex='2';
   if(oldPanelRect.bottom>0&&oldPanelRect.top<innerHeight){
    play(newPanel,[{transform:'translate3d(0,'+(oldPanelRect.top-target.top)+'px,0)',borderRadius:oldRadius},{transform:'translate3d(0,0,0)',borderRadius:getComputedStyle(newPanel).borderRadius}]);
   }
   play(newForm,[{opacity:0,transform:'translate3d(0,'+(mode==='register'?'8':'-8')+'px,0)',offset:0},{opacity:.3,transform:'translate3d(0,4px,0)',offset:.28},{opacity:1,transform:'translate3d(0,0,0)',offset:1}]);
  }
  await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
 }finally{cleanup();}
}
export function stopAuthMotion(){authScreenMotion?.cancel();savedScreen=null}
