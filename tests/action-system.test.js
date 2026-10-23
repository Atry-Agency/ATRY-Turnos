'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),esbuild=require('esbuild');
const source=fs.readFileSync('web/app.js','utf8');
test('Inicio: próximos turnos y gráfica se apilan según espacio disponible, con filas compactas en tarjetas angostas',()=>{
 const css=fs.readFileSync('web/business-polish.css','utf8');
 assert.ok(source.includes('class="grid2 dashboard-overview"'));
 assert.ok(source.includes('class="card dashboard-upcoming"'));
 assert.ok(css.includes('.grid2.dashboard-overview{grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));'));
 assert.ok(css.includes('@container upcoming (max-width:360px)'));
 assert.ok(css.includes('.appt-row>.badge{grid-column:2;justify-self:start}'));
});
test('Cabecera móvil: altura adaptable, acciones sin apilar y copia con etiqueta accesible',()=>{
 const css=fs.readFileSync('web/business-polish.css','utf8');
 assert.ok(css.includes('.app-shell .topbar{height:auto;min-height:77px;'));
 assert.ok(css.includes('.app-shell .topbar>.actions{flex-shrink:0;flex-wrap:nowrap}'));
 assert.ok(css.includes('.app-shell .topbar>.row{flex:1;min-width:0}'));
 assert.ok(css.includes('.app-shell .topbar .btn{white-space:nowrap;flex-shrink:0}'));
 assert.ok(css.includes('@media(max-width:400px){.app-shell .topbar .desktop-label{display:none}}'));
 assert.ok(source.includes('data-action="copy-link" aria-label="Copiar enlace de reservas"'));
});
test('Agenda angosta: las acciones conservan palabras y ancho de contenido al distribuirse en filas',()=>{
 const css=fs.readFileSync('web/agenda.css','utf8');
 assert.ok(css.includes('.ag-workspace .ag-toolbar .btn{white-space:nowrap;overflow-wrap:normal}'));
 assert.ok(css.includes('.ag-toolbar>[data-action=agenda-find-time],.ag-toolbar>.ag-focus-toggle{min-width:max-content}'));
 assert.ok(css.includes('.ag-focus-toggle{flex:1 1 auto}'));
 assert.ok(css.includes('.ag-toolbar .btn[data-action=agenda-find-time]{flex:1 1 auto}'));
 assert.ok(!css.includes('.ag-focus-toggle{flex:1}'));
});
test('Visibilidad responsive: el botón base no impone display sobre menú y cierre móviles',()=>{
 const css=fs.readFileSync('web/buttons.css','utf8'),product=fs.readFileSync('web/product.css','utf8'),styles=fs.readFileSync('web/styles.css','utf8');
 assert.match(css,/:where\(\.btn\)\{display:inline-flex\}/);
 assert.doesNotMatch(css.match(/:root \.btn\{([^}]+)\}/)[1],/(?:^|;)\s*display:/);
 assert.match(styles,/\.mobile-menu\{display:none\}/);
 assert.match(product,/\.sidebar-backdrop,\.sidebar-close\{display:none\}/);
 assert.match(product,/@media\(max-width:1000px\)\{[\s\S]*?\.mobile-menu\{display:inline-flex\}/);
 assert.match(product,/@media\(max-width:1000px\)\{[\s\S]*?\.sidebar-close\{display:flex;/);
});
test('Cancelación de turnos: rojo sólido, completar verde y ausencia neutra',()=>{
 const scope={esc:String,ic:name=>`<svg class="i" data-icon="${name}"></svg>`};vm.createContext(scope);
 vm.runInContext(source.slice(source.indexOf('function bookingActions('),source.indexOf('\n',source.indexOf('function bookingActions('))),scope);
 for(const status of ['pending','confirmed']){const html=scope.bookingActions({id:'b1',status});assert.match(html,/class="btn danger booking-cancel sm"[^>]+data-status="cancelled"/);assert.ok(!html.includes('danger outline'));assert.match(html,/class="btn success sm"/);assert.match(html,/class="btn secondary sm wa-no-show"/);}
 const css=fs.readFileSync('web/buttons.css','utf8');assert.match(css,/\.btn.danger.booking-cancel\{--button-bg:var\(--atry-danger,#E51D4F\);--button-fg:#FFF/);assert.ok(css.includes('var(--atry-danger-hover,#C81240)'));assert.ok(css.includes('background:#A80F35'));assert.ok(css.includes('.btn:focus-visible'));
});
test('Visitas combinadas: ambas cancelaciones conservan sólido y confirmación',()=>{
 const visits=fs.readFileSync('web/visits.js','utf8');const controls=[...visits.matchAll(/<button[^>]+data-visit-cancel[^>]*>/g)];assert.equal(controls.length,2);for(const [html]of controls){assert.ok(html.includes('btn danger booking-cancel'));assert.ok(!html.includes('outline'));}
 assert.match(visits,/if\(btn.hasAttribute\('data-visit-cancel'\)\)\{if\(!await confirmAction/);
});
function profile({dirty=true,confirm=true,valid=true,fail=false,history=[]}={}){
 const calls=[],form={dataset:{id:'c1',...(dirty?{dirty:'true'}:{})},reportValidity:()=>valid};
 const scope={state:{customers:[{id:'c1',name:'Claudia Llorente',phone:'+59899123456',notes:'',email:''}]},document:{querySelector:()=>form},payload:()=>({name:'Claudia Llorente',phone:'+59899222222',notes:'Nueva nota',email:'',marketing_consent:'on'}),post:async(...args)=>{calls.push(args);if(fail)throw Error('Sin conexión');},bapi:x=>x,api:async()=>history,confirmAction:async()=>confirm,toast:()=>{},esc:String,field:(name)=>`<input name="${name}">`,ic:()=>'',waCustomerContact:()=>'<button data-wa-customer="c1">WhatsApp</button>',dateLocal:String,badge:()=>'',empty:String,showDialog:async(title,body)=>{scope.rendered={title,body};}};
 vm.createContext(scope);vm.runInContext(source.slice(source.indexOf('async function customerModal('),source.indexOf('function adminModal(')),scope);return {scope,form,calls};
}
test('Ficha: nombre, secciones separadas y guardado asociado al formulario al final',async()=>{
 for(const history of [[{service_name:'Corte',starts_at:'2026-10-24',staff_name:'Agustina'}],{bookings:[{service_name:'Corte',starts_at:'2026-10-24',staff_name:'Agustina'}]}]){
  const {scope}=profile({history});await scope.customerModal('c1');const {title,body}=scope.rendered;
  assert.equal(title,'Claudia Llorente');assert.ok(!title.startsWith('Cliente:'));
  const order=['Datos del cliente','aria-label="Comunicación"','aria-label="Historial de reservas"','customer-profile-actions'];
  for(let i=1;i<order.length;i++)assert.ok(body.indexOf(order[i])>body.indexOf(order[i-1]));
  assert.ok(body.includes('Corte'));assert.match(body,/type="submit" form="customer-profile-form"/);assert.match(body,/Cancelar edición/);
 }
});
test('Contacto: cancelar mantiene cambios; guardar usa los datos editados y limpia dirty',async()=>{
 const cancelled=profile({confirm:false});assert.equal(await cancelled.scope.customerBeforeContact(),false);assert.equal(cancelled.calls.length,0);assert.equal(cancelled.form.dataset.dirty,'true');
 const saved=profile();assert.equal(await saved.scope.customerBeforeContact(),true);assert.equal(saved.calls[0][1].phone,'+59899222222');assert.equal(saved.calls[0][2],'PATCH');assert.equal(saved.form.dataset.dirty,undefined);
 const clean=profile({dirty:false});assert.equal(await clean.scope.customerBeforeContact(),true);assert.equal(clean.calls.length,0);
});
test('Contacto: validación, error de red y guardado concurrente no pierden la edición',async()=>{
 const invalid=profile({valid:false});assert.equal(await invalid.scope.customerBeforeContact(),false);assert.equal(invalid.calls.length,0);assert.equal(invalid.form.dataset.dirty,'true');
 const failed=profile({fail:true});await assert.rejects(failed.scope.customerBeforeContact(),/Sin conexión/);assert.equal(failed.form.dataset.dirty,'true');assert.equal(failed.form.dataset.saving,undefined);
 const busy=profile();busy.form.dataset.saving='true';assert.equal(await busy.scope.customerBeforeContact(),false);assert.equal(busy.calls.length,0);
});
function luminance(hex){const c=hex.match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
test('Paleta funcional: contraste AA en colores definidos de éxito, peligro, advertencia y deshabilitado',()=>{
 for(const [bg,fg]of [['15803D','FFFFFF'],['166534','FFFFFF'],['14532D','FFFFFF'],['BE123C','FFFFFF'],['9F1239','FFFFFF'],['881337','FFFFFF'],['F2C94C','493500'],['FFF1F2','9F1239'],['E5E7EB','4B5563']]){const l=[luminance(bg),luminance(fg)].sort((a,b)=>b-a);assert.ok((l[0]+.05)/(l[1]+.05)>=4.5,bg+'/'+fg);}
});
test('Sistema CSS: sintaxis, carga final, iconos heredados y ausencia de imposición oscura sobre success',async()=>{
 const html=fs.readFileSync('web/index.html','utf8'),css=fs.readFileSync('web/buttons.css','utf8');assert.ok(html.lastIndexOf('buttons.css')>html.lastIndexOf('whatsapp.css'));
 for(const file of [...html.matchAll(/href="\.\/([^"?]+\.css)/g)].map(x=>x[1])){const text=fs.readFileSync('web/'+file,'utf8');const result=await esbuild.transform(text,{loader:'css'});assert.equal(result.warnings.length,0,file);
  if(file!=='buttons.css')for(const rule of text.matchAll(/([^{}]+)\{([^{}]+)\}/g))assert.ok(!(rule[1].includes('.btn.success')&&/color:[^;}]+!important/.test(rule[2])),file+' overwrites success');
 }
 for(const name of ['secondary','outline','success','danger','warning','ghost'])assert.ok(css.includes('.btn.'+name));
 assert.match(css,/\.btn svg[^}]+color:inherit/);assert.ok(css.includes('@media(pointer:coarse)'));assert.ok(css.includes('prefers-reduced-motion'));
});
