'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const money=n=>'$'+Number(n||0).toLocaleString('es-UY');
const today=()=>new Date(Date.now()-3*3600000).toISOString().slice(0,10);
const dateLocal=iso=>new Date(Date.parse(iso)-3*3600000).toISOString().slice(0,16).replace('T',' · ');
const dayLocal=iso=>new Date(Date.parse(iso)-3*3600000).toISOString().slice(0,10);
const hmLocal=iso=>new Date(Date.parse(iso)-3*3600000).toISOString().slice(11,16);
const dateDisplay=iso=>iso?new Intl.DateTimeFormat('es-UY',{weekday:'short',day:'numeric',month:'short'}).format(new Date(iso+'T12:00:00Z')):'';
const dateLong=iso=>new Intl.DateTimeFormat('es-UY',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(iso+'T12:00:00Z'));
const plusDate=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const ucode=(name)=>String(name||'A').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
const path=()=>decodeURIComponent(location.hash.replace(/^#/,''))||'/';
const iconPaths={waitlist:'<circle cx="7" cy="6" r="3"/><path d="M2 18v-2a5 5 0 0 1 10 0v2M15 5h6M15 11h6M15 17h6"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19 13.4a2 2 0 0 0 0-2.8l1.6-1.3-1.8-3-2 .7a2 2 0 0 0-2.4-1.4L14 3h-4l-.4 2.6a2 2 0 0 0-2.4 1.4l-2-.7-1.8 3L5 10.6a2 2 0 0 0 0 2.8l-1.6 1.3 1.8 3 2-.7a2 2 0 0 0 2.4 1.4L10 21h4l.4-2.6a2 2 0 0 0 2.4-1.4l2 .7 1.8-3z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.12 8.12 12.26 12.26M14.8 9.2l5.58-5.58M8.12 15.88l3.3-3.3"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',chevron:'<path d="m9 18 6-6-6-6"/>',back:'<path d="M19 12H5m6 6-6-6 6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',checkcircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',external:'<path d="M14 4h6v6M10 14 20 4"/><path d="M20 14v6H4V4h6"/>',copy:'<rect x="7" y="7" width="14" height="14" rx="2"/><path d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>',trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',menu:'<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',shop:'<path d="M4 10V21h16V10M3 10l2-7h14l2 7a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0ZM9 21v-7h6v7"/>',chart:'<path d="M4 20V11M10 20V5M16 20v-9M22 20V8"/>',spark:'<path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3ZM20 19l1 2-2 1-1-2z"/>',heart:'<path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.8l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>',shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',block:'<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a8 8 0 0 1 14-2l1 5M4 12l1 5a8 8 0 0 0 14-2"/>',wallet:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 9V5a2 2 0 0 1 2-2h13M15 13h6v5h-6a2.5 2.5 0 0 1 0-5Z"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.8 2.8 0 1 1 4.4 2.3C12.7 12.2 12 13 12 14M12 18h.01"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 4-5 14 0 18M12 3c5 4 5 14 0 18"/>',edit:'<path d="M12 20H4v-8L16 3l5 5-12 12H4M14 5l5 5"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',coffee:'<path d="M4 6h13v10a6.5 6.5 0 0 1-13 0V6ZM17 9h3a3 3 0 0 1 0 6h-3M3 21h16"/>'};
Object.assign(iconPaths,{
 grid:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 chart:'<path d="M4 3v17a1 1 0 0 0 1 1h16M8 16v-4M13 16V7M18 16v-7"/>',
 spark:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 11h18m-13 5 3 3 5-5"/>',
 shop:'<path d="M4 10v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V10M3 10l2-7h14l2 7M9 21v-7h6v7"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5M5.2 8a8 8 0 0 1 13-3l1.8 2M4 17l1.8 2a8 8 0 0 0 13-3"/>'
});
iconPaths.repeat='<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>';
const ic=(n,klass='')=>`<svg class="i i-${n} ${klass}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[n]||iconPaths.info}</svg>`;
const roleLabel=s=>({owner:'Propietario',manager:'Encargado',staff:'Empleado'})[s]||'Sin rol';
const badge=(s)=>`<span class="badge ${esc(s)}">${({confirmed:'Confirmado',pending:'Pendiente',completed:'Completado',cancelled:'Cancelado',no_show:'No asistió',active:'Activo',trialing:'Prueba',past_due:'Pago pendiente',suspended:'Suspendido',queued:'En cola'}[s]||esc(s))}</span>`;
const field=(name,label,value='',type='text',extra='')=>`<div class="field"><label for="f-${esc(name)}">${label}</label><input id="f-${esc(name)}" name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}></div>`;
const option=(v,l,selected=false)=>`<option value="${esc(v)}" ${selected?'selected':''}>${esc(l)}</option>`;
const empty=(msg,ico='calendar')=>`<div class="empty">${ic(ico,'big')}<div>${esc(msg)}</div></div>`;
function toast(msg,error=false){const el=document.createElement('div');el.className='toast'+(error?' error':'');el.textContent=msg;$('#toast-area').append(el);setTimeout(()=>el.remove(),4300);}
function confirmAction(message){
 return new Promise(resolve=>{
  const previous=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='confirm-dialog';dialog.setAttribute('aria-labelledby','confirm-title');dialog.setAttribute('aria-describedby','confirm-message');
  const label=message.includes('completado')?'Marcar completado':message.includes('ausente')?'Marcar ausente':message.includes('cancelar este turno')?'Cancelar turno':message.includes('cambio de estado')?'Cambiar estado':message.includes('Revocar')?'Revocar acceso':message.includes('Eliminar')?'Eliminar':message.includes('Ocultar')?'Ocultar servicio':'Cerrar sin guardar';
  dialog.innerHTML='<div class="confirm-symbol">'+ic('shield')+'</div><h2 id="confirm-title">Confirmar acción</h2><p id="confirm-message">'+esc(message)+'</p><div class="actions"><button type="button" class="btn secondary" data-confirm="back" autofocus>Volver</button><button type="button" class="btn danger" data-confirm="accept">'+label+'</button></div>';
  const finish=value=>{dialog.close();dialog.remove();if(previous?.isConnected)previous.focus();resolve(value);};
  dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);});
  dialog.querySelector('[data-confirm="back"]').addEventListener('click',()=>finish(false));
  dialog.querySelector('[data-confirm="accept"]').addEventListener('click',()=>finish(true));
  document.body.append(dialog);dialog.showModal();
 });
}
const readCache=createAtryReadCache();
async function api(route,opts={}){
 const method=(opts.method||'GET').toUpperCase();
 if(method!=='GET'){
  readCache.clear();
  try{return await requestApi(route,opts);}finally{readCache.clear();}
 }
 try{return await readCache.read(route,()=>requestApi(route,opts),{namespace:state.me?.user?.id||'',fresh:opts.fresh===true});}
 catch(error){if(error.status===401||error.status===403)readCache.clear();throw error;}
}
async function requestApi(route,opts={}){
  if(window.ATRY_DEMO?.enabled)return window.ATRY_DEMO.request(route,opts);
  if(window.ATRY_CONFIG?.backend==='preview')throw Object.assign(new Error('Esta publicación muestra la interfaz. La conexión online de cuentas y reservas todavía está pendiente.'),{status:503});
  if(window.ATRY_CLOUD){await window.ATRY_CLOUD.ready;try{return await window.ATRY_CLOUD.request(route,opts);}catch(error){if(error.code!=='RECENT_AUTH_REQUIRED')throw error;await confirmAdminIdentity();return window.ATRY_CLOUD.request(route,opts);}}
  let res;try{res=await fetch(route,{credentials:'same-origin',...opts,headers:{...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})}});}catch{throw new Error('No hay conexión con el servidor. Conservá tus datos y reintentá la operación.');}
  const contentType=res.headers.get('content-type')||'';
  if(!res.ok){let txt='No se pudo completar la operación';try{const body=await res.json();txt=body.error||txt;}catch{}throw Object.assign(new Error(txt),{status:res.status});}
  return contentType.includes('application/json')?res.json():res.text();
}
let adminIdentityConfirmation=null;
function confirmAdminIdentity(){
 if(adminIdentityConfirmation)return adminIdentityConfirmation;
 adminIdentityConfirmation=new Promise((resolve,reject)=>{
  const previousFocus=document.activeElement,dialog=document.createElement('dialog'),originalRoute=location.hash;
  dialog.className='admin-identity-dialog';
  dialog.innerHTML=`<form class="stack"><div class="row between"><h2 id="admin-identity-title">Confirmá tu identidad</h2><button type="button" class="btn secondary icon-only" aria-label="Cancelar">${ic('x')}</button></div><p class="muted small">Tu sesión sigue abierta y tus cambios están conservados. Ingresá tu contraseña para autorizar esta operación administrativa.</p><label>Contraseña actual<input name="password" type="password" autocomplete="current-password" required maxlength="128"></label><p role="status" class="small"></p><button class="btn" type="submit">Confirmar y continuar</button></form>`;
  dialog.setAttribute('aria-labelledby','admin-identity-title');document.body.append(dialog);
  const form=dialog.querySelector('form'),password=form.elements.password,status=dialog.querySelector('[role=status]'),submit=form.querySelector('[type=submit]');
  let finished=false;
  const finish=error=>{if(finished)return;finished=true;password.value='';dialog.close();dialog.remove();window.removeEventListener('hashchange',cancel);previousFocus?.focus();error?reject(error):resolve();};
  const cancel=()=>finish(new Error('Operación cancelada. Tus datos siguen en el formulario.'));
  dialog.querySelector('[type=button]').onclick=cancel;dialog.oncancel=e=>{e.preventDefault();cancel();};window.addEventListener('hashchange',cancel);
  form.onsubmit=async e=>{e.preventDefault();e.stopPropagation();if(submit.disabled)return;submit.disabled=true;status.textContent='Verificando…';try{const email=state.me?.user?.email;if(!email)throw new Error('No se pudo identificar la sesión.');await window.ATRY_CLOUD.auth.signIn(email,password.value);password.value='';if(finished)return;if(location.hash!==originalRoute)throw new Error('La pantalla cambió. Revisá la operación antes de continuar.');finish();}catch(error){password.value='';status.textContent=error.message;submit.disabled=false;if(!finished)password.focus();}};
  dialog.showModal();password.focus();
 }).finally(()=>{adminIdentityConfirmation=null;});
 return adminIdentityConfirmation;
}
const post=(route,data,method='POST')=>api(route,{method,body:JSON.stringify(data)});
let state={me:null, business:null,businesses:[],appView:'inicio',public:null,service:'',staff:'',date:today(),slot:'',slots:[],dateAgenda:today(),dialog:null,settingsTab:'general',loading:false};
const root=$('#root');
const nav=(uri)=>{location.hash='#'+uri;};
const banner=()=>`<div class="notice">${ic('info')} <strong>Correo: ${{smtp:'SMTP configurado',brevo:'Brevo configurado',disabled:'deshabilitado',local:'buzón de desarrollo local'}[state.config?.mail_provider]||'sin configurar'}.</strong> ${['smtp','brevo'].includes(state.config?.mail_provider)?'La aceptación del proveedor se registra por separado de la entrega final.':'No hay entrega de correo externo habilitada.'} WhatsApp automático y pagos online no están habilitados.</div>`;
const brand=()=>`<a href="#/" class="logo" aria-label="Atry Turnos, inicio"><img class="brand-original" src="./assets/brand/atry.png" alt="Símbolo oficial Atry"><span>ATRY</span><b>TURNOS</b></a>`;
const page=(content)=>{if(window.ATRY_DEMO?.enabled)content='<aside class="demo-notice" role="status"><strong>Demostración ficticia</strong><span>Sin cuentas, reservas, cargos ni mensajes reales. Los cambios se descartan al recargar.</span><nav aria-label="Comparar planes demo"><a href="?demo=1&plan=1#/app/inicio">Individual</a><a href="?demo=1&plan=2#/app/inicio">Negocio</a><a href="?demo=1&plan=3#/app/inicio">Pro</a><a href="./#/login">Salir de la demo</a></nav></aside>'+content;if(window.ATRY_CONFIG?.verificationOnly)content='<aside class="integration-notice" role="status">Validación de integración · datos temporales · no usar para reservas reales.</aside>'+content;if(window.ATRY_CONFIG?.backend==='preview')content='<aside class="deployment-notice" id="deployment-notice" role="status"><strong>Vista previa de Atry Turnos</strong><span>La interfaz está publicada. El acceso, el registro y las reservas online estarán disponibles al completar la conexión con Supabase.</span></aside>'+content;const previousForm=root.querySelector('form[data-form="public-book"]');const preserve=previousForm&&root.dataset.publicSlug===state.public?.business.slug&&content.includes('data-form="public-book"');const draft=preserve?Object.fromEntries(new FormData(previousForm)):null;const requestKey=preserve&&root.dataset.publicSlot===state.slot?previousForm.dataset.requestKey:null;root.innerHTML=content;const currentForm=root.querySelector('form[data-form="public-book"]');if(currentForm){root.dataset.publicSlug=state.public?.business.slug||'';root.dataset.publicSlot=state.slot;if(draft)for(const input of currentForm.elements){if(input.name&&input.name in draft){if(input.type==='checkbox')input.checked=!!draft[input.name];else input.value=draft[input.name];}}if(requestKey)currentForm.dataset.requestKey=requestKey;}else{delete root.dataset.publicSlug;delete root.dataset.publicSlot;}const ids=new Set();root.querySelectorAll('.field label').forEach((label,i)=>{const input=label.querySelector('input,select,textarea')||(label.nextElementSibling?.matches('input,select,textarea')?label.nextElementSibling:null);if(input){input.id=input.id||'field-auto-'+i;if(ids.has(input.id))input.id+='-'+i;ids.add(input.id);if(!label.contains(input))label.htmlFor=input.id;else label.removeAttribute('for');}});if(window.ATRY_CONFIG?.backend==='preview')root.querySelectorAll('form').forEach(form=>{form.setAttribute('aria-describedby','deployment-notice');for(const control of form.elements)control.disabled=true;});root.querySelectorAll('button.icon-only').forEach(button=>{if(!button.getAttribute('aria-label'))button.setAttribute('aria-label',button.title||'Cerrar ventana');});};
const loading=()=>page(`<div class="boot"><img class="brand-original" src="./assets/brand/atry.png" alt="Atry"><div class="spin"></div><p>Cargando Atry Turnos</p><div class="skeleton" style="width:220px"></div><div class="skeleton" style="width:140px"></div></div>`);
const headerTitle=(title,sub,action='')=>`<div class="page-header"><div><span class="eyebrow">ATRY TURNOS / PANEL</span><h1>${title}</h1><p>${sub}</p></div>${action}</div>`;
const ensureAuth=()=>{if(!state.me){nav('/login');return false;}return true;};
const businessUrl=()=>`${new URL("./",location.href).href}#/reservar/${state.business?.slug||'negocio-prueba-1'}`;
let authScreenMotion=null;
async function renderAuthScreen(content,mode){
 authScreenMotion?.cancel();
 const previous=root.querySelector('.auth-shell[data-auth-mode]');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 if(!previous||previous.dataset.authMode===mode||reduced.matches||!Element.prototype.animate){page(content);return;}
 const duration=innerWidth<=800?220:680;
 const easing='cubic-bezier(.4,0,.2,1)';
 const animations=[];
 let stage=null;
 // Freeze the two existing layers before replacing the form; no bitmap capture or layout tween.
 const oldPanel=previous.querySelector('.auth-artwork'),oldForm=previous.querySelector('.auth-right');
 const oldPanelRect=oldPanel.getBoundingClientRect(),oldFormRect=oldForm.getBoundingClientRect();
 const oldRadius=getComputedStyle(oldPanel).borderRadius;
 const brandAnchors=['.logo','.auth-signature'].map(selector=>{const element=oldPanel.querySelector(':scope > '+selector);return {selector,element,rect:element.getBoundingClientRect()};});
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
 page(content);
 const current=root.querySelector('.auth-shell'),newPanel=current.querySelector('.auth-artwork'),newForm=current.querySelector('.auth-right');
 const play=(element,frames,options={})=>{const animation=element.animate(frames,{duration,easing,fill:'both',...options});animations.push(animation);return animation;};
 let finished=false;
 const cleanup=()=>{
  if(finished)return;finished=true;
  for(const animation of animations)animation.cancel();
  stage?.remove();newPanel.style.removeProperty('visibility');
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
   play(newForm,[{opacity:0,transform:'translate3d('+(mode==='register'?'12':'-12')+'px,0,0)'},{opacity:1,transform:'translate3d(0,0,0)'}]);
  }
  await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
 }finally{cleanup();}
}
async function authView(register=false){
 if(register&&typeof registrationWizard==='function')return registrationWizard();
 await renderAuthScreen(`<div class="auth-shell auth-shell--${register?'register':'login'}" data-auth-mode="${register?'register':'login'}">${authArtwork(register)}<div class="auth-right"><div class="auth-form"><div class="auth-mobile-brand">${brand()}</div><div style="margin-top:30px" class="eyebrow">${register?'CREÁ TU ESPACIO':'BIENVENIDO DE VUELTA'}</div><h2>${register?'Empezá con Atry Turnos':'Ingresá a tu negocio'}</h2><p>${register?'Configurá tu cuenta y tu agenda. Sin tarjeta de crédito.':'Accedé a tus turnos, clientes y equipo desde cualquier dispositivo.'}</p><form data-form="${register?'register':'login'}">${register?`${field('name','Tu nombre','','text','required minlength="2"')}${field('business_name','Nombre de tu negocio','','text','required minlength="2"')}`:''}${field('email','Correo electrónico','','email','required')}${field('password','Contraseña','','password',`required ${register?'minlength="10"':''} autocomplete="${register?'new-password':'current-password'}"`)}${register?'<div class="hint-block">La habilitación y las pruebas se coordinan con Atry. Registrarte no activa una suscripción.</div>':''}<button class="btn full" type="submit">${register?'Crear mi negocio':'Ingresar a mi panel'} ${ic('arrow')}</button></form><div class="bottom">${register?'¿Ya tenés una cuenta? <a href="#/login">Iniciar sesión</a>':'¿Todavía no tenés cuenta? <a href="#/registro">Crear mi negocio</a>'}</div>${!register?'<a class="recovery-link" href="#/recuperar">Olvidé mi contraseña</a>':''}</div></div></div>`,register?'register':'login');
}
function appLayout(content,title='Panel'){
 const b=state.business;const v=state.appView;ATRY_APPEARANCE.apply(b,'business');
 const previousShell=root.querySelector('.app-shell');
 const previousSidebar=previousShell?.querySelector('#sidebar');
 const previousScroll=previousSidebar?.scrollTop||0;
 const previousActive=previousSidebar?.querySelector('.navlink.active')?.getBoundingClientRect();
 const sameBusiness=previousShell?.dataset.businessId===String(b.id);
 const changingSection=sameBusiness&&previousShell.dataset.view!==v&&!state.dialog&&matchMedia('(min-width:1001px) and (prefers-reduced-motion:no-preference)').matches;
 const items=businessNavigationItems(b);
 const activeView=['notificaciones','accesos','suscripcion'].includes(v)?'configuracion':v;

 page(`<div class="app-shell${changingSection?' app-shell--enter':''}" data-business-id="${esc(b.id)}" data-view="${esc(v)}"><button class="sidebar-backdrop" data-action="close-menu" aria-label="Cerrar menú lateral" tabindex="-1"></button><aside class="sidebar" id="sidebar"><button class="btn secondary icon-only sidebar-close" data-action="close-menu" aria-label="Cerrar menú">${ic('x')}</button><div class="logo"><img class="brand-original" src="./assets/brand/atry.png" alt="Símbolo oficial Atry"><span>ATRY</span> <b>TURNOS</b></div><div class="store-box">${businessLogoAvatar(b,'store-icon')}<div class="grow truncate"><strong class="truncate">${esc(b.name)}</strong><span>Plan ${esc(subscriptionPlan(b))} · ${esc(b.city)}</span></div></div>${state.businesses.length>1?`<label class="tiny" for="business-switch">Espacio activo</label><select id="business-switch">${state.businesses.map(x=>option(x.id,x.name,x.id===b.id)).join('')}</select>`:''}<div class="side-title">TU NEGOCIO</div>${items.map(([n,i,label])=>`<a href="#/app/${n}" class="navlink ${activeView===n?'active':''}" ${activeView===n?'aria-current="page"':''}>${ic(i)} ${label}</a>`).join('')}<div class="side-title" style="margin-top:17px">RECURSOS</div><a class="navlink" href="#/reservar/${esc(b.slug)}" target="_blank">${ic('external')} Ver página pública</a>${state.me?.user?.platform_admin?`<a class="navlink" href="#/admin">${ic('shield')} Administración Atry</a>`:''}<div class="sidebar-bottom">${subscriptionSidebar(b)}<div class="user-card">${state.me.user.platform_admin?accountAvatar(state.me.user):businessLogoAvatar(b,'avatar',state.me.user.name)}<a href="#/app/cuenta" class="grow truncate account-shortcut" aria-label="Mi cuenta y seguridad"><strong class="truncate">${esc(state.me.user.name)}</strong><span class="truncate">Mi cuenta y seguridad</span></a><button class="btn secondary icon-only sm" data-action="logout" title="Cerrar sesión">${ic('logout')}</button></div></div></aside><main class="main"><div class="topbar"><div class="row"><button class="btn secondary icon-only mobile-menu" data-action="toggle-menu" aria-label="Abrir menú">${ic('menu')}</button><span class="breadcrumb">Atry Turnos / <strong>${esc(b.name)} / ${esc(title)}</strong></span></div><div class="actions"><button class="btn secondary sm" data-action="copy-link">${ic('copy')} <span class="desktop-label">Copiar enlace</span></button><a class="btn sm" href="#/reservar/${esc(b.slug)}" target="_blank">${ic('external')} Reservar</a></div></div><div class="main-content">${subscriptionNotice(b)}${workspaceSetupPrompt(v)}${workspaceSettingsNavigation(v)}${content}</div></main></div>${state.dialog?modalContent():''}`);lockSubscriptionControls();pruneCommercialControls();
 const sidebar=root.querySelector('#sidebar');
 if(sameBusiness&&sidebar)sidebar.scrollTop=previousScroll;
 if(changingSection&&previousActive&&sidebar){
  const active=sidebar.querySelector('.navlink.active');
  const next=active?.getBoundingClientRect();
  if(next&&previousActive.bottom>0&&previousActive.top<innerHeight&&next.bottom>0&&next.top<innerHeight){
   active.animate([{transform:`translateY(${previousActive.top-next.top}px)`},{transform:'translateY(0)'}],{duration:520,easing:'cubic-bezier(.16,1,.3,1)'});
  }
 }
}
function modalContent(){return `<div class="modal-mask" data-action="close-modal" data-backdrop="true"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-head"><h2 id="dialog-title">${esc(state.dialog.title)}</h2><button class="btn secondary icon-only sm" aria-label="Cerrar ventana" data-action="close-modal">${ic('x')}</button></div>${state.dialog.body}</div></div>`;}
async function showDialog(title,body){state.dialog={title,body};if(path().startsWith('/admin'))await adminView();else await renderApp(false);$('.modal input, .modal select, .modal button')?.focus();}
const bapi=p=>`/api/business/${state.business.id}${p}`;
const stepHeader=(n,t)=>`<div class="book-step"><div class="num">${n}</div><h2>${t}</h2></div>`;
async function publicView(slug,reset=false){
 try{
  if(!state.public||state.public.business.slug!==slug||reset){state.public=await api(`/api/public/${encodeURIComponent(slug)}`);state.service='';state.staff='';state.slot='';state.date=today();}
  const p=state.public,b=p.business,brandValues=ATRY_APPEARANCE.values(b);ATRY_APPEARANCE.apply(b,'business');document.title=`Reservar en ${b.name} | Atry Turnos`;
  const avail=state.slots;const visibleSlots=state.staff?avail:avail.filter((slot,i,all)=>all.findIndex(x=>x.start===slot.start)===i);
  page(`<div class="public-shell"><header class="public-nav">${brand()}<a href="#/" class="small muted">${ic('back')} Volver a Atry</a></header><div class="book-layout"><aside class="book-identity"><div class="book-logo" style="background:${brandValues.action};color:${brandValues.onAction}">${b.logo_url?`<img src="${esc(b.logo_url)}" alt="Logo de ${esc(b.name)}">`:esc(ucode(b.name))}</div><span class="eyebrow">RESERVAS ONLINE</span><h1>${esc(b.name)}</h1><p>${esc(b.description)}</p><div class="separator"></div><div class="stack small muted"><div>${ic('shop')} ${esc(b.sector)}</div><div>${ic('globe')} ${esc(b.city)}</div>${b.address?`<div>${ic('info')} ${esc(b.address)}</div>`:''}<div>${ic('clock')} Hora local de Uruguay</div></div><div class="separator"></div><div class="small muted">Gestionado con <strong style="color:var(--accent)">Atry Turnos</strong></div></aside><div class="book-main"><div><span class="eyebrow">RESERVÁ EN POCOS PASOS</span><h1 style="font-size:32px;letter-spacing:-.05em;margin:10px 0">Elegí tu próximo turno</h1><p class="muted small">No necesitás instalar nada ni crear una cuenta.</p></div>${!p.bookable?`<div class="notice">Este comercio no está aceptando reservas online por el momento.</div>`:''}
 <section class="card">${stepHeader('1','Elegí el servicio')}<div class="option-list">${p.services.length?p.services.map(s=>`<button class="service-option ${state.service===s.id?'selected':''}" data-action="public-service" data-id="${esc(s.id)}" ${!p.bookable?'disabled':''}><div><strong>${esc(s.name)}</strong><div class="small muted" style="margin-top:5px">${esc(s.description)} · ${s.duration_min} min</div></div><strong>${money(s.price_uyu)}</strong></button>`).join(''):empty('Este negocio todavía no cargó sus servicios','scissors')}</div></section>
 <section class="card">${stepHeader('2','¿Con quién querés atenderte?')}<div class="staff-row"><button class="staff-option ${!state.staff?'selected':''}" data-action="public-staff" data-id="" ${!state.service?'disabled':''}><strong>Cualquier profesional</strong>${ic('check')}</button>${p.staff.filter(s=>s.service_ids.includes(state.service)).map(s=>`<button class="staff-option ${state.staff===s.id?'selected':''}" data-action="public-staff" data-id="${esc(s.id)}"><span>${esc(s.name)}</span>${state.staff===s.id?ic('check'):''}</button>`).join('')}</div></section>
 <section class="card">${stepHeader('3','Elegí fecha y hora')}<div class="field" style="max-width:240px;margin-bottom:16px"><label>Fecha de la reserva</label><input type="date" id="public-date" value="${esc(state.date)}" min="${today()}" max="${plusDate(today(),b.max_days)}" ${!state.service?'disabled':''}></div>${!state.service?'<p class="muted small">Seleccioná primero un servicio.</p>':`<div class="slot-grid">${visibleSlots.map(s=>`<button class="slot ${state.slot===s.start+'|'+s.staff_id?'selected':''}" data-action="public-slot" data-id="${esc(s.start+'|'+s.staff_id)}">${esc(s.time)}</button>`).join('')}</div>${!avail.length?'<p class="muted small">No hay horarios libres ese día. Probá otra fecha o anotate en la lista de espera.</p>':''}${!state.staff&&avail.length?'<p class="tiny muted" style="margin-top:12px">Al elegir un horario asignamos un profesional disponible.</p>':''}`}</section>
 ${state.service&&!avail.length&&p.waitlist_enabled!==false?`<section class="card"><div class="row between" style="margin-bottom:13px"><h3 class="section-label">¿Querés que te avisemos si se libera un turno?</h3>${ic('bell')}</div><form data-form="public-waitlist" class="stack">${field('customer_name','Nombre','','text','required minlength="2"')}${field('customer_email','Correo electrónico','','email','required')}${field('customer_phone','Teléfono (opcional)','','tel')}<label class="checkline"><input type="checkbox" name="accept_policy" required> Autorizo el uso de mis datos para la lista de espera.</label><button class="btn secondary full">Anotarme en la lista de espera</button></form><p class="tiny muted" style="margin:8px 0 0">No confirma una reserva. Los avisos externos requieren activar el servicio de correo.</p></section>`:''}
 <section class="card">${stepHeader('4','Tus datos para confirmar')}<form data-form="public-book" class="stack">${field('customer_name','Nombre y apellido','','text','required minlength="2"')}${field('customer_phone','Teléfono','','tel','placeholder="099 123 456"')}${field('customer_email','Correo electrónico','','email','placeholder="tu@correo.com"')}<div class="field"><label>Comentario (opcional)</label><textarea name="notes" placeholder="Algo que debamos saber antes de tu visita..."></textarea></div><label class="checkline"><input type="checkbox" name="accept_policy" required> Acepto las políticas de reserva y el uso de mis datos para gestionar mi turno.</label><div class="hint-block">${ic('info')} Cancelaciones online: hasta ${b.cancel_notice_hours} horas antes del turno. ${state.service?'El precio se confirma en el local; los pagos en línea aún no están habilitados.':''}</div><button type="submit" class="btn full" ${!state.slot||!p.bookable?'disabled':''}>Confirmar mi reserva ${ic('arrow')}</button></form></section></div></div></div>`);
 }catch(e){page(`<div class="public-shell"><header class="public-nav">${brand()}</header><div class="closing"><h1>No encontramos ese negocio.</h1><p class="muted">${esc(e.message)}</p><a href="#/" class="btn">Volver al inicio</a></div></div>`);}
}
async function loadSlots(){if(!state.service){state.slots=[];return;}const params=new URLSearchParams({date:state.date,service_id:state.service});if(state.staff)params.set('staff_id',state.staff);try{const res=await api(`/api/public/${state.public.business.slug}/availability?${params}`);state.slots=res.slots;}catch(e){state.slots=[];toast(e.message,true);}}
function setScreen(body,title){state.screen=body;state.screenTitle=title;appLayout(body,title);warmNavigation();}
let warmNavigationKey='',warmNavigationTimer;
function sectionReads(view){
 if(!state.business)return [];
 if(state.business.role==='staff'&&view!=='agenda')return [];
 const routes={inicio:['/dashboard'],clientes:['/customers?q='+encodeURIComponent(state.customerQuery||'')],servicios:['/services','/staff'],equipo:['/services','/staff','/time-off'],disponibilidad:['/services','/staff','/scheduling'], 'turnos-fijos':['/recurring','/services','/staff'],'lista-espera':['/waitlist']};
 if(view==='agenda'){const range=calendarRange(state.dateAgenda,state.agendaMode);return [bapi(`/bookings?date=${range.start}&days=${range.days}${state.agendaMode==='mes'?'&calendar=month':''}`),...(state.business.role==='staff'?[]:[bapi('/staff')])];}
 return (routes[view]||[]).map(bapi);
}
function prefetchSection(view){return Promise.allSettled(sectionReads(view).map(route=>api(route)));}
function warmNavigation(){
 const key=state.me?.user?.id+'|'+state.business?.id;if(!state.business||warmNavigationKey===key)return;
 warmNavigationKey=key;clearTimeout(warmNavigationTimer);
 warmNavigationTimer=setTimeout(()=>{if(key!==state.me?.user?.id+'|'+state.business?.id)return;prefetchSection('agenda');if(state.business.role!=='staff'){prefetchSection('clientes');prefetchSection('servicios');}},500);
}
document.addEventListener('pointerover',e=>{const link=e.target.closest('#sidebar a[href^="#/app/"]');if(!link||link.contains(e.relatedTarget))return;prefetchSection(link.hash.split('/')[2]);});
document.addEventListener('focusin',e=>{const link=e.target.closest('#sidebar a[href^="#/app/"]');if(link)prefetchSection(link.hash.split('/')[2]);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){readCache.clear();warmNavigationKey='';}});
document.addEventListener('click',e=>{if(e.target.closest('[data-action="refresh"],[data-action="select-business"]')){readCache.clear();warmNavigationKey='';}},true);
async function renderApp(refresh=true){
 if(!ensureAuth())return;
 if(!state.business){
   const selected=state.businesses.find(b=>b.id===localStorage.getItem('atry_biz'))||state.businesses[0];
   if(!selected){if(state.me.user.platform_admin){nav('/admin');return;}await viewAccount();return;}
   [state.business,state.entitlements]=await Promise.all([api(`/api/business/${selected.id}`),api(`/api/business/${selected.id}/entitlements`)]);
 }
 if(refresh&&state.business)[state.business,state.entitlements]=await Promise.all([api(bapi('')),api(bapi('/entitlements'),{fresh:true})]);
 if(state.business.role==='owner'&&state.business.subscription_status==='pending'&&!state.dialog){const subscription=await api(bapi('/subscription'));state.commercial=subscription;if(!subscription.requests.length)state.appView='suscripcion';}
 if(typeof connectAgendaEvents==='function')connectAgendaEvents();
 if(!commercialRouteAllowed(state.appView))state.appView='suscripcion';
 if(state.appView!=='suscripcion'&&path()==='/app'&&!state.business.onboarding_completed&&state.business.role!=='staff'){nav('/app/configuracion-inicial');return;}
 if(!refresh && state.screen){appLayout(state.screen,state.screenTitle);return;}
 if(state.business.role==='staff'&&!['agenda','cuenta','suscripcion'].includes(state.appView)){state.appView='agenda';}
 const view=state.appView;
 try{
  if(view==='suscripcion')await viewSubscription();
  else if(view==='soporte')await viewEssentialSupport();
  else if(view==='mi-horario')await viewOwnHours();
  else if(view==='estadisticas')await viewBasicStatistics();
  else if(view==='configuracion-inicial')await viewOnboarding();
  else if(view==='inicio')await viewDashboard();
  else if(view==='agenda')await viewAgenda();
  else if(view==='turnos-fijos')await viewRecurring();
  else if(view==='smartslots')await viewSmartSlots();
  else if(view==='lista-espera')await viewWaitlist();
  else if(view==='servicios')await viewServices();
  else if(view==='equipo')await viewTeam();
  else if(view==='clientes')await viewCustomers();
  else if(view==='notificaciones')await viewNotifications();
  else if(view==='configuracion')await viewSettings();
  else if(view==='accesos')await viewMemberships();
  else if(view==='cuenta')await viewAccount();
  else if(view==='disponibilidad')await viewSchedule();
  else if(view==='insights')await viewInsights();
  else {state.appView='inicio';await viewDashboard();}
 }catch(e){toast(e.message,true);setScreen(`<div class="card">${empty('No se pudo cargar esta sección. Reintentá la operación.','info')}<button class="btn" data-action="refresh">Reintentar</button></div>`,view);}
}
async function viewDashboard(){
 if(!hasCapability('statistics')){const x=await api(bapi('/dashboard'));setScreen(`${headerTitle('Tu negocio','Tus próximos turnos y configuración.')}<div class="card upcoming-essential"><h2>Próximos turnos</h2><div class="upcoming-list">${(x.upcoming||[]).map(b=>`<div class="activity"><span>${esc(b.customer_name)} · ${esc(b.service_name)}</span><span>${dateDisplay(dayLocal(b.starts_at))} · ${hmLocal(b.starts_at)}</span></div>`).join('')||empty('No hay próximos turnos.')}</div><div class="card-footer-actions"><a class="btn" href="#/app/agenda">Abrir agenda ${ic('arrow')}</a></div></div>`,'Inicio');return;}

 const x=await api(bapi('/dashboard'));
 const setup='';
 const chart=x.daily,high=Math.max(1,...chart.map(v=>v.n));
 setScreen(`${setup}${headerTitle('Buen día, '+esc(state.me.user.name.split(' ')[0]),'Así está funcionando tu negocio.',`<button class="btn" data-action="open-booking">${ic('plus')} Crear turno</button>`)}
 <div class="grid4"><div class="metric"><div class="metric-top"><h3>Turnos de hoy</h3>${ic('calendar')}</div><strong>${x.today_count}</strong><div class="delta">Agenda diaria</div></div><div class="metric"><div class="metric-top"><h3>Clientes registrados</h3>${ic('users')}</div><strong>${x.customers}</strong><div class="delta">En tu negocio</div></div><div class="metric"><div class="metric-top"><h3>Profesionales</h3>${ic('users')}</div><strong>${x.staff}</strong><div class="delta">Activos</div></div><div class="metric"><div class="metric-top"><h3>Ingresos registrados · 30 días</h3>${ic('wallet')}</div><strong>${money(x.totals.completed_revenue)}</strong><div class="delta">Solo turnos completados · No contabilidad</div></div></div>
 <div class="grid2" style="margin-top:19px"><div class="card"><div class="row between" style="margin-bottom:14px"><h2 class="section-label">Próximos turnos</h2><a class="small" style="color:var(--accent)" href="#/app/agenda">Ver agenda ${ic('chevron')}</a></div>${x.upcoming.length?x.upcoming.map(a=>`<div class="appt-row"><span class="appt-time">${hmLocal(a.starts_at)}</span><div class="grow"><div class="appt-person">${esc(a.customer_name)}</div><div class="appt-sub">${esc(a.service_name)} · ${esc(a.staff_name)} · ${dateDisplay(dayLocal(a.starts_at))}</div></div>${badge(a.status)}</div>`).join(''):empty('Todavía no hay turnos próximos.')}</div>
 <div class="stack"><div class="card"><h2 class="section-label" style="margin-bottom:13px">Actividad de la última semana</h2><p class="muted tiny">Turnos registrados por día (no cancelados).</p><div class="bar-chart">${Array.from({length:7},(_,i)=>plusDate(today(),i-6)).map(d=>{const item=chart.find(x=>x.day===d);const n=item?item.n:0;return `<div class="bar-col"><div title="${n} turnos" class="bar" style="height:${Math.max(4,n/high*105)}px"></div><label>${d.slice(8)}</label></div>`;}).join('')}</div></div><div class="card"><h2 class="section-label">Actividad reciente</h2><div class="row between" style="padding-top:18px"><span class="muted small">Reservas de 30 días</span><strong>${x.totals.total}</strong></div><div class="row between" style="padding-top:14px"><span class="muted small">Cancelaciones</span><strong>${x.totals.cancelled}</strong></div><div class="row between" style="padding-top:14px"><span class="muted small">Ausencias</span><strong>${x.totals.no_show}</strong></div></div></div></div>
 <div style="margin-top:20px" class="card"><div class="row between" style="margin-bottom:13px"><h2 class="section-label">${ic('spark')} Resumen del negocio</h2><span class="badge info">Reglas basadas en datos</span></div>${x.insights.length?x.insights.map(t=>`<div class="activity"><div class="icon-circle">${ic('info')}</div><div class="grow small">${esc(t)}</div></div>`).join(''):'<p class="muted small">Tu negocio está listo. Compartí tu enlace para conseguir nuevas reservas.</p>'}<div class="small muted" style="margin-top:12px">Estas sugerencias usan información de la agenda. No son predicciones de inteligencia artificial.</div></div>`, 'Inicio');
}
function bookingActions(a){return (a.recurring_id?'<span class="badge info">Turno fijo · acciones solo para esta fecha</span>':'')+(['pending','confirmed'].includes(a.status)?`<div class="actions"><button class="btn secondary sm" data-action="booking-status" data-id="${a.id}" data-starts-at="${esc(a.starts_at)}" data-status="${a.status==='pending'?'confirmed':'completed'}">${ic('check')} ${a.status==='pending'?'Confirmar':'Completar'}</button><button class="btn secondary sm" aria-label="Reprogramar turno" data-action="booking-reschedule" data-id="${a.id}">${ic('edit')}</button><button class="btn danger sm" aria-label="Cancelar turno" data-action="booking-status" data-id="${a.id}" data-status="cancelled">${ic('x')}</button><button class="btn danger sm" data-action="booking-status" data-id="${a.id}" data-status="no_show" ${a.status==='pending'?'disabled':''}>Ausente</button></div>`:'<span class="muted tiny">Sin acciones disponibles</span>');}
async function viewServices(){
 const [services,staff]=await Promise.all([api(bapi('/services')),api(bapi('/staff'))]);state.services=services;state.staffList=staff;
 setScreen(`${headerTitle('Servicios','Definí qué ofrecés, cuánto dura y qué cuesta.',`<button class="btn" data-action="add-service">${ic('plus')} Nuevo servicio</button>`)}<div class="grid3">${services.length?services.map(s=>`<div class="card stack"><div class="row between"><div class="icon-circle">${ic(sectorIcon(state.business.sector,s.name))}</div>${s.active?'<span class="badge">Publicado</span>':'<span class="badge pending">Oculto</span>'}</div><div><h3 style="margin:0 0 6px">${esc(s.name)}</h3><p class="small muted" style="margin:0">${esc(s.description||'Servicio disponible en agenda')}</p></div><div class="row between"><strong style="font-size:22px;letter-spacing:-.03em">${money(s.price_uyu)}</strong><span class="small muted">${s.duration_min} minutos</span></div><div class="small muted">${s.deposit_percent?`Seña prevista: ${s.deposit_percent}% · `:''}Preparación: ${s.buffer_before_min}m · Limpieza: ${s.buffer_after_min}m</div><div class="actions"><button class="btn secondary sm" data-action="edit-service" data-id="${s.id}">${ic('edit')} Editar</button><button class="btn ${s.active?'danger':'secondary'} sm" data-action="toggle-service" data-id="${s.id}" data-active="${s.active?0:1}">${s.active?'Ocultar':'Publicar'}</button></div></div>`).join(''):empty('Todavía no hay servicios. Creá el primero para abrir la agenda.','scissors')}</div><div class="hint-block" style="margin-top:20px">${ic('info')} Un servicio con reservas futuras no permite cambiar su duración para evitar conflictos. Podés ocultarlo y crear otra versión.</div>`, 'Servicios');
}
async function viewTeam(){
 const [staff,services,timeOff]=await Promise.all([api(bapi('/staff')),api(bapi('/services')),api(bapi('/time-off'))]);state.staffList=staff;state.services=services;state.timeOff=timeOff;
 setScreen(`${headerTitle('Equipo y horarios','Organizá profesionales, jornadas y ausencias.',`<button class="btn" data-action="add-staff">${ic('plus')} Agregar profesional</button>`)}${state.business.role==='owner'?'<button class="btn secondary" style="margin-bottom:18px" data-action="add-member">Vincular cuenta del equipo</button>':''}<div class="grid3">${staff.map(s=>`<div class="card stack"><div class="row"><div class="icon-circle">${ic('users')}</div><div class="grow"><h3 style="margin:0 0 3px">${esc(s.name)}</h3><span class="muted tiny">${esc(s.email||'Sin correo')}</span></div>${s.active?'<span class="badge">Activo</span>':'<span class="badge pending">Inactivo</span>'}</div><div class="small muted">${s.service_ids.length} servicios asignados</div><div class="actions"><button class="btn secondary sm" data-action="edit-staff" data-id="${s.id}">${ic('edit')} Editar</button><button class="btn secondary sm" data-action="edit-hours" data-id="${s.id}">${ic('clock')} Horarios</button><button class="btn secondary sm" data-action="add-timeoff" data-id="${s.id}">${ic('block')} Ausencia</button></div></div>`).join('')}</div><div class="card" style="margin-top:20px"><div class="row between"><h2 class="section-label">Bloqueos y ausencias</h2><span class="muted small">Vacaciones, permisos o descansos especiales</span></div>${timeOff.length?`<div class="scroll-x"><table class="table"><thead><tr><th>Profesional</th><th>Desde</th><th>Hasta</th><th>Motivo</th><th></th></tr></thead><tbody>${timeOff.map(t=>`<tr><td>${esc(t.staff_name)}</td><td>${dateLocal(t.starts_at)}</td><td>${dateLocal(t.ends_at)}</td><td>${esc(t.reason||'No indicado')}</td><td><button class="btn danger sm" data-action="delete-timeoff" data-id="${t.id}">${ic('trash')}</button></td></tr>`).join('')}</tbody></table></div>`:empty('Sin bloqueos o ausencias registrados','clock')}</div>`, 'Equipo');
}
async function viewWaitlist(){
 const items=await api(bapi('/waitlist'));state.waitlist=items;
 setScreen(`${headerTitle('Lista de espera','Personas interesadas en horarios todavía no disponibles.')}<div class="hint-block" style="margin-bottom:18px">${ic('info')} Al cancelarse un turno, Atry identifica una solicitud compatible y prepara una oferta en la cola de avisos. No retiene el horario ni garantiza la reserva. Los avisos por correo dependen de la configuración del negocio y del proveedor.</div><div class="card">${items.length?`<div class="scroll-x"><table class="table"><thead><tr><th>Cliente</th><th>Servicio</th><th>Fecha deseada</th><th>Profesional</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${items.map(w=>`<tr><td><strong>${esc(w.customer_name)}</strong><div class="tiny muted">${esc(w.customer_email)}</div></td><td>${esc(w.service_name)}</td><td>${esc(w.desired_date)}</td><td>${esc(w.staff_name||'Cualquiera')}</td><td>${badge(w.status)}</td><td><div class="actions">${w.status!=='cancelled'?`<button class="btn danger sm" data-action="waitlist-status" data-id="${w.id}" data-status="cancelled">Cancelar</button>`:''}${w.status==='offered'?`<button class="btn secondary sm" data-action="waitlist-status" data-id="${w.id}" data-status="booked">Marcar atendido</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:empty('Todavía nadie se anotó en la lista de espera.','clock')}</div>`, 'Lista de espera');
}
async function viewCustomers(){
 const clients=await api(bapi('/customers?q='+encodeURIComponent(state.customerQuery||'')));state.customers=clients;
 const count=clients.length,summary=count+' '+(count===1?'cliente':'clientes')+' '+(state.customerQuery?(count===1?'encontrado':'encontrados'):(count===1?'reciente':'recientes'));
 setScreen(`${headerTitle('Tus clientes','Buscá una persona, revisá su historial y reservá desde su ficha.',`<div class="actions"><button class="btn" data-action="new-customer">${ic('plus')} Agregar cliente</button><button class="btn secondary" data-action="export">${ic('download')} Exportar reservas</button></div>`)}<form data-form="search-customers" class="customer-search"><label class="field"><span>Buscar por nombre, correo o teléfono</span><input aria-label="Buscar clientes" name="q" maxlength="80" value="${esc(state.customerQuery||'')}" placeholder="Por ejemplo: nombre o últimos dígitos"></label><button class="btn secondary">${ic('search')} Buscar</button></form><div class="row between" style="margin:20px 0"><h2 class="section-label">${summary}</h2><span class="small muted">Hasta 100 resultados · Afiná la búsqueda para encontrar más</span></div><div class="grid2 customer-grid">${clients.map(c=>`<article class="card stack customer-card"><div class="row"><div class="avatar">${ucode(c.name)}</div><div class="grow"><h2>${esc(c.name)}</h2><span class="small muted">${c.visits} reservas registradas</span></div></div><div class="customer-contact"><span>${ic('mail')} ${esc(c.email||'Sin correo')}</span><span>${ic('users')} ${esc(c.phone||'Sin teléfono')}</span></div><p class="small muted customer-note">${esc(c.notes||'Sin notas internas')}</p><div class="actions customer-actions"><button class="btn sm" data-action="customer-booking" data-id="${c.id}">${ic('calendar')} Asignar turno</button><button class="btn secondary sm" data-action="customer-fixed" data-id="${c.id}">${ic('repeat')} Turno fijo</button><button class="btn secondary sm" data-action="edit-customer" data-id="${c.id}">${ic('users')} Ver ficha</button></div></article>`).join('')||empty(state.customerQuery?'No encontramos coincidencias. Probá con otro dato o agregá un cliente.':'Agregá tus contactos o recibí la primera reserva para empezar.','users')}</div>`, 'Clientes');
}
async function viewSettings(){
 const b=state.business;
 const tabs=[['general','Datos del negocio'],...(b.role==='owner'?[['apariencia','Apariencia e identidad']]:[]),['reservas','Reglas de reserva'],['publicacion','Página de reservas']];
 const content=state.settingsTab==='apariencia'&&b.role==='owner'?appearanceEditor(b):state.settingsTab==='general'?`<form class="form-grid" data-form="save-settings">${field('name','Nombre comercial',b.name,'text','required')}${field('sector','Categoría',b.sector)}${field('phone','WhatsApp o teléfono',b.phone,'tel')}${field('email','Correo de contacto',b.email,'email')}${field('city','Ciudad',b.city)}${field('address','Dirección',b.address)}<div class="field form-full"><label>Descripción del negocio</label><textarea name="description">${esc(b.description)}</textarea></div><div class="form-full"><button class="btn">${ic('check')} Guardar datos</button></div></form>`:state.settingsTab==='reservas'?`<form class="form-grid" data-form="save-settings">${field('min_notice_min','Anticipación mínima (minutos)',b.min_notice_min,'number','min="0" max="10080" required')}${field('max_days','Hasta cuántos días se puede reservar',b.max_days,'number','min="1" max="365" required')}${field('cancel_notice_hours','Horas mínimas para cancelar',b.cancel_notice_hours,'number','min="0" max="168" required')}<div class="field"><label>Intervalo de la agenda</label><select name="slot_step_min">${[5,10,15,20,30,60].map(n=>option(n,n+' minutos',n===b.slot_step_min)).join('')}</select></div><div class="field form-full"><label>Confirmación de reservas</label><select name="auto_confirm">${option(1,'Automática',b.auto_confirm===1)}${option(0,'Pendiente de aprobación',b.auto_confirm===0)}</select></div><div class="form-full hint-block">Organizá varios tramos de atención y fechas especiales desde Horarios.</div><div class="form-full"><button class="btn">${ic('check')} Guardar reglas</button></div></form>`:`<div class="stack"><div><h3>Tu página pública</h3><p class="muted small">Compartí este enlace donde tus clientes te encuentren.</p><div class="preview-url">${esc(businessUrl())}</div><div class="actions" style="margin-top:12px"><button class="btn secondary" data-action="copy-link">${ic('copy')} Copiar enlace</button><a class="btn secondary" href="#/reservar/${esc(b.slug)}" target="_blank">${ic('external')} Ver página</a></div></div>${hasCapability('exports')?`<div class="separator"></div><div><h3>Exportación de información</h3><p class="muted small">Podés descargar todas las reservas en un archivo CSV.</p><button class="btn secondary" data-action="export">${ic('download')} Descargar CSV</button></div>`:''}</div>`;
 setScreen(`${headerTitle('Configuración','Personalizá tu negocio y decidí cómo se toman los turnos.')}<nav class="settings-tabs workspace-tabs" aria-label="Secciones de configuración">${tabs.map(([key,label],i)=>`<button data-action="settings-tab" data-id="${key}" ${state.settingsTab===key?'aria-current="page"':''}>${ic(['shop','spark','settings','external'][i])} ${label}</button>`).join('')}</nav><div class="card" style="max-width:820px">${content}</div>`, 'Configuración');
}
const serviceCheckList=(selected=[])=>`<div class="field form-full"><label>Servicios asignados</label><div class="subtle-card stack">${(state.services||[]).map(s=>`<label class="checkline"><input type="checkbox" name="service_ids" value="${s.id}" ${selected.includes(s.id)?'checked':''}> ${esc(s.name)}</label>`).join('')||'<span class="small muted">Creá servicios antes de asignarlos.</span>'}</div></div>`;
const teamCheckList=(selected=[])=>`<div class="field form-full"><label>Profesionales que ofrecen el servicio</label><div class="subtle-card stack">${(state.staffList||[]).map(s=>`<label class="checkline"><input type="checkbox" name="staff_ids" value="${s.id}" ${selected.includes(s.id)?'checked':''}> ${esc(s.name)}</label>`).join('')||'<span class="small muted">Aún no hay profesionales.</span>'}</div></div>`;
function serviceModal(service=null){
 const current=service||{name:'',description:'',duration_min:30,price_uyu:500,deposit_percent:0,buffer_before_min:0,buffer_after_min:0};
 const selected=service?(state.staffList||[]).filter(x=>x.service_ids.includes(service.id)).map(x=>x.id):(state.staffList||[]).map(x=>x.id);
 showDialog(service?'Editar servicio':'Nuevo servicio',`<form data-form="${service?'update-service':'create-service'}" ${service?`data-id="${service.id}"`:''} class="form-grid">${field('name','Nombre del servicio',current.name,'text','required minlength="2"')}${field('price_uyu','Precio en pesos uruguayos',current.price_uyu,'number','required min="0"')}${field('duration_min','Duración (minutos)',current.duration_min,'number','required min="5" max="720"')}${field('deposit_percent','Seña estimada (%)',current.deposit_percent,'number','min="0" max="100"')}${field('buffer_before_min','Preparación previa (min)',current.buffer_before_min,'number','min="0" max="180"')}${field('buffer_after_min','Tiempo posterior (min)',current.buffer_after_min,'number','min="0" max="180"')}<div class="field form-full"><label>Descripción</label><textarea name="description">${esc(current.description)}</textarea></div>${teamCheckList(selected)}<div class="form-full hint-block">Los porcentajes de seña se configuran aquí, pero el cobro online todavía no está conectado.</div><div class="form-full"><button class="btn full">${ic('check')} Guardar servicio</button></div></form>`);
}
function staffModal(staff=null){
 const current=staff||{name:'',email:''};const selected=staff?staff.service_ids:(state.services||[]).map(x=>x.id);
 showDialog(staff?'Editar profesional':'Agregar profesional',`<form data-form="${staff?'update-staff':'create-staff'}" ${staff?`data-id="${staff.id}"`:''} class="form-grid">${field('name','Nombre completo',current.name,'text','required minlength="2"')}${field('email','Correo (opcional)',current.email,'email')}${serviceCheckList(selected)}${!staff?'<p class="hint-block form-full">El profesional comienza con jornada de lunes a sábado, de 09:00 a 18:00. Revisá sus horarios antes de compartir el enlace de reservas.</p>':''}${staff?`<div class="field form-full"><label>Estado del profesional</label><select name="active">${option(1,'Activo',!!current.active)}${option(0,'Inactivo',!current.active)}</select></div>`:''}<div class="form-full"><button class="btn full">${ic('check')} Guardar profesional</button></div></form>`);
}
async function hoursModal(staffId){return weeklyHoursModal(staffId);}
function timeOffModal(staffId){
 const near=plusDate(today(),1);showDialog('Bloquear disponibilidad',`<form data-form="create-timeoff"><input type="hidden" name="staff_id" value="${esc(staffId)}">${field('starts_at','Desde',near+'T09:00','datetime-local','required')}${field('ends_at','Hasta',near+'T18:00','datetime-local','required')}${field('reason','Motivo (opcional)','Vacaciones / descanso') }<div class="hint-block">Si hay reservas confirmadas en ese intervalo, primero tendrás que reprogramarlas.</div><button class="btn full">${ic('block')} Bloquear horario</button></form>`);
}
async function bookingModal(customer=null){
 const [services,staff]=await Promise.all([api(bapi('/services')),api(bapi('/staff'))]);state.services=services;state.staffList=staff;
 if(!services.some(s=>s.active)||!staff.some(s=>s.active)){toast('Creá primero un servicio y un profesional activo',true);nav('/app/servicios');return;}
 showDialog('Crear una reserva manual',`<form data-form="manual-book" class="form-grid">${customer?`<input type="hidden" name="customer_id" value="${esc(customer.id)}"><p class="hint-block form-full">Cliente seleccionado: ${esc(customer.name)}. Para modificar su contacto, editá su ficha.</p>`:''}<div class="field form-full"><label>Servicio</label><select name="service_id" required>${services.filter(x=>x.active).map(x=>option(x.id,`${x.name} · ${x.duration_min} min · ${money(x.price_uyu)}`)).join('')}</select></div><div class="field form-full"><label>Profesional</label><select name="staff_id" required>${staff.filter(x=>x.active).map(x=>option(x.id,x.name)).join('')}</select></div>${field('date','Fecha',state.dateAgenda,'date','required')}${field('time','Hora','10:00','time','required')}${field('customer_name','Nombre del cliente',customer?.name||'','text','required minlength="2"')}${field('customer_phone','Teléfono',customer?.phone||'','tel')}${field('customer_email','Correo',customer?.email||'','email')}<div class="field form-full"><label>Notas internas</label><textarea name="notes"></textarea></div><div class="form-full hint-block">Las reservas manuales también respetan jornadas, ausencias y conflictos de horario.</div><div class="form-full"><button class="btn full">${ic('check')} Guardar reserva</button></div></form>`);
 if(customer)for(const name of ['customer_name','customer_email','customer_phone'])document.querySelector(`[data-form=manual-book] [name=${name}]`).readOnly=true;
}
function rescheduleModal(id){
 const a=(state.currentBookings||[]).find(x=>x.id===id);if(!a)return;
 showDialog('Reprogramar turno',`<form data-form="reschedule" data-id="${a.id}"><p class="muted small">${esc(a.customer_name)} · ${esc(a.service_name)}</p><div class="field"><label>Nueva fecha y hora</label><input type="datetime-local" name="date_time" value="${dayLocal(a.starts_at)}T${hmLocal(a.starts_at)}" required></div><div class="field"><label>Profesional</label><select name="staff_id">${(state.staffList||[]).map(s=>option(s.id,s.name,s.id===a.staff_id)).join('')}</select></div><div class="hint-block">Solo se puede mover a un horario disponible del profesional elegido.</div><button class="btn full">${ic('check')} Guardar cambio</button></form>`);
}
async function customerModal(id){const c=id?(state.customers||[]).find(x=>x.id===id):{id:'',name:'',email:'',phone:'',notes:'',marketing_consent:0};if(!c)return;
 const history=id?await api(bapi('/customers/'+id+'/history')):[];
 showDialog(c.id?`Cliente: ${c.name}`:'Agregar cliente',`<form data-form="update-customer" data-id="${c.id}">${field('name','Nombre del cliente',c.name,'text','required minlength="2" maxlength="100"')}${field('phone','Teléfono',c.phone,'tel','maxlength="35"')}${field('email','Correo',c.email,'email','maxlength="150"')}<p class="small muted">Los turnos ya creados conservan su contacto original. Los nuevos usan estos datos; no se reenvían avisos.</p><div class="field"><label>Notas internas</label><textarea name="notes">${esc(c.notes)}</textarea></div><label class="checkline"><input type="checkbox" name="marketing_consent" ${c.marketing_consent?'checked':''}> Tiene consentimiento para comunicaciones promocionales</label><button class="btn full">${ic('check')} Guardar cliente</button></form><h3 style="margin-top:24px">Historial de reservas</h3>${history.length?history.map(a=>`<div class="activity"><div class="grow"><strong class="small">${esc(a.service_name)}</strong><div class="tiny muted">${dateLocal(a.starts_at)} · ${esc(a.staff_name)}</div></div>${badge(a.status)}</div>`).join(''):empty('Sin reservas registradas')}`);
}
function adminModal(target){if(typeof manualSubscriptionModal==='function'){manualSubscriptionModal(target);return;}
 const id=target.dataset.id;showDialog('Administrar suscripción',`<form data-form="admin-business" data-id="${esc(id)}"><div class="field"><label>Plan comercial</label><select name="plan">${['trial','individual','negocio','pro'].map(n=>option(n,n,n===target.dataset.plan)).join('')}</select></div><div class="field"><label>Estado de suscripción</label><select name="subscription_status">${['trialing','active','past_due','suspended'].map(n=>option(n,n,n===target.dataset.status)).join('')}</select></div><div class="field"><label>Estado del negocio</label><select name="is_active">${option(1,'Habilitado',target.dataset.active==='1')}${option(0,'Suspendido',target.dataset.active==='0')}</select></div><div class="hint-block">Estos cambios son administrativos. No procesan un pago real ni crean una suscripción en Mercado Pago.</div><button class="btn full">Actualizar negocio</button></form>`);
}
function parseMontevideo(datetime){if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(datetime))throw new Error('Ingresá una fecha y hora válida');const d=new Date(datetime+':00-03:00');if(!Number.isFinite(d.getTime()))throw new Error('Fecha inválida');return d.toISOString();}
const payload=form=>Object.fromEntries(new FormData(form).entries());
async function onSubmit(e){
 const f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();
 const kind=f.dataset.form,data=payload(f),button=f.querySelector('button[type=submit],button:not([type])');
 let saved=true;
 if(button){button.disabled=true;button.dataset.old=button.innerHTML;button.innerHTML='<span class="spin"></span> Guardando...';}
 try{
  if(await submitFeature(kind,data,f))return;
  if(kind==='accept-offer'){f.dataset.requestKey ||= crypto.randomUUID();const booking=await post('/api/offers/'+f.dataset.token+'/accept',{accept_policy:!!data.accept_policy,idempotency_key:f.dataset.requestKey});nav('/gestionar/'+booking.manage_token);return;}
  if(kind==='admin-business'){
   const keep=new FormData(f).getAll('keep_staff_ids');if(keep.length)data.keep_staff_ids=keep;else delete data.keep_staff_ids;

    f.dataset.requestKey ||= crypto.randomUUID();await post('/api/admin/businesses/'+f.dataset.id,{...data,amount_uyu:Number(data.amount_uyu||0),request_id:f.dataset.requestKey},'PATCH');state.dialog=null;toast('Habilitación guardada');await adminView();return;
  }
  if(kind==='admin-search'){state.adminQuery=data.q;state.adminFilter=data.status||'all';await adminView();return;}
  if(kind==='search-customers'){state.customerQuery=data.q;await viewCustomers();return;}
  if(kind==='smart-date'){state.smartDate=data.date;await viewSmartSlots();return;}
  if(kind==='add-member'){await post(bapi('/members'),data);toast('Cuenta vinculada');state.dialog=null;await renderApp();return;}
  if(kind==='public-reschedule'){await post('/api/manage/'+f.dataset.token+'/reschedule',{starts_at:parseMontevideo(data.date_time)});toast('Turno reprogramado');await manageView(f.dataset.token);return;}
  if(kind==='forgot-password'){const result=await post('/api/auth/forgot-password',data);toast(result.message);return;}
  if(kind==='reset-password'){await post('/api/auth/reset-password',{...data,token:f.dataset.token});toast('Contraseña actualizada. Iniciá sesión.');nav('/login');return;}
  if(kind==='complete-onboarding'){await post(bapi(''),{onboarding_completed:1},'PATCH');state.business=null;nav('/app/inicio');return;}
  if(kind==='login'||kind==='register'){
   const demoPlan=kind==='login'&&window.ATRY_DEMO?.loginPlan(data.email);if(demoPlan){delete f.dataset.dirty;location.assign(location.pathname+'?demo=1&plan='+demoPlan+'#/app/inicio');return;}
   if(kind==='register'){const created=await post('/api/auth/register',data);if(created.requiresEmailVerification){verificationView(data.email);return;}}
   await post('/api/auth/login',{email:data.email,password:data.password});
   state.me=await api('/api/auth/me');state.businesses=state.me.businesses;state.business=null;state.dialog=null;toast('Bienvenido a Atry Turnos');const savedReturn=localStorage.getItem('atry_return_to');localStorage.removeItem('atry_return_to');const invitationReturn=/^\/invitacion\/[A-Za-z0-9_-]{32,100}$/.test(savedReturn||'')?savedReturn:null;const destination=state.returnTo||invitationReturn||(state.me.user.platform_admin?'/admin':kind==='register'?'/app/configuracion-inicial':'/app/inicio');state.returnTo=null;nav(destination);return;
  }
  if(kind==='public-waitlist'){
    f.dataset.requestKey ||= crypto.randomUUID();
    await post(`/api/public/${state.public.business.slug}/waitlist`,{idempotency_key:f.dataset.requestKey,service_id:state.service,staff_id:state.staff||null,desired_date:state.date,customer_name:data.customer_name,customer_email:data.customer_email,customer_phone:data.customer_phone,accept_policy:!!data.accept_policy});
    toast('Te agregamos a la lista de espera. No es una reserva confirmada.');return;
  }
  if(kind==='public-book'){
   if(!state.slot)throw new Error('Seleccioná un horario disponible');
   if(!data.customer_email&&!data.customer_phone)throw new Error('Ingresá un teléfono o correo para confirmar');
   const [start,staffId]=state.slot.split('|');
   f.dataset.requestKey=f.dataset.requestKey||crypto.randomUUID();const out=await post(`/api/public/${state.public.business.slug}/book`,{idempotency_key:f.dataset.requestKey,service_id:state.service,staff_id:staffId,starts_at:start,customer_name:data.customer_name,customer_phone:data.customer_phone,customer_email:data.customer_email,notes:data.notes,accept_policy:true});
   const management=`${new URL("./",location.href).href}#/gestionar/${out.manage_token}`;
   const service=state.public.services.find(s=>s.id===state.service),professional=state.public.staff.find(s=>s.id===staffId);
   let receipt={...out,business_name:state.public.business.name,service_name:service?.name,staff_name:professional?.name,price_uyu:service?.price_uyu,customer_name:data.customer_name};try{receipt={...receipt,...await api('/api/manage/'+encodeURIComponent(out.manage_token))};}catch{}
   page(bookingReceiptPage(receipt,management));window.scrollTo({top:0,behavior:'instant'});
   state.slot='';return;
  }
  const bid=state.business.id;
  if(kind==='save-appearance'){
    if(state.business.role!=='owner')throw new Error('Solo el propietario puede cambiar la apariencia');
    const payload={primary_color:data.primary_color.toUpperCase(),secondary_color:data.secondary_color.toUpperCase(),appearance_mode:data.appearance_mode};
    if(!ATRY_APPEARANCE.hex(payload.primary_color)||!ATRY_APPEARANCE.hex(payload.secondary_color)||!['light','dark'].includes(payload.appearance_mode))throw new Error('Revisá los colores y el tema');
    const logo=preparedBusinessLogo(f);if(logo!==undefined)payload.logo_url=logo;
    state.business={...state.business,...await post(bapi('/appearance'),payload,'PATCH')};state.screen=null;toast('Apariencia guardada para tu equipo');await renderApp();return;
  }
  if(kind==='save-settings'){
    delete data.logo_file;const logo=preparedBusinessLogo(f);if(logo!==undefined)data.logo_url=logo;
    for(const k of ['min_notice_min','max_days','cancel_notice_hours','slot_step_min','auto_confirm'])if(k in data)data[k]=Number(data[k]);
    state.business={...state.business,...await post(bapi(''),data,'PATCH')};state.businesses=state.businesses.map(b=>b.id===state.business.id?{...b,name:state.business.name}:b);state.dialog=null;toast('Configuración guardada');await renderApp();return;
  }
  if(['create-service','update-service'].includes(kind)){
    for(const k of ['price_uyu','duration_min','deposit_percent','buffer_before_min','buffer_after_min'])data[k]=Number(data[k]);
    data.staff_ids=new FormData(f).getAll('staff_ids');
    if(kind==='create-service')await post(bapi('/services'),data);
    else await post(bapi('/services/'+f.dataset.id),data,'PATCH');
    toast('Servicio guardado');state.dialog=null;await renderApp();return;
  }
  if(['create-staff','update-staff'].includes(kind)){
    data.service_ids=new FormData(f).getAll('service_ids');if(kind==='update-staff')data.active=Number(data.active);
    if(kind==='create-staff')await post(bapi('/staff'),data);
    else await post(bapi('/staff/'+f.dataset.id),data,'PATCH');
    toast('Profesional guardado');state.dialog=null;await renderApp();return;
  }
  if(kind==='save-hours'){await saveWeeklyHours(f);return;}
  if(kind==='create-timeoff'){
    await post(bapi('/time-off'),{staff_id:data.staff_id,starts_at:parseMontevideo(data.starts_at),ends_at:parseMontevideo(data.ends_at),reason:data.reason});
    toast('Horario bloqueado');state.dialog=null;await renderApp();return;
  }
  if(kind==='manual-book'){
    if(!data.customer_email&&!data.customer_phone)throw new Error('Ingresá correo o teléfono');
    f.dataset.requestKey=f.dataset.requestKey||crypto.randomUUID();await post(bapi('/bookings'),{idempotency_key:f.dataset.requestKey,service_id:data.service_id,staff_id:data.staff_id,starts_at:parseMontevideo(data.date+'T'+data.time),customer_name:data.customer_name,customer_phone:data.customer_phone,customer_email:data.customer_email,notes:data.notes,...(data.customer_id?{customer_id:data.customer_id}:{})});
    state.dateAgenda=data.date;toast('Reserva creada');state.dialog=null;state.appView='agenda';if(location.hash!=='#/app/agenda')nav('/app/agenda');else await renderApp();return;
  }
  if(kind==='reschedule'){
    await post(bapi('/bookings/'+f.dataset.id),{starts_at:parseMontevideo(data.date_time),staff_id:data.staff_id},'PATCH');toast('Turno reprogramado');state.dialog=null;await renderApp();return;
  }
  if(kind==='update-customer'){
    await post(bapi('/customers'+(f.dataset.id?'/'+f.dataset.id:'')),{name:data.name,email:data.email,phone:data.phone,notes:data.notes,marketing_consent:!!data.marketing_consent},f.dataset.id?'PATCH':'POST');toast('Cliente actualizado');state.dialog=null;await renderApp();return;
  }

 }catch(err){saved=false;toast(err.message,true);}
 finally{if(saved)delete f.dataset.dirty;if(button&&document.contains(button)){button.disabled=false;button.innerHTML=button.dataset.old||'Guardar';}}
}
function setMenu(open){
 const sidebar=$('#sidebar');if(!sidebar)return;
 sidebar.classList.toggle('open',open);
 $('.sidebar-backdrop')?.classList.toggle('visible',open);
 const trigger=$('[data-action="toggle-menu"]');trigger?.setAttribute('aria-expanded',String(open));trigger?.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');
 if(open)sidebar.querySelector('[data-action="close-menu"]')?.focus();else trigger?.focus();
}
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#sidebar')?.classList.contains('open')){e.preventDefault();setMenu(false);}});
 document.addEventListener('click',e=>{if(e.target.closest('#sidebar a'))setMenu(false);});
async function onClick(e){
 const btn=e.target.closest('[data-action]');if(!btn)return;
 const a=btn.dataset.action;
 if(a==='close-modal' && btn.classList.contains('modal-mask') && e.target.closest('.modal'))return;
 e.preventDefault();
 try{
  if(await clickFeature(a,btn))return;
  if(a==='close-modal'){if($('.modal form[data-dirty="true"]')&&!await confirmAction('Hay cambios sin guardar. ¿Querés cerrar esta ventana?'))return;state.dialog=null;if(path().startsWith('/admin'))await adminView();else await renderApp(state.syncPending||false);return;}
  if(a==='toggle-menu'){setMenu(!$('#sidebar')?.classList.contains('open'));return;} if(a==='close-menu'){setMenu(false);return;}
  if(a==='logout'&&window.ATRY_DEMO?.enabled){location.assign(location.pathname+'#/login');return;}
  if(a==='logout'){await post('/api/auth/logout',{});state.me=null;state.business=null;state.businesses=[];state.dialog=null;toast('Sesión cerrada');nav('/login');return;}
  if(a==='copy-link'||a==='copy-custom'){
    const text=a==='copy-link'?businessUrl():btn.dataset.text;
    try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(text);const before=btn.innerHTML;btn.innerHTML=ic('check')+' <span>Copiado</span>';setTimeout(()=>{if(btn.isConnected)btn.innerHTML=before;},1800);toast('Enlace copiado');}
    catch{const dialog=document.createElement('dialog');dialog.className='confirm-dialog';dialog.setAttribute('aria-label','Copiar enlace');dialog.innerHTML='<h2>Copiá este enlace</h2><label for="manual-copy">Enlace</label><input id="manual-copy" readonly><button type="button" class="btn secondary" style="margin-top:16px">Listo</button>';dialog.querySelector('input').value=text;dialog.querySelector('button').addEventListener('click',()=>{dialog.close();dialog.remove();btn.focus();});dialog.addEventListener('cancel',()=>dialog.remove());document.body.append(dialog);dialog.showModal();dialog.querySelector('input').select();}return;
  }
  if(a==='public-service'){state.service=btn.dataset.id;state.staff='';state.slot='';await loadSlots();await publicView(state.public.business.slug);return;}
  if(a==='public-staff'){state.staff=btn.dataset.id;state.slot='';await loadSlots();await publicView(state.public.business.slug);return;}
  if(a==='public-slot'){state.slot=btn.dataset.id;await publicView(state.public.business.slug);return;}
  if(a==='manage-cancel'){
    if(!await confirmAction('¿Querés cancelar este turno? Esta acción no se puede deshacer.'))return;
    await post('/api/manage/'+btn.dataset.token+'/cancel',{});toast('Turno cancelado');await manageView(btn.dataset.token);return;
  }
  if(a==='manage-reschedule'){const form=document.getElementById('public-reschedule');form.hidden=!form.hidden;return;}
  if(a==='add-member'){showDialog('Vincular cuenta del equipo',`<form data-form="add-member">${field('email','Correo de la cuenta existente','','email','required')}<div class="field"><label for="member-role">Rol</label><select id="member-role" name="role">${option('staff','Empleado: consulta su agenda')}${option('manager','Encargado: gestiona el negocio')}</select></div><div class="field"><label for="member-staff">Profesional para el rol empleado</label><select id="member-staff" name="staff_id">${(state.staffList||[]).filter(x=>!x.user_id).map(x=>option(x.id,x.name)).join('')}</select></div><p class="muted small">La persona debe tener una cuenta. Un encargado podrá gestionar datos y reservas de este negocio.</p><button class="btn">Vincular cuenta</button></form>`);return;}
  if(a==='agenda-day'){state.dateAgenda=plusDate(state.dateAgenda,Number(btn.dataset.shift));await renderApp();return;}
  if(a==='agenda-today'){state.dateAgenda=today();await renderApp();return;}
  if(a==='refresh'){await renderApp();return;}
  if(a==='reload-page'){location.reload();return;}
  if(a==='open-booking'){await bookingModal();return;}
  if(a==='add-service'){serviceModal();return;}
  if(a==='edit-service'){serviceModal(state.services.find(x=>x.id===btn.dataset.id));return;}
  if(a==='toggle-service'){
    if(btn.dataset.active==='0'&&!await confirmAction('¿Ocultar el servicio de las nuevas reservas? Las reservas existentes se conservan.'))return;
    await post(bapi('/services/'+btn.dataset.id),{active:Number(btn.dataset.active)},'PATCH');toast('Servicio actualizado');await renderApp();return;
  }
  if(a==='add-staff'){staffModal();return;}
  if(a==='edit-staff'){staffModal(state.staffList.find(x=>x.id===btn.dataset.id));return;}
  if(a==='edit-hours'){await hoursModal(btn.dataset.id);return;}
  if(a==='add-timeoff'){timeOffModal(btn.dataset.id);return;}
  if(a==='delete-timeoff'){
    if(!await confirmAction('¿Eliminar este bloqueo de disponibilidad?'))return;
    await api(bapi('/time-off/'+btn.dataset.id),{method:'DELETE',body:'{}',headers:{'Content-Type':'application/json'}});
    toast('Ausencia eliminada');await renderApp();return;
  }
  if(a==='waitlist-status'){
    await post(bapi('/waitlist/'+btn.dataset.id),{status:btn.dataset.status},'PATCH');toast('Lista de espera actualizada');await renderApp();return;
  }
  if(a==='booking-status'){
    if(btn.dataset.status==='completed'&&Date.parse(btn.dataset.startsAt)>Date.now()&&!await confirmAction('Este turno todavía no comenzó. ¿Marcarlo como completado de todos modos?'))return;
    if(['cancelled','no_show'].includes(btn.dataset.status)&&!await confirmAction(btn.dataset.status==='cancelled'?'¿Querés cancelar este turno? Esta acción no se puede deshacer.':'¿Marcar este turno como ausente?'))return;
    await post(bapi('/bookings/'+btn.dataset.id),{status:btn.dataset.status},'PATCH');toast('Estado actualizado');await renderApp();return;
  }
  if(a==='booking-reschedule'){
    if(!state.staffList)state.staffList=await api(bapi('/staff'));
    rescheduleModal(btn.dataset.id);return;
  }
  if(a==='customer-booking'){await bookingModal(state.customers.find(c=>c.id===btn.dataset.id));return;}
  if(a==='customer-fixed'){const c=state.customers.find(c=>c.id===btn.dataset.id);await recurringModal(null,c);return;}
  if(a==='new-customer'){await customerModal();return;}
  if(a==='edit-customer'){await customerModal(btn.dataset.id);return;}
  if(a==='settings-tab'){state.settingsTab=btn.dataset.id;await renderApp();return;}
  if(a==='export'){const link=document.createElement('a');let blobUrl;if(window.ATRY_CLOUD||window.ATRY_DEMO?.enabled){const csv=await api(bapi('/export/bookings'));blobUrl=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));link.href=blobUrl;}else link.href=bapi('/export/bookings');link.download='atry-turnos-reservas.csv';document.body.append(link);link.click();link.remove();if(blobUrl)setTimeout(()=>URL.revokeObjectURL(blobUrl),1000);return;}
  if(a==='admin-edit'){adminModal(btn);return;}
 }catch(err){toast(err.message,true);}
}
async function onChange(e){
 try{
  if(e.target.id==='public-date'){state.date=e.target.value;state.slot='';await loadSlots();await publicView(state.public.business.slug);}
  if(e.target.id==='business-switch'){ATRY_APPEARANCE.apply(null);readCache.clear();warmNavigationKey='';disconnectAgendaEvents();if(!window.ATRY_DEMO?.enabled)localStorage.setItem('atry_biz',e.target.value);state.business=null;state.screen=null;state.agendaStaff='';state.staffList=[];state.currentBookings=[];await renderApp();}
  if(e.target.id==='agenda-mode'){state.agendaMode=e.target.value;await renderApp();}
  if(e.target.id==='agenda-staff'){state.agendaStaff=e.target.value;await renderApp();}
  if(e.target.id==='agenda-date'){state.dateAgenda=e.target.value;await renderApp();}
 }catch(err){toast(err.message,true);}
}
async function router(){
 const route=path();state.dialog=null;document.title='Atry Turnos | Gestión de reservas';
 if(!route.startsWith('/app')&&!route.startsWith('/reservar/'))ATRY_APPEARANCE.apply(null);
 const initial=!!root.querySelector('.boot');
 if(initial)loading();
 // Keep the current screen in place during navigation; avoid a flash for fast reads.
 const authSwap=['/login','/registro'].includes(route)&&root.querySelector('.auth-shell[data-auth-mode]');
 const progress=initial||authSwap?null:setTimeout(()=>document.body.classList.add('route-pending'),250);
 root.setAttribute('aria-busy','true');
 root.inert=true;
 setMenu(false);
 try{
  if(route.startsWith('/oferta/')){await offerView(route.split('/')[2]);return;}
  if(route.startsWith('/invitacion/')){await invitationView(route.split('/')[2]);return;}
  if(route==='/cuenta-nueva'){accountRegistrationView();return;}
  if(route==='/cuenta'){await viewAccount();return;}
  if(route.startsWith('/reservar/')){await publicView(route.split('/')[2]);return;}
  if(route.startsWith('/gestionar/')){await manageView(route.split('/')[2]);return;}
  if(route==='/recuperar'){recoveryView();return;}
  if(route.startsWith('/restablecer/')){recoveryView(route.split('/')[2]);return;}
  if(route==='/login'){if(state.me){nav(state.me.user.platform_admin?'/admin':'/app');return;}await authView(false);return;}
  if(route==='/registro'){await authView(true);return;}
  if(route==='/admin'||route.startsWith('/admin/')){await adminView();return;}
  if(route==='/app'||route.startsWith('/app/')){state.appView=route.split('/')[2]||'inicio';if(state.appView==='configuracion'&&route.split('/')[3])state.settingsTab=route.split('/')[3];await renderApp();return;}
  if(state.me){nav(state.me.user.platform_admin?'/admin':'/app');}else await authView(false);
 }catch(err){toast(err.message,true);if(err.status===401){state.me=null;nav('/login');}else page(`<div class="closing"><h2>No pudimos cargar esta pantalla</h2><p>${esc(err.message)}</p><button class="btn" data-action="reload-page">Reintentar</button></div>`);}
 finally{clearTimeout(progress);document.body.classList.remove('route-pending');root.removeAttribute('aria-busy');root.inert=false;}
}
async function boot(){
 window.addEventListener('atry-cloud-signed-out',()=>{ATRY_APPEARANCE.apply(null);readCache.clear();disconnectAgendaEvents();state.me=null;state.business=null;state.businesses=[];state.dialog=null;state.slots=[];state.public=null;nav('/login');});
 window.addEventListener('hashchange',router);
 document.addEventListener('submit',onSubmit);document.addEventListener('click',onClick);document.addEventListener('change',onChange);
 document.addEventListener('input',e=>{if(e.target.closest('form[data-form]'))e.target.closest('form').dataset.dirty='true';});
 window.addEventListener('beforeunload',e=>{if(document.querySelector('form[data-dirty="true"]')){e.preventDefault();e.returnValue='';}});
 document.addEventListener('keydown',e=>{const modal=$('.modal');if(!modal||document.querySelector('dialog[open]'))return;if(e.key==='Escape'){e.preventDefault();modal.querySelector('[data-action="close-modal"]')?.click();}if(e.key==='Tab'){const focusable=[...modal.querySelectorAll('a,button,input,select,textarea')].filter(x=>!x.disabled&&x.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
 try{state.me=await api('/api/auth/me');state.businesses=state.me.businesses;}catch{state.me=null;}
 try{state.config=await api('/api/config');}catch{state.config={mail_provider:'disabled'};}
 if(window.ATRY_CLOUD&&state.me?.user){
  const flow=new URL(location.href).searchParams.get('auth_flow');
  if(flow==='signup'||flow==='email_change'){
   const saved=localStorage.getItem('atry_return_to');localStorage.removeItem('atry_return_to');
   const destination=/^\/invitacion\/[A-Za-z0-9_-]{32,100}$/.test(saved||'')?saved:state.businesses.length?'/app/inicio':'/app/cuenta';
   history.replaceState(null,'',location.pathname+'#'+destination);
  }
 }
 await router();
 if(window.ATRY_CONFIG?.backend!=='preview'&&'serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
async function offerView(token){
 const x=await api('/api/offers/'+token);
 page(`<div class="recovery-shell"><div class="card auth-form">${brand()}<h1>Hay un horario disponible</h1><h2>${esc(x.business_name)}</h2><p>${esc(x.service_name)} · ${dateLocal(x.starts_at)}</p><p class="muted small">La oferta vence el ${dateLocal(x.expires_at)}. El horario no está retenido y se comprueba al confirmar.</p><form data-form="accept-offer" data-token="${esc(token)}"><label class="checkline"><input type="checkbox" name="accept_policy" required> Acepto las políticas de reserva del negocio.</label><button class="btn">Confirmar reserva</button></form></div></div>`);
}
async function viewSmartSlots(){
 const date=state.smartDate||plusDate(today(),1);const x=await api(bapi('/smartslots?date='+date));
 setScreen(`${headerTitle('Horarios disponibles','Alternativas reales para aprovechar la disponibilidad.')}<form data-form="smart-date" class="actions" style="margin-bottom:20px">${field('date','Fecha',date,'date','required')}<button class="btn">Buscar horarios</button></form><p class="muted small">${esc(x.method)}. No retienen horarios ni mueven reservas. La disponibilidad se vuelve a validar al confirmar.</p><div class="grid3">${x.suggestions.length?x.suggestions.map(a=>`<div class="card"><h3>${esc(a.service_name)}</h3><strong>${a.time}</strong><p class="muted">${esc(a.staff_name)}</p><a class="btn secondary" href="#/reservar/${esc(state.business.slug)}">Abrir reservas</a></div>`).join(''):empty('No hay alternativas para ese día.')}</div>`, 'Horarios disponibles');
}
function recoveryView(token=''){

 page(`<div class="recovery-shell"><div class="card auth-form">${brand()}<h1>${token?'Nueva contraseña':'Recuperar acceso'}</h1><p class="muted">${token?(window.ATRY_CLOUD?'Abrí el enlace de recuperación desde el mismo navegador. Los enlaces vencidos requieren una nueva solicitud.':'El enlace vence a los 30 minutos y se usa una sola vez.'):(window.ATRY_CLOUD?'Si tu cuenta existe, recibirás instrucciones para recuperar el acceso.':'Registraremos la solicitud. El envío de correo está pendiente de conectar un proveedor.')}</p><form data-form="${token?'reset-password':'forgot-password'}" data-token="${esc(token)}">${token?field('password','Nueva contraseña','','password','required minlength="10" maxlength="128" autocomplete="new-password"'):field('email','Correo electrónico','','email','required autocomplete="email"')}<button class="btn full">${token?'Guardar contraseña':'Solicitar recuperación'}</button></form><a class="recovery-link" href="#/login">Volver al acceso</a></div></div>`);
}
function verificationView(email){page(`<div class="recovery-shell"><div class="card auth-form">${brand()}<h1>Revisá tu correo</h1><p>El registro necesita verificar <strong>${esc(email)}</strong>.</p><p class="muted">Abrí el enlace desde el mismo navegador. Si ya tenés una cuenta, podés iniciar sesión. La cuenta no podrá operar hasta completar la verificación.</p><a class="btn full" href="#/login">Volver al acceso</a></div></div>`);}
// Wait for every deferred feature module before selecting a route.
if(document.readyState==='complete')boot();else window.addEventListener('DOMContentLoaded',boot,{once:true});
