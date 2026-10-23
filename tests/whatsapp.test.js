'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const Core=require('../web/whatsapp-core');const {connect,id,now}=require('../server/db');const {register}=require('../server/whatsapp');const {seedDemo}=require('../server/seed');
test('WhatsApp: teléfonos internacionales, Uruguay y enlaces codificados sin ejecución',()=>{
 assert.equal(Core.phone('099 123 456'),'59899123456');assert.equal(Core.phone('+54 9 11 1234 5678'),'5491112345678');assert.equal(Core.phone('00598 99 123 456'),'59899123456');assert.equal(Core.phone(''),'');for(const phone of ['javascript:1','123','+598123456789','<script>'])assert.throws(()=>Core.phone(phone));
 const message='Hola Agustina 👋\n¿Confirmás?';const url=new URL(Core.link('59899123456',message));assert.equal(url.origin,'https://wa.me');assert.equal(url.searchParams.get('text'),message);assert.throws(()=>Core.link('javascript:x','Hola'));
 const c=Core.settings({country:'54',phone:'+5491112345678'});assert.equal(Core.settings(c).phone,c.phone);
});
test('WhatsApp: plantillas sin datos ficticios, variables verificadas y límites de planes',()=>{
 assert.throws(()=>Core.render('Hola {variable_inventada}',{}));assert.throws(()=>Core.render('{fecha_anterior}',{}));assert.equal(Core.render('Hola {cliente}\n{direccion}',{cliente:'Claudia Llorente',direccion:''}),'Hola Claudia Llorente');
 for(const [plan,n]of [['individual',2],['negocio',10],['pro',100]]){const custom=Array.from({length:n},(_,i)=>({id:'custom_'+i,name:'Mensaje '+i,text:'Hola {cliente}'}));assert.equal(Core.settings({custom},plan).custom.length,n);assert.throws(()=>Core.settings({custom:[...custom,{id:'custom_extra',name:'Más',text:'Hola'}]},plan));}
});
function fixture(){
 const db=connect(':memory:');seedDemo(db);const biz=db.prepare('SELECT * FROM businesses ORDER BY created_at LIMIT 1').get(),user=db.prepare("SELECT u.* FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.business_id=? AND m.role='owner'").get(biz.id);db.prepare("UPDATE businesses SET plan='negocio' WHERE id=?").run(biz.id);biz.plan='negocio';
 const c=db.prepare('SELECT * FROM customers WHERE business_id=? LIMIT 1').get(biz.id);db.prepare("UPDATE customers SET phone='+59899123456' WHERE id=?").run(c.id);
 const b=db.prepare('SELECT * FROM bookings WHERE business_id=? LIMIT 1').get(biz.id);db.prepare("UPDATE bookings SET customer_id=?,starts_at=?,ends_at=?,status='confirmed' WHERE id=?").run(c.id,new Date(Date.now()+3600000).toISOString(),new Date(Date.now()+5400000).toISOString(),b.id);
 const routes=[];register({db,r:(method,pattern,handler)=>routes.push({method,re:new RegExp('^'+pattern+'$'),handler}),authorized:(req,bid,roles=['owner','manager'])=>{if(bid!==biz.id||!roles.includes(req.role||'owner'))throw Error('Forbidden');return {biz:db.prepare('SELECT * FROM businesses WHERE id=?').get(bid),user,role:req.role||'owner'};},record:()=>{}});
 const call=(method,path,body={},role='owner')=>{const route=routes.find(r=>r.method===method&&r.re.test('/api/business/'+biz.id+'/whatsapp'+path));assert.ok(route,path);return route.handler({req:{role},params:route.re.exec('/api/business/'+biz.id+'/whatsapp'+path).slice(1),body});};return {db,biz,c,b,call};
}
test('WhatsApp local: rechaza teléfono y revisión de reserva cambiados mientras se edita el mensaje',()=>{
 const {db,c,b,call}=fixture();try{
 call('PUT','',Core.settings({enabled:true}));call('PUT','/customer/'+c.id,{allowed:true});
 const booking=call('GET','/booking/'+b.id).booking,body={booking_id:b.id,starts_at:booking.starts_at,booking_updated_at:booking.updated_at,recipient_phone:'59899123456',kind:'reminder',state:'prepared'};
 db.prepare("UPDATE customers SET phone='+59899222222' WHERE id=?").run(c.id);
 assert.throws(()=>call('POST','/actions',body),/teléfono del cliente cambió/);
 db.prepare("UPDATE customers SET phone='+59899123456' WHERE id=?").run(c.id);
 db.prepare('UPDATE bookings SET updated_at=? WHERE id=?').run(new Date(Date.now()+1000).toISOString(),b.id);
 assert.throws(()=>call('POST','/actions',body),/datos del turno cambiaron/);
 assert.equal(db.prepare('SELECT count(*) n FROM whatsapp_actions').get().n,0);
 const fresh=call('GET','/booking/'+b.id).booking;assert.equal(fresh.manage_token,undefined);assert.equal(fresh.notes,undefined);call('POST','/actions',{...body,booking_updated_at:fresh.updated_at});
 }finally{db.close();}
});
test('WhatsApp local: consentimiento, estados de envío, pendientes sin duplicados y cambios reales',()=>{
 const {db,biz,c,b,call}=fixture();try{
 call('PUT','',Core.settings({enabled:true,phone:'+59899123456'}));
 assert.throws(()=>call('POST','/actions',{customer_id:c.id,kind:'free',state:'manual_sent'}));
 call('PUT','/customer/'+c.id,{allowed:true});
 const booking=call('GET','/booking/'+b.id).booking;const body={booking_id:b.id,starts_at:booking.starts_at,kind:'reminder'};
 for(const state of ['prepared','opened','manual_sent'])call('POST','/actions',{...body,state});assert.ok(!call('GET','/pending').some(x=>x.id===b.id));assert.throws(()=>call('POST','/actions',{...body,state:'manual_sent'}));
 const next=new Date(Date.now()+2*3600000).toISOString();db.prepare('UPDATE bookings SET starts_at=? WHERE id=?').run(next,b.id);assert.ok(call('GET','/pending').some(x=>x.id===b.id));assert.equal(call('GET','/booking/'+b.id).previous,booking.starts_at);assert.throws(()=>call('POST','/actions',{...body,state:'prepared'}));
 call('POST','/actions',{...body,starts_at:next,state:'snoozed'});assert.ok(!call('GET','/pending').some(x=>x.id===b.id));
 db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(b.id);assert.ok(!call('GET','/pending').some(x=>x.id===b.id));assert.throws(()=>call('POST','/actions',{...body,starts_at:next,state:'prepared'}));
 assert.throws(()=>call('GET','/booking/foreign'));assert.throws(()=>call('GET','/customer/foreign'));assert.throws(()=>call('PUT','',Core.settings({}),'staff'));
 for(const state of ['prepared','opened','manual_sent'])call('POST','/actions',{customer_id:c.id,kind:'free',state});
 assert.equal(db.prepare("SELECT count(*) n FROM whatsapp_actions WHERE state='delivered'").get().n,0);
 }finally{db.close();}
});
test('WhatsApp: demos por plan permanecen aisladas en memoria',()=>{
 const make=plan=>require('../web/whatsapp-demo').create({biz:{id:'b',plan},data:{customers:[],bookings:[],services:[],staff:[]},uid:id});
 for(const plan of ['individual','negocio','pro']){const a=make(plan),b=make(plan);a.handle('/api/business/b/whatsapp','PUT',Core.settings({enabled:true},plan));assert.equal(a.handle('/api/business/b/whatsapp','GET',{}).value.config.enabled,true);assert.equal(b.handle('/api/business/b/whatsapp','GET',{}).value.config.enabled,false);}
});
test('WhatsApp local: conserva plantillas al bajar de plan, guardar y volver a ampliar',()=>{
 const {db,biz,call}=fixture();try{const custom=Array.from({length:5},(_,i)=>({id:'custom_'+i,name:'Plantilla '+i,text:'Hola {cliente}'}));call('PUT','',Core.settings({custom},'negocio'));db.prepare("UPDATE businesses SET plan='individual' WHERE id=?").run(biz.id);const c=call('GET','').config;assert.equal(c.custom.length,2);call('PUT','',Core.settings(c,'individual'));assert.equal(JSON.parse(db.prepare('SELECT config FROM whatsapp_settings WHERE business_id=?').get(biz.id).config).custom.length,5);db.prepare("UPDATE businesses SET plan='negocio' WHERE id=?").run(biz.id);assert.equal(call('GET','').config.custom.length,5);}finally{db.close();}
});
test('WhatsApp local: bandeja evita consultas por cada reserva',()=>{const {db,call}=fixture();try{call('PUT','',Core.settings({enabled:true}));let queries=0;const prepare=db.prepare.bind(db);db.prepare=sql=>{queries++;return prepare(sql);};const rows=call('GET','/pending');assert.ok(Array.isArray(rows));assert.ok(queries<=3,'La cantidad de consultas no debe crecer con el número de reservas');}finally{db.close();}});
test('WhatsApp recordatorios: posponer, persistir, deshacer y gestionar sin estados de envío falsos',()=>{const {db,call,b,c}=fixture();try{call('PUT','',Core.settings({enabled:true}));const current=call('GET','/booking/'+b.id).booking,body={booking_id:b.id,starts_at:current.starts_at,kind:'reminder'};const snooze=call('POST','/actions',{...body,state:'snoozed'});assert.ok(snooze.snoozed_until);assert.ok(call('GET','/reminders').snoozed.some(x=>x.id===b.id&&x.reminder_action_id===snooze.id));assert.ok(!call('GET','/reminders').pending.some(x=>x.id===b.id));call('POST','/reminders/'+snooze.id+'/restore');assert.ok(call('GET','/reminders').pending.some(x=>x.id===b.id));assert.equal(db.prepare('SELECT state FROM whatsapp_actions WHERE id=?').get(snooze.id).state,'snoozed');call('PUT','/customer/'+c.id,{allowed:true});for(const state of ['prepared','opened'])call('POST','/actions',{...body,state});assert.ok(call('GET','/reminders').pending.some(x=>x.id===b.id));call('POST','/actions',{...body,state:'manual_sent'});assert.ok(call('GET','/reminders').managed.some(x=>x.id===b.id));assert.throws(()=>call('POST','/reminders/'+snooze.id+'/restore'));assert.throws(()=>call('POST','/reminders/foreign/restore'));}finally{db.close();}});
