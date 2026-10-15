'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{context}=require('./helpers');
test('Suscripciones: registro pendiente, activación manual, referencia única, renovación y solo lectura al vencer',async()=>{
 const t=await context();try{
  const admin=(await t.call('/api/auth/login',{data:{email:'admin.prueba@example.com',password:'AtryAdmin2026!'}})).cookie;
  const data={name:'Usuario Suscripción',business_name:'Negocio Suscripción',email:'subscription@example.com',password:'SubscriptionTest2026!',subscription_status:'active',paid_until:'2099-01-01'};
  const reg=await t.call('/api/auth/register',{data});assert.equal(reg.status,200,JSON.stringify(reg.body));const bid=reg.body.business_id,base='/api/business/'+bid;
  const cookie=(await t.call('/api/auth/login',{data})).cookie;
  assert.equal((await t.call(base,{cookie})).body.subscription_status,'pending');
  assert.equal((await t.call(base+'/services',{cookie,data:{name:'Servicio prueba',duration_min:30,price_uyu:500}})).status,403);
  const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10),payload={subscription_action:'activate',plan:'negocio',until_day:tomorrow,amount_uyu:1190,reference:'TR-001',request_id:'subscription_activate_001'};
  assert.equal((await t.call('/api/admin/businesses/'+bid,{cookie,method:'PATCH',data:payload})).status,403);
  const activate=()=>t.call('/api/admin/businesses/'+bid,{cookie:admin,method:'PATCH',data:payload});assert.equal((await activate()).status,200);assert.equal((await activate()).status,200);
  assert.equal(t.db.prepare('SELECT count(*) n FROM subscription_events WHERE business_id=?').get(bid).n,1);
  const c=await t.call(base+'/customers',{cookie,data:{name:'Cliente prueba',phone:'099555111'}});assert.equal(c.status,200);
  const renew={...payload,subscription_action:'renew',until_day:new Date(Date.now()+32*86400000).toISOString().slice(0,10),request_id:'subscription_renew_001'};
  assert.equal((await t.call('/api/admin/businesses/'+bid,{cookie:admin,method:'PATCH',data:renew})).status,409);
  assert.equal((await t.call('/api/admin/businesses/'+bid,{cookie:admin,method:'PATCH',data:{...renew,reference:'TR-002'}})).status,200);
  t.db.prepare("UPDATE businesses SET paid_until='2000-01-01T00:00:00Z' WHERE id=?").run(bid);
  assert.equal((await t.call(base+'/customers',{cookie})).status,200);
  assert.equal((await t.call(base+'/customers/'+c.body.id,{cookie,method:'PATCH',data:{notes:'Bloqueado'}})).status,403);
  assert.equal((await t.call(base,{cookie,method:'PATCH',data:{paid_until:'2099-01-01',subscription_status:'active',name:'Cambio'}})).status,403);
  const trial={subscription_action:'trial',until_day:tomorrow,note:'Prueba coordinada',request_id:'subscription_trial_001'};
  assert.equal((await t.call('/api/admin/businesses/'+bid,{cookie:admin,method:'PATCH',data:trial})).status,200);
  assert.equal((await t.call(base+'/customers/'+c.body.id,{cookie,method:'PATCH',data:{notes:'Habilitado'}})).status,200);
 }finally{await t.close();}
});
