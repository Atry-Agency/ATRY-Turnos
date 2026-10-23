'use strict';
document.documentElement.classList.add('js');
// iOS Home Screen uses a separate viewport from the Safari tab.
document.documentElement.classList.toggle('ios-standalone',navigator.standalone===true||matchMedia('(display-mode: standalone)').matches);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
if('IntersectionObserver' in window&&!reduced){const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('seen');observer.unobserve(e.target);}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(e=>observer.observe(e));}else document.querySelectorAll('.reveal').forEach(e=>e.classList.add('seen'));
const screens={panel:{label:'INICIO',alt:'Panel real con próximos turnos y actividad semanal del negocio',caption:'Próximos turnos y actividad del negocio. Una primera mirada para saber por dónde empezar. Resumen y estadísticas desde Negocio.'},agenda:{label:'AGENDA',alt:'Agenda real de ATRY Turnos con horarios, profesionales y estados de las reservas',caption:'Día, semana y mes. Encontrá cada turno y filtrá por profesional según tu plan. Los horarios disponibles se comprueban al reservar.'},reservas:{label:'RESERVAS',alt:'Página real de reservas con selección de servicios para una visita',caption:'El cliente elige sus servicios. Si habilitás visitas combinadas, ATRY busca un recorrido completo con profesionales disponibles.'}};
let screenRequest=0;
async function chooseScreen(button){
 const key=button.dataset.screen,s=screens[key];if(!s)return;
 const request=++screenRequest,url='./assets/landing/'+key+'.webp',image=document.querySelector('[data-screen-image]'),panel=document.querySelector('#screen-panel');
 document.querySelectorAll('[data-screen]').forEach(b=>{const active=b===button;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
 panel.setAttribute('aria-labelledby',button.id);panel.setAttribute('aria-busy','true');
 try{const next=new Image();next.src=url;await next.decode();if(request!==screenRequest)return;
 image.src=url;image.alt=s.alt;document.querySelector('[data-screen-full]').href=url;
 document.querySelector('[data-screen-label]').textContent='ATRY TURNOS / '+s.label;
 document.querySelector('[data-screen-caption]').textContent=s.caption;
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&image.animate)image.animate([{opacity:.35,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});
 }catch{if(request===screenRequest)document.querySelector('[data-screen-caption]').textContent='No pudimos cargar esta captura. Seguís viendo la anterior; podés intentar de nuevo.';}
 finally{if(request===screenRequest)panel.setAttribute('aria-busy','false');}
}
document.querySelectorAll('[data-screen]').forEach((button,index,buttons)=>{button.addEventListener('click',()=>chooseScreen(button));button.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const i=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[i].focus();chooseScreen(buttons[i]);});});
screens.comunicacion={label:'COMUNICACIÓN',alt:'Bandeja real de recordatorios por WhatsApp con pendientes, pospuestos y gestionados; datos ficticios',caption:'Prepará mensajes desde una reserva y organizá sus recordatorios. El envío es manual desde WhatsApp; estos estados no confirman entrega ni lectura.'};
const demos={1:{name:'Individual',title:'Tu oficio.<br>Tu propia agenda.',description:'Probá un espacio para trabajar por tu cuenta. Sin controles de equipo que no necesitás.',tasks:['Creá un turno de prueba.','Organizá tus horarios y servicios.','Conocé la ficha y el historial de un cliente.']},2:{name:'Negocio',title:'Tu equipo.<br>Una misma agenda.',description:'Recorré un negocio con tres profesionales. Filtrá sus agendas, editá un servicio y mirá cómo se organiza una visita.',tasks:['Creá un turno de prueba.','Explorá la lista de espera y los turnos fijos.','Abrí el enlace de reservas de tu negocio.']},3:{name:'Pro',title:'Más herramientas.<br>Más perspectiva.',description:'Explorá una operación con cinco profesionales y herramientas para necesidades más amplias.',tasks:['Explorá recursos compartidos.','Conocé las estadísticas y oportunidades de agenda.','Probá las opciones avanzadas de apariencia.']}};
document.querySelectorAll('[data-demo-plan]').forEach(button=>button.addEventListener('click',()=>{const n=button.dataset.demoPlan,d=demos[n];document.querySelectorAll('[data-demo-plan]').forEach(b=>b.setAttribute('aria-pressed',b===button));document.querySelector('[data-demo-tag]').textContent='DEMO / '+d.name.toLocaleUpperCase('es');document.querySelector('[data-demo-title]').innerHTML=d.title;document.querySelector('[data-demo-description]').textContent=d.description;document.querySelector('[data-demo-tasks]').replaceChildren(...d.tasks.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));const a=document.querySelector('[data-demo-link]');a.href='./?demo=1&plan='+n+'#/app/inicio';a.setAttribute('aria-label','Probar '+d.name+' sin cuenta');a.innerHTML='Probar sin cuenta <span>'+marketingIcon('arrow')+'</span>';}));
document.querySelector('[data-year]').textContent=new Date().getFullYear();
/* Consistent line icons instead of platform-dependent text glyphs. */
const marketingPaths={arrow:'M7 17 17 7M7 7h10v10',down:'M12 4v16m-6-6 6 6 6-6',calendar:'M8 3v4m8-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2',route:'M5 5h6a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h10M5 2v6m11 10 3 3-3 3',palette:'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.7h2a4 4 0 0 0 4-4C21 6 17 3 12 3ZM7 9h.01M11 6h.01M16 7h.01'};
function marketingIcon(key){return '<svg class="marketing-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+marketingPaths[key]+'"/></svg>';}
function polishIcons(scope=document.body){
 const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT),nodes=[];
 while(walker.nextNode())if(/[↗↓]/.test(walker.currentNode.nodeValue))nodes.push(walker.currentNode);
 for(const text of nodes){const fragment=document.createDocumentFragment();for(const part of text.nodeValue.split(/([↗↓])/)){if(part==='↗'||part==='↓'){const holder=document.createElement('span');holder.innerHTML=marketingIcon(part==='↗'?'arrow':'down');fragment.append(holder.firstChild);}else fragment.append(document.createTextNode(part));}text.replaceWith(fragment);}
}
polishIcons();
document.querySelectorAll('.features article').forEach((article,i)=>{const icon=document.createElement('div');icon.className='feature-icon';icon.innerHTML=marketingIcon(['calendar','route','palette'][i]);article.prepend(icon);});
document.querySelectorAll('[data-demo-plan]').forEach(button=>button.addEventListener('click',()=>polishIcons(document.querySelector('.demo-detail'))));
const brandPalettes={atry:{side:'#4754e6',accent:'#4754e6',bg:'#f6f6fb',card:'#ffffff',ink:'#202430',muted:'#6c7181',soft:'#eeeefe',line:'#dedfea',sideInk:'#ffffff',note:'La identidad original de ATRY. Clara, violeta y lista para empezar.'},rosa:{side:'#ed80a6',accent:'#a44b6d',bg:'#fcf5fa',card:'#fff0f1',ink:'#252430',muted:'#826b7b',soft:'#fbe0e9',line:'#ebd8e0',sideInk:'#35212b',note:'Rosa, con carácter. Una presencia cálida para un espacio que cuida.'},salvia:{side:'#6c8e7d',accent:'#3f6a57',bg:'#f4f8f3',card:'#fcfdf8',ink:'#26382f',muted:'#6a7c71',soft:'#e3ede3',line:'#d5e2d5',sideInk:'#ffffff',note:'Salvia, en equilibrio. Frescura y calma en una misma composición.'},arena:{side:'#b59375',accent:'#815e43',bg:'#fbf7f0',card:'#fffdf8',ink:'#382d26',muted:'#857365',soft:'#f2e6d7',line:'#e7dac9',sideInk:'#251e18',note:'Arena, sin apuro. Tonos cálidos y detalles que dejan respirar.'}};
const brandLab=document.querySelector('[data-identity-lab]');
document.querySelectorAll('[data-brand-palette]').forEach(button=>button.addEventListener('click',()=>{const palette=brandPalettes[button.dataset.brandPalette];for(const [key,value]of Object.entries(palette)){if(key==='note')continue;brandLab.style.setProperty('--lab-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value);}document.querySelectorAll('[data-brand-palette]').forEach(b=>b.setAttribute('aria-pressed',b===button));document.querySelector('[data-brand-palette-note]').textContent=palette.note;sendShowcaseTheme();}));
document.querySelector('[data-brand-name]').addEventListener('input',e=>{const name=e.target.value.trim()||'Tu estudio';clearTimeout(showcaseNameTimer);showcaseNameTimer=setTimeout(sendShowcaseTheme,250);});

// Both frames run the same product and theme engine as the independent demos.
let showcaseNameTimer,phoneView='reservas';
const showcaseFrames=[...document.querySelectorAll('[data-showcase-frame]')];
function showcasePayload(frame){
 const key=document.querySelector('[data-brand-palette][aria-pressed="true"]').dataset.brandPalette,p=brandPalettes[key];
 return {type:'atry-showcase-theme',name:document.querySelector('[data-brand-name]').value.trim()||'Tu estudio',view:frame.dataset.showcaseFrame==='panel'?'panel':phoneView,theme_config:{version:1,primary:key==='atry'?'#4754E6':p.accent,secondary:'#00A5E2',mode:'light',radius:'round',font:'atry',cards:'elevated',density:'comfortable',buttons:'solid',agenda:'soft',public_mode:'inherit',public_layout:'calm',...(key==='atry'?{}:{sidebar:p.side,background:p.bg,surface:p.card})}};
}
function sendShowcaseTheme(){updateShowcaseLinks();for(const frame of showcaseFrames)if(frame.dataset.ready==='true')frame.contentWindow.postMessage(showcasePayload(frame),location.origin);}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin)return;
 const frame=showcaseFrames.find(f=>f.contentWindow===event.source);if(!frame)return;
 if(event.data?.type==='atry-showcase-ready'){frame.dataset.ready='true';frame.contentWindow.postMessage(showcasePayload(frame),location.origin);}
 if(event.data?.type==='atry-showcase-applied')frame.dataset.applied='true';
 if(event.data?.type==='atry-showcase-error')frame.dataset.applied='false';
});
document.querySelectorAll('[data-phone-view]').forEach(button=>button.addEventListener('click',()=>{phoneView=button.dataset.phoneView;document.querySelectorAll('[data-phone-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));sendShowcaseTheme();}));
const previewSizer=new ResizeObserver(entries=>{for(const {target,contentRect} of entries){const frame=target.querySelector('iframe'),width=Number(target.dataset.realViewport),scale=contentRect.width/width;frame.style.width=width+'px';frame.style.height=(contentRect.height/scale)+'px';frame.style.transform='scale('+scale+')';}});
document.querySelectorAll('[data-real-viewport]').forEach(el=>previewSizer.observe(el));
function loadShowcase(){for(const frame of showcaseFrames)if(!frame.getAttribute('src'))frame.src=frame.dataset.src;}
if('IntersectionObserver'in window){const previewLoader=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){loadShowcase();previewLoader.disconnect();}},{rootMargin:'500px'});previewLoader.observe(brandLab);}else loadShowcase();

function updateShowcaseLinks(){
 const sample=showcasePayload(showcaseFrames[0]);
 for(const link of document.querySelectorAll('[data-showcase-open]')){
  const view=link.dataset.showcaseOpen==='panel'?'panel':phoneView,url=new URL('./',location.href);
  url.search=new URLSearchParams({demo:'1',plan:'3',demo_name:sample.name,demo_theme:JSON.stringify(sample.theme_config)}).toString();
  url.hash=view==='panel'?'/app/inicio':'/reservar/demo-negocioplan3';link.href=url.href;
  link.setAttribute('aria-label','Abrir '+(view==='panel'?'el panel':'las reservas')+' de demostración en una pestaña nueva');
 }
}
document.querySelectorAll('[data-showcase-open]').forEach(link=>link.addEventListener('click',updateShowcaseLinks));
updateShowcaseLinks();

// Same pure template renderer as the product. No phone number, send link or API.
const messageValues={cliente:'Paula Suárez',negocio:'Estudio Aurora',profesional:'Lucía Fernández',servicio:'Coloración y brushing',fecha:'24 de octubre',hora:'10:00',duracion:'60',direccion:'',fecha_anterior:'23 de octubre',hora_anterior:'14:00',enlace:'[enlace de reservas del negocio]'};
function renderMessageExample(key){
 const core=window.AtryWhatsApp;if(!core||!core.templates[key])return;
 const text=key==='free'?core.templates.free+'¿Querés que coordinemos tu próxima visita?':core.templates[key];
 const output=document.querySelector('[data-message-output]');output.textContent=core.render(text,messageValues);
 document.querySelector('[data-message-label]').textContent=core.labels[key]+' · mensaje preparado';
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&output.animate)output.animate([{opacity:.4,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'});
}
document.querySelectorAll('[data-message]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-message]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderMessageExample(button.dataset.message);
}));
renderMessageExample('reminder');
// If motion preference changes mid-visit, revealed content must remain visible.
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{if(event.matches)document.querySelectorAll('.reveal').forEach(el=>el.classList.add('seen'));});
