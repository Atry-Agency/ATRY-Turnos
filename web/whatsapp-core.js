(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AtryWhatsApp=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const templates={confirmation:'Hola {cliente}, tu reserva en {negocio} está confirmada.\n{servicio} con {profesional}\n{fecha} a las {hora} · {duracion} min\n{direccion}',reminder:'Hola {cliente}, te recordamos tu turno en {negocio}.\n{servicio} con {profesional}, el {fecha} a las {hora}.\n¡Te esperamos!',reschedule:'Hola {cliente}, cambiamos tu turno de {servicio} en {negocio}.\nAntes: {fecha_anterior} a las {hora_anterior}.\nAhora: {fecha} a las {hora}, con {profesional}.\n¿Nos confirmás si podés asistir?',cancellation:'Hola {cliente}, tu turno de {servicio} del {fecha} a las {hora} en {negocio} fue cancelado.\nPodemos coordinar uno nuevo: {enlace}',request:'Hola {cliente}, ¿podés confirmar tu asistencia a {servicio} con {profesional}, el {fecha} a las {hora} en {negocio}?\n¡Gracias!',free:'Hola {cliente}, te escribimos de {negocio}.'};
 Object.assign(templates,{
 confirmation:'Hola {cliente}, tu reserva quedó confirmada.\n\nServicio: {servicio}\nFecha: {fecha}\nHora: {hora}\nProfesional: {profesional}\nDuración: {duracion} min\n\nTe esperamos en {negocio}.\n{direccion}',
 reminder:'Hola {cliente}, te recordamos tu próxima reserva.\n\nServicio: {servicio}\nFecha: {fecha}\nHora: {hora}\nProfesional: {profesional}\n\n¡Te esperamos en {negocio}!',
 reschedule:'Hola {cliente}, actualizamos el horario de tu reserva en {negocio}.\n\nServicio: {servicio}\nAntes: {fecha_anterior}, {hora_anterior}\nNueva fecha: {fecha}\nNueva hora: {hora}\nProfesional: {profesional}\n\n¿Nos confirmás si este nuevo horario te sirve?',
 cancellation:'Hola {cliente}, te avisamos que esta reserva fue cancelada.\n\nServicio: {servicio}\nFecha: {fecha}\nHora: {hora}\nProfesional: {profesional}\nNegocio: {negocio}\n\nSi querés coordinar otro momento, escribinos o elegí una nueva reserva:\n{enlace}',
 request:'Hola {cliente}, ¿nos confirmás si vas a poder asistir?\n\nServicio: {servicio}\nFecha: {fecha}\nHora: {hora}\nProfesional: {profesional}\n\nTe esperamos en {negocio}. ¡Gracias!',
 free:'Hola {cliente}, ¿cómo estás?\nTe escribimos de {negocio}.\n\n'
 });
 const labels={confirmation:'Confirmación de reserva',reminder:'Recordatorio',reschedule:'Cambio de horario',cancellation:'Cancelación',request:'Solicitar confirmación',free:'Mensaje libre'};
 const variables=['cliente','negocio','profesional','servicio','fecha','hora','duracion','direccion','fecha_anterior','hora_anterior','enlace'];
 const limits=plan=>({individual:2,negocio:10,pro:100})[plan]??2;
 function phone(value,country='598'){
  let raw=String(value||'').trim();if(!raw)return '';
  if(!/^[+\d\s().-]+$/.test(raw))throw Error('Revisá el número de teléfono.');
  let digits=raw.replace(/\D/g,'');const international=raw.startsWith('+')||raw.startsWith('00');if(raw.startsWith('00'))digits=digits.slice(2);
  country=String(country).replace(/^\+/,'');if(!/^\d{1,3}$/.test(country))throw Error('Código internacional inválido.');
  if(!international){if(country==='598'&&digits.startsWith('0'))digits=digits.slice(1);if(!(country==='598'&&digits.startsWith('598')&&digits.length===11))digits=country+digits;}
  if(!/^[1-9]\d{6,14}$/.test(digits)||(digits.startsWith('598')&&digits.length!==11))throw Error('Usá un teléfono válido con código internacional.');return digits;
 }
 function validateText(text){if(typeof text!=='string'||!text.trim()||text.length>3000)throw Error('El texto debe tener entre 1 y 3000 caracteres.');for(const match of text.matchAll(/\{([^{}]+)\}/g))if(!variables.includes(match[1]))throw Error('Variable desconocida: '+match[1]);if(/[{}]/.test(text.replace(/\{[^{}]+\}/g,'')))throw Error('Revisá las variables entre llaves.');return text;}
 function settings(input={},plan='individual'){
  const country=String(input.country||'598').replace(/^\+/,'');if(!/^\d{1,3}$/.test(country))throw Error('Código internacional inválido.');
  const custom=Array.isArray(input.custom)?input.custom:[];if(custom.length>limits(plan))throw Error('Tu plan permite hasta '+limits(plan)+' plantillas propias.');
  const ids=new Set();const clean=custom.map((t,i)=>{const id=String(t.id||'custom_'+i);if(!/^custom_[a-zA-Z0-9_-]{1,50}$/.test(id)||ids.has(id))throw Error('Identificador de plantilla inválido.');ids.add(id);const name=String(t.name||'').trim();if(!name||name.length>80)throw Error('Nombre de plantilla inválido.');return {id,name,text:validateText(t.text)};});
  const overrides={};for(const key of Object.keys(templates))if(input.templates?.[key])overrides[key]=validateText(input.templates[key]);
  const hours=Number(input.reminder_hours??24);if(!Number.isInteger(hours)||hours<1||hours>168)throw Error('Recordatorios: elegí entre 1 y 168 horas.');
  const name=String(input.name||'').trim();if(name.length>100)throw Error('Nombre comercial demasiado largo.');
  const normalized=phone(input.phone||'',country);return {enabled:input.enabled===true,country,phone:normalized?'+'+normalized:'',name,reminders:input.reminders!==false,reminder_hours:hours,templates:overrides,custom:clean};
 }
 function effective(config,plan){return {...config,custom:(config.custom||[]).slice(0,limits(plan))};}
 function context(business,customer,booking,previous,base){
  const format=(iso,opts)=>iso&&Number.isFinite(Date.parse(iso))?new Intl.DateTimeFormat('es-UY',{timeZone:business.timezone||'America/Montevideo',...opts}).format(new Date(iso)):'';
  return {cliente:customer.name||booking?.customer_name||'',negocio:business.name||'',profesional:booking?.staff_name||'',servicio:booking?.service_name||'',fecha:format(booking?.starts_at,{day:'numeric',month:'long',year:'numeric'}),hora:format(booking?.starts_at,{hour:'2-digit',minute:'2-digit',hour12:false}),duracion:booking?String(Math.round((Date.parse(booking.ends_at)-Date.parse(booking.starts_at))/60000)):'',direccion:business.address||'',fecha_anterior:format(previous,{day:'numeric',month:'long',year:'numeric'}),hora_anterior:format(previous,{hour:'2-digit',minute:'2-digit',hour12:false}),enlace:new URL('/#/reservar/'+encodeURIComponent(business.slug),base||'https://atryturnos.com').href};
 }
 function render(text,values){validateText(text);return text.replace(/\{([^{}]+)\}/g,(_,key)=>{if(values[key]===undefined||values[key]===''&& !['direccion'].includes(key))throw Error('Falta información real para '+key+'. Elegí otra plantilla.');return String(values[key]);}).replace(/\n{3,}/g,'\n\n').trim();}
 function link(number,message){if(!/^[1-9]\d{6,14}$/.test(number))throw Error('Teléfono internacional inválido.');if(typeof message!=='string'||message.length>3000)throw Error('Mensaje demasiado largo.');return 'https://wa.me/'+number+'?text='+encodeURIComponent(message);}
 return {templates,labels,variables,limits,phone,settings,effective,context,render,link};
});
