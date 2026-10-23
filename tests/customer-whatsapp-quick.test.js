'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('web/whatsapp.js','utf8');
test('Clientes: acceso circular sin texto visible reutiliza el mismo editor y su guardia',async()=>{
 const handlers={},opened=[],scope={window:{AtryWhatsApp:require('../web/whatsapp-core'),open(){assert.fail('El acceso rápido no debe abrir WhatsApp directamente');}},iconPaths:{},Map,document:{addEventListener:(name,fn)=>handlers[name]=fn},esc:x=>String(x).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),toast:message=>assert.fail(message)};
 vm.createContext(scope);vm.runInContext(source,scope);
 const html=scope.waCustomerQuick({id:'customer1',name:'Claudia Llorente',phone:''});
 assert.match(html,/class="wa-customer-quick"/);assert.match(html,/data-wa-customer="customer1"/);assert.match(html,/aria-label="Preparar WhatsApp para Claudia Llorente"/);assert.match(html,/fill="currentColor"/);assert.ok(!html.includes('href='));assert.ok(!html.includes('class="btn'));
 assert.equal(html.replace(/<[^>]+>/g,'').trim(),'');
 scope.waCompose=async data=>opened.push(data.customerId);scope.customerBeforeContact=async()=>true;
 const target={dataset:{waCustomer:'customer1'},hasAttribute:name=>name==='data-wa-customer'};
 await handlers.click({target:{closest:()=>target},preventDefault(){}});assert.deepEqual(opened,['customer1']);
 scope.customerBeforeContact=async()=>false;await handlers.click({target:{closest:()=>target},preventDefault(){}});assert.equal(opened.length,1);
});
test('Clientes: círculo fijo de 44px, verde de marca y tres acciones existentes intactas',()=>{
 const css=fs.readFileSync('web/whatsapp.css','utf8'),app=fs.readFileSync('web/app.js','utf8');
 for(const rule of ['flex:0 0 44px','width:44px;height:44px','border-radius:50%','background:#25D366;color:#FFF',':focus-visible'])assert.ok(css.includes(rule));
 assert.ok(app.includes("${ic('calendar')} Asignar turno</button><button class=\"btn secondary sm\""));
 assert.ok(app.includes("${ic('repeat')} Turno fijo</button><button class=\"btn secondary sm\""));
 assert.ok(app.includes("${ic('users')} Ver ficha</button>${typeof waCustomerQuick==='function'?waCustomerQuick(c):''}"));
});
