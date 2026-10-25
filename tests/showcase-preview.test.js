'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const theme=require('../web/theme-core'),visits=require('../web/visit-demo');
const source=fs.readFileSync(require.resolve('../web/demo'),'utf8');
function browser(search,embedded=true){
 const scope={location:{search},URL,URLSearchParams,structuredClone,crypto,ATRY_THEME_CORE:theme,ATRY_VISIT_DEMO:visits,ATRY_WHATSAPP_DEMO:require('../web/whatsapp-demo')};
 scope.parent=embedded?{}:scope;vm.runInNewContext(source,scope);return scope.ATRY_DEMO;
}
test('Presentación: el control visual existe solo en una demo embebida explícita',()=>{
 assert.equal(browser('?demo=1&plan=3').showcase,null);
 assert.equal(browser('?showcase=1').showcase,null);
 assert.equal(browser('?demo=1&plan=3&showcase=1',false).showcase,null);
 assert.ok(browser('?demo=1&plan=3&showcase=1').showcase);
});
test('Presentación: nombre y tema quedan aislados y no alteran límites ni importes',async()=>{
 const a=browser('?demo=1&plan=3&showcase=1'),b=browser('?demo=1&plan=3&showcase=1');
 const value=a.showcase.apply({name:'Claudia Llorente',theme_config:{primary:'#A44B6D',sidebar:'#ED80A6'}});
 assert.equal(value.name,'Claudia Llorente');assert.equal(value.plan,'pro');
 const untouched=(await b.request('/api/auth/me')).businesses[0];assert.equal(untouched.name,'NegocioPlan3');
 assert.equal(untouched.theme_config.primary,'#4754E6');
 const config=await a.request('/api/config');assert.ok(config.plans.every(p=>p.price_uyu===0));
 assert.equal(config.mail_provider,'disabled');assert.equal(config.payments_live,false);
 const bookings=await a.request('/api/business/'+value.id+'/bookings?days=7');assert.ok(bookings.length>0);assert.ok(bookings.every(x=>x.customer_name&&!/Claudia Llorente|Agustina Rojas|Cliente Ejemplo/.test(x.customer_name)));assert.equal(new Set(bookings.map(x=>x.customer_id)).size,bookings.length);assert.ok(bookings.every(x=>!x.service_name.includes('barba')));
 await assert.rejects(a.request('/api/auth/register',{method:'POST',body:{}}),e=>e.status===403);
 await assert.rejects(a.request('/api/admin/businesses'),e=>e.status===403);
});
test('Presentación: no acepta estilos ejecutables ni opciones de otro plan',()=>{
 const pro=browser('?demo=1&plan=3&showcase=1');
 assert.throws(()=>pro.showcase.apply({theme_config:{primary:'url(https://invalid)'}}));
 assert.throws(()=>pro.showcase.apply({theme_config:{plan:'pro'}}));
 const solo=browser('?demo=1&plan=1&showcase=1');
 assert.throws(()=>solo.showcase.apply({theme_config:{sidebar:'#ED80A6'}}),/Pro/);
});
test('Presentación: mensajes de otro origen o ventana no pueden cambiar la demo',async()=>{
 const listeners={},parent={postMessage(){}},state={business:{},public:null};let changes=0;
 const scope={parent,location:{origin:'http://local.atry'},document:{documentElement:{dataset:{}},addEventListener(){}},state,scrollY:0,scrollTo(){},path:()=>'/app/inicio',readCache:{clear(){}},renderApp:async()=>{}};
 scope.window=scope;scope.ATRY_DEMO={showcase:{apply(){changes++;return {name:'Prueba',slug:'demo'};}}};scope.addEventListener=(name,fn)=>listeners[name]=fn;
 vm.createContext(scope);vm.runInContext(fs.readFileSync(require.resolve('../web/showcase-preview'),'utf8'),scope);scope.startShowcasePreview();
 const data={type:'atry-showcase-theme'};
 listeners.message({source:parent,origin:'https://ajeno.invalid',data});
 listeners.message({source:{},origin:'http://local.atry',data});assert.equal(changes,0);
 listeners.message({source:parent,origin:'http://local.atry',data});await Promise.resolve();assert.equal(changes,1);
});
test('Demo completa: conserva nombre y tema válidos sin cambiar otras instancias',async()=>{
 const params=new URLSearchParams({demo:'1',plan:'3',demo_name:'Estudio Aurora',demo_theme:JSON.stringify({primary:'#A44B6D',sidebar:'#ED80A6'})});
 const opened=browser('?'+params,false),plain=browser('?demo=1&plan=3',false);
 assert.equal(opened.showcase,null);
 const business=(await opened.request('/api/auth/me')).businesses[0];
 assert.equal(business.name,'Estudio Aurora');assert.equal(business.theme_config.sidebar,'#ED80A6');assert.equal(business.plan,'pro');
 assert.equal((await plain.request('/api/auth/me')).businesses[0].name,'NegocioPlan3');
 const invalid=browser('?demo=1&plan=1&demo_theme='+encodeURIComponent(JSON.stringify({sidebar:'#ED80A6'})),false);
 assert.equal((await invalid.request('/api/auth/me')).businesses[0].theme_config.sidebar,undefined);
 assert.equal(browser('?demo_theme='+params.get('demo_theme'),false).enabled,false);
});

test('Identidad: cambiar de paleta conserva reservas editadas y no vuelve a duplicar contactos',async()=>{
 const demo=browser('?demo=1&plan=3&showcase=1');const business=demo.showcase.apply({name:'Estudio Aurora',theme_config:{primary:'#4754E6'}});
 const route='/api/business/'+business.id+'/bookings?days=7';const before=await demo.request(route);
 demo.showcase.apply({name:'Tu estudio',theme_config:{primary:'#A44B6D'}});const after=await demo.request(route);
 assert.deepEqual(after.map(x=>[x.id,x.customer_id,x.service_name]),before.map(x=>[x.id,x.customer_id,x.service_name]));
 const customers=await demo.request('/api/business/'+business.id+'/customers');assert.equal(customers.length,30);assert.equal(new Set(customers.map(c=>c.name)).size,30);
});
