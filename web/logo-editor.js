'use strict';
// Image work stays in the browser. Only the confirmed, optimized square is saved.
function logoCropRect(width,height,zoom=1,x=50,y=50){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('La imagen no tiene dimensiones válidas.');
 const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||min)),size=Math.min(width,height)/clamp(zoom,1,4);
 return {x:(width-size)*clamp(x,0,100)/100,y:(height-size)*clamp(y,0,100)/100,size};
}
function businessLogoAvatar(b,kind,fallback){return `<div class="${kind} business-logo-avatar${b.logo_url?' has-logo':''}">${b.logo_url?`<img src="${esc(b.logo_url)}" alt="Logo de ${esc(b.name)}" decoding="async">`:fallback?esc(ucode(fallback)):ic('shop')}</div>`;}
function preparedBusinessLogo(form){
 if(form.elements.remove_logo?.checked)return '';
 if(form.querySelector('[data-logo-crop]')||form.querySelector('[name=logo_file]')?.files.length)throw Error('Aplicá el recorte o cancelalo antes de guardar.');
 return form.dataset.logoData;
}
function refreshLogoControl(form,url){
 const preview=form.querySelector('[data-logo-preview]');if(!preview)return;
 if(url){const img=new Image();img.src=url;img.alt='Vista previa del logo del negocio';preview.replaceChildren(img);}else preview.innerHTML=ic('shop');
 form.querySelector('[data-logo-edit]').hidden=!url;form.querySelector('[data-logo-delete]').hidden=!state.business.logo_url;form.querySelector('[data-logo-filename]').textContent=url?'Logo guardado':'Sin logo guardado';
}
if(typeof module!=='undefined')module.exports={logoCropRect,preparedBusinessLogo};
if(typeof document!=='undefined')(()=>{
 const editors=new WeakMap(),types=['image/png','image/jpeg','image/webp'];
 function closeEditor(form){const editor=form.querySelector('[data-logo-crop]');if(editor){editors.delete(editor);editor.remove();}form.elements.logo_file.value='';}
 function notifyPreview(form){if(form.matches('[data-appearance-form]'))refreshAppearancePreview(form);form.dataset.dirty='true';}
 async function openEditor(form,source){
  closeEditor(form);const box=document.createElement('section');box.className='logo-crop-editor';box.dataset.logoCrop='';box.setAttribute('aria-label','Editor de logo');box.innerHTML=`<div class="row between wrap"><div><span class="eyebrow">TU IDENTIDAD, BIEN ENCUADRADA</span><h3>Ajustá tu logo</h3></div><button type="button" class="btn secondary sm" data-logo-cancel>Cancelar</button></div><p class="small muted">Arrastrá la imagen o usá los controles. El círculo muestra cómo se verá en el panel.</p><div class="logo-crop-layout"><div class="logo-crop-stage"><canvas width="512" height="512" aria-label="Vista previa circular del recorte" role="img"></canvas></div><div class="logo-crop-controls"><label>Zoom<input type="range" min="1" max="4" step="0.01" value="1" data-crop-zoom></label><label>Posición horizontal<input type="range" min="0" max="100" value="50" data-crop-x></label><label>Posición vertical<input type="range" min="0" max="100" value="50" data-crop-y></label><div class="actions"><button type="button" class="btn secondary sm" data-logo-rotate>Girar 90°</button><button type="button" class="btn secondary sm" data-logo-center>Centrar</button></div><button type="button" class="btn" data-logo-apply disabled>Aplicar recorte</button><p class="tiny muted">La imagen se optimiza a menos de 90 KB. Después confirmá y guardá la apariencia para publicarla.</p><p class="tiny" data-crop-status role="status">Preparando imagen…</p></div></div>`;
  form.querySelector('.logo-upload').after(box);const input=form.elements.logo_file;input.disabled=true;
  try{
   const img=new Image();img.src=source;await img.decode();if(!box.isConnected)return;
   if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>32000000)throw Error('Usá una imagen de hasta 32 megapíxeles.');
   const base=document.createElement('canvas'),ratio=Math.min(1,2048/Math.max(img.naturalWidth,img.naturalHeight));base.width=Math.max(1,Math.round(img.naturalWidth*ratio));base.height=Math.max(1,Math.round(img.naturalHeight*ratio));base.getContext('2d').drawImage(img,0,0,base.width,base.height);
   const model={base,turns:0};editors.set(box,model);render(box);box.querySelector('[data-logo-apply]').disabled=false;box.querySelector('[data-crop-status]').textContent='Lista para ajustar.';box.querySelector('[data-crop-zoom]').focus();
  }catch(error){closeEditor(form);toast(error.message||'No se pudo abrir esa imagen.',true);}finally{input.disabled=false;}
 }
 function render(box){
  const model=editors.get(box);if(!model)return;const {base,turns}=model,source=document.createElement('canvas');source.width=turns%2?base.height:base.width;source.height=turns%2?base.width:base.height;const ctx=source.getContext('2d');ctx.translate(source.width/2,source.height/2);ctx.rotate(turns*Math.PI/2);ctx.drawImage(base,-base.width/2,-base.height/2);model.source=source;
  const r=logoCropRect(source.width,source.height,box.querySelector('[data-crop-zoom]').value,box.querySelector('[data-crop-x]').value,box.querySelector('[data-crop-y]').value),canvas=box.querySelector('canvas'),out=canvas.getContext('2d');out.clearRect(0,0,512,512);out.imageSmoothingQuality='high';out.drawImage(source,r.x,r.y,r.size,r.size,0,0,512,512);model.rect=r;
 }
 document.addEventListener('change',async event=>{
  if(event.target.name!=='logo_file')return;const input=event.target,form=input.form,file=input.files[0];if(!file)return;
  if(!types.includes(file.type)||file.size>5*1024*1024){input.value='';toast('Elegí PNG, JPEG o WebP de hasta 5 MB.',true);return;}
  try{const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('No se pudo leer la imagen.'));reader.readAsDataURL(file);});if(form.isConnected)await openEditor(form,source);}catch(error){input.value='';toast(error.message,true);}
 });
 document.addEventListener('input',event=>{const box=event.target.closest('[data-logo-crop]');if(box)render(box);});
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-logo-delete],[data-logo-edit],[data-logo-cancel],[data-logo-center],[data-logo-rotate],[data-logo-apply]');if(!button)return;event.preventDefault();const form=button.closest('form');
  if(button.hasAttribute('data-logo-delete')){
   if(state.business.role!=='owner')return;
   if(!await confirmAction('¿Eliminar el logo guardado? Se borrará del negocio y dejará de aparecer en el panel y las reservas. No se puede deshacer desde el panel. Las copias de seguridad históricas no se purgan.'))return;
   button.disabled=true;
   try{const changed=await post(bapi('/appearance'),{logo_url:''},'PATCH');closeEditor(form);state.business={...state.business,...changed};state.businesses=state.businesses.map(b=>b.id===state.business.id?{...b,logo_url:''}:b);if(state.public?.business?.id===state.business.id)state.public.business.logo_url='';state.screen=null;delete form.dataset.logoData;delete form.dataset.appearanceLogo;if(form.elements.remove_logo)form.elements.remove_logo.checked=false;refreshLogoControl(form,'');if(form.matches('[data-appearance-form]'))refreshAppearancePreview(form);for(const avatar of root.querySelectorAll('.sidebar .business-logo-avatar'))avatar.outerHTML=businessLogoAvatar(state.business,avatar.classList.contains('store-icon')?'store-icon':'avatar',avatar.classList.contains('store-icon')?null:state.me.user.name);toast('Logo eliminado del negocio.');}catch(error){toast(error.message||'No se pudo eliminar el logo.',true);}finally{if(button.isConnected)button.disabled=false;}return;
  }
  if(button.hasAttribute('data-logo-edit')){const url=form.dataset.logoData||state.business.logo_url;if(url)await openEditor(form,url);return;}
  const box=button.closest('[data-logo-crop]'),model=editors.get(box);
  if(button.hasAttribute('data-logo-cancel')){closeEditor(form);form.querySelector('[data-logo-edit]')?.focus();return;}
  if(!model)return;
  if(button.hasAttribute('data-logo-center')){box.querySelector('[data-crop-zoom]').value=1;box.querySelector('[data-crop-x]').value=50;box.querySelector('[data-crop-y]').value=50;render(box);}
  if(button.hasAttribute('data-logo-rotate')){model.turns=(model.turns+1)%4;render(box);}
  if(button.hasAttribute('data-logo-apply')){
   const canvas=box.querySelector('canvas');let url=canvas.toDataURL('image/png');
   if(atob(url.split(',')[1]).length>90000)for(const quality of [.9,.8,.65,.5,.35]){url=canvas.toDataURL('image/webp',quality);if(atob(url.split(',')[1]).length<=90000)break;}
   if(atob(url.split(',')[1]).length>90000){toast('No pudimos optimizar esta imagen. Probá con un logo más simple.',true);return;}
   form.dataset.logoData=url;form.dataset.appearanceLogo=url;if(form.elements.remove_logo)form.elements.remove_logo.checked=false;refreshLogoControl(form,url);form.querySelector('[data-logo-filename]').textContent='Recorte listo · pendiente de guardar';closeEditor(form);notifyPreview(form);form.querySelector('[data-logo-edit]').focus();
  }
 });
 document.addEventListener('pointerdown',event=>{const canvas=event.target.closest('[data-logo-crop] canvas');if(!canvas)return;const box=canvas.closest('[data-logo-crop]'),m=editors.get(box);if(!m)return;canvas.setPointerCapture(event.pointerId);m.drag={x:event.clientX,y:event.clientY,px:Number(box.querySelector('[data-crop-x]').value),py:Number(box.querySelector('[data-crop-y]').value)};});
 document.addEventListener('pointermove',event=>{const canvas=event.target.closest('[data-logo-crop] canvas');if(!canvas)return;const box=canvas.closest('[data-logo-crop]'),m=editors.get(box);if(!m?.drag)return;const scale=m.rect.size/canvas.getBoundingClientRect().width;for(const [axis,size,pos] of [['x','width','clientX'],['y','height','clientY']]){const range=m.source[size]-m.rect.size;box.querySelector(`[data-crop-${axis}]`).value=range?m.drag['p'+axis]-(event[pos]-m.drag[axis])*scale/range*100:50;}render(box);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,event=>{const box=event.target.closest('[data-logo-crop]');if(box&&editors.has(box))delete editors.get(box).drag;});
})();
