'use strict';
Object.assign(iconPaths,{
 craft:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
 nail:'<path d="M8 12V7a4 4 0 0 1 8 0v5M8 8h8M6 21v-7a6 6 0 0 1 12 0v7"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM5 4l2 3M12 2v3M19 4l-2 3"/><circle cx="12" cy="12" r="3"/>',
 thread:'<path d="M7 3h10M7 21h10M9 3v18M15 3v18M9 7h6M9 11h6M9 15h6M15 17c7 0 7-8 3-8"/>',
 wellness:'<path d="M12 21C3 17 2 10 4 5c5 0 8 3 8 8 0-5 3-8 8-8 2 5 1 12-8 16ZM12 21V10"/>'
});
function sectorIcon(sector='',service=''){
 const classify=text=>{text=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/unas|manicur|pedicur|nail/.test(text))return 'nail';
  if(/pestanas|cejas|lash|brow/.test(text))return 'eye';
  if(/modista|costura|sastr|arreglo de ropa/.test(text))return 'thread';
  if(/barber|peluquer|cabello|corte|peinado/.test(text))return 'scissors';
  if(/masaj|bienestar|spa|estetic/.test(text))return 'wellness';
  return null;
 };return classify(service)||classify(sector)||'craft';
}
function registrationWizard(){
 const sectors=['Barbería','Peluquería','Uñas y manicura','Pestañas y cejas','Modista y costura','Estética y bienestar','Otro rubro'];
 page(`<div class="auth-shell onboarding-shell"><aside class="auth-left">${brand()}<div class="auth-pitch"><span class="eyebrow">HECHO PARA TU NEGOCIO</span><div class="onboarding-orbit" aria-hidden="true">${ic('calendar')}${ic('heart')}${ic('craft')}</div><h1>Tu oficio.<br>Tu estilo.<br>Tu espacio.</h1><p>Una agenda que acompaña lo que hacés. Elegí tu rubro y dale identidad a tu negocio.</p></div><span class="small muted">Atry Turnos · Tu próximo paso empieza acá.</span></aside><main class="auth-right"><div class="auth-form"><a class="small muted" href="#/">${ic('back')} Volver al inicio</a><div class="onboarding-progress" aria-label="Progreso del registro"><span class="active">1 · Tu negocio</span><span>2 · Tu cuenta</span></div><form data-form="register" class="registration-wizard"><section data-register-step="1"><span class="eyebrow">EMPECEMOS POR LO TUYO</span><h2>¿Qué te apasiona hacer?</h2><p>Los iconos de tus servicios acompañarán tu rubro. Podés cambiarlo después en Configuración.</p>${field('business_name','Nombre de tu negocio','','text','required minlength="3" maxlength="100" autocomplete="organization"')}<fieldset class="sector-fieldset"><legend>Tipo de negocio</legend><div class="sector-grid">${sectors.map((label,i)=>`<label class="sector-option"><input type="radio" name="sector_choice" value="${esc(label)}" ${i===0?'checked':''}><span>${ic(sectorIcon(label))}<strong>${label}</strong></span></label>`).join('')}</div></fieldset><div id="custom-sector-field" hidden>${field('sector_custom','Escribí tu rubro','','text','maxlength="100"')}</div><input type="hidden" name="sector" value="Barbería"><button type="button" class="btn full" data-register-next>Continuar ${ic('arrow')}</button></section><section data-register-step="2" hidden><span class="eyebrow">TU ACCESO PERSONAL</span><h2>Un lugar para crecer.</h2><p>Creá tu cuenta para gestionar tu negocio. Vas a recibir un correo para confirmar el acceso.</p>${field('name','Tu nombre','','text','required minlength="2" maxlength="100" autocomplete="name"')}${field('email','Correo electrónico','','email','required autocomplete="email"')}${field('password','Contraseña','','password','required minlength="10" maxlength="128" autocomplete="new-password"')}<div class="hint-block">La habilitación se coordina con Atry después de registrar tu negocio. Sin cobro automático. Usá una contraseña de al menos 10 caracteres.</div><button class="btn full" type="submit">Crear mi negocio ${ic('arrow')}</button><button class="btn secondary full" type="button" data-register-back>Volver a mi negocio</button></section></form><div class="bottom">¿Ya tenés cuenta? <a href="#/login">Iniciar sesión</a></div></div></main></div>`);
 const form=document.querySelector('.registration-wizard'),steps=[...form.querySelectorAll('[data-register-step]')];
 const show=n=>{steps.forEach((step,i)=>step.hidden=i!==n-1);document.querySelectorAll('.onboarding-progress span').forEach((el,i)=>el.classList.toggle('active',i===n-1));steps[n-1].querySelector('input:not([type=hidden])')?.focus();};
 const validFirst=()=>[...steps[0].querySelectorAll('input:not([type=hidden])')].every(input=>input.disabled||input.reportValidity());
 form.querySelector('[data-register-next]').addEventListener('click',()=>{if(validFirst())show(2);});
 form.querySelector('[data-register-back]').addEventListener('click',()=>show(1));
 form.addEventListener('change',event=>{if(event.target.name!=='sector_choice'&&event.target.name!=='sector_custom')return;const custom=form.elements.sector_choice.value==='Otro rubro',input=form.elements.sector_custom;document.querySelector('#custom-sector-field').hidden=!custom;input.disabled=!custom;input.required=custom;form.elements.sector.value=custom?input.value.trim():form.elements.sector_choice.value;});
 form.elements.sector_custom.disabled=true;
 form.addEventListener('keydown',event=>{if(event.key==='Enter'&&!steps[0].hidden){event.preventDefault();if(validFirst())show(2);}});
 form.addEventListener('invalid',event=>{if(steps[0].contains(event.target))show(1);},true);
}
